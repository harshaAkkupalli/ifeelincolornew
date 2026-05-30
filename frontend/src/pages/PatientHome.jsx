import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Palette, Heart, Sun, Cloud, Smile, ArrowRight, Star, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/brand/BrandLogo';
import { LOGO_URL } from '../brand';
import LoginForm from './LoginForm';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Kid-friendly vibrant palette tuned for autism/sensory-friendly UX:
// - High contrast, joyful, no harsh flashing
const C = {
  pink: '#FF4FBF',
  coral: '#FF7AB0',
  orange: '#FF8C3F',
  yellow: '#FFD23F',
  green: '#22D67E',
  teal: '#22D3C5',
  blue: '#4EA8FF',
  purple: '#A78BFA',
  cream: '#FFF7EE',
  ink: '#2A1A4A',
};

function Bubble({ size, color, top, left, right, bottom, delay = 0 }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size, top, left, right, bottom,
        background: `radial-gradient(circle at 30% 30%, ${color}ff 0%, ${color}aa 50%, ${color}33 100%)`,
        boxShadow: `0 16px 40px -8px ${color}66`,
      }}
      animate={{ y: [0, -20, 0], scale: [1, 1.08, 1] }}
      transition={{ duration: 5 + Math.random() * 3, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

export default function PatientHome() {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(true);
  const [activeMood, setActiveMood] = useState(0);

  const moods = [
    { icon: Smile, label: 'Happy', color: C.yellow },
    { icon: Heart, label: 'Loved', color: C.pink },
    { icon: Sun, label: 'Bright', color: C.orange },
    { icon: Cloud, label: 'Calm', color: C.blue },
    { icon: Sparkles, label: 'Excited', color: C.purple },
  ];

  useEffect(() => {
    axios.get(`${API}/admin/settings/demo-visible`).then(r => setShowDemo(r.data.visible !== false)).catch(() => {});
    const id = setInterval(() => setActiveMood(v => (v + 1) % moods.length), 2200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/demo-login`, { role: 'patient' }, { withCredentials: true });
      updateUser(res.data);
      navigate('/dashboard');
    } catch { /* ignored */ } finally { setLoading(false); }
  };

  const current = moods[activeMood];

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden relative"
      style={{
        background:
          `linear-gradient(180deg, #F3EEFF 0%, #EFF7FF 35%, #E6FBF5 70%, #FFF6E5 100%)`,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Floating bubbles */}
      <div className="absolute inset-0 pointer-events-none">
        <Bubble size={130} color={C.pink} top="2%" left="-6%" />
        <Bubble size={90} color={C.yellow} top="10%" right="-4%" delay={1.2} />
        <Bubble size={70} color={C.green} top="48%" left="86%" delay={0.6} />
        <Bubble size={110} color={C.blue} bottom="22%" left="-3%" delay={1.8} />
        <Bubble size={80} color={C.purple} bottom="6%" right="6%" delay={2.4} />
        <Bubble size={50} color={C.teal} top="32%" left="14%" delay={0.3} />
      </div>

      {/* === NAV (mobile-first) === */}
      <header className="relative z-20 px-5 pt-4 pb-2 flex items-center justify-between">
        <Logo size={32} textSize="text-base" />
        <div className="flex items-center gap-2">
          <button
            data-testid="patient-portal-signup-btn"
            onClick={() => navigate('/patient-signup')}
            className="text-xs font-nunito font-bold px-3 py-2 rounded-full"
            style={{ color: C.pink }}
          >
            Sign Up
          </button>
          <button
            data-testid="patient-portal-login"
            onClick={() => document.getElementById('patient-login-card')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-xs font-nunito font-bold px-4 py-2 rounded-full text-white"
            style={{ background: `linear-gradient(135deg, ${C.pink}, ${C.orange})`, boxShadow: `0 8px 18px ${C.pink}55` }}
          >
            Sign In
          </button>
        </div>
      </header>

      {/* === HERO === */}
      <section className="relative z-10 px-5 pt-6 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
          style={{ background: 'white', boxShadow: `0 10px 22px ${C.pink}1a` }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
          <span className="text-[11px] font-nunito font-bold uppercase tracking-wider" style={{ color: C.pink }}>
            Patient Portal • Safe space
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="font-fredoka font-semibold leading-[1.05] mb-4"
          style={{ color: C.ink, fontSize: 'clamp(2.25rem, 7vw, 3.5rem)' }}
        >
          Hi, friend.{' '}
          <span style={{
            background: `linear-gradient(135deg, ${C.pink}, ${C.orange}, ${C.yellow})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            How are you
          </span>{' '}
          feeling today?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="font-nunito text-base mb-7 max-w-md"
          style={{ color: '#5C4D7A' }}
        >
          Tap a color, draw a feeling, take a breath. We're here to help you understand every emotion — big or small.
        </motion.p>

        {/* Mood preview card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="relative rounded-[2rem] p-6 mb-6 overflow-hidden"
          style={{
            background: 'white',
            border: '1px solid rgba(255,255,255,0.7)',
            boxShadow: `0 24px 70px -20px ${current.color}66`,
          }}
        >
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-60"
            style={{ background: `radial-gradient(circle, ${current.color}33, transparent 70%)` }} />
          <div className="relative flex items-center gap-5">
            <motion.div
              key={current.label}
              initial={{ rotate: -20, scale: 0.7 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 14 }}
              className="w-20 h-20 rounded-3xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${current.color}, ${current.color}cc)`,
                boxShadow: `0 16px 36px -6px ${current.color}88`,
              }}
            >
              <current.icon className="w-10 h-10 text-white" strokeWidth={2.2} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: '#A599B8' }}>
                Today I feel
              </p>
              <motion.p
                key={current.label + '-t'}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="font-fredoka font-semibold text-3xl"
                style={{ color: current.color }}
              >
                {current.label}
              </motion.p>
              <div className="flex gap-1.5 mt-3">
                {moods.map((m, i) => (
                  <button
                    key={m.label}
                    data-testid={`mood-dot-${i}`}
                    onClick={() => setActiveMood(i)}
                    aria-label={m.label}
                    className="h-2 rounded-full transition-all"
                    style={{
                      background: i === activeMood ? m.color : '#EEE5F6',
                      width: i === activeMood ? 22 : 8,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-3"
        >
          <Button
            data-testid="patient-hero-cta"
            onClick={() => navigate('/patient-signup')}
            className="rounded-2xl h-14 font-nunito font-bold text-base text-white border-0 shadow-lg w-full"
            style={{
              background: `linear-gradient(135deg, ${C.pink}, ${C.orange})`,
              boxShadow: `0 16px 30px -8px ${C.pink}88`,
            }}
          >
            <Sparkles className="w-5 h-5 mr-2" /> Start My Journey
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            data-testid="patient-portal-login-cta"
            onClick={() => document.getElementById('patient-login-card')?.scrollIntoView({ behavior: 'smooth' })}
            variant="outline"
            className="rounded-2xl h-14 font-nunito font-bold text-base border-2"
            style={{ borderColor: C.pink, color: C.pink, background: 'rgba(255,255,255,0.7)' }}
          >
            I already have an account
          </Button>
        </motion.div>
      </section>

      {/* === FEATURE TILES === */}
      <section className="relative z-10 px-5 pb-10">
        <p className="text-[11px] font-nunito font-bold uppercase tracking-widest mb-3" style={{ color: '#A599B8' }}>
          Why people love it
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Palette, title: 'Color my feelings', color: C.pink, bg: '#FFE7F2' },
            { icon: Heart, title: 'Body map', color: C.blue, bg: '#E1F1FF' },
            { icon: Sparkles, title: 'Daily check-in', color: C.orange, bg: '#FFEDDC' },
            { icon: ShieldCheck, title: 'Safe & gentle', color: C.green, bg: '#DCFAE7' },
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4, rotate: -0.5 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-2xl p-4 cursor-pointer"
              style={{ background: f.bg, boxShadow: `0 10px 24px -10px ${f.color}55` }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'white', boxShadow: `0 6px 14px -4px ${f.color}55` }}>
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <p className="font-fredoka font-semibold text-base" style={{ color: C.ink }}>{f.title}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* === LOGIN CARD === */}
      <section id="patient-login-card" className="relative z-10 px-5 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[2rem] p-6 relative overflow-hidden"
          style={{
            background: 'white',
            border: '1px solid rgba(255,255,255,0.7)',
            boxShadow: '0 24px 70px -20px rgba(255,79,191,0.35)',
          }}
        >
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-50"
            style={{ background: `radial-gradient(circle, ${C.pink}30, transparent 70%)` }} />
          <div className="relative">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${C.pink}, ${C.orange})`, boxShadow: `0 10px 22px -6px ${C.pink}66` }}>
                <img src={LOGO_URL} alt="" className="w-7 h-7 object-contain" />
              </div>
              <div>
                <h3 className="font-fredoka font-semibold text-xl" style={{ color: C.ink }}>Welcome back!</h3>
                <p className="text-xs font-nunito" style={{ color: '#8F84A8' }}>Sign in to continue your journey</p>
              </div>
            </div>
            <LoginForm
              accent={C.pink}
              role="patient"
              onSuccess={() => navigate('/dashboard')}
              onSignup={() => navigate('/patient-signup')}
              onForgot={() => navigate('/forgot-password/patient')}
            />
          </div>
        </motion.div>
      </section>

      {/* === DEMO LOGIN === */}
      {showDemo && (
        <section className="relative z-10 px-5 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-[2rem] p-6 text-center relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${C.purple}, ${C.pink}, ${C.orange})`,
              boxShadow: '0 24px 60px -16px rgba(167,139,250,0.5)',
            }}
          >
            <motion.div
              animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
              className="absolute -top-20 -right-20 w-56 h-56 rounded-full"
              style={{ background: 'conic-gradient(from 0deg, rgba(255,255,255,0.4), transparent 50%)' }}
            />
            <p className="relative text-[11px] font-nunito font-bold uppercase tracking-widest mb-2 text-white/80">Try it now</p>
            <h3 className="relative font-fredoka font-semibold text-2xl text-white mb-2">Take a peek as Luna</h3>
            <p className="relative font-nunito text-sm text-white/80 mb-5">One tap — try the full 9-step check-in</p>
            <Button
              data-testid="patient-demo-login"
              onClick={handleDemoLogin}
              disabled={loading}
              className="relative rounded-full h-12 px-6 font-nunito font-bold text-sm bg-white border-0 w-full"
              style={{ color: C.pink, boxShadow: '0 10px 22px rgba(0,0,0,0.15)' }}
            >
              {loading ? 'Opening...' : 'Open Patient Demo'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        </section>
      )}

      {/* === FOOTER === */}
      <footer className="relative z-10 px-5 pb-10 pt-2 text-center">
        <div className="inline-flex items-center gap-1.5 mb-2">
          {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" style={{ color: C.yellow }} />)}
        </div>
        <p className="font-nunito text-xs italic max-w-xs mx-auto" style={{ color: '#8F84A8' }}>
          "Every feeling has a color. Every voice matters."
        </p>
        <button
          data-testid="patient-to-clinician-link"
          onClick={() => navigate('/clinician-portal')}
          className="mt-4 text-xs font-nunito font-bold underline"
          style={{ color: C.blue }}
        >
          I'm a clinician →
        </button>
        <p className="mt-5 text-[10px] font-nunito" style={{ color: '#8F8493' }}>
          Developed by{' '}
          <span className="font-bold" style={{
            background: `linear-gradient(90deg, ${C.pink}, ${C.orange}, ${C.blue})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>Projexino Solutions Pvt Ltd</span>
        </p>
      </footer>
    </div>
  );
}
