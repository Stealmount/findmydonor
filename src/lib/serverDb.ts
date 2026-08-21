// Client-side serverDb shim — delegates to backend Firebase implementation.
// This file exists for backward compatibility with imports from src/.

export { getCollection, getDoc, saveDoc, deleteDoc, mapProfile } from '../../backend/src/lib/serverDb';
export { db as getServerDb } from './firebase';

// Legacy alias — callers can import getServerSupabase and get the Firestore db
export { db as getServerSupabase } from './firebase';
