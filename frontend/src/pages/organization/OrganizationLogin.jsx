/**
 * Organization Login — premium dark-mode gateway.
 *
 * Design spec (user-approved, Feb 2026):
 *   • Base canvas: #0D0D11 with subtle radial accent glows
 *   • Glassmorphic panel: rgba(26,26,36,0.6) + 12px backdrop blur
 *   • Multi-Role Access Selector pill (Patient · Clinician · Organization · Super Admin)
 *     hard-navigates to each portal. Organization is active by default here.
 *   • Emerald-green primary submit button (#10B981)
 *   • Calls the dedicated /api/organization/login endpoint (role-locked)
 *
 * Routes used by the role pill:
 *   Patient      → /mobile-home?role=patient
 *   Clinician    → /mobile-home?role=clinician
 *   Organization → current page
 *   Super Admin  → /admin/login
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, Mail, Lock, ArrowLeft, ShieldCheck, Sparkles, KeyRound,
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../../components/brand/BrandLogo';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEMO_EMAIL = 'admin@demo.ifeelincolor.com';
const DEMO_PASSWORD = 'Organization@123';

export default function OrganizationLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(true);
  const { setUser, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/admin/settings/demo-visible`)
      .then(r => setShowDemo(r.data.visible !== false))
      .catch(() => setShowDemo(true));
  }, []);

  const doSignIn = async (signInEmail, signInPassword) => {
    setLoading(true);
    try {
      // Use the dedicated role-locked endpoint so a non-org account
      // never gets a session through this portal.
      const r = await axios.post(
        `${API}/organization/login`,
        { email: signInEmail, password: signInPassword },
        { withCredentials: true },
      );
      // Sync AuthContext: prefer the context's login (refreshes /api/auth/me)
      // so the in-memory user reflects role_tier exactly as the dashboard
      // expects.
      if (login) {
        await login(signInEmail, signInPassword).catch(() => setUser?.(r.data));
      } else {
        setUser?.(r.data);
      }
      navigate('/org/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Sign in failed');
    } finally { setLoading(false); }
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    doSignIn(email, password);
  };

  const oneTapDemo = async () => {
    try { await axios.post(`${API}/auth/demo-login/seed`, { role: 'organization' }); } catch {/* idempotent */}
    doSignIn(DEMO_EMAIL, DEMO_PASSWORD);
  };

  const fillDemo = async () => {
    try { await axios.post(`${API}/auth/demo-login/seed`, { role: 'organization' }); } catch {/* idempotent */}
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
  };

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{
        background: '#0D0D11',
        color: '#E5E7EB',
      }}
      data-testid="org-login-page"
    >
      {/* Ambient accent glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.55) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute -bottom-40 -right-32 w-[480px] h-[480px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.6) 0%, transparent 70%)', filter: 'blur(48px)' }} />
        {/* Subtle noise overlay */}
        <div className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{ backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/></filter><rect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/></svg>")' }} />
      </div>

      {/* Top bar */}
      <div className="px-6 py-5 flex items-center justify-between relative z-10">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-emerald-300 transition-colors"
          data-testid="org-login-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Back to home
        </button>
        <Logo size={28} />
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-5 py-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-md rounded-3xl p-7 sm:p-8"
          style={{
            background: 'rgba(26, 26, 36, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 30px 80px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
          data-testid="org-login-card"
        >
          {/* Brand block */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 relative"
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                boxShadow: '0 14px 30px -8px rgba(16,185,129,0.55), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}>
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-fredoka font-bold text-white tracking-tight">IFEELINCOLOR</h1>
            <p className="text-xs text-slate-400 mt-1.5 max-w-[280px] leading-relaxed">
              Healthcare Ecosystem · Organization Gateway
            </p>
          </div>

          {/* Sign in form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">
                Organization Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="admin@your-clinic.com"
                  data-testid="org-email-input"
                  className="pl-11 h-12 rounded-xl text-sm border-0 text-white placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-emerald-500"
                  style={{
                    background: 'rgba(13, 13, 17, 0.7)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">
                Secure Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  data-testid="org-password-input"
                  className="pl-11 h-12 rounded-xl text-sm border-0 text-white placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-emerald-500"
                  style={{
                    background: 'rgba(13, 13, 17, 0.7)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                HIPAA-compliant gateway
              </span>
              <button
                type="button"
                onClick={() => navigate('/forgot-password/clinician')}
                className="text-emerald-300 hover:text-emerald-200 transition-colors font-medium"
                data-testid="org-forgot-link"
              >
                Forgot password?
              </button>
            </div>

            <motion.button
              type="submit"
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              data-testid="org-login-submit"
              className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#0D0D11',
                boxShadow: '0 14px 28px -8px rgba(16,185,129,0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
              }}
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-900/40 border-t-slate-900 animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Enter Organization Portal
                </>
              )}
            </motion.button>
          </form>

          {/* Demo block — gated by super-admin */}
          {showDemo && (
            <div className="mt-6 pt-5 relative" data-testid="org-demo-block">
              <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-slate-700/40" />
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-emerald-400">
                  Demo · Try Instantly
                </span>
                <div className="flex-1 h-px bg-slate-700/40" />
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={oneTapDemo}
                disabled={loading}
                data-testid="org-demo-onetap"
                className="w-full rounded-xl py-2.5 text-xs font-nunito font-bold flex items-center justify-center gap-1.5 transition-all"
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: '#34D399',
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Try Organization Demo (1-tap)
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={fillDemo}
                data-testid="org-demo-fill"
                className="mt-2 w-full rounded-xl py-2 text-[11px] font-nunito font-semibold flex items-center justify-center gap-1.5 transition-all"
                style={{
                  background: 'transparent',
                  border: '1px dashed rgba(148, 163, 184, 0.25)',
                  color: '#94A3B8',
                }}
              >
                <KeyRound className="w-3 h-3" />
                Fill demo credentials into the form
              </motion.button>

              <p className="text-[10px] text-center text-slate-500 mt-3 leading-relaxed">
                <span className="font-mono text-emerald-300/80">{DEMO_EMAIL}</span>
                <br />
                password <span className="font-mono text-emerald-300/80">{DEMO_PASSWORD}</span>
              </p>
            </div>
          )}

          <div className="text-[10px] text-slate-500 text-center mt-5 leading-relaxed">
            Don't have an organization account?
            <br />
            Contact your IFEELINCOLOR account manager to onboard.
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 text-center text-[10px] text-slate-600 relative z-10">
        © {new Date().getFullYear()} IFEELINCOLOR · Encrypted end-to-end · HIPAA · GDPR
      </div>
    </div>
  );
}
