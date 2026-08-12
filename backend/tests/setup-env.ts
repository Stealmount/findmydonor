// Stub Supabase env vars before any module that requires them is loaded.
// Imported first by test files — ESM executes imports in order, so this runs
// before src/lib/supabase.ts throws on missing credentials.
//
// CRITICAL: src/lib/serverDb.ts calls dotenv.config() at import. dotenv only
// skips keys that ALREADY EXIST in process.env, so setting only VITE_* stubs
// below let .env's real SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY leak in at
// module load (serverDb.ts L7 reads process.env.SUPABASE_URL at import time).
// That silently re-enabled real Supabase calls during tests. Force-setting
// BOTH keys to stubs here blocks that: dotenv cannot overwrite them.
process.env.NODE_ENV = 'test';
// Test mode = explicit flag, not a stub-URL string. The child server (spawned
// for auth tests) checks TEST_MODE for its test-token backdoor; the stub-URL
// string would let the test-token short-circuit run WITHOUT NODE_ENV=test and
// bypass isAccountDeleted (server.ts L84). Empty keys also keep
// isSupabaseConfigured() false so nothing dials the stub host.
process.env.TEST_MODE = '1';
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
