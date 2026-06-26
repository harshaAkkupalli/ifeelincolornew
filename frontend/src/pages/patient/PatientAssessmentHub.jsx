import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { History, Users, Brain, CheckCircle2, Lock, ChevronRight, Download, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { LOGO_URL, BRAND } from '../../brand';
import CheckInFlow from '../../components/checkin/CheckInFlow';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ICONS = { history: History, users: Users, brain: Brain };

export default function PatientAssessmentHub() {
  const navigate = useNavigate();
  const [cats, setCats] = useState([]);
  const [progress, setProgress] = useState({});
  const [sub, setSub] = useState(null);
  const [responses, setResponses] = useState([]);

  const [lockToast, setLockToast] = useState('');

  const load = async () => {
    const c = await axios.get(`${API}/assessment-categories`);
    // Hide categories that the admin has turned OFF — the patient simply
    // continues with the rest of the flow.
    setCats((c.data.categories || []).filter((cat) => cat.enabled !== false));
    const s = await axios.get(`${API}/me/subscription`, { withCredentials: true });
    setSub(s.data);
    const p = await axios.get(`${API}/patient/progress`, { withCredentials: true });
    setProgress(p.data.progress || {});
    const r = await axios.get(`${API}/patient/my-responses`, { withCredentials: true });
    setResponses(r.data.responses || []);
  };

  useEffect(() => { load(); }, []);

  // First-run flow: show all 3 category cards.
  // Once every category is completed (>=1 submission per cat), the hub
  // collapses into a single "Regular Check-in" launcher so the patient
  // doesn't repeat Treatment History & Health/Social Info each visit.
  const allCompleted = cats.length > 0 && cats.every((c) => progress[c.id]?.completed);
  const [showCheckin, setShowCheckin] = useState(false);

  const isLocked = (idx) => {
    if (!sub?.active) return true;
    if (idx === 0) return false;
    const prev = cats[idx - 1];
    return prev ? !progress[prev.id]?.completed : false;
  };

  const handleCategoryClick = (idx, cat) => {
    // Subscription gate — explicit, friendly redirect
    if (!sub?.active) {
      setLockToast('Please subscribe to a plan before starting the assessment.');
      setTimeout(() => navigate('/app/subscribe', { state: { fromAssessment: true } }), 1200);
      return;
    }
    // Sequence gate
    if (idx > 0) {
      const prev = cats[idx - 1];
      if (prev && !progress[prev.id]?.completed) {
        setLockToast(`Please complete "${prev.title}" first.`);
        setTimeout(() => setLockToast(''), 2400);
        return;
      }
    }
    navigate(`/app/assessment/run/${cat.id}`);
  };

  const finalResp = responses.find(r => r.category_id === 'assessment');

  // ── Server-rendered PDF download ──
  // The dossier is rendered server-side (reportlab) at /api/patient/dossier/pdf
  // so:
  //   • Inside the APK (Capacitor WebView) we hand the URL to
  //     `@capacitor/browser` which routes it to Chrome / system download
  //     manager — the previous jsPDF auto-download was silently failing in
  //     the WebView because blob URLs aren't routable by the OS.
  //   • In a regular browser we trigger a normal `<a download>` so the file
  //     lands in the user's Downloads folder.
  //   • The PDF includes EXACT questions the patient was asked and the
  //     answers they gave for all three categories (treatment_history,
  //     health_social, assessment) — the server pulls the same
  //     `assessment_templates` rows the patient saw at fill-in time.
  const generatePDF = async () => {
    setLockToast('Preparing your report…');
    const pdfUrl = `${API}/patient/dossier/pdf`;
    try {
      // Detect Capacitor native runtime (APK or iOS shell)
      const isNative = !!(window?.Capacitor?.isNativePlatform?.());
      if (isNative) {
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({ url: pdfUrl, presentationStyle: 'fullscreen' });
          setLockToast('Opened in your browser — choose “Download” to save.');
          setTimeout(() => setLockToast(''), 4000);
          return;
        } catch {
          // fall through to web behaviour
        }
      }
      // Web: fetch with credentials so the cookie-auth survives, then
      // trigger a real `<a download>` so the file is named correctly.
      const resp = await fetch(pdfUrl, { credentials: 'include' });
      if (!resp.ok) throw new Error('PDF request failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IFEELINCOLOR_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setLockToast('Report downloaded — check your downloads folder.');
      setTimeout(() => setLockToast(''), 3500);
    } catch (err) {
      console.error('PDF download failed:', err);
      setLockToast('Could not download report. Please try again.');
      setTimeout(() => setLockToast(''), 3500);
    }
  };

  return (
    <div className="px-5 pt-5 pb-6">
      {/* Lock toast */}
      <AnimatePresence>
        {lockToast && (
          <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
            data-testid="assessment-lock-toast"
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl text-white font-bold text-sm max-w-[300px] text-center shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #FF6B6B, #FF3B30)' }}>
            <Lock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />{lockToast}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.pink }}>
          Your Journey
        </p>
        <h1 className="font-fredoka font-semibold text-3xl" style={{ color: '#2A1A4A' }}>
          Three steps to feel seen.
        </h1>
        <p className="text-sm font-nunito mt-1" style={{ color: '#6B5784' }}>
          Take your time. Each step builds on the last.
        </p>
      </motion.div>

      {!sub?.active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="mt-4 rounded-2xl p-4 flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})`, boxShadow: `0 12px 30px -10px ${BRAND.pink}66` }}
        >
          <Lock className="w-5 h-5 text-white shrink-0" />
          <div className="flex-1">
            <p className="font-fredoka font-semibold text-white text-sm">Subscription required</p>
            <p className="text-[11px] font-nunito text-white/85">Unlock to start your assessments</p>
          </div>
          <Button
            data-testid="hub-subscribe-cta"
            onClick={() => navigate('/app/subscribe')}
            className="rounded-full h-9 px-4 text-xs font-bold bg-white text-pink-600 border-0"
            style={{ color: BRAND.pink }}
          >
            Subscribe
          </Button>
        </motion.div>
      )}

      <div className="mt-6 space-y-3">
        {allCompleted ? (
          /* All 3 categories completed: collapse into a single "Regular Check-in" launcher.
             Tapping it mounts the same 9-step CheckInFlow used by Step-3 — directly
             starting at the 3D Body Map. After completion the patient lands on the
             result/PDF screen and the Journey page auto-refreshes on next visit. */
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 160, damping: 18 }}
            className="rounded-3xl p-6 text-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #FFE4F6 0%, #F0E4FF 50%, #E0F8FF 100%)',
              boxShadow: '0 20px 50px -16px rgba(167,139,250,0.45)',
              border: '1px solid rgba(167,139,250,0.25)',
            }}
            data-testid="regular-checkin-launcher"
          >
            <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-30"
              style={{ background: `radial-gradient(circle, ${BRAND.pink}, transparent 70%)` }} />
            <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full opacity-25"
              style={{ background: `radial-gradient(circle, #22D3C5, transparent 70%)` }} />
            <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-2"
              style={{ color: BRAND.pink }} data-testid="all-completed-hint">
              <CheckCircle2 className="w-3 h-3 inline -mt-0.5 mr-1" />
              All onboarding assessments completed
            </p>
            <h2 className="font-fredoka font-semibold text-2xl mb-1" style={{ color: '#2A1A4A' }}>
              Welcome back ✨
            </h2>
            <p className="text-sm font-nunito mb-5 max-w-xs mx-auto" style={{ color: '#6B5784' }}>
              From here on, your Regular Check-in is the heartbeat of your care plan.
              It takes ~2 minutes and updates your Journey instantly.
            </p>
            <motion.button
              whileHover={{ scale: 1.06, rotate: -2 }}
              whileTap={{ scale: 0.95 }}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              onClick={() => setShowCheckin(true)}
              data-testid="start-regular-checkin"
              className="relative inline-flex items-center justify-center w-32 h-32 rounded-full text-white font-fredoka font-bold"
              style={{
                background: `radial-gradient(circle at 30% 25%, #ffffff44, transparent 55%), conic-gradient(from 200deg, ${BRAND.pink}, #FF7AB6, #A78BFA, #22D3C5, ${BRAND.pink})`,
                boxShadow: '0 24px 60px -16px rgba(255,79,191,0.6), 0 0 0 6px rgba(255,255,255,0.5) inset',
                transformStyle: 'preserve-3d',
              }}
            >
              <span className="absolute inset-2 rounded-full"
                style={{ background: 'radial-gradient(circle at 40% 30%, rgba(255,255,255,0.85), rgba(255,255,255,0) 55%)' }} />
              <span className="relative flex flex-col items-center">
                <Sparkles className="w-7 h-7 mb-1" />
                <span className="text-base">Regular</span>
                <span className="text-base -mt-1">Check-in</span>
              </span>
            </motion.button>
            <p className="text-[11px] font-nunito mt-5" style={{ color: '#8F84A8' }}>
              Goes straight to the 3D Body Map — no extra steps.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                data-testid="view-journey-from-hub"
                onClick={() => navigate('/app/roadmap')}
                className="text-xs font-nunito font-bold px-3 py-1.5 rounded-full"
                style={{ background: 'white', color: BRAND.pink, border: `1px solid ${BRAND.pink}33` }}
              >
                View Journey →
              </button>
            </div>
          </motion.div>
        ) : cats.map((cat, idx) => {
          const Icon = ICONS[cat.icon] || History;
          const done = progress[cat.id]?.completed;
          const locked = isLocked(idx);
          return (
            <motion.button
              key={cat.id}
              data-testid={`assessment-card-${cat.id}`}
              data-completed={done ? 'true' : 'false'}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleCategoryClick(idx, cat)}
              className="w-full text-left rounded-3xl p-5 flex items-center gap-4 relative overflow-hidden"
              style={{
                background: done
                  ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 60%, #A7F3D0 100%)'
                  : 'white',
                boxShadow: done
                  ? `0 16px 38px -10px ${BRAND.green}88, inset 0 0 0 2px ${BRAND.green}55`
                  : `0 16px 38px -12px ${cat.color}44`,
                border: done ? `1px solid ${BRAND.green}66` : `1px solid ${cat.color}22`,
              }}
            >
              {/* Completed ribbon — top-right corner */}
              {done && (
                <motion.div
                  initial={{ scale: 0, rotate: -20, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                  className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${BRAND.green}, #16A34A)`,
                    boxShadow: `0 8px 18px -4px ${BRAND.green}aa`,
                  }}
                  data-testid={`completed-badge-${cat.id}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  <span className="text-[10px] font-nunito font-bold text-white tracking-wide uppercase">Completed</span>
                </motion.div>
              )}
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-30"
                style={{ background: `radial-gradient(circle, ${done ? BRAND.green : cat.color}, transparent 70%)` }} />
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 relative"
                style={{
                  background: done ? `linear-gradient(135deg, ${BRAND.green}, #16A34A)` : `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)`,
                  boxShadow: done ? `0 10px 20px -6px ${BRAND.green}aa` : `0 10px 20px -6px ${cat.color}88`,
                }}>
                {done ? <CheckCircle2 className="w-7 h-7 text-white" strokeWidth={2.5} /> : <Icon className="w-7 h-7 text-white" />}
              </div>
              <div className="flex-1 min-w-0 relative">
                <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-0.5" style={{ color: done ? '#059669' : '#A599B8' }}>
                  Step {idx + 1}{done ? ' · Done' : ''}
                </p>
                <p className="font-fredoka font-semibold text-lg" style={{ color: done ? '#064E3B' : '#2A1A4A' }}>{cat.title}</p>
                <p className="text-[11px] font-nunito mt-0.5" style={{ color: done ? '#047857' : (progress[cat.id]?.has_partial ? '#FF8C3F' : '#8F84A8') }}>
                  {done ? 'You completed this assessment — tap to review your answers.' : locked ? 'Complete previous step first'
                    : progress[cat.id]?.has_partial ? `Resume from question ${(progress[cat.id]?.partial_question_index || 0) + 1}`
                    : 'Tap to begin'}
                </p>
              </div>
              {locked
                ? <Lock data-testid={`lock-${cat.id}`} className="w-5 h-5 text-slate-300" />
                : done
                  ? <CheckCircle2 className="w-6 h-6" style={{ color: BRAND.green }} strokeWidth={2.5} />
                  : <ChevronRight className="w-5 h-5" style={{ color: cat.color }} />}
            </motion.button>
          );
        })}
      </div>

      {finalResp && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl p-5"
          style={{ background: 'white', boxShadow: '0 16px 38px -14px rgba(26,35,50,0.15)' }}
        >
          <p className="text-xs font-nunito font-bold uppercase tracking-widest mb-2" style={{ color: BRAND.pink }}>
            Your Report
          </p>
          <p className="font-fredoka font-semibold text-base mb-2" style={{ color: '#2A1A4A' }}>
            All done! Download your branded report below.
          </p>
          <Button
            data-testid="download-pdf-btn"
            onClick={generatePDF}
            className="w-full rounded-2xl h-12 font-nunito font-bold text-white border-0"
            style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}
          >
            <Download className="w-4 h-4 mr-2" /> Download IFEELINCOLOR PDF
          </Button>
          {finalResp.severity === 'critical' && (
            <div className="mt-3 rounded-xl p-3 text-xs font-nunito"
              style={{ background: '#FFF1F1', color: '#B91C1C', border: '1px solid #FCA5A5' }}>
              Your responses suggest you may need immediate support. The Home tab has an Emergency button.
            </div>
          )}
        </motion.div>
      )}

      {/* Mounted overlay: Regular Check-in (returning patients only) */}
      {showCheckin && (
        <CheckInFlow
          onClose={() => setShowCheckin(false)}
          onComplete={async () => {
            setShowCheckin(false);
            // Record the recurring Regular Check-in as a Step-3 assessment
            // submission too, so /api/patient/progress + /api/patient/my-responses
            // reflect the latest result on the Journey page. CheckInFlow already
            // wrote a row to patient_checkins via its internal POST /api/checkins.
            try {
              await axios.post(`${API}/patient/assessment-submit`, {
                category_id: 'assessment',
                answers: { _daily_checkin: 'completed', triggered_from: 'regular_checkin_hub' },
                is_final: true,
              }, { withCredentials: true });
            } catch { /* non-fatal — check-in is already saved */ }
            await load();
            navigate('/app/roadmap');
          }}
        />
      )}
    </div>
  );
}
