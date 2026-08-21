import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebase';
import { authenticatedApi } from './api';
import type { User as DonorUser, Requester, Profile, HospitalUser, Institution, AdminUser, AuthState } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Profile (from /api/auth/me) → Requester (frontend state). */
function profileToRequester(profile: Profile): Requester {
  return {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email ?? '',
    phone: profile.phone,
    whatsapp_number: profile.whatsapp_phone,
    created_at: profile.consent_accepted_at ?? profile.created_at,
    updated_at: profile.updated_at,
  };
}

/** Institution row → HospitalUser view-model. */
export function institutionToHospitalUser(inst: Institution): HospitalUser {
  return {
    id: inst.id,
    institution_type: inst.type,
    hospital_name: inst.org_name,
    registration_number: inst.registration_number,
    admin_name: inst.contact_person,
    email: inst.email,
    phone: inst.phone,
    pincode: inst.pincode,
    city: inst.city,
    status: inst.verification_status,
    created_at: inst.created_at,
    updated_at: inst.updated_at,
  };
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  loggedInUser: DonorUser | null;
  loggedInRequester: Requester | null;
  loggedInHospital: HospitalUser | null;
  loggedInAdmin: AdminUser | null;
  loggedInInstitution: Institution | null;
  sessionLoading: boolean;

  // Setters — for components that receive auth callbacks (AuthHub, dashboards)
  setLoggedInUser: (u: DonorUser | null) => void;
  setLoggedInRequester: (r: Requester | null) => void;
  setLoggedInHospital: (h: HospitalUser | null) => void;
  setLoggedInAdmin: (a: AdminUser | null) => void;
  setLoggedInInstitution: (i: Institution | null) => void;

  // High-level actions
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loggedInUser, setLoggedInUser] = useState<DonorUser | null>(null);
  const [loggedInRequester, setLoggedInRequester] = useState<Requester | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loggedInHospital, setLoggedInHospital] = useState<HospitalUser | null>(null);
  const [loggedInAdmin, setLoggedInAdmin] = useState<AdminUser | null>(null);
  const [loggedInInstitution, setLoggedInInstitution] = useState<Institution | null>(null);
  const lastResolvedUserIdRef = useRef<string | null>(null);

  async function handleAuthUser(authUser?: FirebaseUser, forceRefresh = false) {
    if (authUser && (forceRefresh || authUser.uid !== lastResolvedUserIdRef.current)) {
      try {
        lastResolvedUserIdRef.current = authUser.uid;
        const authState = await authenticatedApi<AuthState & { institution?: Institution | null }>(
          '/api/auth/me', undefined, 'GET'
        );

        if (authState.institution) {
          setLoggedInInstitution(authState.institution);
          setLoggedInHospital(institutionToHospitalUser(authState.institution));
          return;
        }

        if (authState.profile) {
          if (authState.profile.can_donate) {
            setLoggedInUser(authState.profile as unknown as DonorUser);
          }
          if (authState.profile.can_request || authState.profile.can_donate) {
            setLoggedInRequester(profileToRequester(authState.profile));
          }
        }
      } catch {
        console.warn('[Auth] /api/auth/me failed, session may have expired');
        if (!forceRefresh) lastResolvedUserIdRef.current = null;
      }
    }
  }

  useEffect(() => {
    if (auth.currentUser) void handleAuthUser(auth.currentUser);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) void handleAuthUser(user);
      setSessionLoading(false);
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    try {
      lastResolvedUserIdRef.current = null;
      await signOut(auth);
    } catch (error) {
      console.error('Firebase signOut failed:', error);
    }
    setLoggedInUser(null);
    setLoggedInRequester(null);
    setLoggedInHospital(null);
    setLoggedInInstitution(null);
    setLoggedInAdmin(null);
  };

  const refreshSession = async () => {
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
      await handleAuthUser(auth.currentUser, true);
    }
  };

  return (
    <AuthContext.Provider value={{
      loggedInUser,
      loggedInRequester,
      loggedInHospital,
      loggedInAdmin,
      loggedInInstitution,
      sessionLoading,
      setLoggedInUser,
      setLoggedInRequester,
      setLoggedInHospital,
      setLoggedInAdmin,
      setLoggedInInstitution,
      logout,
      refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useAuth() — consume auth state and actions anywhere in the component tree
 * without prop drilling.
 *
 * Must be used inside <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>');
  return ctx;
}
