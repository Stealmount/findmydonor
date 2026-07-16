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
import AdminPanel from './components/AdminPanel';
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
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [trackingCode, setTrackingCode] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<DonorUser | null>(null);
  const [loggedInRequester, setLoggedInRequester] = useState<Requester | null>(null);
  const [loggedInHospital, setLoggedInHospital] = useState<HospitalUser | null>(null);
  const [loggedInAdmin, setLoggedInAdmin] = useState<AdminUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [prefilledGoogleUser, setPrefilledGoogleUser] = useState<{ uid: string; email: string; full_name: string } | null>(null);

  // Monitor Auth state changes to persist and auto-restore user sessions
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthUser(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAuthUser(session?.user);
    });

    return () => subscription.unsubscribe();

    async function handleAuthUser(authUser?: SupabaseAuthUser) {
      if (authUser) {
        try {
          const authState = await authenticatedApi<AuthState>('/api/auth/me', undefined, 'GET');
          if (authState.profile) {
            if (authState.profile.can_donate) {
              setLoggedInUser(authState.profile as unknown as DonorUser);
              setLoggedInRequester(null);
            } else if (authState.profile.can_request) {
              setLoggedInRequester(authState.profile as unknown as Requester);
              setLoggedInUser(null);
            }
          } else {
            // Fallback check local/firestore during migration before profile row creation
            const userDoc = await getLocalOrFirestoreDoc<DonorUser>('users', authUser.id);
            if (userDoc) {
              setLoggedInUser(userDoc);
              setLoggedInRequester(null);
            } else {
              const requesterDoc = await getLocalOrFirestoreDoc<Requester>('requesters', authUser.id);
              if (requesterDoc) {
                setLoggedInRequester(requesterDoc);
                setLoggedInUser(null);
              } else {
                // Brand new Google Auth user without a profile in our database
                setPrefilledGoogleUser({
                  uid: authUser.id,
                  email: authUser.email || '',
                  full_name: authUser.user_metadata?.full_name || ''
                });
                setLoggedInUser(null);
                setLoggedInRequester(null);
                setActiveView('auth-signup');
              }
            }
          }
        } catch (error) {
          console.error("Error auto-fetching user state via /api/auth/me:", error);
        }
      } else {
        setLoggedInUser(null);
        setLoggedInRequester(null);
      }
    }
  }, []);

  useEffect(() => {
    // Check if there's a tracking code in URL query params
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const view = params.get('view');
    if (code) {
      setTrackingCode(code);
      setActiveView('tracking');
    } else if (view && isActiveView(view)) {
      setActiveView(view);
    }
  }, []);

  const handleRequestSuccess = (code: string) => {
    setTrackingCode(code);
    setActiveView('tracking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDonorRegisterSuccess = (donor: DonorUser) => {
    setLoggedInUser(donor);
    setPrefilledGoogleUser(null);
    setActiveView('donor-dashboard');
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
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Supabase signOut failed:", error);
    }
    setLoggedInUser(null);
    setLoggedInRequester(null);
    setActiveView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (activeView === 'home') {
    return (
      <LanguageProvider>
        <div className="relative pb-16 md:pb-0">
          <RaktdaanHome
            onNavigate={(view) => {
              setActiveView(view);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            loggedInUser={loggedInUser}
            loggedInRequester={loggedInRequester}
          />
          <MobileBottomNav
            activeView={activeView}
            onNavigate={(view) => {
              setActiveView(view);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            loggedInUser={loggedInUser}
            loggedInRequester={loggedInRequester}
          />
          <NotificationSimulator />
        </div>
      </LanguageProvider>
    );
  }

  if (activeView === 'admin-login') {
    return (
      <LanguageProvider>
        <AdminLogin 
          onLogin={(admin) => {
            setLoggedInAdmin(admin);
            setActiveView('admin-dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }} 
          onBack={() => setActiveView('home')} 
        />
      </LanguageProvider>
    );
  }

  if (activeView === 'admin-dashboard' && loggedInAdmin) {
    return (
      <LanguageProvider>
        <AdminDashboard 
          admin={loggedInAdmin} 
          onLogout={() => {
            setLoggedInAdmin(null);
            setActiveView('home');
          }} 
        />
      </LanguageProvider>
    );
  }

  if (activeView === 'hospital-register') {
    return (
      <LanguageProvider>
        <HospitalRegistration 
          onRegister={(hosp) => {
            setLoggedInHospital(hosp);
            setActiveView('hospital-dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }} 
          onBack={() => setActiveView('home')} 
        />
      </LanguageProvider>
    );
  }

  if (activeView === 'hospital-dashboard' && loggedInHospital) {
    return (
      <LanguageProvider>
        <HospitalDashboard 
          hospital={loggedInHospital} 
          onLogout={() => {
            setLoggedInHospital(null);
            setActiveView('home');
          }} 
        />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <div className="min-h-screen ambient-bg flex flex-col font-sans text-ink-900 relative">
        <Navbar
          onNavigate={(view) => {
            setActiveView(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          loggedInUser={loggedInUser}
          loggedInRequester={loggedInRequester}
        />

        {/* MAIN BODY LAYOUT */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          
          {activeView === 'request' && (
            <RequestForm 
              onSuccess={handleRequestSuccess} 
              loggedInRequester={loggedInRequester} 
              loggedInDonor={loggedInUser}
              onLoginSuccess={(requester) => {
                setLoggedInRequester(requester);
              }}
            />
          )}

          {activeView === 'tracking' && (
            <RequestTracking initialCode={trackingCode} />
          )}

          {activeView === 'requester-portal' && (
            <RequesterPortal
              currentRequester={loggedInRequester}
              onLoginSuccess={(requester) => {
                setLoggedInRequester(requester);
                setActiveView('requester-portal');
              }}
              onLogout={handleLogout}
              onNavigateToRequest={() => setActiveView('request')}
              onNavigateToRegister={() => setActiveView('requester-register')}
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
              onSelectDonorSignUp={() => {
                setActiveView('donor-register');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onSelectRequesterSignUp={() => {
                setActiveView('requester-register');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onGoogleSignUpRedirect={(googleData) => {
                setPrefilledGoogleUser(googleData);
              }}
            />
          )}

          {activeView === 'admin' && (
            <AdminPanel />
          )}

        </main>

        <MobileBottomNav
          activeView={activeView}
          onNavigate={(view) => {
            setActiveView(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          loggedInUser={loggedInUser}
          loggedInRequester={loggedInRequester}
        />

        {/* PLATFORM NOTIFICATION LOGS & LIVE SIMULATOR GATEWAY */}
        <NotificationSimulator />
      </div>
    </LanguageProvider>
  );
}
