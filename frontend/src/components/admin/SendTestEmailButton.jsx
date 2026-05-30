import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Check, X, Loader2, MailCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

/**
 * Universal "Send Test Email" button — drop anywhere in the admin panel
 * that triggers an email (welcome flow, announcement, password reset, etc.)
 * Opens a small dialog where the admin can enter ANY email address and
 * dispatch the real email via Gmail SMTP (falls back to mock_sent if creds
 * not configured).
 *
 * Props:
 *   templateId?: string  — admin email_templates.template_id to send
 *   subject?: string     — inline subject (when no template_id)
 *   body?: string        — inline HTML body
 *   ctaLabel?: string
 *   ctaUrl?: string
 *   variables?: object   — placeholders ({{name}}, {{login_url}}, ...)
 *   label?: string       — button label (defaults to "Send test email")
 *   size?: 'sm' | 'md'   — visual size
 *   testId?: string      — data-testid suffix
 *   defaultTo?: string   — pre-filled recipient
 */
export default function SendTestEmailButton({
  templateId,
  subject,
  body,
  ctaLabel,
  ctaUrl,
  variables = {},
  label = 'Send test email',
  size = 'sm',
  testId = 'send-test-email',
  defaultTo = '',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'sent' | 'mock_sent' | 'failed'
  const [err, setErr] = useState('');

  const send = async () => {
    setErr('');
    if (!to || !/^\S+@\S+\.\S+$/.test(to)) { setErr('Enter a valid email'); return; }
    setLoading(true);
    try {
      const payload = templateId
        ? { template_id: templateId, to_email: to, to_name: name, variables }
        : { subject, body, cta_label: ctaLabel, cta_url: ctaUrl, to_email: to, to_name: name, variables };
      const r = await ax.post(`${API}/email/send`, payload);
      setStatus(r.data?.status || 'sent');
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to send');
      setStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setTo(defaultTo); setName(''); setStatus(null); setErr(''); };
  const close = () => { setOpen(false); setTimeout(reset, 200); };

  const sizeCls = size === 'md' ? 'h-10 px-4 text-xs' : 'h-7 px-2.5 text-[10px]';

  return (
    <>
      <button
        data-testid={testId}
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition ${sizeCls} ${className}`}
      >
        <MailCheck className="w-3 h-3" /> {label}
      </button>

      <Dialog open={open} onOpenChange={(v) => !v && close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" /> Test send
            </DialogTitle>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {status === 'sent' || status === 'mock_sent' ? (
              <motion.div key="ok" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="py-4 text-center space-y-3">
                <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center bg-emerald-50">
                  <Check className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {status === 'sent' ? 'Test email delivered' : 'Saved (Gmail not configured)'}
                </p>
                <p className="text-xs text-slate-500">
                  Sent to <span className="font-mono">{to}</span>
                </p>
                {status === 'mock_sent' && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1.5">
                    No real email was dispatched — set <code>GMAIL_APP_PASSWORD</code> in backend env.
                  </p>
                )}
                <Button onClick={close} className="w-full rounded-lg text-xs" data-testid={`${testId}-done`}>
                  Done
                </Button>
              </motion.div>
            ) : (
              <motion.div key="form" className="space-y-3 mt-1"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-xs text-slate-500">
                  Preview this email in any inbox before sending the real one — useful for QA.
                </p>
                <Input
                  data-testid={`${testId}-to`}
                  type="email"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  placeholder="recipient@example.com *"
                  className="rounded-lg"
                />
                <Input
                  data-testid={`${testId}-name`}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Recipient name (optional)"
                  className="rounded-lg"
                />
                {err && <p className="text-xs text-red-500">{err}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={close} className="rounded-lg text-xs">
                    <X className="w-3 h-3 mr-1" /> Cancel
                  </Button>
                  <Button
                    onClick={send}
                    disabled={loading || !to}
                    data-testid={`${testId}-confirm`}
                    className="rounded-lg text-xs text-white border-0"
                    style={{ background: 'linear-gradient(135deg, #22D67E, #12A4F0)' }}
                  >
                    {loading
                      ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sending</>
                      : <><Send className="w-3 h-3 mr-1" /> Send test</>}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
