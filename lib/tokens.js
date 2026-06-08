import 'server-only';
import crypto from 'crypto';
import { supabase } from './supabase';

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function createVerificationToken(userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await supabase.from('verification_tokens').insert({
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
  });

  return token;
}

export async function createPasswordResetToken(userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await supabase.from('password_reset_tokens').insert({
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
  });

  return token;
}
