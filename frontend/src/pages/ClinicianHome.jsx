/**
 * Clinician landing + sign-in page.
 *
 * Redesigned Feb 2026 — light medical aesthetic (whites + indigo) to match
 * the existing /clinician/home portal overhaul. Replaces the previous dark
 * teal landing which felt inconsistent with the rest of the clinician suite.
 *
 * Layout (mobile-first):
 *   • Top: brand bar with subtle pill nav (Patient · Sign Up · Sign In)
 *   • Hero with serene white card, indigo gradient headline, value bullets
 *   • Trust strip (HIPAA · evidence-based · used by N clinicians)
 *   • Primary sign-in card (glass on a soft indigo wash)
 *   • Demo card (optional, when admin demo-visible toggle is on)
 *   • Footer with attribution
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Stethoscope, ArrowRight, ShieldCheck, Sparkles, BarChart3,
  ClipboardList, Brain, Lock,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/brand/BrandLogo';
import LoginForm from './LoginForm';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Light medical palette — matches the clinician portal overhaul.
const INDIGO       = '#4F46E5';
const INDIGO_LIGHT = '#818CF8';
const INDIGO_TINT  = '#EEF2FF';
const INK          = '#0F172A';
const INK_2        = '#475569';
const SURFACE      = '#FFFFFF';
const SURFACE_2    = '#F8FAFC';

export default function ClinicianHome() {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(true);

  useEffect(() => {
    axios.get(`${API}/admin/settings/demo-visible`)
      .then((r) => setShowDemo(r.data.visible !== false))
      .catch(() => { /* default true */ });
  }, []);

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/demo-login`, { role: 'clinician' }, { withCredentials: true });
      updateUser(res.data);
      navigate('/clinician/home');
    } catch { /* ignored */ }
    finally { setLoading(false); }
  };

  const scrollToLogin = () =>
    document.getElementById('clinician-login-card')?.scrollIntoView({ behavior: 'smooth' });

  const features = [
    { icon: ClipboardList, t: 'Structured assessments',  d: 'Evidence-based screens for mood, body, history.' },
    { icon: BarChart3,     t: 'Color-shift analytics',    d: 'Visualize regulation trends over weeks.' },
    { icon: Brain,         t: 'AI-augmented reflections', d: 'Every check-in carries clinical context.' },
    { icon: Sparkles,      t: 'Care-team collaboration',  d: 'Shared notes, alerts, treatment goals.' },
  ];

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden relative"
      style={{
        background: `linear-gradient(180deg, ${SURFACE_2} 0%, ${SURFACE} 38%, ${INDIGO_TINT} 100%)`,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        color: INK,
      }}
      data-testid="clinician-landing"
    >
      {/* Subtle decorative shapes — sized so the page never feels empty,
          tuned to never overpower the typography. */}
      <motion.div
        aria-hidden
        animate={{ y: [0, -20, 0] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${INDIGO_LIGHT}33, transparent 70%)`, filter: 'blur(24px)' }}
      />
      <motion.div
        aria-hidden
        animate={{ y: [0, 16, 0] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-0 -left-28 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${INDIGO}22, transparent 70%)`, filter: 'blur(28px)' }}
      />

      {/* ─── NAV ─── */}
      <header className="relative z-20 px-5 pt-4 pb-2 flex items-center justify-between">
        <Logo size={32} textSize="text-base" />
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate('/patient-portal')}
            data-testid="clinician-portal-to-patient"
            className="text-xs font-nunito font-bold px-3 py-2 rounded-full text-slate-500 hover:text-slate-800"
          >
            Patient
          </button>
          <button
            data-testid="clinician-portal-signup-btn"
            onClick={() => navigate('/clinician-signup')}
            className="text-xs font-nunito font-bold px-3 py-2 rounded-full text-indigo-600"
          >
            Sign Up
          </button>
          <button
            data-testid="clinician-portal-login"
            onClick={scrollToLogin}
            className="text-xs font-nunito font-bold px-4 py-2 rounded-full text-white shadow-md"
            style={{ background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_LIGHT})` }}
          >
            Sign In
          </button>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative z-10 px-5 pt-8 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
          style={{ background: INDIGO_TINT, border: `1px solid ${INDIGO_LIGHT}55` }}
        >
          <Stethoscope className="w-3.5 h-3.5" style={{ color: INDIGO }} />
          <span className="text-[11px] font-nunito font-bold uppercase tracking-wider" style={{ color: INDIGO }}>
            For Healthcare Professionals
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="font-fredoka font-semibold leading-[1.05] mb-4"
          style={{ fontSize: 'clamp(2.25rem, 7vw, 3.25rem)', color: INK }}
        >
          Clinical insight,{' '}
          <span style={{
            background: `linear-gradient(135deg, ${INDIGO} 0%, ${INDIGO_LIGHT} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            colored
          </span>
          {' '}by feeling.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="font-nunito text-base mb-6 max-w-md"
          style={{ color: INK_2 }}
        >
          Track patient emotional journeys with somatic color mapping, AI reflections,
          and real-time check-in data — built for the whole care team.
        </motion.p>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="flex flex-col gap-3 max-w-md"
        >
          <Button
            data-testid="clinician-hero-cta"
            onClick={() => navigate('/clinician-signup')}
            className="rounded-2xl h-13 font-nunito font-bold text-base text-white border-0 w-full"
            style={{
              height: 52,
              background: `linear-gradient(135deg, ${INDIGO} 0%, ${INDIGO_LIGHT} 100%)`,
              boxShadow: `0 14px 30px -8px ${INDIGO}66`,
            }}
          >
            <Stethoscope className="w-5 h-5 mr-2" /> Register as Clinician
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            onClick={scrollToLogin}
            variant="outline"
            className="rounded-2xl font-nunito font-bold text-base border-2 bg-white w-full"
            style={{ height: 52, borderColor: INDIGO_LIGHT, color: INDIGO }}
          >
            Sign in to dashboard
          </Button>
        </motion.div>

        {/* Trust strip */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="mt-6 flex flex-wrap gap-3 text-[11px] font-nunito text-slate-500"
        >
          <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> HIPAA-aware</span>
          <span className="inline-flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5 text-indigo-500" /> Evidence-based</span>
          <span className="inline-flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-slate-400" /> End-to-end encrypted</span>
        </motion.div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="relative z-10 px-5 pb-10">
        <p className="text-[11px] font-nunito font-bold uppercase tracking-widest mb-3" style={{ color: INDIGO }}>
          Tools you'll love
        </p>
        <div className="grid grid-cols-1 gap-3">
          {features.map((f, i) => (
            <motion.div
              key={f.t}
              initial={{ opacity: 0, x: -14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-4 p-4 rounded-2xl bg-white"
              style={{
                border: `1px solid ${INDIGO_TINT}`,
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 8px 24px -12px rgba(79,70,229,0.10)',
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: INDIGO_TINT, border: `1px solid ${INDIGO_LIGHT}55` }}
              >
                <f.icon className="w-5 h-5" style={{ color: INDIGO }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-fredoka font-semibold text-base" style={{ color: INK }}>{f.t}</p>
                <p className="text-xs font-nunito" style={{ color: INK_2 }}>{f.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── LOGIN CARD ─── */}
      <section id="clinician-login-card" className="relative z-10 px-5 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl p-6 sm:p-7 relative overflow-hidden bg-white"
          style={{
            border: `1px solid ${INDIGO_LIGHT}33`,
            boxShadow: '0 30px 60px -20px rgba(79, 70, 229, 0.22), 0 2px 6px rgba(15, 23, 42, 0.04)',
          }}
        >
          {/* Top accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ background: `linear-gradient(90deg, ${INDIGO} 0%, ${INDIGO_LIGHT} 50%, ${INDIGO} 100%)` }}
          />

          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_LIGHT})`,
                boxShadow: `0 10px 22px -6px ${INDIGO}77`,
              }}
            >
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-fredoka font-semibold text-xl" style={{ color: INK }}>Clinician Sign In</h3>
              <p className="text-xs font-nunito" style={{ color: INK_2 }}>Access your patient dashboard</p>
            </div>
          </div>

          <LoginForm
            accent={INDIGO}
            role="clinician"
            onSuccess={() => navigate('/clinician/home')}
            onSignup={() => navigate('/clinician-signup')}
            onForgot={() => navigate('/forgot-password/clinician')}
          />

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-nunito text-slate-400">
            <span>New to IFEELINCOLOR?</span>
            <button
              onClick={() => navigate('/clinician-signup')}
              className="font-bold inline-flex items-center gap-1"
              style={{ color: INDIGO }}
              data-testid="clinician-login-card-signup"
            >
              Create your account <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      </section>

      {/* ─── DEMO CARD ─── */}
      {showDemo && (
        <section className="relative z-10 px-5 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl p-6 text-center relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${INDIGO} 0%, ${INDIGO_LIGHT} 100%)`,
              boxShadow: `0 24px 60px -16px ${INDIGO}55`,
            }}
          >
            <motion.div
              aria-hidden
              animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
              className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
              style={{ background: 'conic-gradient(from 0deg, rgba(255,255,255,0.35), transparent 50%)' }}
            />
            <Stethoscope className="relative w-8 h-8 mx-auto mb-3 text-white" />
            <h3 className="relative font-fredoka font-semibold text-xl text-white mb-1">Clinician Demo</h3>
            <p className="relative font-nunito text-sm text-white/85 mb-5">Try it as Dr. Sarah Chen</p>
            <Button
              data-testid="clinician-demo-login"
              onClick={handleDemoLogin}
              disabled={loading}
              className="relative rounded-full h-12 px-6 font-nunito font-bold text-sm bg-white border-0 w-full"
              style={{ color: INDIGO }}
            >
              {loading ? 'Opening…' : 'Open Clinician Demo'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        </section>
      )}

      {/* ─── FOOTER ─── */}
      <footer className="relative z-10 px-5 pb-10 pt-2 text-center">
        <div className="flex items-center justify-center gap-2 text-[11px] font-nunito text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5" /> HIPAA-aware · Built with clinicians
        </div>
        <p className="mt-3 text-[10px] font-nunito text-slate-400">
          Developed by <span className="font-bold" style={{ color: INDIGO }}>Projexino Solutions Pvt Ltd</span>
        </p>
      </footer>
    </div>
  );
}
