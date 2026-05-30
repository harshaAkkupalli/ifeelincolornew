import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ShieldCheck, RotateCcw, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Check, X, AlertTriangle, KeyRound, Server, AtSign, UserCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

/**
 * Email Provider configuration card — drop into the Admin → Email Templates
 * page so the super-admin can rotate the Gmail "from" mailbox without a
 * redeploy. Supports verify-before-save and a one-click reset to the
 * env-var default.
 */
export default function EmailProviderCard({ onSaved }) {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({
    sender_email: '',
    app_password: '',
    sender_name: 'IFEELINCOLOR',
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
  });
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyEmail, setVerifyEmail] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await ax.get(`${API}/email-provider`);
      setCfg(r.data);
      setForm(prev => ({
        ...prev,
        sender_email: r.data.sender_email || '',
        sender_name: r.data.sender_name || 'IFEELINCOLOR',
        smtp_host: r.data.smtp_host || 'smtp.gmail.com',
        smtp_port: r.data.smtp_port || 587,
      }));
    } catch (e) {
      console.warn('email provider load failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const verify = async () => {
    if (!form.sender_email || !form.app_password || !verifyEmail) {
      setVerifyResult({ ok: false, error: 'Fill sender email, app password, and a test recipient first.' });
      return;
    }
    setVerifying(true); setVerifyResult(null);
    try {
      const r = await ax.post(`${API}/email-provider/verify`, {
        ...form, to_email: verifyEmail,
      });
      setVerifyResult(r.data);
    } catch (e) {
      setVerifyResult({ ok: false, error: e.response?.data?.detail || e.message });
    } finally {
      setVerifying(false);
    }
  };

  const save = async () => {
    if (!form.sender_email || !form.app_password) return;
    setSaving(true);
    try {
      const r = await ax.post(`${API}/email-provider`, form);
      setCfg(r.data.config);
      setForm(prev => ({ ...prev, app_password: '' }));
      setVerifyResult({ ok: true, saved: true });
      onSaved?.(r.data.config);
    } catch (e) {
      setVerifyResult({ ok: false, error: e.response?.data?.detail || e.message });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('Revert to the environment-variable default sender? Any saved override will be removed.')) return;
    setResetting(true);
    try {
      const r = await ax.delete(`${API}/email-provider`);
      setCfg(r.data.config);
      setForm(prev => ({
        ...prev,
        sender_email: r.data.config.sender_email || '',
        sender_name: r.data.config.sender_name || 'IFEELINCOLOR',
      }));
      setVerifyResult({ ok: true, reset: true });
    } finally {
      setResetting(false);
    }
  };

  const sourceLabel = {
    db: { text: 'Custom (Admin override)', color: '#A78BFA', bg: '#A78BFA1A' },
    env: { text: 'Default (server env)', color: '#22D67E', bg: '#22D67E1A' },
    none: { text: 'Not configured · falls back to mock', color: '#F59E0B', bg: '#FEF3C7' },
  }[cfg?.source || 'none'];

  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden mb-6"
         data-testid="email-provider-card">
      {/* Header strip */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-left"
        data-testid="email-provider-toggle"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: 'linear-gradient(135deg, #FF4FBF, #FFA53C)' }}>
            <Server className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-pink-500">Sender mailbox</p>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 truncate">
              {loading ? 'Loading…' : (cfg?.sender_email || 'Not configured')}
              {!loading && cfg?.configured && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            </h3>
            {sourceLabel && (
              <span
                className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ color: sourceLabel.color, background: sourceLabel.bg }}
              >
                {sourceLabel.text}
              </span>
            )}
          </div>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4">
              {/* Help box */}
              <div className="rounded-xl p-3 text-[11px] leading-relaxed flex gap-2"
                   style={{ background: '#FDF4FF', border: '1px solid #F0ABFC' }}>
                <KeyRound className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#A21CAF' }} />
                <div>
                  <b className="text-purple-700">Use a Gmail App Password</b> — generate one at{' '}
                  <a className="underline" target="_blank" rel="noreferrer"
                     href="https://myaccount.google.com/apppasswords">
                    myaccount.google.com/apppasswords
                  </a>. Regular Gmail passwords will be rejected by SMTP.
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
                    <AtSign className="w-3 h-3" /> Sender email
                  </label>
                  <Input
                    data-testid="email-provider-sender-email"
                    type="email"
                    value={form.sender_email}
                    onChange={e => setForm({ ...form, sender_email: e.target.value })}
                    placeholder="you@yourdomain.com"
                    className="rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
                    <UserCircle2 className="w-3 h-3" /> Display name
                  </label>
                  <Input
                    data-testid="email-provider-sender-name"
                    value={form.sender_name}
                    onChange={e => setForm({ ...form, sender_name: e.target.value })}
                    placeholder="IFEELINCOLOR Care Team"
                    className="rounded-xl text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
                    <KeyRound className="w-3 h-3" /> App password
                  </label>
                  <div className="relative">
                    <Input
                      data-testid="email-provider-app-password"
                      type={showPw ? 'text' : 'password'}
                      value={form.app_password}
                      onChange={e => setForm({ ...form, app_password: e.target.value })}
                      placeholder={cfg?.configured
                        ? `Replace ${cfg.app_password_masked}…`
                        : 'xxxx xxxx xxxx xxxx'}
                      className="rounded-xl text-sm pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label="Toggle visibility"
                    >
                      {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">SMTP host</label>
                  <Input
                    value={form.smtp_host}
                    onChange={e => setForm({ ...form, smtp_host: e.target.value })}
                    className="rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">SMTP port</label>
                  <Input
                    type="number"
                    value={form.smtp_port}
                    onChange={e => setForm({ ...form, smtp_port: parseInt(e.target.value || 587, 10) })}
                    className="rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Verify row */}
              <div className="rounded-xl p-3"
                   style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <p className="text-[11px] font-bold text-emerald-700 mb-2 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Step 1 · Verify the credentials
                </p>
                <div className="flex gap-2">
                  <Input
                    data-testid="email-provider-verify-recipient"
                    type="email"
                    value={verifyEmail}
                    onChange={e => setVerifyEmail(e.target.value)}
                    placeholder="Send a test email to…"
                    className="rounded-xl text-sm flex-1"
                  />
                  <Button
                    onClick={verify}
                    disabled={verifying || !form.sender_email || !form.app_password || !verifyEmail}
                    data-testid="email-provider-verify-btn"
                    className="rounded-xl text-xs text-white border-0"
                    style={{ background: 'linear-gradient(135deg,#22D67E,#12A4F0)' }}
                  >
                    {verifying
                      ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Verifying</>
                      : <><Mail className="w-3 h-3 mr-1" /> Verify</>}
                  </Button>
                </div>
              </div>

              {verifyResult && (
                <div className={`rounded-xl px-3 py-2 text-[11px] flex items-start gap-2 ${
                  verifyResult.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {verifyResult.ok ? <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                  <div className="flex-1">
                    {verifyResult.saved && 'Saved · this mailbox now sends every email.'}
                    {verifyResult.reset && 'Reset to environment default.'}
                    {!verifyResult.saved && !verifyResult.reset && (
                      verifyResult.ok
                        ? `Test email sent. Check ${verifyEmail || 'the inbox'} — if it arrived, save these credentials.`
                        : (verifyResult.error || 'Verification failed')
                    )}
                  </div>
                  <button onClick={() => setVerifyResult(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="outline"
                  onClick={reset}
                  disabled={resetting || cfg?.source !== 'db'}
                  data-testid="email-provider-reset-btn"
                  className="rounded-xl text-xs"
                >
                  {resetting ? 'Resetting…' : <><RotateCcw className="w-3 h-3 mr-1" /> Revert to default</>}
                </Button>
                <Button
                  onClick={save}
                  disabled={saving || !form.sender_email || !form.app_password}
                  data-testid="email-provider-save-btn"
                  className="rounded-xl text-xs text-white border-0"
                  style={{ background: 'linear-gradient(135deg,#A78BFA,#FF4FBF)' }}
                >
                  {saving
                    ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving</>
                    : <>Step 2 · Save as active sender</>}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
