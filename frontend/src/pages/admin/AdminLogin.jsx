import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { LOGO_URL, BRAND } from '../../brand';

const FLOAT_SHAPES = [
  { x: '8%', y: '15%', size: 60, color: BRAND.green, delay: 0, dur: 5 },
  { x: '85%', y: '10%', size: 45, color: BRAND.blue, delay: 0.5, dur: 6 },
  { x: '75%', y: '70%', size: 55, color: BRAND.orange, delay: 1, dur: 4.5 },
  { x: '12%', y: '75%', size: 40, color: BRAND.pink, delay: 1.5, dur: 5.5 },
  { x: '50%', y: '85%', size: 35, color: BRAND.yellow, delay: 0.8, dur: 4 },
  { x: '90%', y: '45%', size: 30, color: BRAND.greenLight, delay: 0.3, dur: 6.5 },
  { x: '30%', y: '5%', size: 25, color: BRAND.blue, delay: 1.2, dur: 5 },
];

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(email, password); navigate('/admin'); }
    catch (err) { setError(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Login failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: BRAND.dark }}>
      {/* Animated background shapes */}
      {FLOAT_SHAPES.map((s, i) => (
        <motion.div key={i}
          className="absolute rounded-3xl"
          style={{ left: s.x, top: s.y, width: s.size, height: s.size, background: `${s.color}15`, border: `1px solid ${s.color}25` }}
          animate={{ y: [0, -20, 0], x: [0, 10, 0], rotate: [0, 15, 0] }}
          transition={{ duration: s.dur, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
        />
      ))}

      {/* Large background logo */}
      <motion.img
        src={LOGO_URL} alt=""
        className="absolute opacity-[0.03] pointer-events-none"
        style={{ width: 500, height: 500, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        animate={{ rotate: [0, 5, 0, -5, 0], scale: [1, 1.02, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Gradient orbs */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full" style={{ background: `radial-gradient(circle, ${BRAND.green}12, transparent 70%)`, transform: 'translate(-30%, -30%)' }} />
      <div className="absolute bottom-0 right-0 w-[350px] h-[350px] rounded-full" style={{ background: `radial-gradient(circle, ${BRAND.blue}10, transparent 70%)`, transform: 'translate(30%, 30%)' }} />
      <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] rounded-full" style={{ background: `radial-gradient(circle, ${BRAND.pink}08, transparent 70%)` }} />

      {/* Back to Main Home — top-left corner */}
      <motion.button
        type="button"
        onClick={() => navigate('/')}
        data-testid="admin-login-back"
        whileHover={{ x: -3 }}
        whileTap={{ scale: 0.95 }}
        className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-2 rounded-full font-nunito font-bold text-xs"
        style={{
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.85)',
          border: '1px solid rgba(255,255,255,0.18)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to home
      </motion.button>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: 'spring' }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="rounded-3xl p-8 backdrop-blur-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
          {/* Logo */}
          <motion.div className="flex flex-col items-center mb-8"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <motion.img src={LOGO_URL} alt="IFEELINCOLOR" className="w-20 h-20 object-contain mb-3"
              animate={{ rotateY: [0, 10, 0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />
            <span className="text-xl font-fredoka font-semibold" style={{
              background: `linear-gradient(90deg, ${BRAND.green}, ${BRAND.blue}, ${BRAND.orange}, ${BRAND.pink})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              IFEELINCOLOR
            </span>
            <span className="text-[10px] tracking-widest uppercase mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Admin Portal</span>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] mb-1.5 block font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Email</label>
              <Input data-testid="admin-login-email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@ifeelincolor.com"
                className="rounded-xl border bg-white/5 text-white placeholder:text-white/25 focus:ring-1" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            </div>
            <div>
              <label className="text-[11px] mb-1.5 block font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Password</label>
              <div className="relative">
                <Input data-testid="admin-login-password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"
                  className="rounded-xl border bg-white/5 text-white placeholder:text-white/25 pr-10 focus:ring-1" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button data-testid="admin-login-submit" type="submit" disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white border-0" style={{ background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.blue})` }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Sign In
            </Button>
          </form>

          {/* Bottom gradient line */}
          <div className="mt-6 h-0.5 rounded-full" style={{ background: `linear-gradient(90deg, ${BRAND.green}, ${BRAND.blue}, ${BRAND.orange}, ${BRAND.pink}, ${BRAND.yellow})` }} />
          <p className="text-[9px] text-center mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>IFEELINCOLOR Healthcare Ecosystem</p>
        </div>
      </motion.div>
    </div>
  );
}
