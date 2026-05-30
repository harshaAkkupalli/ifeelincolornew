import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/auth`;

export default function LoginForm({ accent = '#FF6B9D', role = 'patient', onSuccess, onSignup, onForgot }) {
  const { updateUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifyNeeded, setVerifyNeeded] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [mockCode, setMockCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleLogin = async (e) => {
    e?.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await axios.post(`${API}/login`, { email, password }, { withCredentials: true });
      if (!res.data.email_verified) {
        // Send verification code
        const vr = await axios.post(`${API}/send-verification`, { email }, { withCredentials: true });
        setMockCode(vr.data.mock_code || '');
        setVerifyNeeded(true);
        setLoading(false);
        return;
      }
      updateUser(res.data);
      onSuccess?.(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    setVerifying(true); setError('');
    try {
      await axios.post(`${API}/verify-email`, { email, code: verifyCode }, { withCredentials: true });
      setVerified(true);
      // Re-login to get updated user
      const res = await axios.post(`${API}/login`, { email, password }, { withCredentials: true });
      updateUser(res.data);
      setTimeout(() => onSuccess?.(res.data), 1000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid code');
    } finally { setVerifying(false); }
  };

  // Biometric login removed app-wide (per user request).

  // Verification screen
  if (verifyNeeded && !verified) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="text-center">
          <Mail className="w-8 h-8 mx-auto mb-2" style={{ color: accent }} />
          <h3 className="text-lg font-fredoka font-semibold" style={{ color: '#3D2C2C' }}>Verify Your Email</h3>
          <p className="text-xs font-nunito mt-1" style={{ color: '#8B6F47' }}>Enter the 6-digit code sent to {email}</p>
        </div>
        {mockCode && (
          <div className="p-3 rounded-xl text-center" style={{ background: `${accent}10`, border: `1px dashed ${accent}44` }}>
            <p className="text-[10px] font-nunito" style={{ color: accent }}>Demo Mode — Your code is:</p>
            <p className="text-2xl font-fredoka font-bold tracking-widest" style={{ color: accent }}>{mockCode}</p>
          </div>
        )}
        <Input data-testid="verify-code-input" value={verifyCode} onChange={e => setVerifyCode(e.target.value)}
          placeholder="000000" className="text-center text-xl tracking-widest rounded-xl border-2 py-3 font-fredoka" style={{ borderColor: '#F0E0D0' }} maxLength={6} />
        {error && <p className="text-xs text-red-500 text-center font-nunito">{error}</p>}
        <Button data-testid="verify-email-submit" onClick={handleVerify} disabled={verifyCode.length !== 6 || verifying}
          className="w-full rounded-xl py-3 text-sm font-nunito font-bold text-white border-0 disabled:opacity-50" style={{ background: accent }}>
          {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Verify
        </Button>
      </motion.div>
    );
  }

  if (verified) {
    return (
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center py-6">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#06D6A0' }}>
          <Mail className="w-7 h-7 text-white" />
        </div>
        <p className="text-lg font-fredoka font-semibold" style={{ color: '#3D2C2C' }}>Email Verified!</p>
        <p className="text-xs font-nunito mt-1" style={{ color: '#8B6F47' }}>Signing you in...</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleLogin} className="space-y-3">
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#B89878' }} />
        <Input data-testid="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email address" className="pl-10 rounded-xl border-2 py-3 font-nunito text-sm" style={{ borderColor: '#F0E0D0' }} />
      </div>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#B89878' }} />
        <Input data-testid="login-password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Password" className="pl-10 pr-10 rounded-xl border-2 py-3 font-nunito text-sm" style={{ borderColor: '#F0E0D0' }} />
        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#B89878' }}>
          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 font-nunito text-center">{error}</p>}
      <Button data-testid="login-submit" type="submit" disabled={!email || !password || loading}
        className="w-full rounded-xl py-3 text-sm font-nunito font-bold text-white border-0 disabled:opacity-50" style={{ background: accent }}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Sign In
      </Button>

      <div className="flex items-center justify-between pt-1">
        <button type="button" data-testid="forgot-password-link" onClick={onForgot} className="text-[11px] font-nunito cursor-pointer" style={{ color: accent }}>
          Forgot Password?
        </button>
        <button type="button" data-testid="goto-signup-link" onClick={onSignup} className="text-[11px] font-nunito cursor-pointer" style={{ color: '#8B6F47' }}>
          Create Account <ArrowRight className="w-3 h-3 inline" />
        </button>
      </div>
    </form>
  );
}
