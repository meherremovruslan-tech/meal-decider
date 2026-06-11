import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

function dedupeIngredients(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { name, ingredients } = await req.json();

  if (name === undefined && ingredients === undefined) {
    return Response.json({ error: 'name or ingredients required' }, { status: 400 });
  }

  const update = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return Response.json({ error: 'name must be a non-empty string' }, { status: 400 });
    }
    update.name = name.trim().slice(0, 30);
  }

  if (ingredients !== undefined) {
    if (!Array.isArray(ingredients) || !ingredients.every(i => typeof i === 'string')) {
      return Response.json({ error: 'ingredients must be an array of strings' }, { status: 400 });
    }
    const cleaned = ingredients.map(i => i.trim().slice(0, 40)).filter(Boolean);
    update.ingredients = dedupeIngredients(cleaned);
  }

  const { data, error } = await supabase
    .from('pantry_lists')
    .update(update)
    .eq('id', id)
    .eq('user_id', session.user.id)
    .select('id, name, ingredients, created_at')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ list: data });
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabase
    .from('pantry_lists')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id)
    .select('id');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json({ success: true });
}
