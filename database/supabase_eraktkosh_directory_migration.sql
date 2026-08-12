-- ============================================================
-- FindMyDonor — e-RaktKosh Directory & Sync Migration
-- Creates blood_banks, donation_camps, and eraktkosh_sync_logs tables.
-- Safe: Additive — creates new tables and indexes only.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 1. blood_banks
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blood_banks (
  id                      TEXT        PRIMARY KEY,
  eraktkosh_id            TEXT        UNIQUE,
  name                    TEXT        NOT NULL,
  category                TEXT        DEFAULT 'government'
                                        CHECK (category IN ('government', 'red_cross', 'private', 'charitable', 'other')),
  license_number          TEXT,
  contact_person          TEXT,
  phone                   TEXT,
  email                   TEXT,
  address                 TEXT,
  area                    TEXT,
  city                    TEXT        NOT NULL,
  district                TEXT        NOT NULL,
  state                   TEXT        NOT NULL,
  pincode                 TEXT,
  latitude                DOUBLE PRECISION,
  longitude               DOUBLE PRECISION,
  has_component_facility  BOOLEAN     DEFAULT TRUE,
  operating_hours         TEXT        DEFAULT '24/7',
  eraktkosh_url           TEXT,
  stock                   JSONB       DEFAULT '[]'::jsonb,
  last_synced_at          TIMESTAMPTZ DEFAULT NOW(),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_banks_state        ON blood_banks(state);
CREATE INDEX IF NOT EXISTS idx_blood_banks_district     ON blood_banks(district);
CREATE INDEX IF NOT EXISTS idx_blood_banks_city         ON blood_banks(city);
CREATE INDEX IF NOT EXISTS idx_blood_banks_pincode      ON blood_banks(pincode);
CREATE INDEX IF NOT EXISTS idx_blood_banks_category     ON blood_banks(category);

-- ─────────────────────────────────────────────────────────────
-- 2. donation_camps
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS donation_camps (
  id                      TEXT        PRIMARY KEY,
  eraktkosh_camp_id       TEXT        UNIQUE,
  title                   TEXT        NOT NULL,
  organizer_name          TEXT,
  contact_phone           TEXT,
  contact_email           TEXT,
  venue_address           TEXT        NOT NULL,
  area                    TEXT,
  city                    TEXT        NOT NULL,
  district                TEXT        NOT NULL,
  state                   TEXT        NOT NULL,
  pincode                 TEXT,
  latitude                DOUBLE PRECISION,
  longitude               DOUBLE PRECISION,
  camp_date               DATE        NOT NULL,
  start_time              TEXT        DEFAULT '09:00 AM',
  end_time                TEXT        DEFAULT '05:00 PM',
  target_units            INT         DEFAULT 50,
  status                  TEXT        DEFAULT 'upcoming'
                                        CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  eraktkosh_url           TEXT,
  last_synced_at          TIMESTAMPTZ DEFAULT NOW(),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donation_camps_state     ON donation_camps(state);
CREATE INDEX IF NOT EXISTS idx_donation_camps_district  ON donation_camps(district);
CREATE INDEX IF NOT EXISTS idx_donation_camps_city      ON donation_camps(city);
CREATE INDEX IF NOT EXISTS idx_donation_camps_pincode   ON donation_camps(pincode);
CREATE INDEX IF NOT EXISTS idx_donation_camps_date      ON donation_camps(camp_date);
CREATE INDEX IF NOT EXISTS idx_donation_camps_status    ON donation_camps(status);

-- ─────────────────────────────────────────────────────────────
-- 3. eraktkosh_sync_logs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eraktkosh_sync_logs (
  id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  sync_type               TEXT        NOT NULL CHECK (sync_type IN ('blood_banks', 'camps', 'full')),
  status                  TEXT        NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  records_fetched         INT         DEFAULT 0,
  records_added           INT         DEFAULT 0,
  records_updated         INT         DEFAULT 0,
  error_message           TEXT,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_started        ON eraktkosh_sync_logs(started_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 4. Row Level Security Policies
-- ─────────────────────────────────────────────────────────────
ALTER TABLE blood_banks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_camps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE eraktkosh_sync_logs  ENABLE ROW LEVEL SECURITY;

-- Public read access for directory data
DROP POLICY IF EXISTS "Public read blood banks" ON blood_banks;
CREATE POLICY "Public read blood banks" ON blood_banks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read donation camps" ON donation_camps;
CREATE POLICY "Public read donation camps" ON donation_camps FOR SELECT USING (true);

-- Service role full control
DROP POLICY IF EXISTS "Service role insert blood banks" ON blood_banks;
CREATE POLICY "Service role insert blood banks" ON blood_banks FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role update blood banks" ON blood_banks;
CREATE POLICY "Service role update blood banks" ON blood_banks FOR UPDATE TO service_role USING (true);

DROP POLICY IF EXISTS "Service role insert donation camps" ON donation_camps;
CREATE POLICY "Service role insert donation camps" ON donation_camps FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role update donation camps" ON donation_camps;
CREATE POLICY "Service role update donation camps" ON donation_camps FOR UPDATE TO service_role USING (true);

DROP POLICY IF EXISTS "Service role insert sync logs" ON eraktkosh_sync_logs;
CREATE POLICY "Service role insert sync logs" ON eraktkosh_sync_logs FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role update sync logs" ON eraktkosh_sync_logs;
CREATE POLICY "Service role update sync logs" ON eraktkosh_sync_logs FOR UPDATE TO service_role USING (true);

COMMIT;
