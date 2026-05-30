import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, ArrowLeft, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/auth`;

export default function ForgotPassword({ accent = '#FF6B9D', portalRoute = '/patient-portal' }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0=email, 1=token+password, 2=done
  const [email, setEmail] = useState('');
  const [mockToken, setMockToken] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestReset = async (e) => {
    e?.preventDefault(); setLoading(true); setError('');
    try {
      const res = await axios.post(`${API}/forgot-password`, { email });
      setMockToken(res.data.mock_token || '');
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send reset link');
    } finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e?.preventDefault(); setLoading(true); setError('');
    try {
      await axios.post(`${API}/reset-password`, { token, new_password: newPassword });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: accent === '#118AB2' ? '#F0F5FA' : 'linear-gradient(180deg, #FFF8E7, #FFE8C8)' }}>
      <div className="w-full max-w-[430px]">
        <div className="rounded-[2rem] overflow-hidden shadow-2xl" style={{ background: '#FFFFFF', boxShadow: '0 25px 80px rgba(0,0,0,0.12)' }}>
          <div className="px-6 pt-5 pb-2 flex items-center">
            <button onClick={() => step > 0 && step < 2 ? setStep(step - 1) : navigate(portalRoute)} data-testid="forgot-back"
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer" style={{ background: `${accent}10` }}>
              <ArrowLeft className="w-4 h-4" style={{ color: accent }} />
            </button>
          </div>

          <div className="px-6 py-6">
            {step === 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="text-center mb-6">
                  <KeyRound className="w-10 h-10 mx-auto mb-3" style={{ color: accent }} />
                  <h2 className="text-2xl font-fredoka font-semibold" style={{ color: '#3D2C2C' }}>Forgot Password?</h2>
                  <p className="text-xs font-nunito mt-1" style={{ color: '#8B6F47' }}>Enter your email and we'll send a reset link</p>
                </div>
                <form onSubmit={handleRequestReset} className="space-y-4">
                  <Input data-testid="forgot-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="Your email address" className="rounded-xl border-2 py-3 font-nunito" style={{ borderColor: '#F0E0D0' }} />
                  {error && <p className="text-xs text-red-500 text-center font-nunito">{error}</p>}
                  <Button data-testid="forgot-submit" type="submit" disabled={!email || loading}
                    className="w-full rounded-xl py-3 text-sm font-nunito font-bold text-white border-0 disabled:opacity-50" style={{ background: accent }}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Send Reset Link
                  </Button>
                </form>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="text-center mb-5">
                  <h2 className="text-xl font-fredoka font-semibold" style={{ color: '#3D2C2C' }}>Reset Your Password</h2>
                </div>
                {mockToken && (
                  <div className="p-3 rounded-xl mb-4 text-center" style={{ background: `${accent}10`, border: `1px dashed ${accent}44` }}>
                    <p className="text-[10px] font-nunito" style={{ color: accent }}>Demo Mode — Your reset token:</p>
                    <p className="text-xs font-mono font-bold mt-1 break-all" style={{ color: accent }}>{mockToken}</p>
                  </div>
                )}
                <form onSubmit={handleReset} className="space-y-4">
                  <Input data-testid="reset-token" value={token} onChange={e => setToken(e.target.value)}
                    placeholder="Reset token" className="rounded-xl border-2 py-3 font-nunito text-sm" style={{ borderColor: '#F0E0D0' }} />
                  <div className="relative">
                    <Input data-testid="reset-new-password" type={showPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder="New password (min 6 chars)" className="rounded-xl border-2 py-3 font-nunito text-sm pr-10" style={{ borderColor: '#F0E0D0' }} />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#B89878' }}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {error && <p className="text-xs text-red-500 text-center font-nunito">{error}</p>}
                  <Button data-testid="reset-submit" type="submit" disabled={!token || newPassword.length < 6 || loading}
                    className="w-full rounded-xl py-3 text-sm font-nunito font-bold text-white border-0 disabled:opacity-50" style={{ background: accent }}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Reset Password
                  </Button>
                </form>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#06D6A0' }}>
                  <Check className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-fredoka font-semibold mb-2" style={{ color: '#3D2C2C' }}>Password Reset!</h2>
                <p className="text-xs font-nunito mb-6" style={{ color: '#8B6F47' }}>You can now sign in with your new password</p>
                <Button data-testid="back-to-login" onClick={() => navigate(portalRoute)}
                  className="rounded-xl px-8 py-3 text-sm font-nunito font-bold text-white border-0" style={{ background: accent }}>
                  Back to Sign In
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
