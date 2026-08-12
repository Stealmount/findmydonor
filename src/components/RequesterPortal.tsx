import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Requester, BloodRequest, Match, User } from '../types';
import { authenticatedApi } from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import { StateMessage } from './ui/StateMessage';
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
  Droplet,
  FileText,
  Save,
  ArrowRight,
  PlusCircle,
  Users,
  Search,
  Check,
  ChevronRight,
  Sparkles,
  Trash2
} from 'lucide-react';
import DeleteAccountModal from './ui/DeleteAccountModal';

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
  const { t, language, setLanguage } = useLanguage();
  const isHi = language === 'HI';
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Dashboard state
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [donors, setDonors] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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
      setDataError(isHi ? 'आपका डेटा लोड नहीं हो सका। कृपया पुनः प्रयास करें।' : 'Could not load your data. Please try again.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (currentRequester) {
      loadDashboardData();
    }
  }, [currentRequester]);



  // Actions on blood requests
  const handleFulfillRequest = async (request: BloodRequest) => {
    if (!window.confirm("Marking this request as fulfilled will close search and send simulated WhatsApp cooldown confirmations to all approved donors. Proceed?")) return;

    try {
      const nowStr = new Date().toISOString();
      
      await authenticatedApi(`/api/requests/${request.tracking_code}/fulfill`, {}, 'PATCH');

      // Trigger verification messages for matches who approved
      const reqMatches = matches.filter(m => m.request_id === request.id);
      const approvedMatches = reqMatches.filter(m => m.donor_response === 'approved');

      for (const m of approvedMatches) {
        const donor = donors.find(d => d.id === m.donor_id);
        if (donor) {
          const checkNotifId = crypto.randomUUID();
          const bodyMsg = `Did you successfully donate blood for Request ID: ${request.tracking_code} at ${request.hospital_name}? Reply YES to CONFIRM and activate your 60-day recovery cooldown, or NO to indicate it did not happen.`;
          
          await authenticatedApi('/api/notifications', {
            id: checkNotifId,
            type: 'whatsapp',
            recipient_type: 'donor',
            recipient_id: donor.id,
            trigger_event: 'cooldown_verification',
            message_body: bodyMsg,
            status: 'delivered',
            sent_at: nowStr,
            created_at: nowStr
          }, 'POST');
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

      showToast(isHi ? "रक्त अनुरोध सफलतापूर्वक पूर्ण हुआ!" : "Blood request marked as fulfilled successfully!", 'success');
    } catch (err) {
      console.error("Fulfill failed: ", err);
      showToast(isHi ? "अनुरोध पूरा करने में विफल। कृपया पुनः प्रयास करें।" : "Failed to fulfill request. Please try again.", 'error');
    }
  };

  const handleCancelRequest = async (request: BloodRequest) => {
    if (!window.confirm("Are you sure you want to cancel this request? It will be marked inactive and retracted from matching systems.")) return;

    try {
      await authenticatedApi(`/api/requests/${request.tracking_code}/cancel`, {}, 'PATCH');

      await loadDashboardData();
      if (onStateChange) onStateChange();
      showToast(isHi ? "रक्त अनुरोध सफलतापूर्वक रद्द कर दिया गया।" : "Blood request cancelled successfully.", 'success');
    } catch (err) {
      console.error("Cancel failed: ", err);
      showToast(isHi ? "अनुरोध रद्द करने में विफल।" : "Failed to cancel request.", 'error');
    }
  };

  const handleToggleBroadcast = async (req: BloodRequest) => {
    try {
      await authenticatedApi(`/api/requests/${req.tracking_code}/broadcast-toggle`, {}, 'PATCH');
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
  const getStatusBadge = (status: string, reqId?: string) => {
    const reqMatches = matches.filter(m => m.request_id === (reqId || ''));
    const hasApproved = reqMatches.some(m => m.donor_response === 'approved');
    const effectiveStatus = (hasApproved && (status === 'open' || status === 'matching' || status === 'broadcasting')) ? 'partially_matched' : status;

    switch (effectiveStatus) {
      case 'draft':
        return <span className="inline-flex items-center rounded-full bg-ink-100 px-2.5 py-0.5 text-[10px] font-semibold text-ink-600 border border-ink-300 uppercase">Draft</span>;
      case 'broadcasting':
        return <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-semibold text-orange-700 border border-orange-200 uppercase animate-pulse">Broadcasting</span>;
      case 'open':
        return <span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-0.5 text-[10px] font-semibold text-yellow-700 border border-yellow-200 uppercase">{isHi ? 'खोज जारी' : 'Searching'}</span>;
      case 'matching':
        return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200 uppercase animate-pulse">{isHi ? 'मिलान जारी' : 'Matching'}</span>;
      case 'partially_matched':
        return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200 uppercase font-bold">{isHi ? 'दाता मिला' : 'Donor Matched'}</span>;
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
      showToast(isHi ? 'प्रसारण करने में विफल। कृपया पुनः प्रयास करें।' : 'Failed to broadcast. Please try again.', 'error');
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

        <div className="p-8 space-y-4">
          <p className="text-sm text-ink-600 text-center">{isHi ? 'कृपया अपना डैशबोर्ड एक्सेस करने के लिए साइन इन करें।' : 'Please sign in to access your dashboard.'}</p>
          <button
            id="btn-requester-signin"
            type="button"
            onClick={onNavigateToRegister}
            className="w-full h-12 rounded-xl bg-blood-600 hover:bg-blood-700 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {isHi ? 'साइन इन / पंजीकरण करें' : 'Sign In / Register'}
          </button>
        </div>
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

        <div className="flex flex-wrap items-center gap-3">
          <button
            id="btn-dashboard-new-req"
            onClick={onNavigateToRequest}
            className="btn-glow inline-flex items-center justify-center gap-2 rounded-xl bg-blood-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blood-700 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            {t.requesterDashboard.newRequestBtn}
          </button>
          <button
            id="btn-requester-delete-account"
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            {isHi ? 'खाता हटाएं' : 'Delete Account'}
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

      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDeleted={onLogout}
      />

      {/* Requester Stat Strip */}
      <div id="requester-stat-strip" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
              {isHi ? 'सक्रिय प्रसारण' : 'Active Broadcasts'}
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blood-500/10 text-blood-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-ink-900 mt-2">
            {requests.filter(r => ['open', 'broadcasting', 'matching', 'partially_matched'].includes(r.status)).length}
          </p>
          <p className="text-[11px] text-ink-400 mt-1">
            {isHi ? 'वर्तमान में सक्रिय' : 'Currently active emergency requests'}
          </p>
        </div>

        <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
              {isHi ? 'मिले हुए रक्तदाता' : 'Donors Matched'}
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-ink-900 mt-2">
            {matches.filter(m => m.donor_response === 'approved').length}
          </p>
          <p className="text-[11px] text-ink-400 mt-1">
            {isHi ? 'पुष्टीकृत रक्तदाता' : 'Confirmed accepting donors'}
          </p>
        </div>

        <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
              {isHi ? 'पूर्ण किए गए मामले' : 'Fulfilled Cases'}
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600 mt-2">
            {requests.filter(r => r.status === 'fulfilled').length}
          </p>
          <p className="text-[11px] text-ink-400 mt-1">
            {isHi ? 'सफलतापूर्वक समाप्त' : 'Successfully completed requests'}
          </p>
        </div>
      </div>

      {/* ⚡ Emergency Request Command Center */}
      <div className="rounded-3xl bg-gradient-to-r from-ink-900 via-ink-950 to-blood-950 border border-blood-500/30 p-6 sm:p-8 text-white relative overflow-hidden shadow-premium-lg">
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-blood-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blood-500/20 border border-blood-500/30 text-blood-400 text-[11px] font-mono font-bold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isHi ? '⚡ आपातकालीन अनुरोध कमांड सेंटर' : '⚡ Emergency Request Command Center'}</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {isHi ? 'नया आपातकालीन रक्त अनुरोध जनरेट करें' : 'Generate & Broadcast Emergency Blood Requests'}
            </h3>
            <p className="text-xs text-ink-300 leading-relaxed">
              {isHi
                ? 'तुरंत रक्त अनुरोध बनाएं, लाइव दाताओं से जुड़ें और 60 सेकंड से कम समय में अपने टिकट्स प्रबंधित करें।'
                : 'Instantly create verified emergency blood requests, broadcast to compatible nearby donors, and manage live tracking tickets.'}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-semibold text-ink-300">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{requests.filter(r => ['broadcasting', 'open', 'matching', 'partially_matched'].includes(r.status)).length} Active Broadcasts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>{requests.filter(r => r.status === 'draft').length} Saved Drafts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span>{requests.filter(r => r.status === 'fulfilled').length} Fulfilled Cases</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
            <button
              id="btn-command-center-generate"
              onClick={onNavigateToRequest}
              className="px-6 py-4 rounded-2xl btn-glow bg-gradient-to-r from-blood-600 via-blood-600 to-blood-700 hover:from-blood-500 hover:to-blood-600 text-white font-extrabold text-sm shadow-xl flex items-center justify-center gap-2.5 transition-all cursor-pointer group active:scale-[0.99]"
            >
              <PlusCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>{isHi ? '➕ नया अनुरोध जनरेट करें' : '➕ Generate New Emergency Request'}</span>
            </button>
          </div>
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

          {dataError ? (
            <StateMessage
              variant="error"
              title={dataError}
              onRetry={() => { setDataError(null); loadDashboardData(); }}
              isHi={isHi}
            />
          ) : loadingData && requests.length === 0 ? (
            <div className="bg-white/80 backdrop-blur rounded-2xl border border-ink-200 p-8 text-center">
              <span className="w-6 h-6 border-2 border-blood-600 border-t-transparent rounded-full animate-spin inline-block"></span>
              <p className="text-xs text-ink-500 mt-2 font-semibold">{isHi ? 'अनुरोध सिंक हो रहे हैं...' : 'Syncing Requests...'}</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-white/80 backdrop-blur rounded-2xl border border-ink-200 p-8 text-center">
              <Droplet className="w-10 h-10 mx-auto text-ink-300 mb-2" />
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
                      {getStatusBadge(req.status, req.id)}
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
                                      <span title="DigiLocker Verified"><Shield className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/20" /></span>
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
                  <div className="bg-ink-50/50 rounded-xl p-5 text-center border border-ink-100 mt-6">
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

      {toast && (
        <div
          id="requester-toast"
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-bottom-4 flex items-center gap-3 text-xs font-bold ${
            toast.type === 'error'
              ? 'bg-red-900/90 text-white border-red-500/50 shadow-red-900/30'
              : 'bg-emerald-900/90 text-white border-emerald-500/50 shadow-emerald-900/30'
          }`}
        >
          <span className="text-base">{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
