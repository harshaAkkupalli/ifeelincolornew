import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, ClipboardList, Map as MapIcon, Settings as SettingsIcon, User as UserIcon, LogOut,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../brand/BrandLogo';
import BrandFooter from '../BrandFooter';
import WelcomeModal from './WelcomeModal';
import InfoTip from '../ui/InfoTip';
import { FEATURE_TIPS } from '../../lib/featureTips';
import MobileAppFrame from '../MobileAppFrame';
import PortalGuide from '../PortalGuide';
import PatientHomeScreen from '../../pages/patient/PatientHomeScreen';
import PatientAssessmentHub from '../../pages/patient/PatientAssessmentHub';
import PatientAssessmentRun from '../../pages/patient/PatientAssessmentRun';
import PatientSubscribe from '../../pages/patient/PatientSubscribe';
import PatientRecommendations from '../../pages/patient/PatientRecommendations';
import PatientNotifications from '../../pages/patient/PatientNotifications';
import PatientSettings from '../../pages/patient/PatientSettings';
import PatientProfile from '../../pages/patient/PatientProfile';
import PatientEmergency from '../../pages/patient/PatientEmergency';
import PatientHistory from '../../pages/patient/PatientHistory';
import PatientMyOrg from '../../pages/patient/PatientMyOrg';
import { PrivacyPolicyPatient, TermsPatient } from '../../pages/LegalPage';
import { Bell, AlertOctagon } from 'lucide-react';

const TABS = [
  { to: '/app/home', icon: Home, label: 'Home', tip: FEATURE_TIPS.patient_tab_home },
  { to: '/app/assessment', icon: ClipboardList, label: 'Assessment', tip: FEATURE_TIPS.patient_tab_assessment },
  { to: '/app/journey', icon: MapIcon, label: 'Journey', tip: FEATURE_TIPS.patient_tab_journey },
  { to: '/app/settings', icon: SettingsIcon, label: 'Settings', tip: FEATURE_TIPS.patient_tab_settings },
  { to: '/app/profile', icon: UserIcon, label: 'Profile', tip: FEATURE_TIPS.patient_tab_profile },
];

const ACCENT = '#7C5BFF'; // Soft violet — replaces previous pink theme

