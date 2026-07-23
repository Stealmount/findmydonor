import React, { useState, useEffect } from 'react';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { 
  Heart, 
  UserPlus, 
  Search, 
  BarChart2, 
  HelpCircle, 
  PlusCircle, 
  User, 
  ChevronRight, 
  ShieldCheck, 
  HeartHandshake, 
  Clock, 
  PhoneCall, 
  ThumbsUp, 
  ArrowRight,
  Menu,
  X
} from 'lucide-react';
import RequestForm from './components/RequestForm';
import RequestTracking from './components/RequestTracking';
import DonorDashboard from './components/DonorDashboard';
import RequesterPortal from './components/RequesterPortal';
import { AuthHub } from './components/AuthHub';
import NotificationSimulator from './components/NotificationSimulator';
import { RaktdaanHome } from './components/home/RaktdaanHome';
import { Navbar } from './components/home/Navbar';
import { MobileBottomNav } from './components/home/MobileBottomNav';
import { getDoc as getLocalOrFirestoreDoc } from './lib/db';
import { supabase } from './lib/supabase';
import { authenticatedApi } from './lib/api';
import { HospitalRegistration } from './components/hospital/HospitalRegistration';
import { HospitalDashboard } from './components/hospital/HospitalDashboard';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { User as DonorUser, Requester, HospitalUser, AdminUser, AuthState } from './types';
import { LanguageProvider } from './lib/LanguageContext';

type ActiveView = 'home' | 'request' | 'tracking' | 'donor-register' | 'donor-dashboard' | 'requester-portal' | 'requester-register' | 'auth-signin' | 'auth-signup' | 'admin' | 'admin-login' | 'admin-dashboard' | 'hospital-register' | 'hospital-dashboard';

const ACTIVE_VIEWS: readonly ActiveView[] = ['home', 'request', 'tracking', 'donor-register', 'donor-dashboard', 'requester-portal', 'requester-register', 'auth-signin', 'auth-signup', 'admin', 'admin-login', 'admin-dashboard', 'hospital-register', 'hospital-dashboard'];

