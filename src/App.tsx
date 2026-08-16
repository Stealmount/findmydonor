import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import RequestForm from './components/RequestForm';
import RequestTracking from './components/RequestTracking';
import DonorDashboard from './components/DonorDashboard';
import RequesterPortal from './components/RequesterPortal';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthHub } from './components/AuthHub';
import { Rev3AuthScreen } from './components/rev3/Rev3AuthScreen';
import { Rev3OnboardingWizard } from './components/rev3/Rev3OnboardingWizard';
import NotificationSimulator from './components/NotificationSimulator';
import { RaktdaanHome } from './components/home/RaktdaanHome';
import { Navbar } from './components/home/Navbar';
import { MobileBottomNav } from './components/home/MobileBottomNav';
import { HospitalRegistration } from './components/hospital/HospitalRegistration';
import { HospitalDashboard } from './components/hospital/HospitalDashboard';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { BloodBankDirectory } from './components/BloodBankDirectory';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { TermsOfService } from './components/TermsOfService';
import { FAQPage } from './components/FAQPage';
import { CityDonorDirectory } from './components/CityDonorDirectory';
import { BloodCompatibilityPage } from './components/BloodCompatibilityPage';
import { GuidesPage } from './components/GuidesPage';
import { SupportPage } from './components/SupportPage';
import { LanguageProvider } from './lib/LanguageContext';
import { useAuth, institutionToHospitalUser } from './lib/AuthContext';
import { fetchMe, toLegacy } from './lib/rev3Auth';

// View → path mapping. Components still call onNavigate(view) — nav() bridges it
// to react-router navigate(). Added as Task 4.1; kept here for reference.
const VIEW_PATHS: Record<string, string> = {
  'home': '/',
  'request': '/request',
  'tracking': '/track',
  'donor-register': '/auth/donor-register',
  'requester-register': '/auth/requester-register',
  'auth-signin': '/auth/signin',
  'auth-signup': '/auth/signup',
  'hospital-register': '/hospital/register',
  'hospital-dashboard': '/hospital/dashboard',
  'admin-login': '/admin/login',
  'admin-dashboard': '/admin/dashboard',
  'admin': '/admin/login',
  'blood-banks': '/blood-banks',
  'privacy': '/privacy',
  'terms': '/terms',
  'faq': '/faq',
  'donors': '/donors',
  'blood-compatibility': '/blood-compatibility',
  'guides': '/guides',
  'support': '/support',
  'donor-dashboard': '/donor-dashboard',
  'requester-portal': '/requester-portal',
  'landing': '/',
};

