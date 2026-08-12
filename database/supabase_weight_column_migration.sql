-- Migration: Add weight_kg, address_text, and state columns for donor profiles and users
-- Run this script in the Supabase SQL Editor if you notice missing column warnings.

ALTER TABLE donor_profiles ADD COLUMN IF NOT EXISTS weight_kg NUMERIC CHECK (weight_kg IS NULL OR weight_kg >= 30);
ALTER TABLE donor_profiles ADD COLUMN IF NOT EXISTS address_text TEXT;
ALTER TABLE donor_profiles ADD COLUMN IF NOT EXISTS state TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_kg NUMERIC CHECK (weight_kg IS NULL OR weight_kg >= 30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_text TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state TEXT;

COMMENT ON COLUMN donor_profiles.weight_kg IS 'Donor weight in kilograms (minimum 45 kg for clinical donation eligibility per NBTC guidelines)';
