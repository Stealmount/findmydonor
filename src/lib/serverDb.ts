import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// This module is imported only by Express. Never import it from the browser.
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export class SupabaseUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SupabaseUnavailableError';
  }
}

export const serverSupabase: SupabaseClient | null = url && serviceRoleKey
  ? createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
  : null;

export function getServerSupabase(): SupabaseClient {
  if (!serverSupabase) {
    throw new SupabaseUnavailableError('Supabase is not configured on this server.');
  }
  return serverSupabase;
}

export function isSupabaseConfigured(): boolean {
  return serverSupabase !== null;
}

async function withRetry<T>(operation: string, task: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`${operation} timed out`)), 8_000);
        task().then(
          (value) => { clearTimeout(timeout); resolve(value); },
          (error) => { clearTimeout(timeout); reject(error); },
        );
      });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }
  throw new SupabaseUnavailableError(`Supabase ${operation} is temporarily unavailable.`, { cause: lastError });
}

export async function getCollection<T>(table: string): Promise<T[]> {
  const { data, error } = await withRetry(`read from ${table}`, async () => await getServerSupabase().from(table).select('*'));
  if (error) throw error;
  return (data || []) as T[];
}

export async function getDoc<T>(table: string, id: string): Promise<T | null> {
  const { data, error } = await withRetry(`read from ${table}`, async () => await getServerSupabase().from(table).select('*').eq('id', id).maybeSingle());
  if (error) throw error;
  return data as T | null;
}

export async function saveDoc(table: string, id: string, data: any): Promise<void> {
  const { error } = await withRetry(`write to ${table}`, async () => await getServerSupabase().from(table).upsert({ ...data, id }));
  if (error) throw error;
}

export async function deleteDoc(table: string, id: string): Promise<void> {
  const { error } = await withRetry(`delete from ${table}`, async () => await getServerSupabase().from(table).delete().eq('id', id));
  if (error) throw error;
}
