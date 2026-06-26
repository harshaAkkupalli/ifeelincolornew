import React from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Users, Sparkles, FileText, Settings as SettingsIcon, LogOut, Bell,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../brand/BrandLogo';
import BrandFooter from '../BrandFooter';
import InfoTip from '../ui/InfoTip';
import { FEATURE_TIPS } from '../../lib/featureTips';
import MobileAppFrame from '../MobileAppFrame';
import PortalGuide from '../PortalGuide';
import ClinicianHomeMobile from '../../pages/clinician/ClinicianHomeMobile';
import { PrivacyPolicyClinician, TermsClinician } from '../../pages/LegalPage';
import ClinicianPatientsMobile from '../../pages/clinician/ClinicianPatientsMobile';
import ClinicianAICoach from '../../pages/clinician/ClinicianAICoach';
import ClinicianNotesMobile from '../../pages/clinician/ClinicianNotesMobile';
import ClinicianSettingsMobile from '../../pages/clinician/ClinicianSettingsMobile';
import ClinicianSubscribe from '../../pages/clinician/ClinicianSubscribe';
import ClinicianRecommendations from '../../pages/clinician/ClinicianRecommendations';
import ClinicianNotifications from '../../pages/clinician/ClinicianNotifications';
import PatientRoadmap from '../../pages/clinician/PatientRoadmap';
import ClinicianAnalytics from '../../pages/clinician/ClinicianAnalytics';
import ClinicianPatientHistory from '../../pages/clinician/ClinicianPatientHistory';
import ClinicianDiscoverPatients from '../../pages/clinician/ClinicianDiscoverPatients';
import BrowserPushBootstrap from './BrowserPushBootstrap';
import CelebrationToaster from './CelebrationToaster';
import EmergencyAlarm from '../EmergencyAlarm';

const TABS = [
  { to: '/clinician/home', icon: Home, label: 'Home', tip: FEATURE_TIPS.clin_tab_home },
  { to: '/clinician/patients', icon: Users, label: 'Patients', tip: FEATURE_TIPS.clin_tab_patients },
  { to: '/clinician/ai-coach', icon: Sparkles, label: 'AI Coach', tip: FEATURE_TIPS.clin_tab_aicoach },
  { to: '/clinician/notes', icon: FileText, label: 'Notes', tip: FEATURE_TIPS.clin_tab_notes },
  { to: '/clinician/settings', icon: SettingsIcon, label: 'Settings', tip: FEATURE_TIPS.clin_tab_settings },
];

// Emerald/pine clinician accent — matches the Clinician login palette in
// MobileHome.jsx so the whole portal feels visually unified.
const ACCENT = '#1F6F54';   // deep pine (primary)
const ACCENT_2 = '#2FA37A'; // bright emerald (secondary)

/**
 * Clinician Portal Shell — full visual parity with the Patient portal,
 * re-skinned with the emerald/pine clinician palette.
 *
 * Layout mirrors PatientAppShell:
 *   • soft mint-emerald-amber gradient background
 *   • frosted-blur top bar with logo + bell + sign-out (SOS replaced by a
 *     small clinical "Roadmap" pill since clinicians don't need SOS)
 *   • bouncy squircle bottom tab bar with active-state glow + indicator
 *   • swipe-between-tabs gesture (same threshold logic as Patient)
 */
