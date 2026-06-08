import { supabase } from '@/lib/supabase';
import { createPasswordResetToken } from '@/lib/tokens';
import { sendPasswordResetEmail } from '@/lib/email';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email || !EMAIL_REGEX.test(email)) {
      return Response.json({ success: true });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { data: user } = await supabase
      .from('users')
      .select('id, email_verified')
      .eq('email', normalizedEmail)
      .single();

    if (user && user.email_verified) {
      const token = await createPasswordResetToken(user.id);
      await sendPasswordResetEmail(normalizedEmail, token);
    }

    return Response.json({ success: true });
  } catch (e) {
    console.error('Forgot password error:', e);
    return Response.json({ success: true });
  }
}
