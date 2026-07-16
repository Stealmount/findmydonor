// Stub Supabase env vars before any module that requires them is loaded.
// Imported first by test files — ESM executes imports in order, so this runs
// before src/lib/supabase.ts throws on missing credentials.
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://stub.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'stub-anon-key-for-tests';
