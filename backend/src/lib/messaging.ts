/**
 * Messaging Service — centralized outbound message queue.
 *
 * Every outbound message (WhatsApp via WAHA, email via Resend) must pass
 * through enqueueMessage(). No code path calls the provider adapters
 * (waha.ts / sendEmailViaResend) directly.
 *
 * Lifecycle: queued → processing → sent | failed
 * Retries:    on retryable failure → retry_count++, back to queued with
 *             scheduled_send_time = now + backoff(retry_count). After
 *             max_retries → failed.
 * At-most-once: claim marks a row processing; a crashed claim is reclaimed
 *               after MESSAGE_CLAIM_STALE_SECONDS.
 */

import { randomUUID } from "node:crypto";
import {
  getCollection as getLocalOrFirestoreCollection,
  saveDoc as saveLocalOrFirestoreDoc,
} from "./serverDb";
import { sendWhatsApp, sendWhatsAppButtons } from "./waha";
import { sendEmailViaResend } from "./resend";

export type MessageChannel = "whatsapp" | "email";
export type MessageStatus = "queued" | "processing" | "sent" | "failed";

export interface OutgoingMessage {
  id: string;
  channel: MessageChannel;
  recipient: string;
  type: string;
  payload: Record<string, unknown>;
  status: MessageStatus;
  created_at: string;
  scheduled_send_time: string;
  claimed_at: string | null;
  sent_at: string | null;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
}

export interface EnqueueInput {
  channel: MessageChannel;
  recipient: string;
  type: string;
  /** Provider payload. whatsapp: { text, buttons? } — email: { subject, html, text }. */
  payload: Record<string, unknown>;
  /** Override the delay (seconds). OTP uses 0. Defaults to MESSAGE_DELAY_SECONDS. */
  delaySeconds?: number;
}

function nowISO(): string {
  return new Date().toISOString();
}

