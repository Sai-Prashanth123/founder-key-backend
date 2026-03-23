import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';
import logger from '@utils/logger';

// Supabase Admin client — uses service role key, bypasses RLS
// Used ONLY on the server side for verifying OAuth tokens
let supabaseAdmin: SupabaseClient;

try {
  supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  logger.info('Supabase admin client initialized');
} catch (err) {
  logger.error('Failed to initialize Supabase admin client', { error: err });
  throw err;
}

// Supabase Public client — uses anon key
// Used for generating OAuth URLs
const supabasePublic = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export { supabaseAdmin, supabasePublic };
