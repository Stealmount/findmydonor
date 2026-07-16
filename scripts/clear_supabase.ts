import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Order of deletion honors foreign key constraints (child tables first, parent tables last)
const TABLES_TO_CLEAR = [
  'notifications',
  'donation_log',
  'matches',
  'blood_requests',
  'requesters',
  'users',
];

async function clearSupabaseData() {
  console.log(`🔌 Connecting to Supabase: ${url}`);
  console.log(`🧹 Clearing data from ${TABLES_TO_CLEAR.length} tables in dependency order...\n`);

  for (const table of TABLES_TO_CLEAR) {
    try {
      // In Supabase/PostgREST, we must provide a filter to delete multiple rows.
      // .not('id', 'is', null) matches all existing rows safely across UUID, text, or int ID columns.
      const { error, count } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .not('id', 'is', null);

      if (error) {
        console.error(`❌ Error clearing table "${table}":`, error.message);
      } else {
        console.log(`✅ Cleared table "${table}" (${count !== null ? `${count} rows deleted` : 'success'})`);
      }
    } catch (err: any) {
      console.error(`❌ Unexpected error on table "${table}":`, err.message);
    }
  }

  console.log("\n🎉 All Supabase logs and data clearance completed!");
}

clearSupabaseData();
