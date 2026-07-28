-- request_events: append-only audit trail for blood request lifecycle
-- Phase 6, Feature 3

-- Drop existing table (if any) to ensure clean schema with correct types
DROP TABLE IF EXISTS request_events;

CREATE TABLE request_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL,            -- matches blood_requests.id type (TEXT)
  event      TEXT NOT NULL,            -- 'created', 'broadcasting', 'cancelled', 'reopened', 'fulfilled', 'broadcast_toggle'
  actor      TEXT NOT NULL DEFAULT 'system',  -- user id, 'system', or 'worker'
  meta       JSONB DEFAULT '{}',       -- optional extra context
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_request_events_request_id ON request_events (request_id, at);

-- Row-level security (optional, recommended)
ALTER TABLE request_events ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_role_all_request_events" ON request_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read events for their own requests
CREATE POLICY "users_read_own_request_events" ON request_events
  FOR SELECT
  TO authenticated
  USING (
    request_id IN (
      SELECT id::text FROM blood_requests WHERE requester_id = auth.uid()::text
    )
  );
