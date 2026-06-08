import { supabase } from '@/lib/supabase';
import { createVerificationToken } from '@/lib/tokens';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) return Response.json({ error: 'Email required.' }, { status: 400 });

    const normalizedEmail = email.toLowerCase().trim();

    const { data: user } = await supabase
      .from('users')
      .select('id, email_verified')
      .eq('email', normalizedEmail)
      .single();

    if (!user || user.email_verified) {
      return Response.json({ success: true });
    }

    await supabase.from('verification_tokens').delete().eq('user_id', user.id);

    const token = await createVerificationToken(user.id);
    await sendVerificationEmail(normalizedEmail, token);

    return Response.json({ success: true });
  } catch (e) {
    console.error('Resend verification error:', e);
    return Response.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
