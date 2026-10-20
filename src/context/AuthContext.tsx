import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import {
  auth,
  googleProvider,
  db,
  syncUserProfile,
  updateUserRoleInDb,
  handleFirestoreError,
  OperationType,
  UserActivityRecord,
  UserRole,
  UserProfileData,
} from '../services/firebase';

export interface UserProfile extends UserProfileData {}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  activities: UserActivityRecord[];
  isInstructor: boolean;
  isAdmin: boolean;
  loginWithGoogle: (preferredRole?: UserRole) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string, role: UserRole) => Promise<void>;
  changeRole: (newRole: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  activities: [],
  isInstructor: false,
  isAdmin: false,
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  signUpWithEmail: async () => {},
  changeRole: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activities, setActivities] = useState<UserActivityRecord[]>([]);

  // Ref to hold active onSnapshot unsubscription function
  const unsubActivitiesRef = useRef<(() => void) | null>(null);

  const cleanupActivitiesListener = () => {
    if (unsubActivitiesRef.current) {
      unsubActivitiesRef.current();
      unsubActivitiesRef.current = null;
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Always tear down any existing listener on auth state transition
      cleanupActivitiesListener();

      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const userProf = await syncUserProfile(firebaseUser);
          setProfile(userProf);
        } catch (err) {
          console.warn('Profile sync notice:', err);
          setProfile({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            role: firebaseUser.email === 'aditiwari026@gmail.com' ? 'admin' : 'trainee',
          });
        }

        // Only attach onSnapshot if user is authenticated and valid
        if (auth.currentUser && auth.currentUser.uid === firebaseUser.uid) {
          try {
            const actRef = collection(db, 'users', firebaseUser.uid, 'activities');
            const q = query(actRef, limit(40));

            unsubActivitiesRef.current = onSnapshot(
              q,
              (snapshot) => {
                const list: UserActivityRecord[] = [];
                snapshot.forEach((doc) => {
                  list.push({ id: doc.id, ...(doc.data() as any) });
                });
                list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setActivities(list);
              },
              (error) => {
                // If user is no longer authenticated or signed out, gracefully ignore
                if (!auth.currentUser || auth.currentUser.uid !== firebaseUser.uid) {
                  return;
                }
                console.warn('Activity listener notice:', error.message);
              }
            );
          } catch (e) {
            console.warn('Could not establish activity listener:', e);
          }
        }

        setLoading(false);
      } else {
        setProfile(null);
        setActivities([]);
        setLoading(false);
      }
    });

    return () => {
      cleanupActivitiesListener();
      unsubscribeAuth();
    };
  }, []);

  const loginWithGoogle = async (preferredRole: UserRole = 'trainee') => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        const userProf = await syncUserProfile(result.user, preferredRole);
        setProfile(userProf);
      }
    } catch (err: any) {
      console.error('Google Sign In failed:', err);
      throw err;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      if (result.user) {
        const userProf = await syncUserProfile(result.user);
        setProfile(userProf);
      }
    } catch (err: any) {
      console.error('Email Sign In failed:', err);
      throw err;
    }
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    name: string,
    role: UserRole
  ) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      if (result.user) {
        if (name) {
          await updateProfile(result.user, { displayName: name });
        }
        const userProf = await syncUserProfile(result.user, role);
        setProfile(userProf);
      }
    } catch (err: any) {
      console.error('Sign Up failed:', err);
      throw err;
    }
  };

  const changeRole = async (newRole: UserRole) => {
    if (!user) return;
    try {
      await updateUserRoleInDb(user.uid, newRole);
      setProfile((prev) => (prev ? { ...prev, role: newRole } : null));
    } catch (err) {
      console.error('Role update failed:', err);
      throw err;
    }
  };

  const logout = async () => {
    // Explicitly tear down Firestore listeners BEFORE signing out
    cleanupActivitiesListener();
    setActivities([]);
    setProfile(null);
    await signOut(auth);
  };

  const isInstructor = profile?.role === 'instructor' || profile?.role === 'admin';
  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        activities,
        isInstructor,
        isAdmin,
        loginWithGoogle,
        loginWithEmail,
        signUpWithEmail,
        changeRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
