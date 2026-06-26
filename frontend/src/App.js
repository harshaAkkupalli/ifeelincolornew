import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import LandingPage from './pages/LandingPage';
import MobileHome from './pages/MobileHome';
import AuthCallback from './pages/AuthCallback';
import RouteLoader from './components/brand/RouteLoader';
import { CheckinContentProvider } from './components/checkin/CheckinContentContext';
import { NeuroInclusiveProvider } from './contexts/NeuroInclusiveContext';
import { TooltipProvider } from './components/ui/tooltip';
import '@/App.css';

// ─── Code-split everything else so the first paint of `/` or `/mobile-home`
// doesn't have to download the whole patient+clinician+admin bundle. ──
const PatientSignup = lazy(() => import('./pages/PatientSignup'));
const ClinicianSignup = lazy(() => import('./pages/ClinicianSignup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const OrgPortal = lazy(() => import('./pages/OrgPortal'));
const RoleSelection = lazy(() => import('./pages/RoleSelection'));
const OrgDashboard = lazy(() => import('./pages/OrgDashboard'));
const PatientAppShell = lazy(() => import('./components/patient/PatientAppShell'));
const ClinicianAppShell = lazy(() => import('./components/clinician/ClinicianAppShell'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const PatientManagement = lazy(() => import('./pages/admin/PatientManagement'));
const AdminPatientRoadmap = lazy(() => import('./pages/admin/AdminPatientRoadmap'));
const ClinicianManagement = lazy(() => import('./pages/admin/ClinicianManagement'));
const OrgManagement = lazy(() => import('./pages/admin/OrgManagement'));
const AssistantManagement = lazy(() => import('./pages/admin/AssistantManagement'));
const PlanManagement = lazy(() => import('./pages/admin/PlanManagement'));
const RecommendationsPage = lazy(() => import('./pages/admin/RecommendationsPage'));
// Legal — shared component, role-themed.
const PrivacyPolicyPublic = lazy(() => import('./pages/LegalPage').then(m => ({ default: m.PrivacyPolicyPublic })));
const TermsPublic = lazy(() => import('./pages/LegalPage').then(m => ({ default: m.TermsPublic })));
const PrivacyPolicyOrganization = lazy(() => import('./pages/LegalPage').then(m => ({ default: m.PrivacyPolicyOrganization })));
const TermsOrganization = lazy(() => import('./pages/LegalPage').then(m => ({ default: m.TermsOrganization })));
const PrivacyPolicyAdmin = lazy(() => import('./pages/LegalPage').then(m => ({ default: m.PrivacyPolicyAdmin })));
const TermsAdmin = lazy(() => import('./pages/LegalPage').then(m => ({ default: m.TermsAdmin })));
const EarningsPage = lazy(() => import('./pages/admin/EarningsPage'));
const AssessmentsPage = lazy(() => import('./pages/admin/AssessmentsPage'));
const AnnouncementsPage = lazy(() => import('./pages/admin/AnnouncementsPage'));
const PermissionsPage = lazy(() => import('./pages/admin/PermissionsPage'));
const PaymentSetupPage = lazy(() => import('./pages/admin/PaymentSetupPage'));
const EmergencyAlertsPage = lazy(() => import('./pages/admin/EmergencyAlertsPage'));
const EmailTemplatesPage = lazy(() => import('./pages/admin/EmailTemplatesPage'));
const AssistantSettings = lazy(() => import('./pages/admin/AssistantSettings'));
const CheckinConfigPage = lazy(() => import('./pages/admin/CheckinConfigPage'));
// Legacy /clinician-portal redirects to /mobile-home?role=clinician — the
// unified MobileHome handles both roles with theme switching.
const OrganizationLogin = lazy(() => import('./pages/organization/OrganizationLogin'));
const OrganizationDashboard = lazy(() => import('./pages/organization/OrganizationDashboard'));
const OrganizationSubscribe = lazy(() => import('./pages/organization/OrganizationSubscribe'));
const PatientMyOrg = lazy(() => import('./pages/patient/PatientMyOrg'));

// Shared fallback shown while a lazy chunk is loading — matches the brand splash.
function ChunkFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F3EEFF' }}>
      <div className="w-12 h-12 rounded-full animate-pulse" style={{ background: 'linear-gradient(135deg, #7C5BFF, #22D3C5)' }} />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (location.state?.user) return children;
  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#FDFCDC' }}><div className="w-12 h-12 rounded-full animate-pulse" style={{ background: '#FFD166' }} /></div>;
  if (!user) {
    // Send the signed-out user back to the role-specific sign-in/sign-up page
    // rather than dumping them on the public marketing landing page.
    const p = location.pathname || '';
    if (p.startsWith('/clinician')) return <Navigate to="/mobile-home?role=clinician" replace />;
    if (p.startsWith('/app')) return <Navigate to="/mobile-home?role=patient" replace />;
    if (p.startsWith('/org')) return <Navigate to="/org/login" replace />;
    return <Navigate to="/mobile-home" replace />;
  }
  return children;
}

function AdminProtectedRoute({ children }) {
  const { admin, loading } = useAdminAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F172A' }}><div className="w-8 h-8 rounded-full animate-pulse bg-blue-500" /></div>;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return children;
}

function DashboardRouter() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#FDFCDC' }}><div className="w-12 h-12 rounded-full animate-pulse" style={{ background: '#FFD166' }} /></div>;
  if (!user) return <Navigate to="/mobile-home" replace />;
  if (user.is_first_login || !user.role) return <Navigate to="/select-role" replace />;
  switch (user.role) {
    case 'patient': return <Navigate to="/app/home" replace />;
    case 'clinician': return <Navigate to="/clinician/home" replace />;
    case 'organization': return <Navigate to="/org/dashboard" replace />;
    default: return <Navigate to="/select-role" replace />;
  }
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes('session_id=')) return <AuthCallback />;

  return (
    <>
    <RouteLoader />
    <Suspense fallback={<ChunkFallback />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/mobile-home" element={<MobileHome />} />
      {/* Legacy portal routes — now redirect to the unified Patient/Clinician toggle hub. */}
      <Route path="/patient-portal" element={<Navigate to="/mobile-home?role=patient" replace />} />
      <Route path="/clinician-portal" element={<Navigate to="/mobile-home?role=clinician" replace />} />
      <Route path="/patient-signup" element={<PatientSignup />} />
      <Route path="/clinician-signup" element={<ClinicianSignup />} />
      <Route path="/forgot-password/patient" element={<ForgotPassword accent="#FF5A6A" portalRoute="/mobile-home" />} />
      <Route path="/forgot-password/clinician" element={<ForgotPassword accent="#22D3C5" portalRoute="/mobile-home" />} />
      <Route path="/org/:slug" element={<OrgPortal />} />
      <Route path="/select-role" element={<ProtectedRoute><RoleSelection /></ProtectedRoute>} />
      <Route path="/dashboard" element={<DashboardRouter />} />
      <Route path="/app/*" element={<ProtectedRoute><PatientAppShell /></ProtectedRoute>} />
      <Route path="/clinician/*" element={<ProtectedRoute><ClinicianAppShell /></ProtectedRoute>} />

      {/* Organization Portal */}
      <Route path="/org/login" element={<OrganizationLogin />} />
      <Route path="/org/dashboard" element={<ProtectedRoute><OrganizationDashboard /></ProtectedRoute>} />
      <Route path="/org/subscribe" element={<ProtectedRoute><OrganizationSubscribe /></ProtectedRoute>} />
      <Route path="/org/privacy" element={<PrivacyPolicyOrganization />} />
      <Route path="/org/terms" element={<TermsOrganization />} />

      {/* Public legal pages */}
      <Route path="/legal/privacy" element={<PrivacyPolicyPublic />} />
      <Route path="/legal/terms" element={<TermsPublic />} />
      {/* Convenience aliases used from auth screens */}
      <Route path="/privacy" element={<PrivacyPolicyPublic />} />
      <Route path="/terms" element={<TermsPublic />} />

      {/* Admin Panel */}
      <Route path="/admin/login" element={<AdminAuthProvider><AdminLogin /></AdminAuthProvider>} />
      <Route path="/admin" element={<AdminAuthProvider><AdminProtectedRoute><AdminLayout /></AdminProtectedRoute></AdminAuthProvider>}>
        <Route index element={<AdminDashboard />} />
        <Route path="patients" element={<PatientManagement />} />
        <Route path="patient/:id" element={<AdminPatientRoadmap />} />
        <Route path="clinicians" element={<ClinicianManagement />} />
        <Route path="organizations" element={<OrgManagement />} />
        <Route path="assistants" element={<AssistantManagement />} />
        <Route path="plans" element={<PlanManagement />} />
        {/* Legacy redirects — removed pages still resolve to nearest equivalent */}
        <Route path="subscriptions" element={<Navigate to="/admin/plans" replace />} />
        <Route path="patient-tiers" element={<Navigate to="/admin/plans" replace />} />
        <Route path="assignments" element={<Navigate to="/admin/patients" replace />} />
        <Route path="recommendations" element={<RecommendationsPage />} />
        <Route path="assessments" element={<AssessmentsPage />} />
        <Route path="checkin-config" element={<CheckinConfigPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="permissions" element={<PermissionsPage />} />
        <Route path="payment-setup" element={<PaymentSetupPage />} />
        <Route path="emergency-alerts" element={<EmergencyAlertsPage />} />
        <Route path="email-templates" element={<EmailTemplatesPage />} />
        <Route path="settings" element={<AssistantSettings />} />
        <Route path="earnings" element={<EarningsPage />} />
        <Route path="privacy" element={<PrivacyPolicyAdmin />} />
        <Route path="terms" element={<TermsAdmin />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NeuroInclusiveProvider>
          <CheckinContentProvider>
            <TooltipProvider delayDuration={150} skipDelayDuration={300}>
              <AppRouter />
            </TooltipProvider>
          </CheckinContentProvider>
        </NeuroInclusiveProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