export default function PatientAppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Welcome modal — show at most once per calendar day per device.
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined' || !user?.user_id) return false;
    try {
      const today = new Date().toISOString().slice(0, 10);
      return localStorage.getItem('welcome_modal_last_' + user.user_id) !== today;
    } catch { return false; }
  });

  // Persist "shown today" the moment the modal closes — by user action OR back button.
  const closeWelcome = () => {
    setShowWelcome(false);
    if (user?.user_id) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem('welcome_modal_last_' + user.user_id, today);
      } catch { /* ignore */ }
    }
  };

  // Browser back button → close modals instead of navigating away. We push
  // a sentinel history entry the moment the modal opens, then watch popstate.
  useEffect(() => {
    if (!showWelcome) return undefined;
    try { window.history.pushState({ ifcModal: 'welcome' }, ''); } catch { /* ignore */ }
    const onPop = () => closeWelcome();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWelcome]);

  // Redirect to home if on /app root
  useEffect(() => {
    if (location.pathname === '/app' || location.pathname === '/app/') {
      navigate('/app/home', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Swipe to navigate between tabs (drag horizontally) — ONLY on the
  // exact tab landing routes. Sub-routes (e.g. `/app/assessment/run/:id`)
  // run their own multi-step flow and must NOT capture horizontal drag;
  // doing so collides with the Android WebView's native long-press text
  // selection and blanks the content area.
  const isExactTabRoute = TABS.some(t => location.pathname === t.to || location.pathname === `${t.to}/`);
  const tabIndex = isExactTabRoute
    ? TABS.findIndex(t => location.pathname === t.to || location.pathname === `${t.to}/`)
    : -1;
  const handleDragEnd = (_, info) => {
    if (tabIndex < 0) return; // skip on non-tab routes like /subscribe or /assessment/run
    const threshold = 80;
    if (info.offset.x < -threshold && tabIndex < TABS.length - 1) {
      navigate(TABS[tabIndex + 1].to);
    } else if (info.offset.x > threshold && tabIndex > 0) {
      navigate(TABS[tabIndex - 1].to);
    }
  };

  return (
    <MobileAppFrame accent={ACCENT}>
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        background: 'linear-gradient(180deg, #F3EEFF 0%, #EFF7FF 35%, #E6FBF5 70%, #FFF6E5 100%)',
        paddingTop: 'env(safe-area-inset-top)',
        WebkitTouchCallout: 'none', // suppress Android WebView long-press text/image callout
        WebkitTapHighlightColor: 'transparent',
      }}
      data-testid="patient-app-shell"
    >
      {showWelcome && <WelcomeModal name={user?.name} onClose={closeWelcome} />}

      {/* Top bar */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 backdrop-blur-xl"
        style={{ background: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}
      >
        <button
          type="button"
          onClick={() => navigate('/app/home')}
          data-testid="patient-logo-home"
          className="flex items-center -ml-1 px-1 py-0.5 rounded-lg hover:bg-black/5 transition"
          aria-label="Go to home"
        >
          <Logo size={28} textSize="text-sm" />
        </button>
        <div className="flex items-center gap-2">
          <InfoTip text={FEATURE_TIPS.patient_bell} side="bottom" asChild>
            <button
              data-testid="patient-bell-btn"
              onClick={() => navigate('/app/notifications')}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 transition relative"
            >
              <Bell className="w-5 h-5" style={{ color: ACCENT }} />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: ACCENT }} />
            </button>
          </InfoTip>
          <InfoTip text={FEATURE_TIPS.patient_sos} side="bottom" asChild>
            <motion.button
              data-testid="header-emergency-btn"
              onClick={() => navigate('/app/emergency')}
              whileTap={{ scale: 0.92 }}
              className="h-9 px-3 rounded-full flex items-center gap-1.5 text-white font-nunito font-bold text-xs"
              style={{
                background: 'linear-gradient(135deg, #FF3B30, #FF6B6B)',
                boxShadow: '0 8px 18px -4px rgba(255,59,48,0.55)',
              }}
            >
              <motion.span
                animate={{ scale: [1, 1.18, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-white"
              />
              SOS
            </motion.button>
          </InfoTip>
          <InfoTip text={FEATURE_TIPS.patient_signout} side="bottom" asChild>
            <motion.button
              data-testid="patient-top-signout"
              onClick={async () => { await logout(); navigate('/mobile-home?role=patient'); }}
              whileTap={{ scale: 0.92 }}
              className="h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)' }}
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
              <Route path="home" element={<PatientHomeScreen />} />
              <Route path="assessment" element={<PatientAssessmentHub />} />
              <Route path="assessment/run/:categoryId" element={<PatientAssessmentRun />} />
              <Route path="subscribe" element={<PatientSubscribe />} />
              <Route path="roadmap" element={<PatientHistory />} />
              <Route path="journey" element={<PatientHistory />} />
              <Route path="recommendations" element={<PatientRecommendations />} />
              <Route path="notifications" element={<PatientNotifications />} />
              <Route path="settings" element={<PatientSettings />} />
              <Route path="profile" element={<PatientProfile />} />
              <Route path="emergency" element={<PatientEmergency />} />
              <Route path="history" element={<PatientHistory />} />
              <Route path="privacy" element={<PrivacyPolicyPatient />} />
              <Route path="terms" element={<TermsPatient />} />
              <Route path="my-org" element={<PatientMyOrg />} />
              <Route path="*" element={<Navigate to="/app/home" replace />} />
            </Routes>
            <BrandFooter compact />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Tab Bar — sleek dock attached to the bottom edge (mobile-app aesthetic) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-[560px] md:w-[92%] md:mb-3"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          borderTop: '1px solid rgba(124,91,255,0.10)',
          boxShadow: '0 -8px 28px -8px rgba(31,17,71,0.16)',
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
                  data-testid={`patient-tab-${t.label.toLowerCase()}`}
                  onClick={() => navigate(t.to)}
                  className="flex flex-col items-center justify-center gap-0 px-2.5 py-1 rounded-xl relative transition-colors flex-1"
                >
                  {isActive && (
                    <motion.div
                      layoutId="patient-tab-active"
                      className="absolute inset-x-1 inset-y-0 rounded-xl"
                      style={{
                        background: `linear-gradient(135deg, ${ACCENT}1A, ${ACCENT}0F)`,
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
      <PortalGuide role="patient" />
    </div>
    </MobileAppFrame>
  );
}
