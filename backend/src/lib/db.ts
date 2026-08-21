// Backend DB helpers — uses Firebase Admin Firestore (not client SDK).
import { db } from './firebase';

export async function getCollection<T>(collectionName: string): Promise<T[]> {
  try {
    const snapshot = await db.collection(collectionName).get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
  } catch (err) {
    console.error(`Error getting collection ${collectionName}:`, err);
    return [];
  }
}

export async function getDoc<T>(collectionName: string, id: string): Promise<T | null> {
  try {
    const docSnap = await db.collection(collectionName).doc(id).get();
    if (!docSnap.exists) return null;
    return { id: docSnap.id, ...docSnap.data()! } as T;
  } catch (err) {
    console.error(`Error getting doc ${collectionName}/${id}:`, err);
    return null;
  }
}

export async function saveDoc(collectionName: string, id: string, data: any): Promise<void> {
  try {
    await db.collection(collectionName).doc(id).set({ ...data, id }, { merge: true });
  } catch (err) {
    console.error(`Error saving doc ${collectionName}/${id}:`, err);
    throw err;
  }
}

export async function deleteDoc(collectionName: string, id: string): Promise<void> {
  try {
    await db.collection(collectionName).doc(id).delete();
  } catch (err) {
    console.error(`Error deleting doc ${collectionName}/${id}:`, err);
  }
}
