import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, getDoc } from 'firebase/firestore';
import {
  initializeAuth,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import type { UserProfile } from './types';

// Firebase exposes this at runtime on React Native, while its web-first type
// entrypoint omits it. Keeping the bridge here avoids losing persisted login.
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => any;
};

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAalf654KnSepgPUsie19L09csRCjV2b2I',
  authDomain: 'cal-track-9c21a.firebaseapp.com',
  projectId: 'cal-track-9c21a',
  storageBucket: 'cal-track-9c21a.firebasestorage.app',
  messagingSenderId: '34447032805',
  appId: '1:34447032805:web:8c677958ccfe8f90a7ef0c',
};

const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];
const db = getFirestore(app);

// Initialize auth with AsyncStorage persistence so login survives app restarts
let _auth: ReturnType<typeof getAuth>;
try {
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  _auth = getAuth(app);
}
export const auth = _auth;

const getUID = (): string | null => auth.currentUser?.uid ?? null;

const userCol = (uid: string, name: string) => collection(db, 'users', uid, name);
const userDoc = (uid: string, colName: string, id: string) => doc(db, 'users', uid, colName, id);

export const fsUpsert = async (colName: string, id: string, data: object): Promise<void> => {
  const uid = getUID();
  if (!uid) return;
  try {
    await setDoc(userDoc(uid, colName, id), data);
  } catch (e) {
    console.warn('[FS] upsert failed:', e);
  }
};

export const fsDelete = async (colName: string, id: string): Promise<void> => {
  const uid = getUID();
  if (!uid) return;
  try {
    await deleteDoc(userDoc(uid, colName, id));
  } catch (e) {
    console.warn('[FS] delete failed:', e);
  }
};

export const fsFetchAll = async <T>(colName: string): Promise<T[]> => {
  const uid = getUID();
  if (!uid) return [];
  try {
    const snap = await getDocs(userCol(uid, colName));
    return snap.docs.map((d) => d.data() as T);
  } catch (e) {
    console.warn('[FS] fetch failed:', e);
    return [];
  }
};

export const fsSetSettings = async (data: Partial<{ goal: number; profile: UserProfile }>): Promise<void> => {
  const uid = getUID();
  if (!uid) return;
  try {
    await setDoc(doc(db, 'users', uid, 'settings', 'main'), data, { merge: true });
  } catch (e) {
    console.warn('[FS] settings write failed:', e);
  }
};

export const fsFetchSettings = async (): Promise<{ goal?: number; profile?: UserProfile } | null> => {
  const uid = getUID();
  if (!uid) return null;
  try {
    const d = await getDoc(doc(db, 'users', uid, 'settings', 'main'));
    return d.exists() ? (d.data() as { goal?: number; profile?: UserProfile }) : null;
  } catch {
    return null;
  }
};

export const fsMirrorPhotoUpsert = async (monthKey: string, data: object): Promise<void> => {
  const uid = getUID();
  if (!uid) return;
  try {
    await setDoc(doc(db, 'users', uid, 'mirrorPhotos', monthKey), data);
  } catch (e) {
    console.warn('[FS] mirrorPhoto upsert failed:', e);
    throw e;
  }
};

export const fsMirrorPhotoFetchAll = async (): Promise<any[]> => {
  const uid = getUID();
  if (!uid) return [];
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'mirrorPhotos'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
};

export const fsMirrorPhotoDelete = async (monthKey: string): Promise<void> => {
  const uid = getUID();
  if (!uid) return;
  try {
    await deleteDoc(doc(db, 'users', uid, 'mirrorPhotos', monthKey));
  } catch (e) {
    console.warn('[FS] mirrorPhoto delete failed:', e);
  }
};

export const fsGetDeviceLicense = async (androidId: string): Promise<{ trialStartDate?: string; paid?: boolean; paidUntil?: string } | null> => {
  try {
    const d = await getDoc(doc(db, 'devices', androidId));
    return d.exists() ? (d.data() as { trialStartDate?: string; paid?: boolean; paidUntil?: string }) : null;
  } catch {
    return null;
  }
};

export const fsSetDeviceTrialStart = async (androidId: string, date: string): Promise<void> => {
  try {
    const ref = doc(db, 'devices', androidId);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        trialStartDate: date,
        paid: false,
        uid: getUID() ?? '',
        email: auth.currentUser?.email ?? '',
      });
    }
  } catch (e) {
    console.warn('[FS] device license write failed:', e);
  }
};

export const fsSetDevicePaid = async (androidId: string, paidUntil: string): Promise<void> => {
  try {
    await setDoc(doc(db, 'devices', androidId), { paidUntil }, { merge: true });
  } catch (e) { console.warn('[FS] device paid update failed:', e); }
};

export const fsSetLicensePaid = async (paidUntil: string): Promise<void> => {
  const uid = getUID();
  if (!uid) return;
  try {
    await setDoc(doc(db, 'users', uid, 'license', 'main'), { paidUntil }, { merge: true });
  } catch (e) { console.warn('[FS] license paid update failed:', e); }
};

export const fsGetLicense = async (): Promise<{ trialStartDate?: string; paid?: boolean; paidUntil?: string } | null> => {
  const uid = getUID();
  if (!uid) return null;
  try {
    const d = await getDoc(doc(db, 'users', uid, 'license', 'main'));
    return d.exists() ? (d.data() as { trialStartDate?: string; paid?: boolean; paidUntil?: string }) : null;
  } catch {
    return null;
  }
};

export const fsSetTrialStart = async (date: string): Promise<void> => {
  const uid = getUID();
  if (!uid) return;
  try {
    await setDoc(doc(db, 'users', uid, 'license', 'main'), { trialStartDate: date, paid: false }, { merge: true });
  } catch (e) {
    console.warn('[FS] license write failed:', e);
  }
};

// Auth helpers
export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const signUp = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const signOut = () => fbSignOut(auth);

export const onAuthChange = (cb: (user: User | null) => void) =>
  onAuthStateChanged(auth, cb);

export type { User };
