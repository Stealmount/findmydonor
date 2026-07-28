import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (typeof process !== 'undefined' ? (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) : undefined);

const supabaseAnonKey = 
  (typeof process !== 'undefined' ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY) : undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: true,
    autoRefreshToken: true,
    persistSession: true,
    flowType: 'implicit'
  }
});
