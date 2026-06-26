import React, { useState } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { UserPlus, Copy, Check, Eye, EyeOff } from 'lucide-react';
import SendTestEmailButton from './SendTestEmailButton';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

/**
 * Reusable "Add New User" modal for admin.
 * Creates a patient, clinician, or organization account.
 */
export default function AddUserDialog({ open, onClose, role, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '', specialty: '', org_name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async () => {
    setError('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        mobile: form.mobile,
        password: form.password || null,
        role,
        ...(role === 'clinician' ? { specialty: form.specialty } : {}),
        ...(role === 'organization' ? { org_name: form.org_name } : {}),
      };
      const r = await ax.post(`${API}/users`, payload);
      setDone(r.data);
      onCreated?.(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setForm({ name: '', email: '', mobile: '', password: '', specialty: '', org_name: '' });
    setDone(null);
    setError('');
    setCopied(false);
  };

  const close = () => { reset(); onClose?.(); };

  const labels = {
    patient: 'Patient',
    clinician: 'Clinician',
    organization: 'Organization',
  };

  // Map role → welcome template id (matches /backend/email_templates.py seed)
  const WELCOME_TPL = {
    patient: 'tpl_welcome_patient',
    clinician: 'tpl_welcome_clinician',
    organization: 'tpl_welcome_clinician', // reuses clinician welcome for now
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-pink-500" /> Add New {labels[role]}
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-3 mt-2">
            <div className="rounded-2xl p-4 bg-green-50 border border-green-200">
              <p className="font-bold text-sm text-green-800 flex items-center gap-2">
                <Check className="w-4 h-4" /> {labels[role]} created
              </p>
              <p className="text-xs text-slate-600 mt-1">{done.user?.name} · {done.user?.email}</p>
              {done.temporary_password && (
                <div className="mt-3 p-2 bg-white rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Temporary password</p>
                    <p className="font-mono text-sm">{done.temporary_password}</p>
                  </div>
                  <button
                    data-testid="copy-password-btn"
                    onClick={() => { navigator.clipboard.writeText(done.temporary_password); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="text-xs px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
            <Button onClick={close} className="w-full rounded-lg" data-testid="add-user-close">Done</Button>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name *" className="rounded-lg" data-testid={`add-${role}-name`} />
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email *" className="rounded-lg" data-testid={`add-${role}-email`} />
            <Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="Mobile (optional)" className="rounded-lg" />
            {role === 'clinician' && (
              <Input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="Specialty (e.g., Pediatric Psychology)" className="rounded-lg" />
            )}
            {role === 'organization' && (
              <Input value={form.org_name} onChange={e => setForm({ ...form, org_name: e.target.value })} placeholder="Organization name" className="rounded-lg" />
            )}
            <div className="relative">
              <Input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Temporary password (or leave blank for Welcome@123!)" className="rounded-lg pr-10" data-testid={`add-${role}-password`} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" data-testid={`add-${role}-toggle-pw`}>
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 px-3 py-2.5 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-emerald-700 truncate">
                  Preview the welcome email
                </p>
                <p className="text-[10px] text-emerald-600/70 truncate">
                  Send a test to any inbox before creating the account.
                </p>
              </div>
              <SendTestEmailButton
                templateId={WELCOME_TPL[role]}
                label="Test"
                size="sm"
                testId={`add-${role}-test-welcome`}
                variables={{ name: form.name || 'there', login_url: window.location.origin, admin_url: window.location.origin + '/admin' }}
                defaultTo={form.email || ''}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={close} className="rounded-lg text-xs">Cancel</Button>
              <Button onClick={submit} disabled={loading} className="rounded-lg text-xs bg-pink-500 text-white border-0" data-testid={`submit-add-${role}`}>
                {loading ? 'Creating...' : `Create ${labels[role]}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