export default function App() {
  return (
    <LanguageProvider>
      <AppRoutes />
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

// ── Routes ────────────────────────────────────────────────────────────────────

function AppRoutes() {
  const navigate = useNavigate();
  const auth = useAuth();

  // Legacy ?view=X / ?code=CODE URL redirect (WhatsApp links, old bookmarks).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const codeParam = params.get('code');
    if (viewParam && VIEW_PATHS[viewParam]) {
      const target = viewParam === 'tracking' && codeParam
        ? `/track/${encodeURIComponent(codeParam)}`
        : VIEW_PATHS[viewParam];
      navigate(target, { replace: true });
    }
  }, [navigate]);

  // Keep the onNavigate prop pattern — just call navigate() internally.
  const nav = (view: string, _pushHistory?: boolean, code?: string) => {
    const target = VIEW_PATHS[view] ?? '/';
    if (view === 'tracking' && code) {
      navigate(`/track/${encodeURIComponent(code)}`);
    } else {
      navigate(target);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { loggedInUser, loggedInRequester, loggedInHospital, loggedInAdmin, sessionLoading } = auth;

  return (
    <Routes>
      <Route path="/" element={<HomeView nav={nav} />} />

      <Route path="/request" element={
        <AppShell nav={nav} activeView="request">
          <ErrorBoundary fallbackMessage="The request form hit an unexpected error. Please try again.">
            <RequestForm
              onSuccess={(code) => nav('tracking', true, code)}
              loggedInRequester={loggedInRequester}
              loggedInDonor={loggedInUser}
              onLoginSuccess={(requester) => auth.setLoggedInRequester(requester)}
              onNavigate={nav}
            />
          </ErrorBoundary>
        </AppShell>
      } />

      <Route path="/track/:code" element={
        <AppShell nav={nav} activeView="tracking">
          <TrackingView />
        </AppShell>
      } />

      <Route path="/donor-dashboard" element={
        <AppShell nav={nav} activeView="donor-dashboard">
          {sessionLoading ? (
            <LoadingScreen />
          ) : (
            <ErrorBoundary fallbackMessage="The donor dashboard hit an unexpected error. Your data is safe.">
              <DonorDashboard
                currentUser={loggedInUser}
                onLoginSuccess={(donor) => { auth.setLoggedInUser(donor); nav('donor-dashboard'); }}
                onLogout={auth.logout}
                onGoogleRegisterRedirect={() => navigate('/auth/donor-register')}
                onNavigateToRequest={() => nav('request')}
                onNavigate={nav}
              />
            </ErrorBoundary>
          )}
        </AppShell>
      } />

      <Route path="/requester-portal" element={
        <AppShell nav={nav} activeView="requester-portal">
          {sessionLoading ? (
            <LoadingScreen />
          ) : (
            <ErrorBoundary fallbackMessage="The requester portal hit an unexpected error. Your data is safe.">
              <RequesterPortal
                currentRequester={loggedInRequester}
                onLoginSuccess={(requester) => { auth.setLoggedInRequester(requester); }}
                onLogout={auth.logout}
                onNavigateToRequest={() => nav('request')}
                onNavigateToRegister={() => nav('requester-register')}
              />
            </ErrorBoundary>
          )}
        </AppShell>
      } />

      <Route path="/auth/rev3" element={<Rev3AuthRoute nav={nav} />} />
      <Route path="/auth/rev3/onboarding" element={<Rev3OnboardingRoute nav={nav} />} />

      <Route path="/auth/signin" element={<Rev3AuthRoute nav={nav} />} />
      <Route path="/auth/signup" element={<Rev3AuthRoute nav={nav} intent="donor" />} />
      <Route path="/auth/donor-register" element={<Rev3AuthRoute nav={nav} intent="donor" />} />
      <Route path="/auth/requester-register" element={<Rev3AuthRoute nav={nav} intent="requester" />} />

      <Route path="/hospital/register" element={
        <FullScreenRoute nav={nav}>
          <HospitalRegistration
            onRegister={(hosp) => { auth.setLoggedInHospital(hosp); nav('hospital-dashboard'); }}
            onBack={() => nav('home')}
          />
        </FullScreenRoute>
      } />

      <Route path="/hospital/dashboard" element={
        loggedInHospital ? (
          <FullScreenRoute nav={nav}>
            <ErrorBoundary fallbackMessage="The hospital dashboard hit an unexpected error. Your data is safe.">
              <HospitalDashboard
                hospital={loggedInHospital}
                onLogout={() => { auth.setLoggedInHospital(null); nav('home'); }}
              />
            </ErrorBoundary>
          </FullScreenRoute>
        ) : (
          <Navigate to="/hospital/register" replace />
        )
      } />

      <Route path="/admin/login" element={
        <FullScreenRoute nav={nav}>
          <AdminLogin
            onLogin={(admin) => { auth.setLoggedInAdmin(admin); nav('admin-dashboard'); }}
            onBack={() => nav('home')}
          />
        </FullScreenRoute>
      } />

      <Route path="/admin/dashboard" element={
        loggedInAdmin ? (
          <FullScreenRoute nav={nav}>
            <ErrorBoundary fallbackMessage="The admin dashboard hit an unexpected error. Your data is safe.">
              <AdminDashboard
                admin={loggedInAdmin}
                onLogout={() => { auth.setLoggedInAdmin(null); nav('home'); }}
              />
            </ErrorBoundary>
          </FullScreenRoute>
        ) : (
          <Navigate to="/admin/login" replace />
        )
      } />

      <Route path="/blood-banks" element={
        <AppShell nav={nav} activeView="blood-banks">
          <BloodBankDirectory onNavigate={nav} />
        </AppShell>
      } />

      <Route path="/privacy" element={
        <AppShell nav={nav} activeView="privacy">
          <PrivacyPolicy onNavigate={nav} />
        </AppShell>
      } />

      <Route path="/terms" element={
        <AppShell nav={nav} activeView="terms">
          <TermsOfService onNavigate={nav} />
        </AppShell>
      } />

      <Route path="/faq" element={
        <AppShell nav={nav} activeView="faq">
          <FAQPage onNavigate={nav} />
        </AppShell>
      } />

      <Route path="/donors" element={
        <AppShell nav={nav} activeView="donors">
          <CityDonorDirectory onNavigate={nav} />
        </AppShell>
      } />

      <Route path="/blood-compatibility" element={
        <AppShell nav={nav} activeView="blood-compatibility">
          <BloodCompatibilityPage onNavigate={nav} />
        </AppShell>
      } />

      <Route path="/guides" element={
        <AppShell nav={nav} activeView="guides">
          <GuidesPage onNavigate={nav} />
        </AppShell>
      } />

      <Route path="/support" element={
        <AppShell nav={nav} activeView="support">
          <SupportPage onNavigate={nav} />
        </AppShell>
      } />

      <Route path="*" element={<NotFoundRedirect />} />
    </Routes>
  );
}

// Legacy ?view= / unknown paths → home (replace so back button isn't polluted).
function NotFoundRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam && VIEW_PATHS[viewParam]) {
      const codeParam = params.get('code');
      const target = viewParam === 'tracking' && codeParam
        ? `/track/${encodeURIComponent(codeParam)}`
        : VIEW_PATHS[viewParam];
      navigate(target, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate]);
  return <LoadingScreen />;
}

