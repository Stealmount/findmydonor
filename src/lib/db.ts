import { supabase } from './supabase';
import { User, BloodRequest, Match, NotificationLog, DonationLog, BloodType } from '../types';

// Mock initial data if empty
const INITIAL_MOCK_DONORS: Partial<User>[] = [
  {
    id: "donor_rahul",
    full_name: "Rahul Sharma",
    email: "rahul@gmail.com",
    phone: "+919876543210",
    whatsapp_number: "+919876543210",
    blood_type: "O-",
    donation_frequency: "regular",
    last_donation_date: "2026-03-10",
    cooldown_until: null,
    pincode: "400001",
    area: "Fort",
    city: "Mumbai",
    availability_status: "available",
    number_sharing_pref: "on_approval",
    emergency_only: false,
    account_status: "active",
    whatsapp_verified: true,
  },
  {
    id: "donor_priya",
    full_name: "Priya Patel",
    email: "priya@gmail.com",
    phone: "+919876543211",
    whatsapp_number: "+919876543211",
    blood_type: "A+",
    donation_frequency: "occasional",
    last_donation_date: null,
    cooldown_until: null,
    pincode: "400001",
    area: "Fort",
    city: "Mumbai",
    availability_status: "available",
    number_sharing_pref: "on_approval",
    emergency_only: false,
    account_status: "active",
    whatsapp_verified: true,
  }
];

export async function seedInitialDonors() {
  if (!import.meta.env.DEV) return;
  try {
    const { data: existing, error } = await supabase.from('users').select('id').limit(1);
    if (!error && (!existing || existing.length === 0)) {
      console.log("Database empty, seeding mock donors...");
      for (const donor of INITIAL_MOCK_DONORS) {
        await saveDoc('users', donor.id!, {
          ...donor,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.error("Seeding failed", err);
  }
}

export async function getCollection<T>(collectionName: string): Promise<T[]> {
  try {
    const { data, error } = await supabase.from(collectionName).select('*');
    if (error) throw error;
    return (data || []) as T[];
  } catch (err) {
    console.error(`Error getting collection ${collectionName}:`, err);
    return [];
  }
}

export async function getDoc<T>(collectionName: string, id: string): Promise<T | null> {
  try {
    const { data, error } = await supabase.from(collectionName).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data || null) as T | null;
  } catch (err) {
    console.error(`Error getting doc ${collectionName}/${id}:`, err);
    return null;
  }
}

export async function saveDoc(collectionName: string, id: string, data: any): Promise<void> {
  try {
    // Supabase upsert requires the primary key in the payload. We ensure 'id' is present.
    const payload = { ...data, id };
    const { error } = await supabase.from(collectionName).upsert(payload);
    if (error) throw error;
  } catch (err) {
    console.error(`Error saving doc ${collectionName}/${id}:`, err);
    throw err; // Re-throw to allow caller to handle
  }
}

export async function deleteDoc(collectionName: string, id: string): Promise<void> {
  try {
    const { error } = await supabase.from(collectionName).delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error(`Error deleting doc ${collectionName}/${id}:`, err);
  }
}