function messageDelaySeconds(): number {
  const raw = Number(process.env.MESSAGE_DELAY_SECONDS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 60;
}

function maxRetries(): number {
  const raw = Number(process.env.MESSAGE_MAX_RETRIES);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 5;
}

function claimStaleSeconds(): number {
  const raw = Number(process.env.MESSAGE_CLAIM_STALE_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw : 120;
}

/** Insert a message into the queue. Never sends immediately. */
export async function enqueueMessage(input: EnqueueInput): Promise<OutgoingMessage> {
  const id = randomUUID();
  const now = new Date();
  const delay = input.delaySeconds ?? messageDelaySeconds();
  const scheduled = new Date(now.getTime() + delay * 1000).toISOString();

  const row: OutgoingMessage = {
    id,
    channel: input.channel,
    recipient: input.recipient,
    type: input.type,
    payload: input.payload || {},
    status: "queued",
    created_at: nowISO(),
    scheduled_send_time: scheduled,
    claimed_at: null,
    sent_at: null,
    retry_count: 0,
    max_retries: maxRetries(),
    last_error: null,
  };

  await saveLocalOrFirestoreDoc("message_queue", id, row as unknown as Record<string, unknown>);

  console.log(
    `[MsgQueue] queued ${id} ${input.channel} → ${input.recipient} ` +
      `(${input.type}) scheduled ${scheduled}`
  );
  return row;
}

/**
 * Atomically claim due rows (queued + scheduled_send_time <= now, or stale
 * processing rows older than MESSAGE_CLAIM_STALE_SECONDS).
 */
export async function claimDueMessages(limit = 25): Promise<OutgoingMessage[]> {
  const all = await getLocalOrFirestoreCollection<OutgoingMessage>("message_queue");
  const now = new Date();
  const staleBefore = new Date(now.getTime() - claimStaleSeconds() * 1000);

  const due = all
    .filter((m) => {
      if (!m || !m.id) return false;
      if (m.status === "queued") return new Date(m.scheduled_send_time) <= now;
      if (m.status === "processing" && m.claimed_at) {
        // Reclaim crashed claims after the stale window.
        return new Date(m.claimed_at) < staleBefore;
      }
      return false;
    })
    .sort((a, b) => new Date(a.scheduled_send_time).getTime() - new Date(b.scheduled_send_time).getTime())
    .slice(0, limit);

  const claimed: OutgoingMessage[] = [];
  for (const m of due) {
    const updated: OutgoingMessage = {
      ...m,
      status: "processing",
      claimed_at: nowISO(),
    };
    await saveLocalOrFirestoreDoc("message_queue", m.id, updated as unknown as Record<string, unknown>);
    claimed.push(updated);
  }

  if (claimed.length) {
    console.log(`[MsgQueue] claimed ${claimed.length} message(s) for delivery`);
  }
  return claimed;
}

function backoffSeconds(retryCount: number): number {
  return Math.min(30 * 2 ** retryCount, 3600); // 30, 60, 120, 240, ... capped 1h
}

/**
 * Deliver a single message through the provider adapter.
 * Returns the updated row. Throws nothing — failures are recorded on the row.
 */
export async function processMessage(row: OutgoingMessage): Promise<OutgoingMessage> {
  let ok = false;
  let error: string | null = null;

  try {
    if (row.channel === "whatsapp") {
      const text = String(row.payload?.text ?? "");
      const buttons = Array.isArray(row.payload?.buttons)
        ? (row.payload.buttons as Array<{ id: string; text: string }>)
        : null;
      ok = buttons && buttons.length > 0
        ? await sendWhatsAppButtons(
            row.recipient,
            String(row.payload?.title ?? ""),
            text,
            String(row.payload?.footer ?? ""),
            buttons
          )
        : await sendWhatsApp(row.recipient, text);
    } else if (row.channel === "email") {
      const subject = String(row.payload?.subject ?? "");
      const html = String(row.payload?.html ?? "");
      const text = String(row.payload?.text ?? "");
      ok = await sendEmailViaResend(row.recipient, subject, html, text);
    } else {
      error = `Unknown channel: ${row.channel}`;
    }
  } catch (e: any) {
    error = e?.message || String(e);
  }

  if (ok) {
    const updated: OutgoingMessage = { ...row, status: "sent", sent_at: nowISO(), last_error: null };
    await saveLocalOrFirestoreDoc("message_queue", row.id, updated as unknown as Record<string, unknown>);
    console.log(`[MsgQueue] sent ${row.id} ${row.channel} → ${row.recipient} (${row.type})`);
    return updated;
  }

  const nextRetry = row.retry_count + 1;
  if (nextRetry > row.max_retries) {
    const updated: OutgoingMessage = {
      ...row,
      status: "failed",
      retry_count: nextRetry,
      last_error: error || "Delivery failed",
    };
    await saveLocalOrFirestoreDoc("message_queue", row.id, updated as unknown as Record<string, unknown>);
    console.error(
      `[MsgQueue] failed ${row.id} ${row.channel} → ${row.recipient} (${row.type}) ` +
        `after ${nextRetry} attempts: ${error || "unknown"}`
    );
    return updated;
  }

  const retryIn = backoffSeconds(row.retry_count);
  const updated: OutgoingMessage = {
    ...row,
    status: "queued",
    retry_count: nextRetry,
    scheduled_send_time: new Date(Date.now() + retryIn * 1000).toISOString(),
    claimed_at: null,
    last_error: error || "Delivery failed",
  };
  await saveLocalOrFirestoreDoc("message_queue", row.id, updated as unknown as Record<string, unknown>);
  console.warn(
    `[MsgQueue] retrying ${row.id} ${row.channel} → ${row.recipient} (${row.type}) ` +
      `attempt ${nextRetry}/${row.max_retries} in ${retryIn}s: ${error || "unknown"}`
  );
  return updated;
}

export interface QueueStats {
  queued: number;
  processing: number;
  sent: number;
  failed: number;
  total: number;
}

export async function getQueueStats(): Promise<QueueStats> {
  const all = await getLocalOrFirestoreCollection<OutgoingMessage>("message_queue");
  const stats: QueueStats = { queued: 0, processing: 0, sent: 0, failed: 0, total: all.length };
  for (const m of all) {
    if (m?.status === "queued") stats.queued++;
    else if (m?.status === "processing") stats.processing++;
    else if (m?.status === "sent") stats.sent++;
    else if (m?.status === "failed") stats.failed++;
  }
  return stats;
}

/** Test hook: reset the local queue store (no-op in production). */
export async function clearMessageQueueForTest(): Promise<void> {
  const all = await getLocalOrFirestoreCollection<OutgoingMessage>("message_queue");
  for (const m of all) {
    // serverDb has no raw remove besides deleteDoc — import lazily to avoid cycle
    const { deleteDoc } = await import("./serverDb");
    await deleteDoc("message_queue", m.id);
  }
}
