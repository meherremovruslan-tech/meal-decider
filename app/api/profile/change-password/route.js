import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { current_password, new_password } = await req.json();
  if (!current_password || !new_password) {
    return Response.json({ error: 'Both passwords are required.' }, { status: 400 });
  }
  if (current_password.length > 128 || new_password.length > 128) {
    return Response.json({ error: 'Password too long.' }, { status: 400 });
  }

  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', session.user.id)
    .single();

  if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 });
  if (!user.password_hash) {
    return Response.json({ error: 'This account uses Google sign-in. Password change not available.' }, { status: 400 });
  }

  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) return Response.json({ error: 'Current password is incorrect.' }, { status: 400 });

  if (!PASSWORD_REGEX.test(new_password)) {
    return Response.json(
      { error: 'New password must be at least 8 characters with 1 uppercase letter and 1 number.' },
      { status: 400 }
    );
  }

  const password_hash = await bcrypt.hash(new_password, 12);
  const { error: updateError } = await supabase
    .from('users')
    .update({ password_hash })
    .eq('id', session.user.id);

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });
  return Response.json({ success: true });
}
