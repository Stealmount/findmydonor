import React, { useState, useEffect } from 'react';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import RequestForm from './components/RequestForm';
import RequestTracking from './components/RequestTracking';
import DonorDashboard from './components/DonorDashboard';
import RequesterPortal from './components/RequesterPortal';
import { AuthHub } from './components/AuthHub';
import NotificationSimulator from './components/NotificationSimulator';
import { RaktdaanHome } from './components/home/RaktdaanHome';
import { Navbar } from './components/home/Navbar';
import { MobileBottomNav } from './components/home/MobileBottomNav';
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

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-blood-500/30 border-t-blood-500 rounded-full animate-spin" />
    </div>
  );
}

function AppContent() {
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [trackingCode, setTrackingCode] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<DonorUser | null>(null);
  const [loggedInRequester, setLoggedInRequester] = useState<Requester | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loggedInHospital, setLoggedInHospital] = useState<HospitalUser | null>(null);
  const [loggedInAdmin, setLoggedInAdmin] = useState<AdminUser | null>(null);
  const [prefilledGoogleUser, setPrefilledGoogleUser] = useState<{ uid: string; email: string; full_name: string } | null>(null);
  const [trackingRole, setTrackingRole] = useState<'donor' | 'requester'>('requester');
  const [trackingMatchId, setTrackingMatchId] = useState<string | undefined>();
  const lastResolvedUserIdRef = React.useRef<string | null>(null);

  function navigateTo(view: ActiveView, pushHistory = true, customCode?: string) {
    const code = customCode || trackingCode;
    const targetUrl = (view === 'home' || (view as string) === 'landing')
      ? '/'
      : view === 'tracking' && code
      ? `/track/${code}`
      : `/?view=${view}`;

    if (pushHistory) {
      window.history.pushState({ view, trackingCode: code }, '', targetUrl);
    }
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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
        console.warn('[Auth] /api/auth/me failed, session may have expired');
        if (!forceRefresh) lastResolvedUserIdRef.current = null;
      }
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleAuthUser(session.user);
      setSessionLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) handleAuthUser(session.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const syncFromUrl = (replaceState = false) => {
      const params = new URLSearchParams(window.location.search);
      const pathMatch = window.location.pathname.match(/^\/track\/([A-Z0-9-]+)/i);
      let initialView: ActiveView = 'home';
      let code = '';

      if (pathMatch) {
        code = pathMatch[1];
        setTrackingCode(code);
        setTrackingRole((params.get('role') as 'donor' | 'requester') || 'requester');
        setTrackingMatchId(params.get('matchId') || undefined);
        initialView = 'tracking';
      } else {
        const queryCode = params.get('code');
        const viewParam = params.get('view');
        if (queryCode) {
          code = queryCode;
          setTrackingCode(code);
          initialView = 'tracking';
        } else if (viewParam && isActiveView(viewParam)) {
          initialView = viewParam as ActiveView;
        }
      }

      setActiveView(initialView);
      const targetUrl = (initialView === 'home' || (initialView as string) === 'landing')
        ? '/'
        : initialView === 'tracking' && code
        ? `/track/${code}`
        : `/?view=${initialView}`;

      if (replaceState) {
        window.history.replaceState({ view: initialView, trackingCode: code }, '', targetUrl);
      }
    };

    syncFromUrl(true);

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view && isActiveView(event.state.view)) {
        setActiveView(event.state.view as ActiveView);
        if (event.state.trackingCode) setTrackingCode(event.state.trackingCode);
      } else {
        syncFromUrl(false);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleRequestSuccess = (code: string) => {
    setTrackingCode(code);
    navigateTo('tracking');
  };

  const handleDonorLoginSuccess = (donor: DonorUser) => {
    setLoggedInUser(donor);
    setPrefilledGoogleUser(null);
    navigateTo('donor-dashboard');
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
    navigateTo('home');
  };

  // ── Standalone full-screen views (no Navbar) ──
  if (activeView === 'admin-login') {
    return <AdminLogin 
      onLogin={(admin) => { setLoggedInAdmin(admin); navigateTo('admin-dashboard'); }} 
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
      onRegister={(hosp) => { setLoggedInHospital(hosp); navigateTo('hospital-dashboard'); }} 
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
          onNavigate={(view) => navigateTo(view)}
          loggedInUser={loggedInUser}
          loggedInRequester={loggedInRequester}
        />
        <MobileBottomNav
          activeView={activeView}
          onNavigate={(view) => navigateTo(view)}
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
        onNavigate={(view) => navigateTo(view)}
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
            onNavigate={(view) => navigateTo(view)}
          />
        )}

        {activeView === 'tracking' && (
          <RequestTracking
            initialCode={trackingCode}
            role={trackingRole}
            matchId={trackingMatchId}
          />
        )}

        {activeView === 'requester-portal' && (sessionLoading ? (
          <LoadingScreen />
        ) : (
          <RequesterPortal
            currentRequester={loggedInRequester}
            onLoginSuccess={(requester) => { setLoggedInRequester(requester); setActiveView('requester-portal'); }}
            onLogout={handleLogout}
            onNavigateToRequest={() => navigateTo('request')}
            onNavigateToRegister={() => navigateTo('requester-register')}
          />
        ))}

        {activeView === 'donor-dashboard' && (sessionLoading ? (
          <LoadingScreen />
        ) : (
          <DonorDashboard 
            currentUser={loggedInUser}
            onLoginSuccess={handleDonorLoginSuccess}
            onLogout={handleLogout}
            onGoogleRegisterRedirect={(googleData) => {
              setPrefilledGoogleUser(googleData);
              navigateTo('donor-register');
            }}
            onNavigateToRequest={() => navigateTo('request')}
            onNavigate={(view) => navigateTo(view as ActiveView)}
          />
        ))}

        {(activeView === 'auth-signin' || activeView === 'auth-signup' || activeView === 'donor-register' || activeView === 'requester-register') && (
          <AuthHub
            initialMode={activeView === 'auth-signin' ? 'signin' : 'signup'}
            initialIntent={activeView === 'requester-register' ? 'requester' : 'donor'}
            onLoginSuccessDonor={(donor) => {
              setLoggedInUser(donor);
              setLoggedInRequester(null);
              navigateTo('donor-dashboard');
            }}
            onLoginSuccessRequester={(requester) => {
              setLoggedInRequester(requester);
              setLoggedInUser(null);
              navigateTo('requester-portal');
            }}
            onSelectDonorSignUp={() => navigateTo('donor-register')}
            onSelectRequesterSignUp={() => navigateTo('requester-register')}
          />
        )}

      </main>

      <MobileBottomNav
        activeView={activeView}
        onNavigate={(view) => navigateTo(view)}
        loggedInUser={loggedInUser}
        loggedInRequester={loggedInRequester}
      />

      <NotificationSimulator />
    </div>
  );
}
