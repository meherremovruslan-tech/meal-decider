import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('pantry_lists')
    .select('id, name, ingredients, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ lists: data });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (typeof name !== 'string' || !name.trim()) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  const trimmed = name.trim().slice(0, 250);

  const { count, error: countError } = await supabase
    .from('pantry_lists')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.user.id);

  if (countError) return Response.json({ error: countError.message }, { status: 500 });
  if (count >= 3) return Response.json({ error: 'Maximum 3 lists reached' }, { status: 409 });

  const { data, error } = await supabase
    .from('pantry_lists')
    .insert({ user_id: session.user.id, name: trimmed, ingredients: [] })
    .select('id, name, ingredients, created_at')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ list: data });
}
