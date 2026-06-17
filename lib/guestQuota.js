import { supabase } from './supabase';

const DAILY_LIMIT = 3;

const COLUMNS = {
  spin: ['spin_count', 'spin_date'],
  suggest: ['suggest_count', 'suggest_date'],
  recipe: ['recipe_count', 'recipe_date'],
};

// Fails closed: any Supabase error blocks the request rather than allowing it through.
export async function consumeGuestQuota(sessionId, kind) {
  const [countCol, dateCol] = COLUMNS[kind];
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('guest_sessions')
    .select(`${countCol}, ${dateCol}`)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) return { allowed: false, left: 0 };

  if (!data || data[dateCol] !== today) {
    const { error: upsertError } = await supabase
      .from('guest_sessions')
      .upsert({ session_id: sessionId, [countCol]: 1, [dateCol]: today });
    if (upsertError) return { allowed: false, left: 0 };
    return { allowed: true, left: DAILY_LIMIT - 1 };
  }

  if (data[countCol] >= DAILY_LIMIT) return { allowed: false, left: 0 };

  const newCount = data[countCol] + 1;
  const { error: updateError } = await supabase
    .from('guest_sessions')
    .update({ [countCol]: newCount })
    .eq('session_id', sessionId);
  if (updateError) return { allowed: false, left: 0 };

  return { allowed: true, left: DAILY_LIMIT - newCount };
}