function isActiveView(value: string): value is ActiveView {
  return ACTIVE_VIEWS.includes(value as ActiveView);
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

function AppContent() {
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [trackingCode, setTrackingCode] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<DonorUser | null>(null);
  const [loggedInRequester, setLoggedInRequester] = useState<Requester | null>(null);
  const [loggedInHospital, setLoggedInHospital] = useState<HospitalUser | null>(null);
  const [loggedInAdmin, setLoggedInAdmin] = useState<AdminUser | null>(null);
  const [prefilledGoogleUser, setPrefilledGoogleUser] = useState<{ uid: string; email: string; full_name: string } | null>(null);
  const [trackingRole, setTrackingRole] = useState<'donor' | 'requester'>('requester');
  const [trackingMatchId, setTrackingMatchId] = useState<string | undefined>();
  const lastResolvedUserIdRef = React.useRef<string | null>(null);

  async function handleAuthUser(authUser?: SupabaseAuthUser, forceRefresh = false) {
    if (authUser && (forceRefresh || authUser.id !== lastResolvedUserIdRef.current)) {
      try {
        lastResolvedUserIdRef.current = authUser.id;
        const authState = await authenticatedApi<AuthState>('/api/auth/me', undefined, 'GET');
        if (authState.profile) {
          if (authState.profile.can_donate) {
            setLoggedInUser(authState.profile as unknown as DonorUser);
          }
          if (authState.profile.can_request || authState.profile.can_donate) {
            setLoggedInRequester(authState.profile as unknown as Requester);
          }
        }
      } catch {
        // silent fail
        if (!forceRefresh) lastResolvedUserIdRef.current = null;
      }
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleAuthUser(session.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) handleAuthUser(session.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pathMatch = window.location.pathname.match(/^\/track\/([A-Z0-9-]+)/i);
    if (pathMatch) {
      setTrackingCode(pathMatch[1]);
      setTrackingRole((params.get('role') as 'donor' | 'requester') || 'requester');
      setTrackingMatchId(params.get('matchId') || undefined);
      setActiveView('tracking');
    } else {
      const code = params.get('code');
      const view = params.get('view');
      if (code) {
        setTrackingCode(code);
        setActiveView('tracking');
      } else if (view && isActiveView(view)) {
        setActiveView(view);
      }
    }
  }, []);

  const handleRequestSuccess = (code: string) => {
    setTrackingCode(code);
    setActiveView('tracking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDonorLoginSuccess = (donor: DonorUser) => {
    setLoggedInUser(donor);
    setPrefilledGoogleUser(null);
    setActiveView('donor-dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    try {
      lastResolvedUserIdRef.current = null;
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Supabase signOut failed:", error);
    }
    setLoggedInUser(null);
    setLoggedInRequester(null);
    setActiveView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Standalone full-screen views (no Navbar) ──
  if (activeView === 'admin-login') {
    return <AdminLogin 
      onLogin={(admin) => { setLoggedInAdmin(admin); setActiveView('admin-dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
      onBack={() => setActiveView('home')} 
    />;
  }

  if (activeView === 'admin-dashboard' && loggedInAdmin) {
    return <AdminDashboard 
      admin={loggedInAdmin} 
      onLogout={() => { setLoggedInAdmin(null); setActiveView('home'); }} 
    />;
  }

  if (activeView === 'hospital-register') {
    return <HospitalRegistration 
      onRegister={(hosp) => { setLoggedInHospital(hosp); setActiveView('hospital-dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
      onBack={() => setActiveView('home')} 
    />;
  }

  if (activeView === 'hospital-dashboard' && loggedInHospital) {
    return <HospitalDashboard 
      hospital={loggedInHospital} 
      onLogout={() => { setLoggedInHospital(null); setActiveView('home'); }} 
    />;
  }

  // ── Home (special: no Navbar, own layout) ──
  if (activeView === 'home') {
    return (
      <div className="relative pb-16 md:pb-0">
        <RaktdaanHome
          onNavigate={(view) => { setActiveView(view); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          loggedInUser={loggedInUser}
          loggedInRequester={loggedInRequester}
        />
        <MobileBottomNav
          activeView={activeView}
          onNavigate={(view) => { setActiveView(view); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          loggedInUser={loggedInUser}
          loggedInRequester={loggedInRequester}
        />
        <NotificationSimulator />
      </div>
    );
  }

  // ── All other views share Navbar ──
  return (
    <div className="min-h-screen ambient-bg flex flex-col font-sans text-ink-900 relative">
      <Navbar
        onNavigate={(view) => { setActiveView(view); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        loggedInUser={loggedInUser}
        loggedInRequester={loggedInRequester}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">

        {activeView === 'request' && (
          <RequestForm 
            onSuccess={handleRequestSuccess} 
            loggedInRequester={loggedInRequester} 
            loggedInDonor={loggedInUser}
            onLoginSuccess={(requester) => setLoggedInRequester(requester)}
            onNavigate={(view) => { setActiveView(view); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        )}

        {activeView === 'tracking' && (
          <RequestTracking
            initialCode={trackingCode}
            role={trackingRole}
            matchId={trackingMatchId}
          />
        )}

        {activeView === 'requester-portal' && (
          <RequesterPortal
            currentRequester={loggedInRequester}
            onLoginSuccess={(requester) => { setLoggedInRequester(requester); setActiveView('requester-portal'); }}
            onLogout={handleLogout}
            onNavigateToRequest={() => { setActiveView('request'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onNavigateToRegister={() => { setActiveView('requester-register'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        )}

        {activeView === 'donor-dashboard' && (
          <DonorDashboard 
            currentUser={loggedInUser}
            onLoginSuccess={handleDonorLoginSuccess}
            onLogout={handleLogout}
            onGoogleRegisterRedirect={(googleData) => {
              setPrefilledGoogleUser(googleData);
              setActiveView('donor-register');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onNavigateToRequest={() => { setActiveView('request'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onNavigate={(view) => { setActiveView(view as any); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        )}

        {(activeView === 'auth-signin' || activeView === 'auth-signup' || activeView === 'donor-register' || activeView === 'requester-register') && (
          <AuthHub
            initialMode={activeView === 'auth-signin' ? 'signin' : 'signup'}
            initialIntent={activeView === 'requester-register' ? 'requester' : 'donor'}
            onLoginSuccessDonor={(donor) => {
              setLoggedInUser(donor);
              setLoggedInRequester(null);
              setActiveView('donor-dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onLoginSuccessRequester={(requester) => {
              setLoggedInRequester(requester);
              setLoggedInUser(null);
              setActiveView('requester-portal');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectDonorSignUp={() => { setActiveView('donor-register'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onSelectRequesterSignUp={() => { setActiveView('requester-register'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        )}

      </main>

      <MobileBottomNav
        activeView={activeView}
        onNavigate={(view) => { setActiveView(view); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        loggedInUser={loggedInUser}
        loggedInRequester={loggedInRequester}
      />

      <NotificationSimulator />
    </div>
  );
}
