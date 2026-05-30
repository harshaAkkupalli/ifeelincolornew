import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import axios from 'axios';
import {
  Heart, Stethoscope, Eye, EyeOff, Mail, Lock, ArrowRight, Loader2, Sparkles,
  Shield, KeyRound, Activity, Brain, Smile,
} from 'lucide-react';
import { LOGO_URL } from '../brand';
import { useAuth } from '../contexts/AuthContext';
import AppStoreCTAs from '../components/brand/AppStoreCTAs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ─── Sky-Blue Calm Palettes ──────────────────────────────────────────────
const PATIENT = {
  bg1: '#E0F4FB',   // very light sky
  bg2: '#BFE2F2',   // soft sky
  bg3: '#8FCDE8',   // sky blue
  primary: '#3F88B5',
  accent: '#5BB3DB',
  highlight: '#A4D7EE',
  text: '#0F3B57',
  sub: 'rgba(15,59,87,0.65)',
  orb1: '#7FC9E8',
  orb2: '#A8DFF0',
  card: 'rgba(255,255,255,0.78)',
  border: 'rgba(91,179,219,0.32)',
  field: 'rgba(255,255,255,0.55)',
  fieldBorder: 'rgba(63,136,181,0.22)',
};

const CLINICIAN = {
  // Medical emerald / pine — distinct from Patient sky-blue, evokes clinical
  // calm + trust ("scrubs green" softened into a modern teal palette).
  bg1: '#E6F7F1',   // very light mint
  bg2: '#B8E6D3',   // soft seafoam
  bg3: '#7BC4A6',   // emerald
  primary: '#1F6F54',   // deep pine
  accent: '#2FA37A',
  highlight: '#A5DCC7',
  text: '#0A2A20',
  sub: 'rgba(10,42,32,0.68)',
  orb1: '#76C8A5',
  orb2: '#A8DDC7',
  card: 'rgba(255,255,255,0.78)',
  border: 'rgba(47,163,122,0.32)',
  field: 'rgba(255,255,255,0.55)',
  fieldBorder: 'rgba(31,111,84,0.22)',
};

// ─── Infographic SVGs ────────────────────────────────────────────────────
const HeartbeatLine = ({ color }) => (
  <svg viewBox="0 0 200 60" className="w-full h-full" fill="none">
    <motion.path
      d="M0 30 L40 30 L50 10 L60 50 L70 20 L80 30 L120 30 L130 14 L140 46 L150 30 L200 30"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 2.6, ease: 'easeInOut', delay: 0.4 }}
    />
  </svg>
);

// 3D animated person+heart illustration for the Patient role
const PatientIllustration = ({ color }) => (
  <motion.svg
    viewBox="0 0 220 220"
    className="w-full h-full pointer-events-none"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.8 }}
  >
    <defs>
      <radialGradient id="patient-aura" cx="50%" cy="50%">
        <stop offset="0%" stopColor={color} stopOpacity="0.45" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </radialGradient>
      <linearGradient id="patient-body" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFF" stopOpacity="0.95" />
        <stop offset="100%" stopColor={color} stopOpacity="0.85" />
      </linearGradient>
    </defs>
    {/* Aura */}
    <motion.circle cx="110" cy="110" r="92" fill="url(#patient-aura)"
      animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
    {/* Floating orbital dots */}
    <motion.g animate={{ rotate: 360 }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '110px 110px' }}>
      <circle cx="195" cy="110" r="4" fill={color} opacity="0.9" />
      <circle cx="110" cy="22" r="3" fill={color} opacity="0.7" />
      <circle cx="25" cy="120" r="3.5" fill={color} opacity="0.8" />
    </motion.g>
    {/* Body (head + torso) */}
    <motion.g animate={{ y: [0, -4, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
      <circle cx="110" cy="80" r="22" fill="url(#patient-body)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
      <path d="M 70 174 Q 70 122 110 122 Q 150 122 150 174 Z" fill="url(#patient-body)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
    </motion.g>
    {/* Heart pulsing */}
    <motion.g animate={{ scale: [1, 1.16, 1] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '110px 138px' }}>
      <path d="M 110 152 C 102 142, 92 142, 92 132 C 92 124, 100 122, 110 130 C 120 122, 128 124, 128 132 C 128 142, 118 142, 110 152 Z" fill="#FF6B7A" />
    </motion.g>
    {/* Sparkles */}
    {[{x: 50, y: 50, d: 0}, {x: 168, y: 60, d: 0.6}, {x: 175, y: 168, d: 1.2}, {x: 42, y: 175, d: 1.8}].map(({x, y, d}, i) => (
      <motion.g key={i} animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 0.6] }} transition={{ duration: 2.4, repeat: Infinity, delay: d }}>
        <path d={`M ${x} ${y - 6} L ${x + 1.5} ${y - 1.5} L ${x + 6} ${y} L ${x + 1.5} ${y + 1.5} L ${x} ${y + 6} L ${x - 1.5} ${y + 1.5} L ${x - 6} ${y} L ${x - 1.5} ${y - 1.5} Z`} fill="white" opacity="0.9" />
      </motion.g>
    ))}
  </motion.svg>
);

