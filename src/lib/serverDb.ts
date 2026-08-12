import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

// Global Memory & Disk Persistence Engine
const localMemoryStore: Map<string, Map<string, any>> = (globalThis as any).__localMemoryStore || ((globalThis as any).__localMemoryStore = new Map<string, Map<string, any>>());

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
}

function loadLocalDiskStore(table: string): Map<string, any> {
  let map = localMemoryStore.get(table);
  if (!map) {
    map = new Map<string, any>();
    localMemoryStore.set(table, map);
  }
  const filePath = path.join(DATA_DIR, `db_${table}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const items = JSON.parse(raw);
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item && item.id) map.set(item.id, item);
        }
      }
    } catch (e) {
      console.warn(`[serverDb] Error loading local file store for ${table}:`, e);
    }
  }
  return map;
}

function persistLocalDiskStore(table: string) {
  const map = localMemoryStore.get(table);
  if (!map) return;
  const filePath = path.join(DATA_DIR, `db_${table}.json`);
  try {
    const items = Array.from(map.values());
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf8');
  } catch (e) {
    console.warn(`[serverDb] Error saving local file store for ${table}:`, e);
  }
}

function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test' || SUPABASE_URL === 'https://stub.supabase.co';
}

const PROFILE_SELECT = 'id, phone, whatsapp_phone, email, full_name, trust_report_count, donor_profiles(blood_group, pincode, is_available, emergency_only, cooldown_until)';

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
  const localMap = loadLocalDiskStore(table);
  const localItems = Array.from(localMap.values()) as T[];

  if (isTestMode()) {
    return localItems;
  }

  let remoteItems: T[] = [];
  try {
    if (table === 'users') {
      const { data } = await getServerSupabase()
        .from('profiles')
        .select(PROFILE_SELECT)
        .order('created_at', { ascending: false });
      if (data) remoteItems = data.map(mapProfile) as T[];
    } else {
      const { data } = await getServerSupabase().from(table).select('*');
      if (data) remoteItems = data as T[];
    }
  } catch (err) {
    console.warn(`[serverDb] Supabase getCollection(${table}) notice:`, (err as any)?.message || err);
  }

  // Merge remote items + local items (deduplicated by id)
  const itemMap = new Map<string, T>();
  for (const item of remoteItems) {
    if (item && (item as any).id) itemMap.set((item as any).id, item);
  }
  for (const item of localItems) {
    if (item && (item as any).id) itemMap.set((item as any).id, item);
  }
  return Array.from(itemMap.values());
}

export async function getDoc<T>(table: string, id: string): Promise<T | null> {
  const localMap = loadLocalDiskStore(table);
  const localDoc = localMap.get(id) || null;

  if (isTestMode()) {
    return localDoc as T | null;
  }

  try {
    if (table === 'users') {
      const { data } = await getServerSupabase()
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('id', id)
        .maybeSingle();
      if (data) return { ...mapProfile(data), ...localDoc } as T;
    } else {
      const { data } = await getServerSupabase().from(table).select('*').eq('id', id).maybeSingle();
      if (data) return { ...data, ...localDoc } as T;
    }
  } catch (err) {
    console.warn(`[serverDb] Supabase getDoc(${table}, ${id}) notice:`, (err as any)?.message || err);
  }

  return localDoc as T | null;
}

export async function saveDoc(table: string, id: string, data: any): Promise<void> {
  const localMap = loadLocalDiskStore(table);
  localMap.set(id, { ...data, id });
  persistLocalDiskStore(table);

  if (isTestMode()) {
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
      try {
        await withRetry(`save to users`, async () => {
          const { error } = await supabase.from('donor_profiles').update(updates).eq('profile_id', id);
          if (error) throw error;
        });
      } catch (err: any) {
        console.warn(`[serverDb] Save to users (donor_profiles) notice: ${err?.message || err}`);
      }
    }
    return;
  }

  try {
    const { error } = await withRetry(`save to ${table}`, async () => await getServerSupabase().from(table).upsert({ ...data, id }));
    if (error) {
      console.warn(`[serverDb] Upsert to ${table} notice: ${error.message}`);
    }
  } catch (err: any) {
    console.warn(`[serverDb] Save to ${table} fallback active. Reason: ${err?.message || err}`);
  }
}

export async function deleteDoc(table: string, id: string): Promise<void> {
  const localMap = loadLocalDiskStore(table);
  localMap.delete(id);
  persistLocalDiskStore(table);

  if (isTestMode()) {
    return;
  }
  try {
    const { error } = await withRetry(`delete from ${table}`, async () => await getServerSupabase().from(table).delete().eq('id', id));
    if (error) console.warn(`[serverDb] Delete from ${table} notice:`, error.message);
  } catch (err: any) {
    console.warn(`[serverDb] Delete from ${table} notice:`, err?.message || err);
  }
}
