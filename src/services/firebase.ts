import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID (CRITICAL: matches provisioned database)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection to Firestore
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline.');
      return false;
    }
    // Expected if test doc does not exist or permission denied for test collection, which is normal under default-deny
    return true;
  }
}

export type UserRole = 'trainee' | 'instructor' | 'admin';

export interface UserProfileData {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

// User Profile creation or retrieval in Firestore
export async function syncUserProfile(
  user: FirebaseUser,
  preferredRole: UserRole = 'trainee'
): Promise<UserProfileData> {
  const userRef = doc(db, 'users', user.uid);
  const isAdminEmail = user.email === 'aditiwari026@gmail.com';
  const assignedRole: UserRole = isAdminEmail ? 'admin' : preferredRole;

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const newProfile: UserProfileData = {
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        role: assignedRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userRef, newProfile);
      return newProfile;
    } else {
      const data = snap.data();
      const existingRole: UserRole = isAdminEmail
        ? 'admin'
        : (data.role as UserRole) || assignedRole;

      await setDoc(
        userRef,
        {
          email: user.email || data.email || '',
          displayName: user.displayName || data.displayName || 'User',
          role: existingRole,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return {
        id: user.uid,
        email: user.email || data.email || '',
        displayName: user.displayName || data.displayName || 'User',
        role: existingRole,
      };
    }
  } catch (err) {
    console.warn('Profile sync warning:', err);
    return {
      id: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'User',
      role: assignedRole,
    };
  }
}

export async function updateUserRoleInDb(userId: string, newRole: UserRole): Promise<void> {
  const userRef = doc(db, 'users', userId);
  try {
    await setDoc(userRef, { role: newRole, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
  }
}

export interface UserActivityRecord {
  id?: string;
  userId: string;
  userEmail: string;
  actionType: 'decision_submitted' | 'decision_revised' | 'task_updated' | 'report_acknowledged' | 'aar_completed';
  title: string;
  description: string;
  domain: string;
  timestamp: string;
  scenarioId?: string;
  metadata?: Record<string, any>;
}

// Save activity to user's activity subcollection in Firestore
export async function saveUserActivity(activity: Omit<UserActivityRecord, 'userId' | 'userEmail' | 'timestamp'>) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    // If not signed in, log locally
    return null;
  }

  const path = `users/${currentUser.uid}/activities`;
  try {
    const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'activities'), {
      ...activity,
      userId: currentUser.uid,
      userEmail: currentUser.email || '',
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    return null;
  }
}

// Save completed training record to Firestore
export async function saveTrainingRecord(record: {
  scenarioTitle: string;
  difficulty: string;
  overallScore: number;
  decisionsCount: number;
  alertsCount: number;
}) {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;

  const path = 'training_records';
  try {
    const docRef = await addDoc(collection(db, 'training_records'), {
      ...record,
      userId: currentUser.uid,
      userEmail: currentUser.email || '',
      completedAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    return null;
  }
}
