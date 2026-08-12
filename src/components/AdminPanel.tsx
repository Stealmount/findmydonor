import React from 'react';
import { Droplets, ShieldCheck } from 'lucide-react';
import AdminShell, { AdminTab } from './admin/AdminShell';
import { ToastHost } from './admin/widgets/Shared';
import AdminLogin from './AdminPanel/AdminLogin';
import Overview from './admin/views/Overview';
import Donors from './admin/views/Donors';
import Requesters from './admin/views/Requesters';
import Requests from './admin/views/Requests';
import Matches from './admin/views/Matches';
import Institutions from './admin/views/Institutions';
import Notifications from './admin/views/Notifications';
import AuditLog from './admin/views/AuditLog';
import Faq from './admin/views/Faq';
import Roles from './admin/views/Roles';
import Settings from './admin/views/Settings';
import useAdminPanel from './AdminPanel/useAdminPanel';
import { useLanguage } from '../lib/LanguageContext';

export default function AdminPanel() {
  const { language } = useLanguage();
  const isHi = language === 'HI';
  const p = useAdminPanel();

  // Badges for sidebar nav
  const badges: Partial<Record<AdminTab, number>> = React.useMemo(() => ({
    institutions: p.institutions.filter((i: any) => i.verification_status === 'pending').length,
    requests: p.requests.filter((r: any) => r.urgency_level === 'critical' && ['open', 'broadcasting', 'matching'].includes(r.status)).length,
    matches: p.matches.filter((m: any) => m.donor_response === 'pending').length,
    donors: 0,
  }), [p.institutions, p.requests, p.matches]);

  if (!p.isAdminLoggedIn) {
    return (
      <>
        <AdminLogin
          password={p.adminPassword}
          error={p.adminError}
          onPasswordChange={p.setAdminPassword}
          onSubmit={p.handleAdminLogin}
        />
        <ToastHost toasts={p.toasts} isHi={isHi} />
      </>
    );
  }

  return (
    <AdminShell
      activeTab={p.activeTab}
      badges={badges}
      telemetry={p.telemetry}
      onTabChange={p.setActiveTab}
      onLoadRequesters={() => p.loadRequesters(p.showDeletedRequesters)}
      onLoadInstitutions={() => p.loadInstitutions()}
      onSweep={p.handleTriggerSweep}
      onLogout={p.logout}
      globalSearch={p.globalSearch}
      onGlobalSearchChange={p.setGlobalSearch}
    >
      {p.activeTab === 'overview' && (
        <Overview
          donors={p.donors} requests={p.requests} matches={p.matches}
          notifications={p.notifications} donationLogs={p.donationLogs}
          telemetry={p.telemetry} isHi={isHi} onExportCSV={p.handleExportCSV}
        />
      )}
      {p.activeTab === 'donors' && (
        <Donors
          donors={p.donors.filter((d: any) => p.showDeletedDonors || d.account_status !== 'deleted')}
          allDonors={p.donors}
          loading={p.donorsLoading}
          showDeleted={p.showDeletedDonors}
          bloodFilter={p.donorBloodFilter}
          search={p.globalSearch}
          isHi={isHi}
          onToggleDeleted={p.setShowDeletedDonors}
          onBloodFilterChange={p.setDonorBloodFilter}
          onSearchChange={p.setGlobalSearch}
          onOpenDetail={p.openDonorDetail}
          onForceCooldown={p.handleForceCooldown}
          onLiftCooldown={p.handleLiftCooldown}
          onBulkApprove={p.handleBulkApprove}
          onBulkCooldown={p.handleBulkCooldown}
        />
      )}
      {p.activeTab === 'requesters' && (
        <Requesters
          requesters={p.requesters}
          loading={p.requestersLoading}
          showDeleted={p.showDeletedRequesters}
          search={p.globalSearch}
          isHi={isHi}
          onToggleDeleted={p.setShowDeletedRequesters}
          onSearchChange={p.setGlobalSearch}
          onOpenDetail={p.openRequesterDetail}
          onRestore={p.restoreProfile}
        />
      )}
      {p.activeTab === 'requests' && (
        <Requests
          requests={p.requests} matches={p.matches}
          statusFilter={p.requestStatusFilter}
          urgencyFilter={p.requestUrgencyFilter}
          search={p.globalSearch}
          isHi={isHi}
          onStatusFilterChange={p.setRequestStatusFilter}
          onUrgencyFilterChange={p.setRequestUrgencyFilter}
          onSearchChange={p.setGlobalSearch}
        />
      )}
      {p.activeTab === 'matches' && (
        <Matches matches={p.matches} isHi={isHi} onOverrideOutcome={p.overrideMatchOutcome} />
      )}
      {p.activeTab === 'institutions' && (
        <Institutions
          institutions={p.institutions}
          loading={p.institutionsLoading}
          search={p.globalSearch}
          statusFilter={p.institutionStatusFilter}
          isHi={isHi}
          onSearchChange={p.setGlobalSearch}
          onStatusFilterChange={p.setInstitutionStatusFilter}
          onOpenDetail={() => {}}
          onApprove={(id) => p.handleInstitutionReview(id, 'approve')}
          onReject={(id, reason) => p.handleInstitutionReview(id, 'reject', reason)}
        />
      )}
      {p.activeTab === 'notifications' && (
        <Notifications
          notifications={p.notifications}
          isHi={isHi}
          sosCity={p.sosCity} sosBloodType={p.sosBloodType} sosMessage={p.sosMessage}
          sosSending={p.sosSending} sosStatus={p.sosStatus}
          onSosCityChange={p.setSosCity} onSosBloodTypeChange={p.setSosBloodType}
          onSosMessageChange={p.setSosMessage} onSendSos={p.handleSendSOSBroadcast}
        />
      )}
      {p.activeTab === 'audit' && (
        <AuditLog
          audits={p.auditLogs} loading={p.auditLoading}
          actionFilter={p.auditActionFilter} isHi={isHi}
          onActionFilterChange={p.setAuditActionFilter}
        />
      )}
      {p.activeTab === 'faq' && (
        <Faq
          faqs={p.faqs} loading={p.faqLoading} isHi={isHi}
          onSaveFaq={p.saveFaq} onToggleActive={p.toggleFaqActive}
        />
      )}
      {p.activeTab === 'roles' && <Roles isHi={isHi} />}
      {p.activeTab === 'settings' && (
        <Settings
          isHi={isHi} telemetry={p.telemetry} onRefresh={p.loadAdminData}
          onExportAll={p.handleExportCSV}
          donorsCount={p.donors.length} requestsCount={p.requests.length}
          matchesCount={p.matches.length} notificationsCount={p.notifications.length}
        />
      )}

      <ToastHost toasts={p.toasts} isHi={isHi} />
    </AdminShell>
  );
}
