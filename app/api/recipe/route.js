import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

const client = new Anthropic();

export async function POST(req) {
  try {
    const { meal, ingredients, filters, cuisine } = await req.json();
    if (!meal) {
      return Response.json({ error: 'No meal provided' }, { status: 400 });
    }

    const filterText = filters?.length
      ? `\nDietary requirements (ALL meals MUST comply): ${filters.join(', ')}.`
      : '';

    const cuisineText = cuisine
      ? `\nCuisine style: ${cuisine}.`
      : '';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Write a concise recipe for: ${meal}${filterText}${cuisineText}
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

    // Save to Supabase for logged-in users — fire-and-forget, don't block the response
    const { userId } = await auth();
    if (userId) {
      supabase.from('recipe_history').insert({
        user_id: userId,
        meal_name: meal,
        recipe,
        ingredients: ingredients || '',
        dietary_filters: filters || [],
        cuisine: cuisine || null,
      }).then(({ error }) => {
        if (error) console.error('History save failed:', error.message);
      });
    }

    return Response.json({ recipe });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
