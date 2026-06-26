import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Sparkles, User, Stethoscope, Building2, ArrowRight, Heart, Brain, Smile,
  Palette, ShieldCheck, Activity, Star, ChevronRight, Smartphone,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { Logo, AnimatedLogo } from '../components/brand/BrandLogo';
import { LOGO_URL, BRAND } from '../brand';
import AppStoreCTAs from '../components/brand/AppStoreCTAs';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ----- Animations -----
const float = (dy = 14, dx = 0, dur = 5) => ({
  animate: {
    y: [0, -dy, 0],
    x: [0, dx, 0],
    transition: { duration: dur, repeat: Infinity, ease: 'easeInOut' },
  },
});

const stagger = {
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

// ----- Feeling words for the marquee -----
const FEELINGS = [
  { word: 'Calm', color: BRAND.blue },
  { word: 'Joyful', color: BRAND.yellow },
  { word: 'Bold', color: BRAND.pink },
  { word: 'Curious', color: BRAND.green },
  { word: 'Hopeful', color: BRAND.orange },
  { word: 'Grounded', color: '#7B8FA1' },
  { word: 'Loved', color: BRAND.pink },
  { word: 'Soft', color: BRAND.greenLight },
  { word: 'Alive', color: BRAND.blue },
  { word: 'Safe', color: BRAND.orange },
];

// ----- Orb sphere with 3D shading -----
function Orb({ size, color, top, left, right, bottom, delay = 0, intensity = 0.7 }) {
  return (
    <motion.div
      animate={{ y: [0, -18, 0], scale: [1, 1.05, 1] }}
      transition={{ duration: 6 + Math.random() * 3, repeat: Infinity, ease: 'easeInOut', delay }}
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size, top, left, right, bottom,
        background: `radial-gradient(circle at 30% 30%, ${color}ff 0%, ${color}aa 35%, ${color}55 70%, transparent 100%)`,
        filter: `blur(${size > 100 ? 1 : 0}px)`,
        opacity: intensity,
      }}
    />
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [demoLoading, setDemoLoading] = useState(null);
  const [showDemo, setShowDemo] = useState(true);
  const [activeFeeling, setActiveFeeling] = useState(0);
  const { scrollY } = useScroll();
  const yParallax = useTransform(scrollY, [0, 400], [0, -80]);
  const yParallax2 = useTransform(scrollY, [0, 400], [0, 60]);

  useEffect(() => {
    axios.get(`${API}/admin/settings/demo-visible`).then(r => setShowDemo(r.data.visible !== false)).catch(() => {});
    const id = setInterval(() => setActiveFeeling(v => (v + 1) % FEELINGS.length), 1800);
    return () => clearInterval(id);
  }, []);

  const handleLogin = () => {
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleDemoLogin = async (role) => {
    setDemoLoading(role);
    try {
      const res = await axios.post(`${API}/auth/demo-login`, { role }, { withCredentials: true });
      updateUser(res.data);
      navigate('/dashboard');
    } catch (err) {
      console.error('Demo login failed:', err);
    } finally {
      setDemoLoading(null);
    }
  };

  const current = FEELINGS[activeFeeling];

  return (
    <div className="min-h-screen w-full overflow-x-hidden" style={{ background: '#FDFBF4' }}>
      {/* ============ NAV ============ */}
      <header className="sticky top-0 z-50 backdrop-blur-xl" style={{ background: 'rgba(253,251,244,0.75)', borderBottom: '1px solid rgba(26,35,50,0.06)' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <motion.button
            type="button"
            onClick={() => navigate('/')}
            data-testid="landing-logo-home"
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5 -ml-1 px-1 py-0.5 rounded-lg hover:bg-black/5 transition"
            aria-label="Go to home"
          >
            <Logo size={34} textSize="text-lg" />
          </motion.button>
          <motion.nav initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1 sm:gap-2">
            <motion.button
              data-testid="nav-org-portal"
              onClick={() => navigate('/org/login')}
              whileHover={{ y: -2, scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="relative flex items-center gap-2 px-4 py-2 rounded-full overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg, rgba(251,146,60,0.95), rgba(249,115,22,0.95))',
                boxShadow: '0 10px 24px -10px rgba(249,115,22,0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
              }}
            >
              <motion.span
                aria-hidden
                animate={{ x: ['-120%', '160%'] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.6 }}
                className="absolute top-0 left-0 w-1/2 h-full opacity-40"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}
              />
              <motion.span
                aria-hidden
                animate={{ rotate: 360 }}
                transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 rounded-md flex items-center justify-center relative z-10"
                style={{
                  background: 'linear-gradient(135deg, #ffffff, #FFE4C4)',
                }}
              >
                <Building2 className="w-3 h-3" style={{ color: '#F97316' }} />
              </motion.span>
              <span className="relative z-10 text-xs font-nunito font-bold text-white tracking-wide">
                Organization
              </span>
              <span className="relative z-10 hidden sm:inline text-[10px] font-nunito text-white/70">
                · network portal
              </span>
            </motion.button>
            <motion.button
              data-testid="nav-admin-portal"
              onClick={() => navigate('/admin/login')}
              whileHover={{ y: -2, scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="relative flex items-center gap-2 px-4 py-2 rounded-full overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg, rgba(26,35,50,0.92), rgba(46,49,72,0.92))',
                boxShadow: '0 10px 24px -10px rgba(26,35,50,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}
            >
              {/* shimmer */}
              <motion.span
                aria-hidden
                animate={{ x: ['-120%', '160%'] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.6 }}
                className="absolute top-0 left-0 w-1/2 h-full opacity-40"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}
              />
              <motion.span
                aria-hidden
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 rounded-md flex items-center justify-center relative z-10"
                style={{
                  background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.blue}, ${BRAND.pink})`,
                }}
              >
                <ShieldCheck className="w-3 h-3 text-white" />
              </motion.span>
              <span className="relative z-10 text-xs font-nunito font-bold text-white tracking-wide">
                Admin
              </span>
              <span className="relative z-10 hidden sm:inline text-[10px] font-nunito text-white/55">
                · super console
              </span>
            </motion.button>
          </motion.nav>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-12 sm:pt-20 pb-24">
        {/* Floating 3D orbs */}
        <motion.div style={{ y: yParallax }} className="absolute inset-0 pointer-events-none">
          <Orb size={140} color={BRAND.yellow} top="2%" left="3%" delay={0} />
          <Orb size={90} color={BRAND.pink} top="14%" right="8%" delay={1.2} />
          <Orb size={70} color={BRAND.green} top="40%" left="42%" delay={0.6} intensity={0.55} />
          <Orb size={110} color={BRAND.blue} bottom="6%" left="6%" delay={2} />
          <Orb size={80} color={BRAND.orange} bottom="14%" right="12%" delay={1.8} />
        </motion.div>

        <motion.div variants={stagger} initial="hidden" animate="show" className="relative grid lg:grid-cols-12 gap-10 items-center">
          {/* LEFT: Headline */}
          <div className="lg:col-span-7 relative z-10">
            <motion.div variants={item} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6"
              style={{ background: 'white', border: `1px solid ${BRAND.green}30`, boxShadow: '0 4px 18px rgba(26,35,50,0.06)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: BRAND.green }} />
              <span className="text-xs font-nunito font-semibold tracking-wide" style={{ color: BRAND.dark }}>
                Now with biometric login & AI reflections
              </span>
            </motion.div>

            <motion.h1 variants={item} className="font-fredoka font-semibold leading-[1.05] mb-6"
              style={{ color: BRAND.dark, fontSize: 'clamp(2.5rem, 6vw, 4.75rem)' }}>
              Every feeling has{' '}
              <span className="relative inline-block">
                <span style={{
                  background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.blue}, ${BRAND.orange}, ${BRAND.pink})`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  a color.
                </span>
                <motion.svg
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, delay: 0.6 }}
                  className="absolute -bottom-3 left-0 w-full" height="14" viewBox="0 0 400 14" fill="none">
                  <motion.path d="M2 8 Q 100 1 200 7 T 398 6" stroke={BRAND.orange} strokeWidth="4" strokeLinecap="round" fill="none" />
                </motion.svg>
              </span>
              <br />
              We help you{' '}
              <span style={{ color: BRAND.pink }}>name it.</span>
            </motion.h1>

            <motion.p variants={item} className="text-base sm:text-lg font-nunito leading-relaxed mb-8 max-w-xl"
              style={{ color: '#4A5563' }}>
              IFEELINCOLOR is a sensory-friendly emotional wellness companion for everyone navigating their feelings — patients, families, and care teams.
              Tap, color, breathe — and turn what you're feeling into something you can share.
            </motion.p>

            <motion.div variants={item} className="flex flex-wrap items-center gap-3 mb-10">
              <Button
                data-testid="hero-get-started-button"
                onClick={() => navigate('/mobile-home')}
                className="group rounded-full h-14 px-7 font-nunito font-bold text-white border-0 shadow-lg hover:shadow-2xl transition-all text-base"
                style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}
              >
                <Sparkles className="w-5 h-5 mr-2 group-hover:rotate-12 transition" />
                Open the app to feel better
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition" />
              </Button>
            </motion.div>

            {/* Trust strip */}
            <motion.div variants={item} className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-nunito" style={{ color: '#6B7380' }}>
              <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" style={{ color: BRAND.green }} /> HIPAA-aware</div>
              <div className="flex items-center gap-1.5"><Brain className="w-4 h-4" style={{ color: BRAND.blue }} /> Built with clinicians</div>
              <div className="flex items-center gap-1.5"><Heart className="w-4 h-4" style={{ color: BRAND.pink }} /> Autism-affirming</div>
              <div className="flex items-center gap-1.5"><Star className="w-4 h-4" style={{ color: BRAND.orange }} /> 4.9/5 by care teams</div>
            </motion.div>
          </div>

          {/* RIGHT: 3D rotating feeling card */}
          <motion.div variants={item} className="lg:col-span-5 relative">
            <div className="relative w-full max-w-md mx-auto aspect-square">
              {/* Soft halo */}
              <motion.div
                animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full"
                style={{ background: `conic-gradient(from 0deg, ${BRAND.green}, ${BRAND.blue}, ${BRAND.orange}, ${BRAND.pink}, ${BRAND.yellow}, ${BRAND.green})`, filter: 'blur(28px)', opacity: 0.45 }}
              />

              {/* Center card */}
              <motion.div
                animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-6 rounded-[2rem] backdrop-blur-xl flex flex-col items-center justify-center text-center p-8"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(255,255,255,0.9)',
                  boxShadow: '0 30px 80px -20px rgba(26,35,50,0.25), inset 0 1px 0 rgba(255,255,255,0.9)',
                }}>
                <img src={LOGO_URL} alt="IFEELINCOLOR" className="w-16 h-16 object-contain mb-4 drop-shadow-md" />
                <p className="text-xs font-nunito uppercase tracking-[0.2em] mb-2" style={{ color: '#9AA1AE' }}>Today I feel</p>
                <motion.div
                  key={current.word}
                  initial={{ opacity: 0, y: 14, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="font-fredoka font-semibold text-4xl sm:text-5xl mb-4"
                  style={{ color: current.color }}>
                  {current.word}
                </motion.div>
                <div className="flex gap-1.5">
                  {FEELINGS.map((f, i) => (
                    <button
                      key={f.word}
                      data-testid={`feeling-dot-${i}`}
                      onClick={() => setActiveFeeling(i)}
                      className="w-2 h-2 rounded-full transition-all"
                      style={{ background: i === activeFeeling ? f.color : '#E5E7EB', width: i === activeFeeling ? 18 : 8 }}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Orbiting mini chips */}
              {[
                { icon: Heart, color: BRAND.pink, angle: 0 },
                { icon: Smile, color: BRAND.yellow, angle: 90 },
                { icon: Brain, color: BRAND.blue, angle: 180 },
                { icon: Palette, color: BRAND.green, angle: 270 },
              ].map((c, i) => {
                const r = 175;
                const rad = (c.angle * Math.PI) / 180;
                return (
                  <motion.div
                    key={i}
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                    style={{ position: 'absolute', inset: 0 }}
                  >
                    <div
                      className="absolute w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                      style={{
                        background: 'white',
                        left: `calc(50% + ${Math.cos(rad) * r}px - 24px)`,
                        top: `calc(50% + ${Math.sin(rad) * r}px - 24px)`,
                        border: `2px solid ${c.color}`,
                      }}>
                      <c.icon className="w-5 h-5" style={{ color: c.color }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>

        {/* Marquee */}
        <motion.div style={{ y: yParallax2 }} className="relative mt-16 -mx-5 sm:-mx-8 overflow-hidden py-4"
          // eslint-disable-next-line react/forbid-dom-props
        >
          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            className="flex gap-4 whitespace-nowrap"
          >
            {[...FEELINGS, ...FEELINGS, ...FEELINGS].map((f, i) => (
              <span
                key={i}
                className="font-fredoka font-semibold text-3xl sm:text-5xl px-2 opacity-80"
                style={{ color: f.color }}
              >
                {f.word} <span style={{ color: '#1A2332', opacity: 0.2 }}>•</span>
              </span>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="relative py-20" style={{ background: BRAND.dark, color: 'white' }}>
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <Orb size={260} color={BRAND.pink} top="-10%" right="-5%" delay={0} intensity={0.4} />
          <Orb size={200} color={BRAND.blue} bottom="-10%" left="-5%" delay={1} intensity={0.4} />
        </div>
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
            <div>
              <p className="text-xs font-nunito uppercase tracking-[0.25em] mb-3" style={{ color: BRAND.yellow }}>How it works</p>
              <h2 className="font-fredoka font-semibold text-4xl sm:text-5xl leading-tight max-w-xl">
                Nine gentle steps from <span style={{ color: BRAND.greenLight }}>feeling</span> to <span style={{ color: BRAND.orange }}>understanding.</span>
              </h2>
            </div>
            <p className="font-nunito text-base max-w-md opacity-70">
              Each check-in is a guided journey — sensory zone, body map, feelings wheel, and an AI reflection your care team can see.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { n: '01', t: 'Tune in', d: 'Pick a sensory zone — calm, alert, or somewhere between.', c: BRAND.green },
              { n: '02', t: 'Map it', d: 'Tap on a 3D body model to mark sensations. Multi-touch supported.', c: BRAND.blue },
              { n: '03', t: 'Reflect', d: 'Spin the feelings wheel, choose a regulation step, see your AI reflection.', c: BRAND.pink },
            ].map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -6, rotateX: 2, rotateY: -2 }}
                className="relative p-7 rounded-3xl group"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', transformStyle: 'preserve-3d' }}
              >
                <div className="flex items-start justify-between mb-6">
                  <span className="font-fredoka text-5xl font-semibold opacity-20">{s.n}</span>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: s.c + '22', border: `1px solid ${s.c}66` }}>
                    <ChevronRight className="w-4 h-4" style={{ color: s.c }} />
                  </div>
                </div>
                <h3 className="font-fredoka font-semibold text-2xl mb-2" style={{ color: s.c }}>{s.t}</h3>
                <p className="font-nunito text-sm opacity-70 leading-relaxed">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ROLES / PORTALS (hidden from public) ============ */}

      {/* ============ STATS ============ */}
      <section className="relative py-16" style={{ background: `linear-gradient(135deg, ${BRAND.green}10, ${BRAND.blue}10, ${BRAND.pink}10)` }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { v: '50k+', l: 'Check-ins logged', c: BRAND.pink },
              { v: '17', l: 'Audit data points', c: BRAND.blue },
              { v: '9', l: 'Step guided flow', c: BRAND.orange },
              { v: '∞', l: 'Colors of feeling', c: BRAND.green },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="text-center"
              >
                <div className="font-fredoka font-semibold text-5xl sm:text-6xl mb-2" style={{ color: s.c }}>{s.v}</div>
                <p className="font-nunito text-sm opacity-70" style={{ color: BRAND.dark }}>{s.l}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ DEMO LOGIN ============ */}
      {showDemo && (
        <section className="relative max-w-7xl mx-auto px-5 sm:px-8 py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-[2rem] p-8 sm:p-12 overflow-hidden"
            style={{ background: BRAND.dark, border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="absolute inset-0 opacity-50 pointer-events-none">
              <Orb size={240} color={BRAND.yellow} top="-20%" left="-5%" intensity={0.5} />
              <Orb size={200} color={BRAND.green} bottom="-20%" right="-5%" intensity={0.5} />
            </div>

            <div className="relative">
              <div className="text-center mb-10">
                <p className="text-xs font-nunito uppercase tracking-[0.25em] mb-3" style={{ color: BRAND.yellow }}>Try it instantly</p>
                <h2 className="font-fredoka font-semibold text-4xl sm:text-5xl text-white mb-3">
                  See the app from any angle
                </h2>
                <p className="font-nunito text-base max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  No sign-up. One click logs you into a fully-loaded demo account.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {[
                  { role: 'patient', label: 'Patient', name: 'Luna Star', desc: 'Try the 9-step check-in, body map & feelings wheel', icon: User, color: BRAND.yellow },
                  { role: 'clinician', label: 'Clinician', name: 'Dr. Sarah Chen', desc: 'See your caseload, check-in trends & AI reflections', icon: Stethoscope, color: BRAND.blue },
                  { role: 'organization', label: 'Organization', name: 'Sunshine Care Center', desc: 'Browse org-wide stats, branding & subscriptions', icon: Building2, color: BRAND.green },
                ].map((d) => (
                  <motion.button
                    key={d.role}
                    data-testid={`demo-login-${d.role}`}
                    whileHover={{ y: -6, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDemoLogin(d.role)}
                    disabled={demoLoading !== null}
                    className="text-left p-6 rounded-2xl disabled:opacity-60 transition-all relative overflow-hidden"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${d.color}40`,
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: d.color + '1a', border: `1px solid ${d.color}40` }}>
                      <d.icon className="w-5 h-5" style={{ color: d.color }} />
                    </div>
                    <p className="font-fredoka font-semibold text-lg mb-0.5" style={{ color: d.color }}>{d.label}</p>
                    <p className="font-nunito text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>as {d.name}</p>
                    <p className="font-nunito text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>{d.desc}</p>
                    <div className="flex items-center gap-2 font-nunito text-sm font-semibold" style={{ color: d.color }}>
                      {demoLoading === d.role ? (
                        <>
                          <Activity className="w-4 h-4 animate-pulse" /> Logging in...
                        </>
                      ) : (
                        <>
                          Open demo <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </section>
      )}

      {/* ============ CTA STRIP ============ */}
      <section className="relative max-w-7xl mx-auto px-5 sm:px-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-[2rem] p-10 sm:p-14 overflow-hidden text-center"
          style={{
            background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange}, ${BRAND.yellow})`,
          }}
        >
          <motion.div
            animate={{ rotate: 360 }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
            className="absolute -top-20 -right-20 w-72 h-72 rounded-full"
            style={{ background: `conic-gradient(from 0deg, ${BRAND.white}33, transparent 50%)` }}
          />
          <h3 className="relative font-fredoka font-semibold text-4xl sm:text-5xl text-white mb-4 leading-tight">
            Your feelings deserve a place to live.
          </h3>
          <p className="relative font-nunito text-base text-white/85 max-w-xl mx-auto mb-8">
            Join families, clinicians and organizations using IFEELINCOLOR to make emotions visible.
          </p>
          <Button
            data-testid="cta-bottom-button"
            onClick={handleLogin}
            className="relative rounded-full h-14 px-8 font-nunito font-bold text-base shadow-xl hover:shadow-2xl transition"
            style={{ background: BRAND.dark, color: 'white' }}
          >
            Start free <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          {/* App store CTAs on Main Home */}
          <div className="relative mt-8">
            <AppStoreCTAs align="center" theme="light" />
          </div>
        </motion.div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t" style={{ borderColor: 'rgba(26,35,50,0.08)' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size={28} textSize="text-base" />
          <p className="font-nunito text-xs" style={{ color: '#6B7380' }}>
            © {new Date().getFullYear()} IFEELINCOLOR — Made with care for every feeling.
          </p>
          <div className="flex items-center gap-3 text-xs font-nunito" style={{ color: '#6B7380' }}>
            <a href="/admin/login" data-testid="footer-admin-link" className="hover:underline">Admin Panel</a>
          </div>
        </div>
        <div className="border-t" style={{ borderColor: 'rgba(26,35,50,0.06)' }}>
          <p className="text-center text-[10px] font-nunito py-3" style={{ color: '#8F8493' }}>
            Developed by{' '}
            <span className="font-bold" style={{
              background: `linear-gradient(90deg, ${BRAND.pink}, ${BRAND.orange}, ${BRAND.blue})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Projexino Solutions Pvt Ltd</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
