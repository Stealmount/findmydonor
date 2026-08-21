import { db } from './firebase';
import { collection, doc, getDocs, getDoc as firestoreGetDoc, setDoc, deleteDoc as firestoreDeleteDoc } from 'firebase/firestore';

export async function getCollection<T>(collectionName: string): Promise<T[]> {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
  } catch (err) {
    console.error(`Error getting collection ${collectionName}:`, err);
    return [];
  }
}

export async function getDoc<T>(collectionName: string, id: string): Promise<T | null> {
  try {
    const docSnap = await firestoreGetDoc(doc(db, collectionName, id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as T;
  } catch (err) {
    console.error(`Error getting doc ${collectionName}/${id}:`, err);
    return null;
  }
}

export async function saveDoc(collectionName: string, id: string, data: any): Promise<void> {
  try {
    await setDoc(doc(db, collectionName, id), { ...data, id }, { merge: true });
  } catch (err) {
    console.error(`Error saving doc ${collectionName}/${id}:`, err);
    throw err;
  }
}

export async function deleteDoc(collectionName: string, id: string): Promise<void> {
  try {
    await firestoreDeleteDoc(doc(db, collectionName, id));
  } catch (err) {
    console.error(`Error deleting doc ${collectionName}/${id}:`, err);
  }
}
