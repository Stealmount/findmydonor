import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
  console.error('Missing Supabase URL or service role key');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data: usersRes, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  console.error('Failed to list auth users:', listError.message);
  process.exit(1);
}

const authUsers = usersRes?.users ?? [];
console.log(`Found ${authUsers.length} auth user(s)`);

for (const user of authUsers) {
  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) {
    console.error(`Failed to delete auth user ${user.email ?? user.id}:`, error.message);
  } else {
    console.log(`Deleted auth user: ${user.email ?? user.id}`);
  }
}

const tables = ['notifications', 'donation_log', 'matches', 'blood_requests', 'requesters', 'users'];
for (const table of tables) {
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).not('id', 'is', null);
  if (error) {
    console.error(`Error clearing ${table}:`, error.message);
  } else {
    console.log(`Cleared ${table}: ${count ?? 0} row(s)`);
  }
}

console.log('Platform data reset complete');