// 3D animated stethoscope+brain illustration for Clinician role
const ClinicianIllustration = ({ color }) => (
  <motion.svg
    viewBox="0 0 220 220"
    className="w-full h-full pointer-events-none"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.8 }}
  >
    <defs>
      <radialGradient id="clin-aura" cx="50%" cy="50%">
        <stop offset="0%" stopColor={color} stopOpacity="0.4" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </radialGradient>
      <linearGradient id="clin-brain" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFF" stopOpacity="0.9" />
        <stop offset="100%" stopColor={color} stopOpacity="0.85" />
      </linearGradient>
    </defs>
    <motion.circle cx="110" cy="110" r="92" fill="url(#clin-aura)"
      animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 4, repeat: Infinity }} />
    {/* Rotating clinical icons orbit */}
    <motion.g animate={{ rotate: 360 }} transition={{ duration: 28, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '110px 110px' }}>
      {/* Tiny plus icon */}
      <g transform="translate(190, 105)">
        <rect x="-2" y="-6" width="4" height="12" fill={color} rx="1" />
        <rect x="-6" y="-2" width="12" height="4" fill={color} rx="1" />
      </g>
      <circle cx="22" cy="110" r="4" fill={color} opacity="0.9" />
      <circle cx="110" cy="22" r="3" fill={color} opacity="0.7" />
    </motion.g>
    {/* Brain in the center */}
    <motion.g animate={{ y: [0, -4, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '110px 110px' }}>
      <path d="M 110 60 C 80 58, 64 80, 70 102 C 58 110, 60 130, 76 138 C 78 158, 100 162, 110 152 C 120 162, 142 158, 144 138 C 160 130, 162 110, 150 102 C 156 80, 140 58, 110 60 Z"
        fill="url(#clin-brain)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
      {/* Brain folds */}
      <path d="M 88 84 Q 96 92, 90 102 Q 84 110, 92 118" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M 132 84 Q 124 92, 130 102 Q 136 110, 128 118" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M 110 70 L 110 148" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
    </motion.g>
    {/* Stethoscope hanging */}
    <motion.g animate={{ rotate: [-3, 3, -3] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '60px 165px' }}>
      <path d="M 60 130 Q 60 160, 80 168 Q 95 172, 102 162" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="60" cy="128" r="5" fill="white" />
      <circle cx="102" cy="162" r="7" fill="white" stroke={color} strokeWidth="1.5" />
    </motion.g>
    {/* Tiny ECG line */}
    <motion.path
      d="M 50 192 L 70 192 L 78 178 L 86 206 L 94 192 L 170 192"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: [0, 1, 1, 0] }}
      transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
    />
  </motion.svg>
);

const FloatingBlob = ({ color, delay = 0, size = 100, x = 0, y = 0 }) => (
  <motion.svg
    viewBox="0 0 200 200"
    style={{ position: 'absolute', width: size, height: size, left: x, top: y, pointerEvents: 'none' }}
    animate={{
      y: [0, -20, 0],
      rotate: [0, 12, -8, 0],
      scale: [1, 1.05, 1],
    }}
    transition={{ duration: 9 + delay, repeat: Infinity, ease: 'easeInOut' }}
  >
    <defs>
      <radialGradient id={`blob-grad-${delay}`} cx="50%" cy="50%">
        <stop offset="0%" stopColor={color} stopOpacity="0.7" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </radialGradient>
    </defs>
    <path
      d="M 100 20 Q 160 30 170 80 Q 180 130 130 160 Q 80 180 50 150 Q 20 120 25 80 Q 40 35 100 20 Z"
      fill={`url(#blob-grad-${delay})`}
    />
  </motion.svg>
);

