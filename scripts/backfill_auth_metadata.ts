// FindMyDonor — backfill auth metadata after the Rev 3 auth redesign (Phase 2).
//
// Run once (idempotent, safe to re-run). Effect:
//   1. Backfills profiles.auth_method from auth_profile_links.provider.
//   2. Backfills profile location (pincode/city/district/state/area) from
//      donor_profiles where the profile has no location yet.
//
// The profiles columns (auth_method, onboarding_step, notification_channel,
// welcome_sent_at, pincode, city, district, state, area) come from
// database/supabase_auth_redesign_migration.sql — apply that FIRST.
//
// Usage:
//   npx tsx scripts/backfill_auth_metadata.ts
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_URL).
import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Aborting.");
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  // ── 1. auth_method from auth_profile_links ──────────────────────────────
  // A profile may link multiple providers; prefer google > email for auth_method.
  const { data: links, error: linksErr } = await sb.from("auth_profile_links").select("profile_id, provider");
  if (linksErr) throw new Error(`auth_profile_links read failed: ${linksErr.message}`);
  if (!links || links.length === 0) console.log("No auth_profile_links rows; nothing to backfill for auth_method.");

  const methodByProfile = new Map<string, string>();
  for (const l of (links || [])) {
    const cur = methodByProfile.get(l.profile_id);
    // Priority: google > email > (any other provider)
    if (!cur || l.provider === "email" || l.provider === "google") {
      if (l.provider === "google" || (l.provider === "email" && cur !== "google")) {
        methodByProfile.set(l.profile_id, l.provider);
      }
    }
  }

  let methodUpdated = 0;
  for (const [profileId, method] of methodByProfile) {
    const { error } = await sb.from("profiles")
      .update({ auth_method: method })
      .eq("id", profileId)
      .is("auth_method", null);
    if (!error) methodUpdated += 1;
  }
  console.log(`auth_method backfilled for ${methodUpdated} profiles.`);

  // ── 2. Profile location from donor_profiles (only where profiles have none) ──
  const { data: donors } = await sb.from("donor_profiles").select(
    "profile_id, pincode, area, city, state"
  );
  let locUpdated = 0;
  for (const d of (donors || [])) {
    if (!d.profile_id || !d.pincode) continue;
    const { error } = await sb.from("profiles")
      .update({
        pincode: d.pincode,
        area: d.area ?? null,
        city: d.city ?? null,
        state: d.state ?? null,
      })
      .eq("id", d.profile_id)
      .is("pincode", null);
    if (!error) locUpdated += 1;
  }
  console.log(`Location backfilled for ${locUpdated} profiles.`);
  console.log("Done.");
}

main().catch((e) => { console.error("[backfill] failed:", e); process.exit(1); });