// Tracking params (code from path, role/matchToken from query) → RequestTracking.
function TrackingView() {
  const { code } = useParams<{ code: string }>();
  const [params] = useSearchParams();
  const role = (params.get('role') as 'donor' | 'requester') || 'requester';
  const matchToken = params.get('matchToken') || params.get('matchId') || undefined;

  return (
    <ErrorBoundary fallbackMessage="Request tracking hit an unexpected error. Please refresh.">
      <RequestTracking initialCode={code} role={role} matchToken={matchToken} />
    </ErrorBoundary>
  );
}

// AuthHub route — mode/intent derived from the URL path.
function AuthRoute({ nav, mode, intent }: {
  nav: (view: string, push?: boolean, code?: string) => void;
  mode: 'signin' | 'signup';
  intent: 'donor' | 'requester';
}) {
  const navigate = useNavigate();
  const auth = useAuth();

  // If user is already authenticated (e.g. via AuthContext session resolution),
  // auto-redirect to dashboard instead of stranding user on auth screens.
  useEffect(() => {
    if (auth.loggedInUser) {
      navigate('/donor-dashboard', { replace: true });
    } else if (auth.loggedInRequester) {
      navigate('/requester-portal', { replace: true });
    } else if (auth.loggedInHospital || auth.loggedInInstitution) {
      navigate('/hospital/dashboard', { replace: true });
    }
  }, [auth.loggedInUser, auth.loggedInRequester, auth.loggedInHospital, auth.loggedInInstitution, navigate]);

  return (
    <AppShell nav={nav} activeView={mode === 'signin' ? 'auth-signin' : intent === 'requester' ? 'requester-register' : 'auth-signup'}>
      <AuthHub
        initialMode={mode}
        initialIntent={intent}
        onLoginSuccessDonor={(donor) => {
          auth.setLoggedInUser(donor);
          auth.setLoggedInRequester(null);
          navigate('/donor-dashboard');
        }}
        onLoginSuccessRequester={(requester) => {
          auth.setLoggedInRequester(requester);
          auth.setLoggedInUser(null);
          navigate('/requester-portal');
        }}
        onLoginSuccessInstitution={(inst) => {
          auth.setLoggedInInstitution(inst);
          auth.setLoggedInHospital(institutionToHospitalUser(inst));
          navigate('/hospital/dashboard');
        }}
        onSelectDonorSignUp={() => navigate('/auth/donor-register')}
        onSelectRequesterSignUp={() => navigate('/auth/requester-register')}
      />
    </AppShell>
  );
}