const PulseDot = ({ color, x = '50%', y = '50%', delay = 0 }) => (
  <motion.span
    className="absolute w-2 h-2 rounded-full"
    style={{ left: x, top: y, background: color }}
    animate={{ scale: [1, 2.4, 1], opacity: [0.9, 0, 0.9] }}
    transition={{ duration: 2.4, repeat: Infinity, delay }}
  />
);

// ─── Main Component ──────────────────────────────────────────────────────
export default function MobileHome() {
  const navigate = useNavigate();
  const { login, updateUser } = useAuth();
  // Pre-select toggle from ?role=patient|clinician (used by legacy /patient-portal & /clinician-portal redirects).
  const [searchParams] = useSearchParams();
  const initialRole = (searchParams.get('role') === 'clinician') ? 'clinician' : 'patient';
  const [role, setRole] = useState(initialRole);
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useTransform(my, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(mx, [-0.5, 0.5], [-10, 10]);

  const handleMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const handleLeave = () => { mx.set(0); my.set(0); };

  const isPatient = role === 'patient';
  const C = isPatient ? PATIENT : CLINICIAN;

  const submit = async () => {
    setError('');
    if (mode === 'signin') {
      if (!form.email || !form.password) { setError('Please fill both fields.'); return; }
      setLoading(true);
      try {
        const loggedUser = await login(form.email, form.password);
        const actualRole = (loggedUser?.role || '').toLowerCase();
        if (actualRole && actualRole !== role) {
          setError(`This account is registered as a ${actualRole}. Please switch the toggle above.`);
          // best-effort sign out client-side
          try { await axios.post(`${API}/auth/logout`, {}, { withCredentials: true }); } catch { /* ignore */ }
          setLoading(false);
          return;
        }
        navigate(isPatient ? '/app/home' : '/clinician/home');
      } catch (e) {
        setError(e.response?.data?.detail || 'Invalid credentials.');
      } finally { setLoading(false); }
    } else {
      // Signup — pass collected email forward so wizard can pre-fill it
      const target = isPatient ? '/patient-signup' : '/clinician-signup';
      navigate(target, { state: { email: form.email } });
    }
  };

  const demoLogin = async () => {
    setLoading(true); setError('');
    try {
      const r = await axios.post(`${API}/auth/demo-login`, { role }, { withCredentials: true });
      updateUser(r.data);
      navigate(isPatient ? '/app/home' : '/clinician/home');
    } catch { setError('Demo unavailable.'); }
    finally { setLoading(false); }
  };

  // Auto-fill demo creds into the form (so user can edit / submit manually)
  const fillDemoCreds = () => {
    // Ensure the demo account is seeded (sets password_hash on first call), then prefill the form
    axios.post(`${API}/auth/demo-login/seed`, { role }, { withCredentials: false }).catch(() => {});
    if (isPatient) {
      setForm({ email: 'luna@demo.ifeelincolor.com', password: 'Patient@123' });
    } else {
      setForm({ email: 'sarah@demo.ifeelincolor.com', password: 'Clinician@123' });
    }
    setMode('signin');
    setError('');
  };

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden flex flex-col"
      style={{
        background: `linear-gradient(165deg, ${C.bg1} 0%, ${C.bg2} 55%, ${C.bg3} 100%)`,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        transition: 'background 0.9s ease',
      }}
      data-testid="mobile-home"
    >
      {/* ─── Animated Cloud / Sky orbs ─── */}
      <motion.div
        animate={{ x: [0, 50, -20, 0], y: [0, -30, 20, 0], rotate: [0, 14, -8, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${C.orb1}aa 0%, ${C.orb1}55 35%, transparent 70%)`, filter: 'blur(60px)' }}
      />
      <motion.div
        animate={{ x: [0, -40, 30, 0], y: [0, 40, -20, 0], rotate: [0, -14, 12, 0] }}
        transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-0 -left-32 w-[26rem] h-[26rem] rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${C.orb2}aa 0%, ${C.orb2}55 35%, transparent 70%)`, filter: 'blur(60px)' }}
      />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
        className="absolute top-1/2 left-1/2 w-[42rem] h-[42rem] pointer-events-none opacity-35"
        style={{
          transform: 'translate(-50%, -50%)',
          background: `conic-gradient(from 0deg, transparent, ${C.highlight}44, transparent 30%, ${C.accent}33, transparent 60%, ${C.highlight}22, transparent 90%)`,
          filter: 'blur(48px)',
        }}
      />

      {/* Decorative floating blobs */}
      <FloatingBlob color={C.accent} delay={0} size={140} x="70%" y="58%" />
      <FloatingBlob color={C.highlight} delay={2} size={110} x="-3%" y="48%" />

      {/* ─── Header (no Admin link) ─── */}
      <div className="relative z-10 px-5 pt-6 flex items-center">
        <motion.button
          type="button"
          onClick={() => { navigate('/'); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          data-testid="mobile-home-logo"
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-2.5 -ml-1 px-1 py-0.5 rounded-lg"
          style={{ perspective: 600 }}
          aria-label="Go to home"
        >
          <motion.div
            animate={{ rotateY: [0, 360], y: [0, -3, 0] }}
            transition={{
              rotateY: { duration: 9, repeat: Infinity, ease: 'linear' },
              y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center relative"
            style={{
              background: `linear-gradient(135deg, ${C.highlight}, ${C.accent})`,
              boxShadow: `0 16px 32px -10px ${C.primary}77, inset 0 1px 0 rgba(255,255,255,0.5)`,
              transformStyle: 'preserve-3d',
            }}
          >
            <img src={LOGO_URL} alt="" className="w-9 h-9 rounded-xl object-cover" />
          </motion.div>
          <div>
            <p className="font-fredoka font-bold text-lg leading-none" style={{ color: C.text, letterSpacing: '-0.02em' }}>
              IFEELINCOLOR
            </p>
            <p className="text-[10px] font-nunito" style={{ color: C.sub }}>
              {isPatient ? 'Calm. Sky-blue care.' : 'Clinical. Emerald-grounded.'}
            </p>
          </div>
        </motion.button>
      </div>

      {/* ─── Role toggle ─── */}
      <div className="relative z-10 px-5 mt-7">
        <div
          className="rounded-full p-1 flex relative"
          style={{
            background: 'rgba(255,255,255,0.55)',
            border: `1px solid ${C.border}`,
            backdropFilter: 'blur(14px)',
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.7), 0 16px 32px -16px ${C.primary}77`,
          }}
        >
          <motion.div
            initial={false}
            animate={{ x: isPatient ? 0 : '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="absolute top-1 left-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-full"
            style={{
              background: isPatient
                ? `linear-gradient(135deg, ${PATIENT.accent}, ${PATIENT.primary})`
                : `linear-gradient(135deg, ${CLINICIAN.accent}, ${CLINICIAN.primary})`,
              boxShadow: `0 10px 22px -10px ${C.primary}cc`,
            }}
          />
          <button
            data-testid="role-toggle-patient"
            onClick={() => setRole('patient')}
            className="relative z-10 flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-nunito font-bold transition"
            style={{ color: isPatient ? '#fff' : C.sub }}
          >
            <Heart className="w-3.5 h-3.5" /> Patient
          </button>
          <button
            data-testid="role-toggle-clinician"
            onClick={() => setRole('clinician')}
            className="relative z-10 flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-nunito font-bold transition"
            style={{ color: !isPatient ? '#fff' : C.sub }}
          >
            <Stethoscope className="w-3.5 h-3.5" /> Clinician
          </button>
        </div>
      </div>

      {/* ─── Hero copy + 3D Illustration ─── */}
      <div className="relative z-10 px-5 mt-7 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={role + mode} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
              <p className="text-[10px] font-nunito font-bold uppercase tracking-[0.22em] mb-2" style={{ color: C.primary }}>
                {isPatient ? 'For families' : 'For healthcare pros'}
              </p>
              <h1 className="font-fredoka font-semibold text-[2rem] leading-[1.05] max-w-[14ch]" style={{ color: C.text, letterSpacing: '-0.015em' }}>
                {mode === 'signin'
                  ? (isPatient ? 'Welcome back, breathe.' : 'Sign in, doctor.')
                  : (isPatient ? 'Begin your calm journey.' : 'Set up your practice.')}
              </h1>
              <p className="text-xs font-nunito mt-2 max-w-[24ch]" style={{ color: C.sub }}>
                {mode === 'signin'
                  ? (isPatient ? 'A clear sky to notice how your body feels.' : 'Your AI-augmented companion, sky-calm.')
                  : (isPatient ? 'A few details and your sky-space is ready.' : 'A secure clinician workspace.')}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
        {/* 3D Illustration */}
        <motion.div
          key={`illus-${role}`}
          initial={{ opacity: 0, scale: 0.8, rotateY: 30 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ perspective: 800, transformStyle: 'preserve-3d' }}
          className="w-32 h-32 shrink-0 -mr-2 -mt-1"
        >
          <motion.div
            animate={{ rotateY: [0, 6, 0, -6, 0], rotateX: [0, -4, 0, 4, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d' }}
            data-testid={`hero-illustration-${role}`}
          >
            {isPatient
              ? <PatientIllustration color={C.primary} />
              : <ClinicianIllustration color={C.primary} />}
          </motion.div>
        </motion.div>
      </div>

      {/* Heartbeat infographic strip */}
      <div className="relative z-10 px-5 mt-3">
        <div className="rounded-2xl p-3 flex items-center gap-3 relative overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.4)', border: `1px solid ${C.border}`, backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-2 shrink-0">
            {[Brain, Heart, Activity].map((Icon, i) => (
              <motion.div key={i}
                animate={{ y: [0, -4, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
                className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.highlight}, ${C.accent})`,
                  boxShadow: `0 6px 14px -4px ${C.primary}88`,
                }}>
                <Icon className="w-3.5 h-3.5 text-white" />
              </motion.div>
            ))}
          </div>
          <div className="flex-1 h-10 relative">
            <HeartbeatLine color={C.primary} />
          </div>
          <p className="text-[10px] font-nunito font-bold whitespace-nowrap" style={{ color: C.primary }}>
            {isPatient ? 'Whole-body care' : 'Clinical insight'}
          </p>
        </div>
      </div>

      {/* ─── 3D tilted auth card ─── */}
      <div className="relative z-10 flex-1 flex flex-col px-5 mt-5 mb-2" style={{ perspective: 1500 }}>
        <motion.div
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
          style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[32px] p-5 relative"
        >
          {/* Card base */}
          <div
            className="absolute inset-0 rounded-[32px]"
            style={{
              background: C.card,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: `1px solid ${C.border}`,
              boxShadow: `
                0 55px 90px -32px ${C.primary}77,
                0 24px 42px -22px ${C.accent}66,
                inset 0 1px 0 rgba(255,255,255,0.85)
              `,
            }}
          />
          {/* Top-right glow */}
          <div
            className="absolute -top-20 -right-10 w-44 h-44 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${C.highlight}aa, transparent 70%)`,
              filter: 'blur(28px)',
              transform: 'translateZ(40px)',
            }}
          />
          {/* Bottom-left glow */}
          <div
            className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${C.accent}66, transparent 70%)`,
              filter: 'blur(28px)',
              transform: 'translateZ(20px)',
            }}
          />

          <div className="relative" style={{ transform: 'translateZ(30px)' }}>
            {/* Mode toggle */}
            <div className="flex items-center justify-center mb-5">
              <div className="rounded-full p-0.5 flex relative text-[11px] font-bold"
                style={{ background: 'rgba(255,255,255,0.55)', border: `1px solid ${C.border}` }}>
                {['signin', 'signup'].map((m) => (
                  <button key={m} data-testid={`mode-${m}`} onClick={() => setMode(m)}
                    className="px-5 py-1.5 rounded-full transition relative"
                    style={{
                      background: mode === m ? 'white' : 'transparent',
                      color: mode === m ? C.primary : C.sub,
                      boxShadow: mode === m ? '0 6px 14px -4px rgba(0,0,0,0.12)' : 'none',
                    }}>
                    {m === 'signin' ? 'Sign in' : 'Sign up'}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={role + mode} initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -22 }} transition={{ duration: 0.28 }} className="space-y-3">
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: C.primary }} />
                  <input data-testid="mobile-home-email" type="email" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl pl-10 pr-3 py-3.5 text-sm outline-none transition"
                    style={{
                      background: C.field, border: `1px solid ${C.fieldBorder}`, color: C.text,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
                    }} />
                </div>
                {mode === 'signin' && (
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: C.primary }} />
                    <input data-testid="mobile-home-password" type={showPw ? 'text' : 'password'} value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Your password"
                      className="w-full rounded-2xl pl-10 pr-10 py-3.5 text-sm outline-none transition"
                      style={{
                        background: C.field, border: `1px solid ${C.fieldBorder}`, color: C.text,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
                      }} />
                    <button type="button" onClick={() => setShowPw(!showPw)} data-testid="mobile-home-toggle-pw"
                      className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: C.primary }}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {error && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    data-testid="mobile-home-error" className="text-xs font-bold" style={{ color: '#C44A4A' }}>
                    {error}
                  </motion.p>
                )}

                <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }}
                  onClick={submit} disabled={loading} data-testid="mobile-home-submit"
                  className="w-full rounded-2xl py-3.5 text-sm font-nunito font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{
                    background: `linear-gradient(135deg, ${C.accent}, ${C.primary})`,
                    boxShadow: `0 20px 40px -12px ${C.primary}bb, inset 0 1px 0 rgba(255,255,255,0.3)`,
                  }}>
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <>{mode === 'signin' ? 'Sign in' : 'Continue'} <ArrowRight className="w-4 h-4" /></>}
                </motion.button>

                {mode === 'signin' && (
                  <Link to={`/forgot-password/${role}`} data-testid="mobile-home-forgot"
                    className="text-[11px] font-nunito font-bold inline-flex items-center gap-1 mt-1"
                    style={{ color: C.primary }}>
                    <KeyRound className="w-3 h-3" /> Forgot your password?
                  </Link>
                )}

                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px" style={{ background: `${C.primary}28` }} />
                  <span className="text-[10px] font-nunito font-bold tracking-widest uppercase" style={{ color: C.sub }}>or</span>
                  <div className="flex-1 h-px" style={{ background: `${C.primary}28` }} />
                </div>

                <motion.button whileTap={{ scale: 0.97 }} onClick={demoLogin} disabled={loading}
                  data-testid={`mobile-home-demo-${role}`}
                  className="w-full rounded-2xl py-3 text-xs font-nunito font-bold flex items-center justify-center gap-1.5"
                  style={{
                    background: 'rgba(255,255,255,0.78)', border: `1px solid ${C.border}`, color: C.primary,
                    backdropFilter: 'blur(8px)',
                  }}>
                  <Sparkles className="w-3.5 h-3.5" /> Try {isPatient ? 'Patient' : 'Clinician'} Demo (1-tap)
                </motion.button>

                <motion.button whileTap={{ scale: 0.97 }} onClick={fillDemoCreds}
                  data-testid={`mobile-home-fill-demo-${role}`}
                  className="w-full rounded-2xl py-2.5 text-[11px] font-nunito font-bold flex items-center justify-center gap-1.5"
                  style={{
                    background: 'transparent', border: `1px dashed ${C.fieldBorder}`, color: C.sub,
                  }}>
                  Fill demo credentials into the form
                </motion.button>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Mini benefits row — 3 floating chips */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { icon: Shield, label: 'HIPAA-aware', delay: 0 },
            { icon: Smile, label: 'Sensory-safe', delay: 0.18 },
            { icon: Sparkles, label: 'AI-guided', delay: 0.36 },
          ].map(({ icon: Icon, label, delay }) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + delay }}
              whileHover={{ y: -2 }}
              className="rounded-2xl py-2 px-2.5 flex items-center gap-1.5 justify-center"
              style={{
                background: 'rgba(255,255,255,0.55)',
                border: `1px solid ${C.border}`,
                backdropFilter: 'blur(10px)',
                boxShadow: `0 8px 18px -8px ${C.primary}55`,
              }}>
              <Icon className="w-3 h-3" style={{ color: C.primary }} />
              <span className="text-[9px] font-nunito font-bold" style={{ color: C.text }}>{label}</span>
            </motion.div>
          ))}
        </div>

        {/* App store CTAs */}
        <div className="mt-6 mb-2">
          <AppStoreCTAs align="center" />
        </div>
      </div>
    </div>
  );
}
