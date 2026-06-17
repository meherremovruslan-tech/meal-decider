import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getGuestSessionId, attachGuestSessionCookie } from '@/lib/guestSession';
import { consumeGuestQuota } from '@/lib/guestQuota';

const client = new Anthropic();
const ALLOWED_CUISINES = ['Asian', 'Italian', 'Turkish', 'Mexican', 'Mediterranean'];

export async function POST(req) {
  let session, guestSessionId, guestIsNew;
  try {
    session = await getServerSession(authOptions);
    if (!session) {
      ({ sessionId: guestSessionId, isNew: guestIsNew } = await getGuestSessionId());
      const { allowed } = await consumeGuestQuota(guestSessionId, 'recipe');
      if (!allowed) {
        const res = NextResponse.json({ error: 'Daily free limit reached. Sign up for unlimited recipes.' }, { status: 429 });
        if (guestIsNew) attachGuestSessionCookie(res, guestSessionId);
        return res;
      }
    }

    const { meal, ingredients, cuisine } = await req.json();
    if (!meal) {
      return Response.json({ error: 'No meal provided' }, { status: 400 });
    }

    const safeCuisines = Array.isArray(cuisine)
      ? cuisine.filter(c => ALLOWED_CUISINES.includes(c))
      : [];

    const cuisineText = safeCuisines.length
      ? `\nCuisine style: ${safeCuisines.join(', ')}.`
      : '';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Write a concise recipe for: ${meal}${cuisineText}
Available ingredients the user has: ${ingredients}

Format the recipe with these sections:
## Ingredients
(list what's needed, mark anything the user may need to buy)

## Steps
(numbered steps, keep them short and clear)

## Tips
(1-2 practical cooking tips)

Keep it practical and under 400 words.`,
      }],
    });

    const recipe = message.content[0].text;

    if (session?.user?.id) {
      const { error: historyError } = await supabase.from('recipe_history').insert({
        user_id: session.user.id,
        meal_name: meal,
        recipe,
        ingredients: ingredients || '',
        dietary_filters: [],
        cuisine: safeCuisines.length ? safeCuisines.join(',') : null,
      });
      if (historyError) console.error('History save failed:', historyError.code, historyError.message);
    }

    const res = NextResponse.json({ recipe });
    if (!session && guestIsNew) attachGuestSessionCookie(res, guestSessionId);
    return res;
  } catch (e) {
    console.error(e);
    const res = NextResponse.json({ error: e.message }, { status: 500 });
    if (!session && guestIsNew) attachGuestSessionCookie(res, guestSessionId);
    return res;
  }
}
