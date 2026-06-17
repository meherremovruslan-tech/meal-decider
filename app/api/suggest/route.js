import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGuestSessionId, attachGuestSessionCookie } from '@/lib/guestSession';
import { consumeGuestQuota } from '@/lib/guestQuota';

const client = new Anthropic();
const ALLOWED_CUISINES = ['Asian', 'Italian', 'Turkish', 'Mexican', 'Mediterranean'];
const ALLOWED_MEAL_TIMES = ['Breakfast', 'Lunch', 'Dinner'];

export async function POST(req) {
  let session, guestSessionId, guestIsNew;
  try {
    session = await getServerSession(authOptions);
    if (!session) {
      ({ sessionId: guestSessionId, isNew: guestIsNew } = await getGuestSessionId());
      const { allowed } = await consumeGuestQuota(guestSessionId, 'suggest');
      if (!allowed) {
        const res = NextResponse.json({ error: 'Daily free limit reached. Sign up for unlimited suggestions.' }, { status: 429 });
        if (guestIsNew) attachGuestSessionCookie(res, guestSessionId);
        return res;
      }
    }

    const { ingredients, mealTime, cuisine } = await req.json();
    if (!ingredients?.trim()) {
      return Response.json({ error: 'No ingredients provided' }, { status: 400 });
    }

    const safeCuisines = Array.isArray(cuisine)
      ? cuisine.filter(c => ALLOWED_CUISINES.includes(c))
      : [];

    const mealTimeText = ALLOWED_MEAL_TIMES.includes(mealTime)
      ? `\nMeal type: suggest only ${mealTime.toLowerCase()} meals.`
      : '';

    const cuisineText = safeCuisines.length
      ? `\nCuisine style: ${safeCuisines.join(', ')} cuisine only.`
      : '';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `I have these ingredients: ${ingredients}.${mealTimeText}${cuisineText}
Suggest exactly 6 meal names I can realistically make with some or all of these.
Return ONLY a valid JSON array of 6 short meal name strings, nothing else.
Example format: ["Meal One", "Meal Two", "Meal Three", "Meal Four", "Meal Five", "Meal Six"]`,
      }],
    });

    let text = message.content[0].text.trim();
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const meals = JSON.parse(text);

    const res = NextResponse.json({ meals });
    if (!session && guestIsNew) attachGuestSessionCookie(res, guestSessionId);
    return res;
  } catch (e) {
    console.error(e);
    const res = NextResponse.json({ error: e.message }, { status: 500 });
    if (!session && guestIsNew) attachGuestSessionCookie(res, guestSessionId);
    return res;
  }
}
