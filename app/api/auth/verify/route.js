import { supabase } from '@/lib/supabase';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return Response.redirect(new URL('/login?error=invalid_token', req.url));
  }

  const { data: record } = await supabase
    .from('verification_tokens')
    .select('id, user_id, expires_at')
    .eq('token', token)
    .single();

  if (!record) {
    return Response.redirect(new URL('/login?error=invalid_token', req.url));
  }

  if (new Date(record.expires_at) < new Date()) {
    await supabase.from('verification_tokens').delete().eq('id', record.id);
    return Response.redirect(new URL('/login?error=token_expired', req.url));
  }

  await supabase.from('users').update({ email_verified: true }).eq('id', record.user_id);
  await supabase.from('verification_tokens').delete().eq('id', record.id);

  return Response.redirect(new URL('/login?verified=true', req.url));
}
