import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGuestSessionId, attachGuestSessionCookie } from '@/lib/guestSession';
import { consumeGuestQuota } from '@/lib/guestQuota';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (session) return Response.json({ allowed: true, spinsLeft: null });

  const { sessionId, isNew } = await getGuestSessionId();
  const { allowed, left } = await consumeGuestQuota(sessionId, 'spin');

  const res = NextResponse.json({ allowed, spinsLeft: left });
  if (isNew) attachGuestSessionCookie(res, sessionId);
  return res;
}
