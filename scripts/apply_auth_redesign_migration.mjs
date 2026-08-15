/**
 * Phase 0 migration script — applies supabase_auth_redesign_migration.sql
 * plus CHECK constraint fixes for nullable phone/whatsapp_phone.
 * Run once: node scripts/apply_auth_redesign_migration.mjs
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Supabase JS client can't run raw DDL via .rpc() unless a helper function
// exists. We use the REST /rest/v1/rpc endpoint with a raw SQL exec helper,
// OR we split DDL into individual statements and call them one by one via
// the admin API. The cleanest approach with the service-role key is to POST
// directly to the Supabase SQL endpoint.

async function runSQL(sql, label) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  // Supabase doesn't expose a generic SQL RPC by default.
  // Use the management API via the pg endpoint instead.
  const mgmtUrl = process.env.SUPABASE_URL.replace(
    "https://",
    "https://api.supabase.com/v1/projects/"
  );

  // Fall back to direct pg via supabase-js rpc if a helper exists,
  // otherwise we use the database direct connection string.
  // Simplest approach that works: use supabase.rpc with a no-arg wrapper.
  // Since we can't guarantee that exists, we'll use fetch to the SQL API.
  const projectRef = process.env.SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1];
  if (!projectRef) throw new Error("Could not extract project ref from SUPABASE_URL");

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[${label}] HTTP ${res.status}: ${text}`);
  }
  console.log(`✅ ${label}`);
  return text;
}

const steps = [
  {
    label: "Add auth_method column",
    sql: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_method text;
          COMMENT ON COLUMN profiles.auth_method IS 'google | email | NULL (legacy phone)';`,
  },
  {
    label: "Add intent column",
    sql: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS intent text;
          COMMENT ON COLUMN profiles.intent IS 'donor | requester | institution — onboarding preference only';`,
  },
  {
    label: "Add onboarding_step column",
    sql: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_step text;
          COMMENT ON COLUMN profiles.onboarding_step IS 'basic | intent | complete (+ legacy contact/otp/donor-profile)';`,
  },
  {
    label: "Add notification_channel column",
    sql: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_channel text;
          COMMENT ON COLUMN profiles.notification_channel IS 'whatsapp | email | both';`,
  },
  {
    label: "Add welcome_sent_at column",
    sql: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;
          COMMENT ON COLUMN profiles.welcome_sent_at IS 'Set when the welcome message is enqueued; guards against duplicates';`,
  },
  {
    label: "Add location columns (pincode/city/district/state/area) to profiles",
    sql: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pincode text;
          ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city text;
          ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district text;
          ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state text;
          ALTER TABLE profiles ADD COLUMN IF NOT EXISTS area text;`,
  },
  {
    label: "Drop NOT NULL on phone",
    sql: `ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;`,
  },
  {
    label: "Drop NOT NULL on whatsapp_phone",
    sql: `ALTER TABLE profiles ALTER COLUMN whatsapp_phone DROP NOT NULL;`,
  },
  {
    label: "Fix profiles_phone_format CHECK to allow NULL",
    sql: `ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_format;
          ALTER TABLE profiles ADD CONSTRAINT profiles_phone_format
            CHECK (phone IS NULL OR phone ~ '^91[6-9][0-9]{9}$');`,
  },
  {
    label: "Fix profiles_whatsapp_format CHECK to allow NULL",
    sql: `ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_whatsapp_format;
          ALTER TABLE profiles ADD CONSTRAINT profiles_whatsapp_format
            CHECK (whatsapp_phone IS NULL OR whatsapp_phone ~ '^91[6-9][0-9]{9}$');`,
  },
  {
    label: "Create indexes for new columns",
    sql: `CREATE INDEX IF NOT EXISTS idx_profiles_auth_method ON profiles (auth_method);
          CREATE INDEX IF NOT EXISTS idx_profiles_pincode ON profiles (pincode);`,
  },
];

async function main() {
  console.log("🚀 Applying auth redesign migration to live Supabase...\n");
  for (const step of steps) {
    try {
      await runSQL(step.sql, step.label);
    } catch (err) {
      console.error(`❌ ${step.label}:`, err.message);
      process.exit(1);
    }
  }
  console.log("\n✅ All migration steps complete.");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
