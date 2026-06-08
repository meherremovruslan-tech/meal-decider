import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

const DAILY_LIMIT = 3;

export async function POST() {
  // Logged-in users always allowed — no limit
  const { userId } = await auth();
  if (userId) return Response.json({ allowed: true, spinsLeft: null });

  const cookieStore = await cookies();
  let sessionId = cookieStore.get('guest_session_id')?.value;
  const isNewSession = !sessionId;
  if (isNewSession) sessionId = crypto.randomUUID();

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD UTC

  const { data } = await supabase
    .from('guest_sessions')
    .select('spin_count, spin_date')
    .eq('session_id', sessionId)
    .maybeSingle();

  let newCount;

  if (!data || data.spin_date !== today) {
    // First spin today — reset to 1
    newCount = 1;
    await supabase.from('guest_sessions').upsert({
      session_id: sessionId,
      spin_count: newCount,
      spin_date: today,
    });
  } else if (data.spin_count >= DAILY_LIMIT) {
    // Already at limit — deny without incrementing
    const res = NextResponse.json({ allowed: false, spinsLeft: 0 });
    if (isNewSession) attachSessionCookie(res, sessionId);
    return res;
  } else {
    // Increment
    newCount = data.spin_count + 1;
    await supabase
      .from('guest_sessions')
      .update({ spin_count: newCount })
      .eq('session_id', sessionId);
  }

  const res = NextResponse.json({
    allowed: true,
    spinsLeft: DAILY_LIMIT - newCount,
  });
  if (isNewSession) attachSessionCookie(res, sessionId);
  return res;
}

function attachSessionCookie(response, sessionId) {
  response.cookies.set('guest_session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
}
