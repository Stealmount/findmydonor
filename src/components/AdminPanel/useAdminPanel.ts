import { useState, useEffect, useCallback } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { User, BloodRequest, Match, NotificationLog, DonationLog, Requester } from '../../types';
import { authenticatedApi } from '../../lib/api';
import { AdminTab } from '../admin/AdminShell';
import { Toast } from '../admin/widgets/Shared';

const ADMIN_EMAIL = import.meta.env?.VITE_ADMIN_EMAIL || 'admin@findmydonor.online';

export interface DrawerState {
 kind: 'donor' | 'requester';
 donor?: User;
 requester?: Requester;
 donorProfile?: any;
 stats?: any;
}

export interface AuditEntry {
 id: string;
 actor: string;
 action: string;
 entity_type: string;
 entity_id: string;
 meta?: string;
 created_at: string;
}

export interface FaqEntry {
 id: string;
 title_en: string;
 title_hi: string;
 body_en: string;
 body_hi: string;
 active: boolean;
 created_at: string;
 updated_at?: string;
}

export default function useAdminPanel() {
 // Auth State — check Firebase auth on mount
 const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
 try {
 const saved = localStorage.getItem('fmd_admin_session');
 if (saved) {
 const parsed = JSON.parse(saved);
 if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
 return true;
 }
 }
 } catch { }
 return false;
 });
 const [adminEmail, setAdminEmail] = useState('');
 const [adminPassword, setAdminPassword] = useState('');
 const [adminError, setAdminError] = useState('');

 // Keep admin state in sync with Firebase Auth
 useEffect(() => {
 const unsubscribe = onAuthStateChanged(auth, (user) => {
 if (!user || user.email !== ADMIN_EMAIL) {
 setIsAdminLoggedIn(false);
 localStorage.removeItem('fmd_admin_session');
 }
 });
 return () => unsubscribe();
 }, []);

 // Toast queue — replaces alert()
 const [toasts, setToasts] = useState<Toast[]>([]);
 const pushToast = useCallback((kind: Toast['kind'], message: string) => {
 const id = Date.now() + Math.random();
 setToasts(t => [...t, { id, kind, message }]);
 setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
 }, []);

 // Data State
 const [donors, setDonors] = useState<User[]>([]);
 const [requests, setRequests] = useState<BloodRequest[]>([]);
 const [matches, setMatches] = useState<Match[]>([]);
 const [notifications, setNotifications] = useState<NotificationLog[]>([]);
 const [donationLogs, setDonationLogs] = useState<DonationLog[]>([]);
 const [telemetry, setTelemetry] = useState<any>(null);

 // Governance data (Phase-added)
 const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
 const [auditLoading, setAuditLoading] = useState(false);
 const [faqs, setFaqs] = useState<FaqEntry[]>([]);
 const [faqLoading, setFaqLoading] = useState(false);

 // Active Navigation View
 const [activeTab, setActiveTab] = useState<AdminTab>('overview');

 // Filters & Search
 const [globalSearch, setGlobalSearch] = useState('');
 const [donorBloodFilter, setDonorBloodFilter] = useState('');
 const [requestStatusFilter, setRequestStatusFilter] = useState('');
 const [requestUrgencyFilter, setRequestUrgencyFilter] = useState('');
 const [institutionStatusFilter, setInstitutionStatusFilter] = useState('');
 const [auditActionFilter, setAuditActionFilter] = useState('');

 // ─── Donor & Requester Profile Management State ───────────────────────────
 const [requesters, setRequesters] = useState<Requester[]>([]);
 const [showDeletedDonors, setShowDeletedDonors] = useState(false);
 const [showDeletedRequesters, setShowDeletedRequesters] = useState(false);
 const [requestersLoading, setRequestersLoading] = useState(false);
 const [donorsLoading, setDonorsLoading] = useState(false);
 const [profileActionLoading, setProfileActionLoading] = useState(false);

 const [drawer, setDrawer] = useState<DrawerState | null>(null);
 const [editForm, setEditForm] = useState<Record<string, string>>({});

 const loadRequesters = async (showDeleted = showDeletedRequesters) => {
 setRequestersLoading(true);
 try {
 const data = await authenticatedApi<{ requesters: Requester[] }>(
 `/api/admin/requesters${showDeleted ? '?status=deleted' : ''}`, undefined, 'GET'
 );
 setRequesters(data.requesters || []);
 } catch { /* silent */ } finally {
 setRequestersLoading(false);
 }
 };

 const loadDonors = async (showDeleted: boolean) => {
 setDonorsLoading(true);
 try {
 const data = await authenticatedApi<{ donors: User[] }>(
 `/api/admin/donors${showDeleted ? '?status=deleted' : ''}`, undefined, 'GET'
 );
 setDonors(data.donors || []);
 } catch { /* silent */ } finally {
 setDonorsLoading(false);
 }
 };

 const openDonorDetail = async (donor: User) => {
 try {
 const data = await authenticatedApi<{ donor: User; donorProfile: any; stats: any }>(
 `/api/admin/donors/${donor.id}`, undefined, 'GET'
 );
 setDrawer({ kind: 'donor', donor: data.donor, donorProfile: data.donorProfile, stats: data.stats });
 setEditForm({
 full_name: data.donor.full_name || '',
 email: data.donor.email || '',
 phone: data.donor.phone || '',
 whatsapp_number: data.donor.whatsapp_number || '',
 blood_type: data.donor.blood_type || '',
 pincode: data.donor.pincode || '',
 area: data.donor.area || '',
 city: data.donor.city || '',
 state: data.donor.state || '',
 address_text: data.donor.address_text || '',
 weight_kg: data.donor.weight_kg ? String(data.donor.weight_kg) : '',
 availability_status: data.donor.availability_status || '',
 emergency_only: data.donor.emergency_only ? 'true' : 'false',
 number_sharing_pref: data.donor.number_sharing_pref || 'on_approval',
 age: data.donor.age ? String(data.donor.age) : '',
 gender: data.donor.gender || '',
 });
 } catch { pushToast('error', 'Failed to load donor details.'); }
 };

 const openRequesterDetail = async (requester: Requester) => {
 try {
 const data = await authenticatedApi<{ requester: Requester; profile?: any; stats?: any }>(
 `/api/admin/requesters/${requester.id}`, undefined, 'GET'
 );
 setDrawer({ kind: 'requester', requester: data.requester });
 setEditForm({
 full_name: data.requester.full_name || '',
 email: data.requester.email || '',
 phone: data.requester.phone || '',
 whatsapp_number: data.requester.whatsapp_number || '',
 });
 } catch { pushToast('error', 'Failed to load requester details.'); }
 };

 const saveProfileEdit = async () => {
 if (!drawer) return;
 setProfileActionLoading(true);
 try {
 const id = drawer.kind === 'donor' ? drawer.donor!.id : drawer.requester!.id;
 const payload: Record<string, unknown> = { ...editForm };
 if (drawer.kind === 'donor') {
 payload.weight_kg = editForm.weight_kg ? Number(editForm.weight_kg) : null;
 payload.age = editForm.age ? Number(editForm.age) : null;
 payload.emergency_only = editForm.emergency_only === 'true';
 }
 await authenticatedApi(`/api/admin/${drawer.kind}s/${id}`, payload, 'PATCH');
 pushToast('success', 'Profile updated successfully.');
 setDrawer(null);
 if (drawer.kind === 'donor') { await loadDonors(showDeletedDonors); await loadAdminData(); }
 else { await loadRequesters(showDeletedRequesters); }
 } catch (err: any) {
 pushToast('error', err?.message || 'Failed to update profile.');
 } finally {
 setProfileActionLoading(false);
 }
 };

 const softDeleteProfile = async () => {
 if (!drawer) return;
 setProfileActionLoading(true);
 try {
 const id = drawer.kind === 'donor' ? drawer.donor!.id : drawer.requester!.id;
 await authenticatedApi(`/api/admin/${drawer.kind}s/${id}`, {}, 'DELETE');
 pushToast('info', `${drawer.kind} account soft-deleted.`);
 setDrawer(null);
 if (drawer.kind === 'donor') { await loadDonors(showDeletedDonors); await loadAdminData(); }
 else { await loadRequesters(showDeletedRequesters); }
 } catch (err: any) {
 pushToast('error', err?.message || 'Failed to delete account.');
 } finally {
 setProfileActionLoading(false);
 }
 };

 const restoreProfile = async () => {
 if (!drawer) return;
 setProfileActionLoading(true);
 try {
 const id = drawer.kind === 'donor' ? drawer.donor!.id : drawer.requester!.id;
 await authenticatedApi(`/api/admin/${drawer.kind}s/${id}`, { account_status: 'active' }, 'PATCH');
 pushToast('success', 'Account restored to active.');
 setDrawer(null);
 if (drawer.kind === 'donor') { await loadDonors(showDeletedDonors); await loadAdminData(); }
 else { await loadRequesters(showDeletedRequesters); }
 } catch (err: any) {
 pushToast('error', err?.message || 'Failed to restore account.');
 } finally {
 setProfileActionLoading(false);
 }
 };

 // SOS Broadcaster Form State
 const [sosCity, setSosCity] = useState('');
 const [sosBloodType, setSosBloodType] = useState('');
 const [sosMessage, setSosMessage] = useState('');
 const [sosSending, setSosSending] = useState(false);
 const [sosStatus, setSosStatus] = useState<string | null>(null);

 // Institutions state
 const [institutions, setInstitutions] = useState<any[]>([]);
 const [institutionsLoading, setInstitutionsLoading] = useState(false);
 const [institutionReviewId, setInstitutionReviewId] = useState<string | null>(null);
 const [institutionRejectReason, setInstitutionRejectReason] = useState('');
 const [institutionActionLoading, setInstitutionActionLoading] = useState(false);

 const loadInstitutions = async () => {
 setInstitutionsLoading(true);
 try {
 const data = await authenticatedApi<{ institutions: any[] }>('/api/admin/institutions', undefined, 'GET');
 setInstitutions(data.institutions || []);
 } catch { /* silent */ } finally {
 setInstitutionsLoading(false);
 }
 };

 const handleInstitutionReview = async (id: string, action: 'approve' | 'reject', reason?: string) => {
 try {
 await authenticatedApi(`/api/admin/institutions/${id}/review`, {
 action,
 rejection_reason: action === 'reject' ? reason : undefined,
 }, 'PATCH');
 setInstitutionReviewId(null);
 setInstitutionRejectReason('');
 await loadInstitutions();
 await loadAdminData();
 pushToast('success', `Institution ${action === 'approve' ? 'APPROVED' : 'REJECTED'}. Notification sent.`);
 } catch (err: any) {
 pushToast('error', err?.message || 'Failed to update institution status.');
 }
 };

 const [loading, setLoading] = useState(false);
 const [dashboardError, setDashboardError] = useState<string | null>(null);

 const loadAdminData = async () => {
 setLoading(true);
 setDashboardError(null);
 try {
 const data = await authenticatedApi<{
 users: User[];
 blood_requests: BloodRequest[];
 matches: Match[];
 notifications: NotificationLog[];
 donation_log: DonationLog[];
 }>('/api/admin/dashboard', undefined, 'GET');

 setDonors(data.users || []);
 setRequests(data.blood_requests || []);
 setMatches(data.matches || []);
 setNotifications(data.notifications || []);
 setDonationLogs(data.donation_log || []);

 fetch('/api/admin/telemetry')
 .then(r => r.json())
 .then(tData => setTelemetry(tData.telemetry || null))
 .catch(() => {});
 } catch (err: any) {
 console.error(err);
 setDashboardError(err?.message || 'Failed to load data');
 } finally {
 setLoading(false);
 }
 };

 // ─── Governance: Audit log + FAQ ─────────────────────────────────────────
 const loadAudit = async () => {
 setAuditLoading(true);
 try {
 const data = await authenticatedApi<{ audits: AuditEntry[] }>('/api/admin/audit', undefined, 'GET');
 setAuditLogs(data.audits || []);
 } catch { /* silent */ } finally {
 setAuditLoading(false);
 }
 };

 const loadFaqs = async () => {
 setFaqLoading(true);
 try {
 const data = await authenticatedApi<{ faqs: FaqEntry[] }>('/api/admin/faqs', undefined, 'GET');
 setFaqs(data.faqs || []);
 } catch { /* silent */ } finally {
 setFaqLoading(false);
 }
 };

 const saveFaq = async (faq: Omit<FaqEntry, 'id' | 'created_at'> & { id?: string }) => {
 try {
 if (faq.id) {
 const { id, ...body } = faq;
 await authenticatedApi(`/api/admin/faqs/${id}`, body, 'PATCH');
 } else {
 await authenticatedApi('/api/admin/faqs', faq, 'POST');
 }
 await loadFaqs();
 pushToast('success', 'FAQ saved.');
 return true;
 } catch (err: any) {
 pushToast('error', err?.message || 'Failed to save FAQ.');
 return false;
 }
 };

 const toggleFaqActive = async (id: string, active: boolean) => {
 try {
 await authenticatedApi(`/api/admin/faqs/${id}`, { active }, 'PATCH');
 await loadFaqs();
 pushToast('info', active ? 'FAQ published.' : 'FAQ hidden.');
 } catch {
 pushToast('error', 'Failed to update FAQ.');
 }
 };

 // ─── Bulk donor actions ──────────────────────────────────────────────────
 const handleBulkApprove = async (ids: string[]) => {
 let ok = 0;
 for (const id of ids) {
 try { await authenticatedApi(`/api/admin/donors/${id}/approve`, {}, 'PATCH'); ok++; } catch { /* per-row */ }
 }
 pushToast('success', `${ok}/${ids.length} donors reactivated.`);
 await loadAdminData();
 };

 const handleBulkCooldown = async (ids: string[]) => {
 const confirmed = window.confirm(`${ids.length} donors moved to 60-day cooldown?`);
 if (!confirmed) return;
 let ok = 0;
 for (const id of ids) {
 try { await authenticatedApi(`/api/admin/donors/${id}/log-donation`, {}, 'POST'); ok++; } catch { /* per-row */ }
 }
 pushToast('success', `${ok}/${ids.length} donors put on cooldown.`);
 await loadAdminData();
 };

 // ─── Match outcome override ──────────────────────────────────────────────
 const overrideMatchOutcome = async (matchId: string, outcome: 'donated' | 'cancelled') => {
 try {
 await authenticatedApi('/api/admin/matches', { matchId, payload: { outcome, outcome_confirmed_at: new Date().toISOString() } }, 'POST');
 await loadAdminData();
 pushToast('success', 'Match outcome updated.');
 } catch {
 pushToast('error', 'Failed to update match outcome.');
 }
 };

 useEffect(() => {
 if (isAdminLoggedIn) {
 loadAdminData();
 loadInstitutions();
 loadAudit();
 loadFaqs();
 const interval = setInterval(() => {
 loadAdminData();
 loadInstitutions();
 }, 30000);
 return () => clearInterval(interval);
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [isAdminLoggedIn]);

 const handleAdminLogin = async (e: React.FormEvent) => {
 e.preventDefault();
 const trimmedEmail = adminEmail.trim();
 if (!trimmedEmail || !adminPassword) {
 setAdminError('Enter both email and password');
 return;
 }
 try {
 const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, adminPassword);
 if (userCredential.user.email !== ADMIN_EMAIL) {
 await signOut(auth);
 setAdminError('Unauthorized: Only admin accounts can access this panel.');
 return;
 }
 sessionStorage.setItem('fmd_admin_secret', 'firebase-admin');
 const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
 localStorage.setItem('fmd_admin_session', JSON.stringify({ loggedIn: true, expiresAt }));
 setIsAdminLoggedIn(true);
 setAdminError('');
 } catch (err: any) {
 const code = err?.code;
 if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
 setAdminError('Invalid email or password');
 } else {
 setAdminError('Login failed. Please try again.');
 }
 }
 };

 const handleSendSOSBroadcast = async (e: React.FormEvent) => {
 e.preventDefault();
 setSosSending(true);
 setSosStatus(null);
 try {
 const res = await authenticatedApi<{ success: boolean; recipients_count: number }>('/api/admin/broadcast-sos', {
 city: sosCity,
 blood_type: sosBloodType,
 message_body: sosMessage
 }, 'POST');
 setSosStatus(`Dispatched emergency alert to ${res.recipients_count || 0} active donors.`);
 setSosMessage('');
 loadAdminData();
 pushToast('success', `SOS broadcast sent to ${res.recipients_count || 0} donors.`);
 } catch {
 setSosStatus('Failed to send broadcast alert.');
 } finally {
 setSosSending(false);
 }
 };

 const handleTriggerSweep = async () => {
 try {
 await authenticatedApi('/api/admin/engine/sweep', {}, 'POST');
 pushToast('success', 'System-wide matching algorithm executed successfully.');
 loadAdminData();
 } catch {
 pushToast('error', 'Failed to trigger match sweep.');
 }
 };

 const handleForceCooldown = async (donorId: string) => {
 if (!window.confirm('Apply 60-day medical cooldown period to donor?')) return;
 try {
 await authenticatedApi(`/api/admin/donors/${donorId}/log-donation`, {}, 'POST');
 pushToast('success', 'Cooldown applied.');
 loadAdminData();
 } catch { pushToast('error', 'Failed to apply cooldown.'); }
 };

  const handleLiftCooldown = async (donorId: string) => {
    if (!window.confirm('Reinstate donor status to active?')) return;
    try {
      await authenticatedApi(`/api/admin/donors/${donorId}/approve`, {}, 'PATCH');
      pushToast('success', 'Donor reactivated.');
      loadAdminData();
    } catch { pushToast('error', 'Failed to reactivate donor.'); }
  };

  const handleBanDonor = async (donorId: string, reason?: string) => {
    try {
      await authenticatedApi(`/api/admin/donors/${donorId}/ban`, { banReason: reason || 'Admin ban from panel' }, 'PATCH');
      pushToast('success', 'Donor banned.');
      loadAdminData();
    } catch { pushToast('error', 'Failed to ban donor.'); }
  };

  const handleUnbanDonor = async (donorId: string) => {
    try {
      await authenticatedApi(`/api/admin/donors/${donorId}/approve`, {}, 'PATCH');
      pushToast('success', 'Donor unbanned and reactivated.');
      loadAdminData();
    } catch { pushToast('error', 'Failed to unban donor.'); }
  };

 const handleExportCSV = () => {
 const headers = ['ID', 'Full Name', 'Phone', 'Blood Group', 'Pincode', 'Status', 'Last Donation'];
 const rows = donors.map(d => [d.id, d.full_name, d.phone, d.blood_type, d.pincode, d.account_status, d.last_donation_date || 'N/A']);
 const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
 const link = document.createElement('a');
 link.setAttribute('href', encodeURI(csvContent));
 link.setAttribute('download', `FindMyDonor_AuditReport_${new Date().toISOString().split('T')[0]}.csv`);
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 };

 const logout = async () => {
 try {
 await signOut(auth);
 } catch { /* ignore signOut errors */ }
 localStorage.removeItem('fmd_admin_session');
 sessionStorage.removeItem('fmd_admin_secret');
 setIsAdminLoggedIn(false);
 };

 return {
 // auth
 isAdminLoggedIn, adminEmail, setAdminEmail, adminPassword, setAdminPassword, adminError, handleAdminLogin, logout,
 // data
 donors, requests, matches, notifications, telemetry,
 // toast
 toasts, pushToast,
 // nav & filters
 activeTab, setActiveTab, globalSearch, setGlobalSearch, donorBloodFilter, setDonorBloodFilter,
 requestStatusFilter, setRequestStatusFilter, requestUrgencyFilter, setRequestUrgencyFilter,
 institutionStatusFilter, setInstitutionStatusFilter, auditActionFilter, setAuditActionFilter,
 // requesters/donors management
 requesters, showDeletedDonors, setShowDeletedDonors, showDeletedRequesters, setShowDeletedRequesters,
 requestersLoading, donorsLoading, profileActionLoading,
 loadRequesters, loadDonors, openDonorDetail, openRequesterDetail, saveProfileEdit, softDeleteProfile, restoreProfile,
 // drawer
 drawer, setDrawer, editForm, setEditForm,
 // sos
 sosCity, setSosCity, sosBloodType, setSosBloodType, sosMessage, setSosMessage, sosSending, sosStatus, handleSendSOSBroadcast,
 // institutions
 institutions, institutionsLoading, institutionReviewId, setInstitutionReviewId,
 institutionRejectReason, setInstitutionRejectReason, institutionActionLoading,
 loadInstitutions, handleInstitutionReview,
 // governance
 auditLogs, auditLoading, loadAudit, faqs, faqLoading, loadFaqs, saveFaq, toggleFaqActive,
 // bulk
 handleBulkApprove, handleBulkCooldown, overrideMatchOutcome,
    // actions
    handleTriggerSweep, handleForceCooldown, handleLiftCooldown, handleBanDonor, handleUnbanDonor, handleExportCSV,
 // data
 loadAdminData, donationLogs, loading, dashboardError,
 };
}
