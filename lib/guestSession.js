import { cookies } from 'next/headers';

const COOKIE_NAME = 'guest_session_id';

export async function getGuestSessionId() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;
  return { sessionId: existing || crypto.randomUUID(), isNew: !existing };
}

export function attachGuestSessionCookie(response, sessionId) {
  response.cookies.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
}
