import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function POST(req) {
  try {
    const { token, password, confirmPassword } = await req.json();

    if (!token) {
      return Response.json({ error: 'Invalid reset link.' }, { status: 400 });
    }
    if (!PASSWORD_REGEX.test(password)) {
      return Response.json(
        { error: 'Password must be at least 8 characters with 1 uppercase letter and 1 number.' },
        { status: 400 }
      );
    }
    if (password !== confirmPassword) {
      return Response.json({ error: 'Passwords do not match.' }, { status: 400 });
    }

    const { data: record } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used')
      .eq('token', token)
      .single();

    if (!record || record.used) {
      return Response.json({ error: 'This reset link is invalid or has already been used.' }, { status: 400 });
    }
    if (new Date(record.expires_at) < new Date()) {
      return Response.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 12);

    await supabase.from('users').update({ password_hash }).eq('id', record.user_id);
    await supabase.from('password_reset_tokens').update({ used: true }).eq('id', record.id);
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('user_id', record.user_id)
      .neq('id', record.id);

    return Response.json({ success: true });
  } catch (e) {
    console.error('Reset password error:', e);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
