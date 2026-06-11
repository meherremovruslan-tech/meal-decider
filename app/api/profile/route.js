import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('users')
    .select('avatar_emoji, display_name, email, created_at, password_hash')
    .eq('id', session.user.id)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    avatar_emoji: data.avatar_emoji,
    display_name: data.display_name,
    email: data.email,
    created_at: data.created_at,
    provider: data.password_hash ? 'email' : 'google',
  });
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { display_name } = await req.json();
  if (typeof display_name !== 'string') {
    return Response.json({ error: 'display_name must be a string' }, { status: 400 });
  }

  const trimmed = display_name.trim().slice(0, 50);

  const { error } = await supabase
    .from('users')
    .update({ display_name: trimmed || null })
    .eq('id', session.user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
