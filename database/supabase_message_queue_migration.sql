-- Centralized message queue — run once in Supabase SQL editor.
-- Additive, non-breaking. Service-role only (no anon access); RLS below
-- follows the same pattern as other server-written tables.

create table if not exists message_queue (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp','email')),
  recipient text not null,
  type text not null,                -- otp|donor_sos|requester_alert|confirm|welcome|reminder|admin|...
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued','processing','sent','failed')),
  created_at timestamptz not null default now(),
  scheduled_send_time timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  retry_count int not null default 0,
  max_retries int not null default 5,
  last_error text
);

create index if not exists idx_message_queue_due
  on message_queue (status, scheduled_send_time);

-- Service-role uses the service key (bypasses RLS), so RLS is enabled only
-- to guarantee the anon/authenticated keys can never touch this table.
alter table message_queue enable row level security;

create policy "message_queue service role only"
  on message_queue
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
