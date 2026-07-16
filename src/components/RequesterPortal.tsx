import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Requester, BloodRequest, Match, User, BloodType } from '../types';
import { getCollection as getLocalOrFirestoreCollection, saveDoc as saveLocalOrFirestoreDoc, getDoc as getLocalOrFirestoreDoc } from '../lib/db';
import { supabase } from '../lib/supabase';
import { authenticatedApi } from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import { 
  Heart, 
  MapPin, 
  Clock, 
  Phone, 
  MessageSquare, 
  User as UserIcon, 
  CheckCircle, 
  XCircle, 
  Calendar,
  AlertTriangle,
  LogOut,
  Shield,
  FileText,
  Save,
  Lock,
  ArrowRight,
  PlusCircle,
  Users,
  Search,
  Check,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface RequesterPortalProps {
  currentRequester: Requester | null;
  onLoginSuccess: (requester: Requester) => void;
  onLogout: () => void;
  onStateChange?: () => void;
  onNavigateToRequest: () => void;
  onNavigateToRegister: () => void;
}

export default function RequesterPortal({ 
  currentRequester, 
  onLoginSuccess, 
  onLogout, 
  onStateChange,
  onNavigateToRequest,
  onNavigateToRegister
}: RequesterPortalProps) {
  const { t, language } = useLanguage();
  const isHi = language === 'HI';
  
  // Auth view toggles
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Dashboard state
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [donors, setDonors] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Refresh dashboard data
  const loadDashboardData = async () => {
    if (!currentRequester) return;
    setLoadingData(true);
    try {
      const dashboard = await authenticatedApi<{
        requests: BloodRequest[]; matches: Match[]; donors: User[];
      }>('/api/requester/requests', undefined, 'GET');
      const userRequests = dashboard.requests || [];
      const allMatches = dashboard.matches || [];
      const allDonors = dashboard.donors || [];

      // Sort by creation date (newest first)
      userRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setRequests(userRequests);
      setMatches(allMatches);
      setDonors(allDonors);

      if (userRequests.length > 0 && !selectedRequestId) {
        setSelectedRequestId(userRequests[0].id);
      }
    } catch (err) {
      console.error("Error loading requester data: ", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (currentRequester) {
      loadDashboardData();
    }
  }, [currentRequester]);

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      const uid = data.user?.id;
      if (!uid) throw new Error("No user returned");

      let requesterDoc = await getLocalOrFirestoreDoc<Requester>('requesters', uid);

      if (!requesterDoc) {
        // Fallback or automatic creation if they registered on google earlier
        const nowStr = new Date().toISOString();
        requesterDoc = {
          id: uid,
          full_name: data.user.user_metadata?.full_name || email.split('@')[0],
          email: data.user.email || email,
          phone: '+91 9999999999',
          created_at: nowStr,
          updated_at: nowStr
        };
        await saveLocalOrFirestoreDoc('requesters', uid, requesterDoc);
      }

      onLoginSuccess(requesterDoc);
    } catch (err: any) {
      console.error(err);
      setAuthError('Invalid email or password. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setAuthError('Google sign in failed. Please try again.');
      setAuthLoading(false);
    }
  };

  // Actions on blood requests
  const handleFulfillRequest = async (request: BloodRequest) => {
    if (!window.confirm("Marking this request as fulfilled will close search and send simulated WhatsApp cooldown confirmations to all approved donors. Proceed?")) return;

    try {
      const nowStr = new Date().toISOString();
      
      const updatedReq: BloodRequest = {
        ...request,
        status: 'fulfilled',
        fulfilled_at: nowStr,
      };
      await saveLocalOrFirestoreDoc('blood_requests', request.id, updatedReq);

      // Trigger verification messages for matches who approved
      const reqMatches = matches.filter(m => m.request_id === request.id);
      const approvedMatches = reqMatches.filter(m => m.donor_response === 'approved');

      for (const m of approvedMatches) {
        const donor = donors.find(d => d.id === m.donor_id);
        if (donor) {
          const checkNotifId = crypto.randomUUID();
          const bodyMsg = `Did you successfully donate blood for Request ID: ${request.tracking_code} at ${request.hospital_name}? Reply YES to CONFIRM and activate your 60-day recovery cooldown, or NO to indicate it did not happen.`;
          
          await saveLocalOrFirestoreDoc('notifications', checkNotifId, {
            id: checkNotifId,
            type: 'whatsapp',
            recipient_type: 'donor',
            recipient_id: donor.id,
            trigger_event: 'cooldown_verification',
            message_body: bodyMsg,
            status: 'delivered',
            sent_at: nowStr,
            created_at: nowStr
          });
        }
      }

      await loadDashboardData();
      if (onStateChange) onStateChange();

      // Trigger success confetti animation
      try {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (confettiErr) {
        console.error("Confetti error:", confettiErr);
      }

      alert("Blood request marked as fulfilled successfully!");
    } catch (err) {
      console.error("Fulfill failed: ", err);
      alert("Failed to fulfill request. Please try again.");
    }
  };

  const handleCancelRequest = async (request: BloodRequest) => {
    if (!window.confirm("Are you sure you want to cancel this request? It will be marked inactive and retracted from matching systems.")) return;

    try {
      const updatedReq: BloodRequest = {
        ...request,
        status: 'cancelled',
      };
      await saveLocalOrFirestoreDoc('blood_requests', request.id, updatedReq);

      await loadDashboardData();
      if (onStateChange) onStateChange();
      alert("Blood request cancelled successfully.");
    } catch (err) {
      console.error("Cancel failed: ", err);
      alert("Failed to cancel request.");
    }
  };

  const handleToggleBroadcast = async (req: BloodRequest) => {
    try {
      const newVal = !(req.broadcast_to_simulator);
      const updated = { ...req, broadcast_to_simulator: newVal };
      await saveLocalOrFirestoreDoc('blood_requests', req.id, updated);
      await loadDashboardData();
      if (onStateChange) onStateChange();
    } catch (err) {
      console.error("Broadcast toggle failed: ", err);
    }
  };

  // Rendering Helper: Urgency Style
  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return <span className="inline-flex items-center rounded-full bg-blood-50 px-2.5 py-0.5 text-[10px] font-semibold text-blood-700 border border-blood-200 uppercase">{isHi ? 'अत्यंत गंभीर' : 'CRITICAL'}</span>;
      case 'urgent':
        return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200 uppercase">{isHi ? 'तत्काल' : 'URGENT'}</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-ink-50 px-2.5 py-0.5 text-[10px] font-semibold text-ink-600 border border-ink-200 uppercase">{isHi ? 'नियोजित' : 'PLANNED'}</span>;
    }
  };

  // Rendering Helper: Status Badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="inline-flex items-center rounded-full bg-ink-100 px-2.5 py-0.5 text-[10px] font-semibold text-ink-600 border border-ink-300 uppercase">Draft</span>;
      case 'broadcasting':
        return <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-semibold text-orange-700 border border-orange-200 uppercase animate-pulse">Broadcasting</span>;
      case 'open':
        return <span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-0.5 text-[10px] font-semibold text-yellow-700 border border-yellow-200 uppercase">{isHi ? 'खोज जारी' : 'Searching'}</span>;
      case 'matching':
        return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200 uppercase animate-pulse">{isHi ? 'मिलान जारी' : 'Matching'}</span>;
      case 'partially_matched':
        return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200 uppercase">{isHi ? 'दाता मिला' : 'Donor Matched'}</span>;
      case 'fulfilled':
        return <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200 uppercase">{isHi ? 'पूर्ण हुआ' : 'Fulfilled'}</span>;
      case 'cancelled':
        return <span className="inline-flex items-center rounded-full bg-ink-100 px-2.5 py-0.5 text-[10px] font-semibold text-ink-500 border border-ink-200 uppercase">{isHi ? 'रद्द किया गया' : 'Cancelled'}</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-ink-50 px-2.5 py-0.5 text-[10px] font-semibold text-ink-700 border border-ink-200 uppercase">{status}</span>;
    }
  };

  // Broadcast a saved draft — promotes it to a live broadcast via API
  const [broadcastingDraftId, setBroadcastingDraftId] = useState<string | null>(null);
  const handleBroadcastDraft = async (req: BloodRequest) => {
    if (!window.confirm(`Broadcast "${req.blood_type_needed}" request to nearby donors now?`)) return;
    setBroadcastingDraftId(req.id);
    try {
      await authenticatedApi(`/api/requests/${req.id}/broadcast`, {}, 'POST');
      await loadDashboardData();
    } catch (err: any) {
      console.error('Broadcast draft error:', err);
      alert('Failed to broadcast. Please try again.');
    } finally {
      setBroadcastingDraftId(null);
    }
  };

  // Render Logged Out View
  if (!currentRequester) {
    return (
      <div id="requester-login-container" className="max-w-md mx-auto rounded-3xl bg-white/95 backdrop-blur-2xl border border-ink-200/80 shadow-premium-lg overflow-hidden my-8">
        <div className="bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-blood-600/20 blur-2xl" aria-hidden />
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl blood-drop-gradient shadow-[0_8px_20px_-4px_rgba(244,63,87,0.5)]">
            <Heart className="w-6 h-6 text-white fill-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white font-sans">
            {t.requesterDashboard.loginTitle}
          </h2>
          <p className="text-ink-300 text-xs mt-1">
            {isHi ? 'लाइव मिलान अपडेट ट्रैक करें, विवरण सत्यापित करें और अनुरोध प्रबंधित करें।' : 'Track live matching updates, verify details & manage requests.'}
          </p>
        </div>

        <form onSubmit={handleLoginSubmit} className="p-8 space-y-4">
          {authError && (
            <div id="auth-error" className="p-3 rounded-xl bg-blood-50 text-blood-700 border border-blood-200 text-xs font-semibold flex items-center gap-2">
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'ईमेल पता *' : 'Email Address *'}</label>
            <input
              id="inp-auth-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'पासवर्ड *' : 'Password *'}</label>
            <input
              id="inp-auth-password"
              type="password"
              required
              placeholder="••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all"
            />
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            disabled={authLoading}
            className="w-full h-12 rounded-xl bg-blood-600 hover:bg-blood-700 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {authLoading ? (isHi ? 'लॉगिन हो रहा है...' : 'Logging in...') : (isHi ? 'साइन इन करें' : 'Sign In')}
          </button>

          <div className="flex items-center gap-2 my-2">
            <hr className="flex-1 border-ink-200" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{isHi ? 'या Google से' : 'OR'}</span>
            <hr className="flex-1 border-ink-200" />
          </div>

          <button
            id="btn-google-auth"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="w-full h-12 rounded-xl bg-white hover:bg-ink-50/80 active:scale-[0.99] text-ink-800 border border-ink-200 font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {isHi ? 'Google के साथ जारी रखें' : 'Continue with Google'}
          </button>

          <div className="text-center pt-3 border-t border-ink-100">
            <button
              id="btn-navigate-register"
              type="button"
              onClick={onNavigateToRegister}
              className="text-xs font-semibold text-blood-600 hover:text-blood-700 hover:underline cursor-pointer"
            >
              {isHi ? 'अनुरोधकर्ता प्रोफ़ाइल नहीं है? पंजीकरण करें' : "Don't have a Requester profile? Register"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Active Requester Dashboard View
  const selectedRequest = requests.find(r => r.id === selectedRequestId);
  const selectedMatches = selectedRequest ? matches.filter(m => m.request_id === selectedRequest.id) : [];

  return (
    <div id="requester-dashboard" className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Sleek Glass Overview Header */}
      <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 shadow-premium-lg p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl blood-drop-gradient text-white shadow-md">
            <UserIcon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-ink-900">
                {currentRequester.full_name}
              </h2>
              <span className="inline-flex items-center rounded-full bg-blood-50 px-3 py-1 text-xs font-semibold text-blood-700 border border-blood-200 uppercase">
                {isHi ? 'सत्यापित अनुरोधकर्ता' : 'Verified Requester'}
              </span>
            </div>
            <p className="text-xs text-ink-400 font-medium mt-1">
              {isHi ? 'संपर्क:' : 'Contact:'} {currentRequester.phone} &bull; {isHi ? 'ईमेल:' : 'Email:'} {currentRequester.email}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            id="btn-dashboard-new-req"
            onClick={onNavigateToRequest}
            className="btn-glow inline-flex items-center justify-center gap-2 rounded-xl bg-blood-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blood-700 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            {t.requesterDashboard.newRequestBtn}
          </button>
          <button
            id="btn-requester-logout"
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-5 py-2.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 hover:text-ink-900 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            {isHi ? 'साइन आउट' : 'Sign Out'}
          </button>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: My Request Registry */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
              {t.requesterDashboard.activeRequests} ({requests.length})
            </h3>
            <button 
              id="btn-refresh-dashboard"
              onClick={loadDashboardData}
              className="text-[10px] font-semibold uppercase tracking-wider text-blood-600 hover:text-blood-700 transition-colors cursor-pointer"
            >
              {isHi ? 'लाइव सिंक करें' : 'Sync Live'}
            </button>
          </div>

          {/* My Drafts Banner — shown when there are unsent draft requests */}
          {requests.filter(r => r.status === 'draft').length > 0 && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-800">
                  {requests.filter(r => r.status === 'draft').length} Saved Draft{requests.filter(r => r.status === 'draft').length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[11px] text-amber-700">These requests were saved without broadcasting. Tap to send them when ready.</p>
              <div className="space-y-2">
                {requests.filter(r => r.status === 'draft').map(draft => (
                  <div key={draft.id} className="flex items-center justify-between bg-white rounded-xl border border-amber-200 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-ink-900">{draft.blood_type_needed} · {draft.units_required} unit(s)</p>
                      <p className="text-[10px] text-ink-500">{draft.hospital_name} · {draft.hospital_city}</p>
                    </div>
                    <button
                      onClick={() => handleBroadcastDraft(draft)}
                      disabled={broadcastingDraftId === draft.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[10px] transition-all cursor-pointer disabled:opacity-50"
                    >
                      {broadcastingDraftId === draft.id ? (
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Broadcast Now
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingData && requests.length === 0 ? (
            <div className="bg-white/80 backdrop-blur rounded-2xl border border-ink-200 p-8 text-center">
              <span className="w-6 h-6 border-2 border-blood-600 border-t-transparent rounded-full animate-spin inline-block"></span>
              <p className="text-xs text-ink-500 mt-2 font-semibold">{isHi ? 'अनुरोध सिंक हो रहे हैं...' : 'Syncing Requests...'}</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-white/80 backdrop-blur rounded-2xl border border-ink-200 p-8 text-center">
              <FileText className="w-10 h-10 mx-auto text-ink-300 mb-2" />
              <p className="text-sm text-ink-800 font-bold">{t.requesterDashboard.noRequests}</p>
              <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                {t.requesterDashboard.noRequestsSub}
              </p>
              <button
                id="btn-empty-create-req"
                onClick={onNavigateToRequest}
                className="mt-4 px-5 py-2.5 rounded-xl bg-blood-600 hover:bg-blood-700 text-white font-semibold text-xs tracking-wide transition-all shadow-sm cursor-pointer"
              >
                {t.requesterDashboard.newRequestBtn}
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {requests.map(req => {
                const isSelected = req.id === selectedRequestId;
                const reqMatches = matches.filter(m => m.request_id === req.id);
                const approvedCount = reqMatches.filter(m => m.donor_response === 'approved').length;

                return (
                  <button
                    key={req.id}
                    id={`btn-select-req-${req.id}`}
                    onClick={() => setSelectedRequestId(req.id)}
                    className={`w-full text-left p-4 rounded-2xl transition-all block cursor-pointer border ${
                      isSelected 
                        ? 'bg-white border-ink-200 shadow-premium' 
                        : 'bg-white/60 border-transparent hover:bg-white hover:border-ink-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                        {req.tracking_code}
                      </span>
                      {getUrgencyBadge(req.urgency_level)}
                    </div>

                    <h4 className="text-sm font-semibold text-ink-900 truncate">
                      {isHi ? 'मरीज:' : 'Patient:'} {req.patient_name}
                    </h4>

                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-ink-50 text-ink-700 border border-ink-100">
                        {isHi ? 'रक्त समूह:' : 'Type:'} {req.blood_type_needed}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-ink-50 text-ink-700 border border-ink-100">
                        {isHi ? 'यूनिट:' : 'Units:'} {req.units_required}
                      </span>
                      {getStatusBadge(req.status)}
                    </div>

                    <div className="mt-3 pt-3 border-t border-ink-100 flex justify-between items-center text-[10px] text-ink-500">
                      <span>
                        {isHi ? 'दिनांक:' : 'Created:'} {new Date(req.created_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-emerald-600">
                        <Users className="w-3.5 h-3.5" />
                        {approvedCount} {isHi ? 'दाता मिले' : 'matched'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right columns: Selected Request Match Operations & Management */}
        <div className="lg:col-span-2">
          {selectedRequest ? (
            <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 shadow-premium-lg overflow-hidden">
              
              {/* Card Header Info */}
              <div className="bg-gradient-to-br from-ink-50 to-white p-6 sm:p-8 border-b border-ink-100">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
                    {isHi ? 'सक्रिय अनुरोध' : 'Active Request'} &bull; {selectedRequest.tracking_code}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleBroadcast(selectedRequest)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                        selectedRequest.broadcast_to_simulator
                          ? 'bg-blood-600 text-white border-blood-600 shadow-sm'
                          : 'bg-white text-ink-600 border-ink-200 hover:border-blood-400'
                      }`}
                    >
                      📡 {selectedRequest.broadcast_to_simulator ? (isHi ? 'लाइव सिमुलेटर प्रसारण: चालू' : 'Live Simulator Broadcast: ON') : (isHi ? 'लाइव सिमुलेटर प्रसारण: बंद' : 'Live Simulator Broadcast: OFF')}
                    </button>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                </div>

                <h3 className="text-2xl font-semibold text-ink-900 mt-3 tracking-tight">
                  {selectedRequest.blood_type_needed} &bull; {selectedRequest.units_required} {isHi ? 'यूनिट' : 'units'}
                </h3>
                <p className="text-sm text-ink-500 mt-1">
                  {selectedRequest.hospital_name} &bull; {selectedRequest.hospital_city}
                  {selectedRequest.hospital_uhid && <span className="ml-2">UHID: {selectedRequest.hospital_uhid}</span>}
                  {selectedRequest.attending_doctor && <span className="ml-2">Dr. {selectedRequest.attending_doctor}</span>}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink-50 px-3 py-1.5 border border-ink-100">
                   <span className="text-xs font-semibold text-ink-700">{isHi ? 'मरीज:' : 'Patient:'} {selectedRequest.patient_name} {selectedRequest.patient_age ? `(${selectedRequest.patient_age}Y)` : ''}</span>
                </div>
              </div>

              {/* Patient and Hospital Meta Grid */}
              <div className="p-6 sm:p-8 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-ink-100">
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500 block">{isHi ? 'आवश्यक यूनिट' : 'Units Required'}</span>
                    <p className="text-sm font-semibold text-ink-900">{selectedRequest.units_required} {isHi ? 'यूनिट' : 'Bags / Units'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500 block">{isHi ? 'प्राथमिकता स्तर' : 'Urgency Priority'}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {getUrgencyBadge(selectedRequest.urgency_level)}
                      <span className="text-xs font-semibold text-ink-700">
                        {selectedRequest.urgency_level === 'critical' ? (isHi ? '6 घंटे में समाप्त' : 'Expires in 6 Hrs') : selectedRequest.urgency_level === 'urgent' ? (isHi ? '24 घंटे में समाप्त' : 'Expires in 24 Hrs') : (isHi ? 'नियोजित खोज' : 'Planned Search')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500 block">{isHi ? 'अस्पताल स्थान पिनकोड' : 'Hospital Location Pincode'}</span>
                    <p className="text-sm font-semibold text-ink-900">{selectedRequest.hospital_pincode} - {selectedRequest.hospital_area}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500 block">{isHi ? 'अनुरोध टिप्पणी' : 'Request Notes'}</span>
                    <p className="text-xs font-medium text-ink-600 italic leading-relaxed">
                      "{selectedRequest.additional_notes || 'No extra notes provided'}"
                    </p>
                  </div>
                </div>

                {/* Match Operations Section */}
                <div className="rounded-2xl bg-white border border-ink-100 p-5 shadow-premium">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-[12px] font-semibold text-ink-900 flex items-center gap-1.5">
                      {isHi ? 'प्रतिक्रिया देने वाले दाता' : 'Donors responding'}
                    </h4>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      {selectedMatches.length} {isHi ? 'मिले' : 'matched'}
                    </span>
                  </div>

                  {selectedMatches.length === 0 ? (
                    <div className="bg-ink-50 p-6 border border-dashed border-ink-200 rounded-xl text-center">
                      <p className="text-xs text-ink-800 font-semibold uppercase tracking-wider">{isHi ? 'निकटतम खोज जारी है' : 'Proximity Search in Progress'}</p>
                      <p className="text-[11px] text-ink-500 mt-2 leading-relaxed max-w-sm mx-auto">
                        {isHi ? `हम पिनकोड ${selectedRequest.hospital_pincode} के पास संगत रक्तदाताओं की खोज कर रहे हैं। मिलान यहाँ तुरंत दिखाई देंगे।` : `We are searching our database for compatible blood donors near pincode ${selectedRequest.hospital_pincode}. Matches will appear here instantly.`}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedMatches.map((match, idx) => {
                        const donor = donors.find(d => d.id === match.donor_id);
                        if (!donor) return null;

                        const isApproved = match.donor_response === 'approved';
                        const isDeclined = match.donor_response === 'declined';
                        const isPending = match.donor_response === 'pending';

                        return (
                          <div 
                            key={match.id}
                            id={`match-row-${match.id}`}
                            className={`p-3 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${
                              isApproved ? 'bg-emerald-50/60 border border-emerald-100' :
                              isDeclined ? 'bg-ink-50/50 border border-ink-100 opacity-60' :
                              'bg-ink-50/80 border border-ink-100'
                            }`}
                          >
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                              <div className={`grid h-9 w-9 place-items-center rounded-full text-white text-[10px] font-semibold shrink-0 ${isApproved ? 'blood-drop-gradient shadow-sm' : 'bg-ink-300'}`}>
                                {isApproved ? donor.full_name[0] : '?'}
                              </div>
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-[11.5px] text-ink-900 flex items-center gap-1.5">
                                    {isApproved ? donor.full_name : (isHi ? `रक्तदाता #${idx + 1}` : `Donor #${idx + 1}`)}
                                    {donor.aadhaar_verified && isApproved && (
                                      <Shield className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/20" title="DigiLocker Verified" />
                                    )}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white border border-ink-200 text-ink-700">
                                    {donor.blood_type}
                                  </span>
                                </div>
                                <p className="text-[10px] text-ink-500 flex items-center gap-1">
                                  {donor.area} ({donor.pincode}) &bull; ~{match.distance_km ? `${match.distance_km} ${isHi ? 'किमी दूर' : 'km away'}` : (isHi ? '2 किमी दूर' : '2km away')}
                                </p>
                              </div>
                            </div>

                            <div className="flex-shrink-0 w-full sm:w-auto sm:text-right flex flex-col sm:items-end gap-2">
                              {isPending && (
                                <>
                                  <p className="text-[10.5px] font-semibold text-amber-600 flex items-center gap-1">
                                    <Clock className="w-3 h-3 animate-spin" />
                                    {isHi ? 'प्रतीक्षारत' : 'Pending'}
                                  </p>
                                  <p className="text-[10px] text-ink-500">{isHi ? 'सूचित किया गया' : 'Notified'}</p>
                                </>
                              )}
                              
                              {isDeclined && (
                                <>
                                  <p className="text-[10.5px] font-semibold text-ink-400">{isHi ? 'अस्वीकृत' : 'Declined'}</p>
                                </>
                              )}

                              {isApproved && (
                                <div className="flex flex-col sm:items-end w-full">
                                  <p className="text-[10.5px] font-semibold text-emerald-600 mb-2">{isHi ? 'पुष्टि की गई' : 'Confirmed'}</p>
                                  <div className="flex gap-2 w-full sm:w-auto">
                                    <a
                                      id={`lnk-call-donor-${match.id}`}
                                      href={`tel:${donor.phone}`}
                                      className="flex-1 sm:flex-initial px-3 py-1.5 bg-white hover:bg-ink-50 text-ink-700 border border-ink-200 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                                    >
                                      <Phone className="w-3 h-3" />
                                      {isHi ? 'कॉल' : 'Call'}
                                    </a>
                                    {donor.whatsapp_number && (
                                      <a
                                        id={`lnk-wa-donor-${match.id}`}
                                        href={`https://wa.me/${donor.whatsapp_number.replace(/\+/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 sm:flex-initial px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#1da851] border border-[#25D366]/30 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                                      >
                                        <MessageSquare className="w-3 h-3" />
                                        {isHi ? 'चैट' : 'Chat'}
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Dashboard Request Level Action Buttons */}
                {selectedRequest.status !== 'fulfilled' && selectedRequest.status !== 'cancelled' ? (
                  <div className="pt-6 border-t border-ink-100 flex flex-wrap gap-3">
                    <button
                      id="btn-fulfill-req-act"
                      onClick={() => handleFulfillRequest(selectedRequest)}
                      className="px-6 py-2.5 bg-ink-900 hover:bg-ink-800 text-white rounded-xl font-semibold text-[11px] tracking-wide transition-all shadow-sm flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {isHi ? 'पूर्ण के रूप में चिह्नित करें और खोज समाप्त करें' : 'Mark Fulfilled & Complete Search'}
                    </button>
                    <button
                      id="btn-cancel-req-act"
                      onClick={() => handleCancelRequest(selectedRequest)}
                      className="px-6 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-ink-200 hover:border-red-200 rounded-xl font-semibold text-[11px] tracking-wide transition-all flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      {isHi ? 'खोज रद्द करें' : 'Cancel Search'}
                    </button>
                  </div>
                ) : (
                  <div className="pt-6 border-t border-ink-100 bg-ink-50/50 rounded-xl p-5 text-center border border-ink-100">
                    <p className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider">
                      {isHi ? 'अनुरोध की स्थिति है:' : 'Request status is:'} <strong className="text-blood-600 ml-1">{selectedRequest.status}</strong>
                    </p>
                    <p className="text-[11px] text-ink-500 mt-1.5">
                      {isHi ? 'यह रक्त खोज अभियान पूरा हो चुका है। आगे कोई दाता मिलान प्रसारण ट्रिगर नहीं होगा।' : 'This blood search operation has finished. No further donor match broadcasts will trigger.'}
                    </p>
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 shadow-premium-lg p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-16 h-16 rounded-2xl bg-blood-50 flex items-center justify-center text-blood-500 mb-4 border border-blood-100/50">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-ink-900 tracking-tight">{isHi ? 'एक रक्त अनुरोध चुनें' : 'Select a Blood Request'}</h3>
              <p className="text-sm text-ink-500 mt-2 max-w-sm leading-relaxed">
                {isHi ? 'लाइव दाता मिलान प्रतिक्रियाएं देखने के लिए बाईं सूची से अपना कोई अनुरोध चुनें।' : 'Choose one of your requirements from the left list to view live donor match responses and consent gateways.'}
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
