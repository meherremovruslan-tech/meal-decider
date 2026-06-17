import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('recipe_history')
    .select('id, meal_name, ingredients, dietary_filters, cuisine, recipe, video_id, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ history: data });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { meal_name, recipe, ingredients, dietary_filters, cuisine, video_id, created_at } = await req.json();
  if (!meal_name) return Response.json({ error: 'meal_name required' }, { status: 400 });

  const row = {
    user_id: session.user.id,
    meal_name,
    recipe: recipe || '',
    ingredients: ingredients || '',
    dietary_filters: dietary_filters || [],
    cuisine: cuisine || null,
    video_id: video_id || null,
  };
  // Restoring a deleted entry (undo) keeps its original date
  if (created_at && !Number.isNaN(Date.parse(created_at))) row.created_at = created_at;

  const { error } = await supabase.from('recipe_history').insert(row);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
