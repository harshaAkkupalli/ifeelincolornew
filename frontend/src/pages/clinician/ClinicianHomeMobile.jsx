/**
 * Clinician Home (Dashboard) — Mirror of Patient HomeScreen aesthetic,
 * re-skinned with the emerald/pine clinician palette.
 *
 * Layout DNA shared with PatientHomeScreen:
 *   • Frosted pastel gradient surface (provided by ClinicianAppShell)
 *   • 3D animated "good morning, doctor" hero orb (Framer Motion)
 *   • Glass stat cards with spring-physics tap feedback
 *   • Bouncy quick-action chips
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, AlertOctagon, Sparkles, TrendingUp, ChevronRight,
  DollarSign, FileText, X, Clock, Award, BookOpen, Megaphone, User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AnnouncementsRail from '../../components/AnnouncementsRail';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Clinician palette — matches MobileHome.jsx CLINICIAN colors so login →
// dashboard transition feels seamless.
const C = {
  ink:       '#0A2A20',
  pine:      '#1F6F54',
  emerald:   '#2FA37A',
  mint:      '#A5DCC7',
  seafoam:   '#E6F7F1',
  butter:    '#FFF6E5',
  rose:      '#E11D48',
  amber:     '#D97706',
  bubblegum: '#7BC4A6',
};

const SEVERITY = {
  low:      { fg: '#047857', bg: '#ECFDF5', border: '#A7F3D0', label: 'Low' },
  medium:   { fg: '#B45309', bg: '#FFFBEB', border: '#FCD34D', label: 'Medium' },
  high:     { fg: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', label: 'High' },
  critical: { fg: '#9F1239', bg: '#FFF1F2', border: '#FECDD3', label: 'Critical' },
};

// Springy 3D-glass stat tile — replaces the flat Stripe card.
function StatCard({ icon: Icon, label, value, tone = 'pine', to, testid }) {
  const navigate = useNavigate();
  const TONES = {
    pine:    { fg: C.pine,    bg: '#E0F4EB', glow: `${C.pine}55` },
    emerald: { fg: C.emerald, bg: '#DDF6E9', glow: `${C.emerald}55` },
    amber:   { fg: C.amber,   bg: '#FEF3C7', glow: '#F59E0B55' },
    rose:    { fg: C.rose,    bg: '#FFE4E6', glow: `${C.rose}55` },
  };
  const t = TONES[tone] || TONES.pine;
  return (
    <motion.button
      type="button"
      data-testid={testid}
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => to && navigate(to)}
      className="rounded-2xl p-4 text-left relative overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(14px)',
        border: `1px solid ${t.fg}22`,
        boxShadow: `0 12px 28px -16px ${t.glow}, inset 0 1px 0 rgba(255,255,255,0.7)`,
      }}
    >
      <motion.div
        animate={{ y: [0, -3, 0], rotate: [-2, 2, -2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{
          background: `linear-gradient(135deg, ${t.fg}, ${t.bg})`,
          color: '#FFF',
          boxShadow: `0 8px 20px -6px ${t.glow}`,
        }}
      >
        <Icon className="w-4 h-4" />
      </motion.div>
      <p className="text-2xl font-fredoka font-bold tracking-tight" style={{ color: C.ink }}>{value}</p>
      <p className="text-xs font-nunito mt-0.5" style={{ color: 'rgba(10,42,32,0.62)' }}>{label}</p>
    </motion.button>
  );
}

export default function ClinicianHomeMobile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loadingAssess, setLoadingAssess] = useState(false);

  const load = async () => {
    try {
      const r = await axios.get(`${API}/clinician/dashboard-stats`, { withCredentials: true });
      setStats(r.data);
    } catch { /* fallback */ }
    try {
      const r = await axios.get(`${API}/announcements/active`, { withCredentials: true });
      const items = (r.data.announcements || []).filter((a) => {
        const aud = a.target_audience || a.audience || 'all';
        return aud === 'clinician' || aud === 'all' || aud === 'everyone';
      });
      setAnnouncements(items.slice(0, 8));
    } catch { /* */ }
  };
  useEffect(() => { load(); }, []);
  // Auto-refresh every 12 s so dashboard counters stay in sync with patient
  // actions across portals (user directive 2026-06-04).
  useEffect(() => {
    const iv = setInterval(load, 12000);
    return () => clearInterval(iv);
  }, []);

  const openPatient = async (p) => {
    setSelectedPatient(p);
    setLoadingAssess(true); setAssessments([]);
    try {
      const r = await axios.get(`${API}/clinician/patient/${p.user_id}/assessments`, { withCredentials: true });
      setAssessments(r.data.assessments || []);
    } finally { setLoadingAssess(false); }
  };

  const cleanName = (user?.name || 'Doctor').replace(/^Dr\.?\s+/i, '');
  const firstName = cleanName.split(' ')[0];

  return (
    <div className="px-4 pt-4 pb-6">
      {/* 3D Animated Hero — mirrors PatientHomeScreen's welcome orb */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-3xl p-5 relative overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${C.pine}22`,
          boxShadow: `0 28px 56px -22px ${C.pine}55, inset 0 1px 0 rgba(255,255,255,0.85)`,
        }}
        data-testid="clinician-home-hero"
      >
        {/* Decorative top-right orb */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-10 -right-10 w-36 h-36 rounded-full pointer-events-none opacity-60"
          style={{
            background: `radial-gradient(circle, ${C.emerald}66, ${C.mint}33 50%, transparent 75%)`,
            filter: 'blur(20px)',
          }}
        />
        <div className="flex items-start gap-4 relative">
          {/* 3D rotating sparkle orb */}
          <motion.div
            animate={{
              rotateY: [0, 360],
              y: [0, -4, 0],
            }}
            transition={{
              rotateY: { duration: 10, repeat: Infinity, ease: 'linear' },
              y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
            }}
            style={{ transformStyle: 'preserve-3d' }}
            className="w-16 h-16 rounded-2xl shrink-0 flex items-center justify-center relative"
          >
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${C.pine}, ${C.emerald}, ${C.mint})`,
                boxShadow: `0 18px 32px -10px ${C.pine}77, inset 0 -6px 12px rgba(0,0,0,0.18), inset 0 4px 10px rgba(10,42,32,0.5)`,
                transform: 'perspective(400px) rotateX(8deg)',
              }}
            />
            <Sparkles className="w-7 h-7 text-white relative drop-shadow" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-nunito font-bold uppercase tracking-[0.2em]" style={{ color: C.emerald }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <h1 className="font-fredoka font-semibold text-[1.6rem] leading-tight mt-1 truncate" style={{ color: C.ink, letterSpacing: '-0.015em' }}>
              Good day, Dr. {firstName}
            </h1>
            <p className="text-sm font-nunito mt-1" style={{ color: 'rgba(10,42,32,0.62)' }}>
              {stats?.patient_count != null
                ? <>{stats.patient_count} subscribed · <span style={{ color: C.pine, fontWeight: 700 }}>${(stats.revenue_usd || 0).toLocaleString()}</span> earned</>
                : 'Loading caseload…'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stat tiles (all clickable) */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <StatCard icon={Users} label="Patients" value={stats?.patient_count ?? '—'} tone="pine"
          to="/clinician/patients" testid="clin-stat-patients" />
        <StatCard icon={Award} label="Subscribed" value={stats?.subscribed_count ?? '—'} tone="emerald"
          to="/clinician/patients?filter=subscribed" testid="clin-stat-subscribed" />
        <StatCard icon={DollarSign} label="Revenue" value={`$${(stats?.revenue_usd || 0).toLocaleString()}`} tone="amber"
          to="/clinician/analytics" testid="clin-stat-revenue" />
        <StatCard icon={AlertOctagon} label="Alerts" value={stats?.alerts_count ?? 0} tone="rose"
          to="/clinician/notifications" testid="clin-stat-alerts" />
      </div>

      {/* AI Coach hero — 3D gradient pill */}
      <motion.button
        whileHover={{ y: -3, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate('/clinician/ai-coach')}
        className="w-full mt-5 rounded-3xl p-4 text-left relative overflow-hidden text-white"
        style={{
          background: `linear-gradient(135deg, ${C.pine}, ${C.emerald})`,
          boxShadow: `0 20px 40px -12px ${C.pine}aa, inset 0 1px 0 rgba(255,255,255,0.25)`,
        }}
        data-testid="ai-coach-hero"
      >
        {/* Floating background sparkles */}
        <motion.div
          aria-hidden
          className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none"
          animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.35), transparent 70%)' }}
        />
        <div className="flex items-start gap-3 relative">
          <motion.div
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </motion.div>
          <div className="flex-1">
            <h3 className="text-base font-fredoka font-semibold">AI Treatment Coach</h3>
            <p className="text-xs text-white/85 font-nunito mt-0.5">Evidence-informed 5-step care plans, tailored per patient.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/80 mt-1" />
        </div>
      </motion.button>

      {/* Quick actions — bouncy chips */}
      <div className="grid grid-cols-3 gap-2.5 mt-4" data-testid="clinician-quick-actions">
        {[
          { to: '/clinician/discover-patients', icon: User,  label: 'Discover' },
          { to: '/clinician/analytics',       icon: TrendingUp, label: 'Analytics' },
          { to: '/clinician/notes',           icon: FileText,   label: 'Notes' },
        ].map((q, i) => (
          <motion.button
            key={q.to}
            data-testid={`quick-action-${q.label.toLowerCase()}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.06 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate(q.to)}
            className="rounded-2xl p-3 flex flex-col items-start gap-2 text-left"
            style={{
              background: 'rgba(255,255,255,0.78)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${C.pine}22`,
              boxShadow: `0 8px 18px -10px ${C.pine}55`,
            }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ background: `linear-gradient(135deg, ${C.pine}, ${C.emerald})` }}>
              <q.icon className="w-4 h-4" />
            </div>
            <span className="text-xs font-nunito font-semibold" style={{ color: C.ink }}>{q.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Subscribed patients */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-nunito font-bold tracking-widest uppercase" style={{ color: C.pine }}>Your patients</h2>
          <button onClick={() => navigate('/clinician/patients')} className="text-xs font-nunito font-bold" style={{ color: C.emerald }}>
            View all →
          </button>
        </div>
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.78)',
            backdropFilter: 'blur(14px)',
            border: `1px solid ${C.pine}1F`,
            boxShadow: `0 12px 28px -16px ${C.pine}55`,
          }}>
          {(stats?.patients || []).slice(0, 5).map((p) => {
            const sev = SEVERITY[p.assessment_severity] || null;
            return (
              <button key={p.user_id}
                onClick={() => openPatient(p)}
                data-testid={`home-patient-${p.user_id}`}
                className="w-full p-3 flex items-center gap-3 text-left transition border-b last:border-b-0"
                style={{ borderColor: `${C.pine}11` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ background: `linear-gradient(135deg, ${C.pine}, ${C.emerald})` }}>
                  {(p.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-fredoka font-semibold truncate" style={{ color: C.ink }}>{p.name || 'Unnamed'}</p>
                    {p.subscribed && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0' }}>
                        Subscribed
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-nunito truncate" style={{ color: 'rgba(10,42,32,0.55)' }}>
                    {p.last_emotion ? <>Recent: <span className="font-bold" style={{ color: C.pine }}>{p.last_emotion}</span></> : 'No check-ins yet'}
                  </p>
                </div>
                {sev && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                    style={{ background: sev.bg, color: sev.fg, borderColor: sev.border }}>
                    {sev.label}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: `${C.pine}66` }} />
              </button>
            );
          })}
          {(!stats?.patients || !stats.patients.length) && (
            <div className="p-8 text-center">
              <Users className="w-6 h-6 mx-auto mb-2" style={{ color: `${C.pine}66` }} />
              <p className="text-sm font-fredoka font-semibold" style={{ color: C.ink }}>No patients yet</p>
              <p className="text-xs font-nunito mt-1" style={{ color: 'rgba(10,42,32,0.55)' }}>
                Patients who subscribe to your plan will appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Announcements — auto-scrolling carousel */}
      {announcements.length > 0 && (
        <div className="mt-6" data-testid="clinician-announcements-section">
          <h2 className="text-xs font-nunito font-bold tracking-widest uppercase mb-3" style={{ color: C.pine }}>From IFEELINCOLOR</h2>
          <AnnouncementsRail
            announcements={announcements}
            color={C.pine}
            accent={C.emerald}
            intervalMs={4500}
            testid="clin-announcements-rail"
            onCardClick={(a) => { if (a.link_target) navigate(a.link_target); }}
          />
        </div>
      )}

      {/* Patient detail sheet */}
      <AnimatePresence>
        {selectedPatient && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 backdrop-blur-sm p-4"
            onClick={() => setSelectedPatient(null)}
            data-testid="patient-assessment-modal">
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl max-h-[88vh] overflow-y-auto"
              style={{
                background: 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(20px)',
                boxShadow: `0 40px 80px -20px ${C.pine}77`,
              }}>
              <div className="sticky top-0 z-10 px-4 py-3 bg-white/90 backdrop-blur border-b flex items-center gap-3"
                style={{ borderColor: `${C.pine}1F` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ background: `linear-gradient(135deg, ${C.pine}, ${C.emerald})` }}>
                  {(selectedPatient.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-fredoka font-semibold truncate" style={{ color: C.ink }}>{selectedPatient.name}</p>
                  <p className="text-xs font-nunito truncate" style={{ color: 'rgba(10,42,32,0.55)' }}>{selectedPatient.email}</p>
                </div>
                <button onClick={() => setSelectedPatient(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${C.pine}11`, color: C.pine }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-2">
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => { setSelectedPatient(null); navigate(`/clinician/ai-coach?patient=${selectedPatient.user_id}`); }}
                  data-testid="modal-open-ai-coach"
                  className="w-full rounded-2xl p-3 flex items-center gap-3 text-white"
                  style={{ background: `linear-gradient(135deg, ${C.pine}, ${C.emerald})`, boxShadow: `0 12px 24px -8px ${C.pine}77` }}>
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-nunito font-bold flex-1 text-left">Build AI treatment plan</span>
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => { setSelectedPatient(null); navigate('/clinician/recommendations'); }}
                  className="w-full rounded-2xl p-3 flex items-center gap-3"
                  style={{ background: '#FFF', border: `1px solid ${C.pine}22`, color: C.ink }}>
                  <BookOpen className="w-4 h-4" style={{ color: C.pine }} />
                  <span className="text-sm font-nunito font-bold flex-1 text-left">Send a recommendation</span>
                  <ChevronRight className="w-4 h-4" style={{ color: `${C.pine}88` }} />
                </motion.button>

                <p className="text-xs font-nunito font-bold tracking-widest uppercase mt-4 mb-2" style={{ color: C.pine }}>
                  Assessment history · {assessments.length}
                </p>
                {loadingAssess && <p className="text-xs italic" style={{ color: 'rgba(10,42,32,0.45)' }}>Loading…</p>}
                {!loadingAssess && !assessments.length && (
                  <p className="text-xs italic" style={{ color: 'rgba(10,42,32,0.45)' }}>No assessments submitted yet.</p>
                )}
                <div className="space-y-2">
                  {assessments.map((a, i) => {
                    const sev = SEVERITY[a.severity] || null;
                    return (
                      <div key={a.response_id || i}
                        className="rounded-xl p-3"
                        style={{ background: '#F8FCFA', border: `1px solid ${C.pine}1F` }}>
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-3.5 h-3.5" style={{ color: C.pine }} />
                          <p className="text-xs font-nunito font-bold" style={{ color: C.ink }}>
                            {a.category_id ? a.category_id.replace(/_/g, ' ') : 'Assessment'}
                          </p>
                          {sev && (
                            <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
                              style={{ background: sev.bg, color: sev.fg, borderColor: sev.border }}>
                              {sev.label}
                            </span>
                          )}
                        </div>
                        {a.submitted_at && (
                          <p className="text-[10px] flex items-center gap-1 mb-1" style={{ color: 'rgba(10,42,32,0.55)' }}>
                            <Clock className="w-2.5 h-2.5" /> {new Date(a.submitted_at).toLocaleString()}
                          </p>
                        )}
                        {a.ai_plan?.summary && (
                          <p className="text-xs italic line-clamp-3 mt-1" style={{ color: 'rgba(10,42,32,0.7)' }}>"{a.ai_plan.summary}"</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
