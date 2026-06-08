import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { createVerificationToken } from '@/lib/tokens';
import { sendVerificationEmail } from '@/lib/email';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function POST(req) {
  try {
    const { email, password, confirmPassword } = await req.json();

    if (!email || !password || !confirmPassword) {
      return Response.json({ error: 'All fields are required.' }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(email)) {
      return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
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

    const normalizedEmail = email.toLowerCase().trim();

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      return Response.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert({ email: normalizedEmail, password_hash })
      .select('id')
      .single();

    if (insertError) throw insertError;

    const token = await createVerificationToken(user.id);
    await sendVerificationEmail(normalizedEmail, token);

    return Response.json({ success: true });
  } catch (e) {
    console.error('Register error:', e);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
