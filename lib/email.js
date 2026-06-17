import 'server-only';
import { Resend } from 'resend';
import { APP_NAME } from '@/lib/brand';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL;
const BASE_URL = process.env.NEXTAUTH_URL;

export async function sendVerificationEmail(email, token) {
  const link = `${BASE_URL}/api/auth/verify?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Verify your ${APP_NAME} account`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0f1a;color:#fff;border-radius:12px">
        <h2 style="margin-top:0">🎰 ${APP_NAME}</h2>
        <p>Thanks for signing up! Click the button below to verify your email address.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#667eea;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Verify Email</a>
        <p style="color:#888;font-size:13px">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email, token) {
  const link = `${BASE_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0f1a;color:#fff;border-radius:12px">
        <h2 style="margin-top:0">🎰 ${APP_NAME}</h2>
        <p>We received a request to reset your password. Click the button below to choose a new one.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#667eea;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Reset Password</a>
        <p style="color:#888;font-size:13px">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });
}
