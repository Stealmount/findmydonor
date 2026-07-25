import { supabase } from './supabase';
import { User, BloodRequest, Match, NotificationLog, DonationLog, BloodType } from '../types';

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