export default function ClinicianAppShell() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [subState, setSubState] = React.useState({ checked: false, active: false });

  React.useEffect(() => {
    if (location.pathname === '/clinician' || location.pathname === '/clinician/') {
      navigate('/clinician/home', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Subscription gate — same logic as before. A clinician without an active
  // portal subscription is forced onto /clinician/subscribe before any other
  // page renders. Settings remains accessible so they can update their card.
  React.useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/me/subscription`, { credentials: 'include' });
        const data = await r.json();
        if (cancelled) return;
        setSubState({ checked: true, active: !!data.active });
        if (!data.active
            && !location.pathname.startsWith('/clinician/subscribe')
            && !location.pathname.startsWith('/clinician/settings')) {
          navigate('/clinician/subscribe?gate=1', { replace: true });
        }
      } catch {
        if (!cancelled) setSubState({ checked: true, active: false });
      }
    };
    check();
    return () => { cancelled = true; };
  }, [location.pathname, navigate]);

  // Swipe-to-navigate between tabs — only on exact tab landing routes so
  // sub-routes (patient detail, roadmap, etc) keep their own gestures.
  const isExactTabRoute = TABS.some(t => location.pathname === t.to || location.pathname === `${t.to}/`);
  const tabIndex = isExactTabRoute
    ? TABS.findIndex(t => location.pathname === t.to || location.pathname === `${t.to}/`)
    : -1;
  const handleDragEnd = (_, info) => {
    if (tabIndex < 0) return;
    const threshold = 80;
    if (info.offset.x < -threshold && tabIndex < TABS.length - 1) navigate(TABS[tabIndex + 1].to);
    else if (info.offset.x > threshold && tabIndex > 0) navigate(TABS[tabIndex - 1].to);
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/mobile-home?role=clinician');
  };

  return (
    <MobileAppFrame accent={ACCENT_2}>
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        // Mint → seafoam → soft butter — clinical "morning rounds" tonal
        // ladder, mirrors the Patient pastel gradient pattern but cooler.
        background:
          'linear-gradient(180deg, #E6F7F1 0%, #DBF1E6 35%, #E8F8EF 70%, #FFF7E0 100%)',
        paddingTop: 'env(safe-area-inset-top)',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      data-testid="clinician-app-shell"
      data-route={location.pathname}
    >
      <BrowserPushBootstrap />
      <CelebrationToaster />
      <EmergencyAlarm />

      {/* Top bar — frosted glass, mirrors Patient layout */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 backdrop-blur-xl"
        style={{
          background: 'rgba(255,255,255,0.7)',
          borderBottom: '1px solid rgba(31,111,84,0.10)',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/clinician/home')}
          data-testid="clinician-logo-home"
          className="flex items-center -ml-1 px-1 py-0.5 rounded-lg hover:bg-emerald-50/70 transition"
          aria-label="Go to home"
        >
          <Logo size={28} textSize="text-sm" />
        </button>

        <div className="flex items-center gap-2">
          <InfoTip text={FEATURE_TIPS.clin_bell} side="bottom" asChild>
            <button
              data-testid="clinician-bell"
              onClick={() => navigate('/clinician/notifications')}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 transition relative"
            >
              <Bell className="w-5 h-5" style={{ color: ACCENT }} />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: ACCENT_2 }} />
            </button>
          </InfoTip>

          <InfoTip text="See your AI-curated patient overview" side="bottom" asChild>
            <motion.button
              data-testid="clinician-top-analytics"
              onClick={() => navigate('/clinician/analytics')}
              whileTap={{ scale: 0.92 }}
              className="h-9 px-3 rounded-full flex items-center gap-1.5 text-white font-nunito font-bold text-xs"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2})`,
                boxShadow: `0 8px 18px -4px ${ACCENT}77`,
              }}
            >
              <motion.span
                animate={{ scale: [1, 1.18, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-white"
              />
              Insight
            </motion.button>
          </InfoTip>

          <InfoTip text={FEATURE_TIPS.clin_signout} side="bottom" asChild>
            <motion.button
              data-testid="clinician-top-signout"
              onClick={handleSignOut}
              whileTap={{ scale: 0.92 }}
              className="h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.20)' }}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" style={{ color: '#DC2626' }} />
            </motion.button>
          </InfoTip>
        </div>
      </header>

      {/* Swipeable page area */}
      <main className="flex-1 pb-20 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            drag={tabIndex >= 0 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={handleDragEnd}
            className="w-full h-full"
            style={{ touchAction: tabIndex >= 0 ? 'pan-y' : 'auto' }}
          >
            <Routes>
              <Route path="home" element={<ClinicianHomeMobile />} />
              <Route path="patients" element={<ClinicianPatientsMobile />} />
              <Route path="ai-coach" element={<ClinicianAICoach />} />
              <Route path="notes" element={<ClinicianNotesMobile />} />
              <Route path="settings" element={<ClinicianSettingsMobile />} />
              <Route path="subscribe" element={<ClinicianSubscribe />} />
              <Route path="recommendations" element={<ClinicianRecommendations />} />
              <Route path="notifications" element={<ClinicianNotifications />} />
              <Route path="analytics" element={<ClinicianAnalytics />} />
              <Route path="discover-patients" element={<ClinicianDiscoverPatients />} />
              <Route path="roadmap" element={<PatientRoadmap />} />
              <Route path="patient/:id/roadmap" element={<PatientRoadmap />} />
              <Route path="patient/:id/history" element={<ClinicianPatientHistory />} />
              <Route path="privacy" element={<PrivacyPolicyClinician />} />
              <Route path="terms" element={<TermsClinician />} />
              <Route path="*" element={<Navigate to="/clinician/home" replace />} />
            </Routes>
            <BrandFooter compact />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Tab Bar — sleek dock attached to the bottom edge with emerald accents */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-[560px] md:w-[92%] md:mb-3"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          borderTop: `1px solid ${ACCENT}1A`,
          boxShadow: '0 -8px 28px -8px rgba(15,68,52,0.16)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
        }}
      >
        <div className="flex items-center justify-around px-2 py-1.5 md:rounded-2xl">
          {TABS.map((t) => {
            const isActive = location.pathname.startsWith(t.to);
            return (
              <InfoTip key={t.to} text={t.tip} side="top" asChild>
                <button
                  data-testid={`clinician-tab-${t.label.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => navigate(t.to)}
                  className="flex flex-col items-center justify-center gap-0 px-2.5 py-1 rounded-xl relative transition-colors flex-1"
                >
                  {isActive && (
                    <motion.div
                      layoutId="clinician-tab-active"
                      className="absolute inset-x-1 inset-y-0 rounded-xl"
                      style={{
                        background: `linear-gradient(135deg, ${ACCENT}1A, ${ACCENT_2}0F)`,
                        border: `1px solid ${ACCENT}26`,
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    />
                  )}
                  <motion.div
                    animate={{ scale: isActive ? 1.05 : 1, y: isActive ? -1 : 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                    className="relative z-10"
                  >
                    <t.icon
                      className="w-[18px] h-[18px]"
                      style={{ color: isActive ? ACCENT : '#94A3B8' }}
                    />
                  </motion.div>
                  <span
                    className="relative z-10 text-[9.5px] font-nunito font-bold leading-tight mt-0.5"
                    style={{ color: isActive ? ACCENT : '#94A3B8' }}
                  >
                    {t.label}
                  </span>
                </button>
              </InfoTip>
            );
          })}
        </div>
      </nav>
      <PortalGuide role="clinician" />
    </div>
    </MobileAppFrame>
  );
}