// Rev 3 authentication route. After sign-in, resolve the user's profile from /me
// and route to the correct user dashboard (donor, requester, or hospital).
function Rev3AuthRoute({ nav, intent }: { nav: (view: string, push?: boolean, code?: string) => void; intent?: 'donor' | 'requester' }) {
  const navigate = useNavigate();
  const auth = useAuth();

  // Auto-redirect authenticated users away from auth screens to their dashboard
  useEffect(() => {
    if (auth.loggedInUser) {
      navigate('/donor-dashboard', { replace: true });
    } else if (auth.loggedInRequester) {
      navigate('/requester-portal', { replace: true });
    } else if (auth.loggedInHospital || auth.loggedInInstitution) {
      navigate('/hospital/dashboard', { replace: true });
    }
  }, [auth.loggedInUser, auth.loggedInRequester, auth.loggedInHospital, auth.loggedInInstitution, navigate]);

  const handleContinue = async (_step: string) => {
    let me: Awaited<ReturnType<typeof fetchMe>> | undefined;
    try {
      me = await fetchMe();
    } catch { /* keep signing in */ }
    if (!me || !me.authUser) return;
    const legacy = toLegacy(me);
    if (legacy.institution) {
      auth.setLoggedInInstitution(legacy.institution);
      auth.setLoggedInHospital(institutionToHospitalUser(legacy.institution));
      navigate('/hospital/dashboard');
      return;
    }
    if (legacy.donor) {
      auth.setLoggedInUser(legacy.donor);
      auth.setLoggedInRequester(null);
      navigate('/donor-dashboard');
      return;
    } else if (legacy.requester) {
      auth.setLoggedInRequester(legacy.requester);
      auth.setLoggedInUser(null);
      navigate('/requester-portal');
      return;
    }
    nav('home');
  };

  return (
    <AppShell nav={nav} activeView="auth-signin">
      <Rev3AuthScreen onContinue={(step) => { void handleContinue(step); }} initialIntent={intent} />
    </AppShell>
  );
}

// Rev 3 onboarding route (Slice 2). Three-step wizard: Basic Profile → Intent → Complete.
function Rev3OnboardingRoute({ nav }: { nav: (view: string, push?: boolean, code?: string) => void }) {
  const navigate = useNavigate();
  const auth = useAuth();

  const handleComplete = async () => {
    try {
      const me = await fetchMe();
      if (!me || !me.authUser) {
        navigate('/auth/rev3');
        return;
      }
      const legacy = toLegacy(me);
      if (legacy.institution) {
        auth.setLoggedInInstitution(legacy.institution);
        auth.setLoggedInHospital(institutionToHospitalUser(legacy.institution));
        navigate('/hospital/dashboard');
        return;
      }
      if (legacy.donor) {
        auth.setLoggedInUser(legacy.donor);
        auth.setLoggedInRequester(null);
      } else if (legacy.requester) {
        auth.setLoggedInRequester(legacy.requester);
        auth.setLoggedInUser(null);
      }

      nav(legacy.institution ? 'hospital-dashboard'
        : legacy.donor ? 'donor-dashboard'
        : 'requester-portal');
    } catch {
      navigate('/auth/rev3');
    }
  };

  return (
    <AppShell nav={nav} activeView="auth-signup">
      <Rev3OnboardingWizard onComplete={() => { void handleComplete(); }} />
    </AppShell>
  );
}

// Full-screen views (no Navbar/AppShell) — admin/hospital standalone pages.
function FullScreenRoute({ children, nav }: { children: React.ReactNode; nav: (view: string, push?: boolean, code?: string) => void }) {
  return (
    <>
      {children}
      <NotificationSimulator onNavigate={(view) => nav(view as string)} />
    </>
  );
}

// Shared shell for Navbar-backed views.
// Navbar and MobileBottomNav read auth state from useAuth() directly (Task 4.2).
function AppShell({ nav, activeView, children }: {
  nav: (view: string, push?: boolean, code?: string) => void;
  activeView: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen ambient-bg flex flex-col font-sans text-ink-900 relative">
      <Navbar onNavigate={(view) => nav(view)} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {children}
      </main>

      <MobileBottomNav
        activeView={activeView}
        onNavigate={(view) => nav(view)}
      />

      <NotificationSimulator onNavigate={(view) => nav(view as string)} />
    </div>
  );
}

// Home (special: no Navbar, own layout).
function HomeView({ nav }: { nav: (view: string, push?: boolean, code?: string) => void }) {
  return (
    <div className="relative pb-16 md:pb-0">
      <RaktdaanHome onNavigate={nav} />
      <MobileBottomNav
        activeView="home"
        onNavigate={nav}
      />
      <NotificationSimulator />
    </div>
  );
}
