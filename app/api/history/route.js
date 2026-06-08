import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('recipe_history')
    .select('id, meal_name, ingredients, dietary_filters, cuisine, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ history: data });
}

export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { meal_name, recipe, ingredients, dietary_filters, cuisine } = await req.json();
  if (!meal_name) return Response.json({ error: 'meal_name required' }, { status: 400 });

  const { error } = await supabase.from('recipe_history').insert({
    user_id: userId,
    meal_name,
    recipe: recipe || '',
    ingredients: ingredients || '',
    dietary_filters: dietary_filters || [],
    cuisine: cuisine || null,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
