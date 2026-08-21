import { db as firestoreDb } from './firebase';

export class FirebaseUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FirebaseUnavailableError';
  }
}

export function getDb() {
  return firestoreDb;
}

export function isFirebaseConfigured(): boolean {
  try {
    return firestoreDb !== null && firestoreDb !== undefined;
  } catch {
    return false;
  }
}

export function mapProfile(p: any) {
  const dp = p.donor_profile || null;
  const isAvailable = dp ? dp.is_available : (p.availability_status === 'available' || p.is_available === true);
  return {
    id: p.id,
    phone: p.phone,
    whatsapp_number: p.whatsapp_number || p.whatsapp_phone || p.phone,
    email: p.email,
    full_name: p.full_name,
    blood_type: dp?.blood_group || p.blood_type || p.blood_group || null,
    pincode: dp?.pincode || p.pincode || null,
    availability_status: isAvailable ? 'available' : 'unavailable',
    account_status: p.trust_report_count >= 5 ? 'suspended' : (p.account_status || 'active'),
    emergency_only: dp?.emergency_only || p.emergency_only || false,
    cooldown_until: dp?.cooldown_until || p.cooldown_until || null,
  };
}

export async function getCollection<T>(table: string): Promise<T[]> {
  try {
    const snapshot = await firestoreDb.collection(table).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
  } catch (err) {
    console.warn(`[serverDb] Firestore getCollection(${table}) error:`, (err as any)?.message || err);
    return [];
  }
}

export async function getDoc<T>(table: string, id: string): Promise<T | null> {
  try {
    const doc = await firestoreDb.collection(table).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as T;
  } catch (err) {
    console.warn(`[serverDb] Firestore getDoc(${table}, ${id}) error:`, (err as any)?.message || err);
    return null;
  }
}

export async function saveDoc(table: string, id: string, data: any): Promise<void> {
  try {
    await firestoreDb.collection(table).doc(id).set(data, { merge: true });
  } catch (err) {
    console.warn(`[serverDb] Firestore saveDoc(${table}, ${id}) error:`, (err as any)?.message || err);
  }
}

export async function deleteDoc(table: string, id: string): Promise<void> {
  try {
    await firestoreDb.collection(table).doc(id).delete();
  } catch (err) {
    console.warn(`[serverDb] Firestore deleteDoc(${table}, ${id}) error:`, (err as any)?.message || err);
  }
}
