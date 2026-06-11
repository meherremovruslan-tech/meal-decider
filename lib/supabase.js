import 'server-only';
import { createClient } from '@supabase/supabase-js';

const clean = (s) => s?.replace(/^﻿/, '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

export const supabase = createClient(
  clean(process.env.SUPABASE_URL),
  clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
);
