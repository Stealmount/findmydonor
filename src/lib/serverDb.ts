import dotenv from 'dotenv';
dotenv.config();
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// This module is imported only by Express. Never import it from the browser.
// Keep module-level for isTestMode() only.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

export class SupabaseUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SupabaseUnavailableError';
  }
}

// Singleton client — createClient once, not per request.
let _serverClient: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (_serverClient) return _serverClient;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceRoleKey) {
    throw new SupabaseUnavailableError('Supabase is not configured on this server.');
  }
  _serverClient = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _serverClient;
}

// getAnonSupabase deleted — zero callers in codebase. Add back if needed.

export function isSupabaseConfigured(): boolean {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(SUPABASE_URL && serviceRoleKey);
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

const localMemoryStore = new Map<string, Map<string, any>>();

function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test' || SUPABASE_URL === 'https://stub.supabase.co';
}

const PROFILE_SELECT = 'id, phone, whatsapp_phone, email, full_name, trust_report_count, donor_profiles(blood_group, pincode, is_available, emergency_only, cooldown_until)';

/** Unwrap the isArray-or-not dance Supabase returns for FK joins. */
function mapProfile(p: any) {
  const dp = Array.isArray(p.donor_profiles) ? p.donor_profiles[0] : p.donor_profiles;
  return {
    id: p.id,
    phone: p.phone,
    whatsapp_number: p.whatsapp_phone,
    email: p.email,
    full_name: p.full_name,
    blood_type: dp?.blood_group,
    pincode: dp?.pincode,
    availability_status: dp?.is_available ? 'available' : 'unavailable',
    account_status: p.trust_report_count >= 5 ? 'suspended' : 'active',
    emergency_only: dp?.emergency_only,
    cooldown_until: dp?.cooldown_until,
  };
}

export async function getCollection<T>(table: string): Promise<T[]> {
  if (isTestMode()) {
    const tableMap = localMemoryStore.get(table);
    return tableMap ? Array.from(tableMap.values()) as T[] : [];
  }

  if (table === 'users') {
    const { data, error } = await withRetry(`read from users`, async () => await getServerSupabase()
      .from('profiles')
      .select(PROFILE_SELECT)
      .order('created_at', { ascending: false }));
    if (error) throw error;
    return (data || []).map(mapProfile) as T[];
  }

  const { data, error } = await withRetry(`read from ${table}`, async () => await getServerSupabase().from(table).select('*'));
  if (error) throw error;
  return (data || []) as T[];
}

export async function getDoc<T>(table: string, id: string): Promise<T | null> {
  if (isTestMode()) {
    const tableMap = localMemoryStore.get(table);
    return tableMap ? (tableMap.get(id) || null) as T | null : null;
  }
  
  if (table === 'users') {
    const { data, error } = await withRetry(`read doc from users`, async () => await getServerSupabase()
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', id)
      .maybeSingle());
    if (error) throw error;
    if (!data) return null;
    return mapProfile(data) as T;
  }

  const { data, error } = await withRetry(`read from ${table}`, async () => await getServerSupabase().from(table).select('*').eq('id', id).maybeSingle());
  if (error) throw error;
  return data as T | null;
}

export async function saveDoc(table: string, id: string, data: any): Promise<void> {
  if (isTestMode()) {
    if (!localMemoryStore.has(table)) {
      localMemoryStore.set(table, new Map<string, any>());
    }
    localMemoryStore.get(table)!.set(id, { ...data, id });
    return;
  }
  
  if (table === 'users') {
    const supabase = getServerSupabase();
    const updates: any = {};
    if (data.cooldown_until !== undefined) updates.cooldown_until = data.cooldown_until;
    if (data.availability_status !== undefined) updates.is_available = data.availability_status === 'available';
    if (data.emergency_only !== undefined) updates.emergency_only = data.emergency_only;
    if (data.pincode !== undefined) updates.pincode = data.pincode;
    if (data.area !== undefined) updates.area = data.area;
    if (data.city !== undefined) updates.city = data.city;
    if (data.blood_type !== undefined) updates.blood_group = data.blood_type;
    
    if (Object.keys(updates).length > 0) {
      await withRetry(`save to users`, async () => {
        const { error } = await supabase.from('donor_profiles').update(updates).eq('profile_id', id);
        if (error) throw error;
      });
    }
    return;
  }

  const { error } = await withRetry(`save to ${table}`, async () => await getServerSupabase().from(table).upsert({ ...data, id }));
  if (error) throw error;
}

export async function deleteDoc(table: string, id: string): Promise<void> {
  if (isTestMode()) {
    const tableMap = localMemoryStore.get(table);
    if (tableMap) tableMap.delete(id);
    return;
  }
  const { error } = await withRetry(`delete from ${table}`, async () => await getServerSupabase().from(table).delete().eq('id', id));
  if (error) throw error;
}
