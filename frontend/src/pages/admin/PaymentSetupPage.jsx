import React, { useState, useEffect } from 'react';
import { Wallet, Send, ExternalLink, CheckCircle, XCircle, KeyRound, Eye, EyeOff, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import axios from 'axios';
const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ROOT_API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ax = axios.create({ withCredentials: true });

function RazorpayConfigCard() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ key_id: '', key_secret: '', webhook_secret: '', mode: 'test', currency: 'INR', enabled: true });
  const [showSecret, setShowSecret] = useState(false);
  const [showHook, setShowHook] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    try {
      const r = await ax.get(`${API}/payment-settings`);
      setSettings(r.data);
      setForm((f) => ({ ...f, key_id: r.data.key_id || '', mode: r.data.mode || 'test', currency: r.data.currency || 'INR', enabled: !!r.data.enabled }));
    } catch (e) { console.error(e); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const payload = { ...form };
      // Only send secret/webhook if user typed (avoid wiping on no-op save)
      if (!payload.key_secret) delete payload.key_secret;
      if (!payload.webhook_secret) delete payload.webhook_secret;
      await ax.put(`${API}/payment-settings`, payload);
      setSaved(true);
      setForm((f) => ({ ...f, key_secret: '', webhook_secret: '' }));
      await load();
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Failed to save: ' + (e.response?.data?.detail || e.message));
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-6 mb-6" data-testid="razorpay-config-card">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
          <KeyRound className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-slate-800">Razorpay Configuration</h3>
          <p className="text-xs text-slate-500">Live keys store securely in MongoDB. The frontend only ever sees the public key_id.</p>
        </div>
        {settings && (
          <span data-testid="razorpay-status-pill"
            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${settings.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {settings.enabled ? `${settings.mode.toUpperCase()} · LIVE` : 'INACTIVE'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Key ID (public)</label>
          <Input
            data-testid="rzp-key-id"
            value={form.key_id}
            onChange={e => setForm({ ...form, key_id: e.target.value })}
            placeholder={settings?.key_id_masked || 'rzp_test_xxxxxxxxxxxx'}
            className="rounded-lg font-mono text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            Key Secret {settings?.key_secret_set && <span className="text-emerald-600">· stored</span>}
          </label>
          <div className="relative">
            <Input
              data-testid="rzp-key-secret"
              type={showSecret ? 'text' : 'password'}
              value={form.key_secret}
              onChange={e => setForm({ ...form, key_secret: e.target.value })}
              placeholder={settings?.key_secret_set ? '••• already set (type to replace)' : 'enter Key Secret'}
              className="rounded-lg font-mono text-xs pr-10"
            />
            <button type="button" onClick={() => setShowSecret(v => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              data-testid="rzp-key-secret-eye">
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            Webhook Secret {settings?.webhook_secret_set && <span className="text-emerald-600">· stored</span>}
          </label>
          <div className="relative">
            <Input
              data-testid="rzp-webhook-secret"
              type={showHook ? 'text' : 'password'}
              value={form.webhook_secret}
              onChange={e => setForm({ ...form, webhook_secret: e.target.value })}
              placeholder={settings?.webhook_secret_set ? '••• already set (type to replace)' : 'optional'}
              className="rounded-lg font-mono text-xs pr-10"
            />
            <button type="button" onClick={() => setShowHook(v => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showHook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Mode</label>
            <Select value={form.mode} onValueChange={v => setForm({ ...form, mode: v })}>
              <SelectTrigger className="rounded-lg" data-testid="rzp-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Test</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Currency</label>
            <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
              <SelectTrigger className="rounded-lg" data-testid="rzp-currency"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR (₹)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          data-testid="rzp-enabled-toggle"
          onClick={() => setForm({ ...form, enabled: !form.enabled })}
          className="flex items-center gap-2 text-xs font-semibold"
        >
          {form.enabled ? <ToggleRight className="w-7 h-7 text-emerald-500" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
          <span className={form.enabled ? 'text-emerald-700' : 'text-slate-500'}>
            {form.enabled ? 'Enabled — patients & clinicians can checkout' : 'Disabled — checkout blocked'}
          </span>
        </button>
        <Button
          data-testid="rzp-save"
          onClick={save}
          disabled={saving || !form.key_id}
          className="rounded-lg text-xs bg-indigo-600 text-white border-0 px-5"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Razorpay Keys'}
        </Button>
      </div>

      <div className="mt-4 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
        <p className="text-[11px] text-indigo-700">
          <strong>Where do I get my keys?</strong> Sign in to <a className="underline" href="https://dashboard.razorpay.com/" target="_blank" rel="noreferrer">dashboard.razorpay.com</a> → Settings → API Keys → Generate. Use <code className="bg-white px-1 rounded">Test Mode</code> first; flip to Live once UAT is signed off.
        </p>
      </div>
    </div>
  );
}

export default function PaymentSetupPage() {
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [emailLogs, setEmailLogs] = useState([]);

  useEffect(() => {
    ax.get(`${API}/organizations`).then(r => setOrgs(r.data.organizations || [])).catch(() => {});
  }, []);

  // Check for returning from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const status = params.get('status');
    if (sessionId) {
      ax.get(`${API}/subscribe/status/${sessionId}`).then(r => {
        setResult({ type: r.data.payment_status === 'paid' ? 'success' : 'pending', message: r.data.payment_status === 'paid' ? 'Payment completed successfully!' : 'Payment is being processed...' });
      }).catch(() => {});
      window.history.replaceState({}, '', window.location.pathname);
    } else if (status === 'cancelled') {
      setResult({ type: 'error', message: 'Payment was cancelled.' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleSendLink = async () => {
    if (!selectedOrg || !amount || parseFloat(amount) <= 0) return;
    setSending(true); setResult(null);
    try {
      const r = await ax.post(`${API}/payment-setup/send-link`, {
        organization_id: selectedOrg, amount: parseFloat(amount),
        origin_url: window.location.origin,
      });
      setResult({ type: 'success', message: `Payment link generated and email sent (mocked) to organization.`, url: r.data.payment_url, email: r.data.email_log });
    } catch (err) {
      setResult({ type: 'error', message: err.response?.data?.detail || 'Failed to generate payment link' });
    } finally { setSending(false); }
  };

  const orgData = orgs.find(o => o.user_id === selectedOrg);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Payment Setup</h1>
        <p className="text-sm text-slate-500">Configure your Razorpay credentials and send payment links to organizations.</p>
      </div>

      <RazorpayConfigCard />

      {/* Payment Form */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Wallet className="w-4 h-4 text-blue-500" /> Send Payment Link</h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Select Organization</label>
            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
              <SelectTrigger className="rounded-lg" data-testid="payment-org-select"><SelectValue placeholder="Choose an organization..." /></SelectTrigger>
              <SelectContent>
                {orgs.map(o => <SelectItem key={o.user_id} value={o.user_id}>{o.name} ({o.email})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {orgData && (
            <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
              <p className="text-xs text-blue-700 font-medium">{orgData.name}</p>
              <p className="text-[10px] text-blue-500">{orgData.email}</p>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Payment Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <Input data-testid="payment-amount" type="number" step="0.01" min="0.01" value={amount}
                onChange={e => setAmount(e.target.value)} placeholder="0.00" className="rounded-lg pl-7" />
            </div>
          </div>

          <Button data-testid="send-payment-link-btn" onClick={handleSendLink} disabled={sending || !selectedOrg || !amount}
            className="rounded-lg text-xs bg-blue-600 text-white border-0 w-full py-3">
            <Send className="w-3.5 h-3.5 mr-2" />
            {sending ? 'Generating Link...' : 'Generate & Send Payment Link'}
          </Button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-xl border p-5 mb-6 ${result.type === 'success' ? 'bg-green-50 border-green-200' : result.type === 'error' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-start gap-3">
            {result.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-500 mt-0.5" />}
            <div className="flex-1">
              <p className={`text-sm font-medium ${result.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>{result.message}</p>
              {result.url && (
                <div className="mt-3 p-3 rounded-lg bg-white/60">
                  <p className="text-xs text-slate-500 mb-1">Payment Link:</p>
                  <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 break-all">
                    {result.url.substring(0, 80)}... <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              )}
              {result.email && (
                <div className="mt-2 p-3 rounded-lg bg-white/60">
                  <p className="text-xs text-slate-500 mb-1">Email Sent (Mocked):</p>
                  <p className="text-xs text-slate-700">To: {result.email.to}</p>
                  <p className="text-xs text-slate-700">Subject: {result.email.subject}</p>
                  <p className="text-[10px] text-slate-400 mt-1 italic">{result.email.body?.substring(0, 200)}...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h4 className="text-xs font-semibold text-slate-600 mb-2">How it works</h4>
        <ol className="space-y-1.5 text-xs text-slate-500">
          <li>1. Select an organization from the dropdown</li>
          <li>2. Enter the payment amount in USD</li>
          <li>3. Click to generate a secure Razorpay payment link</li>
          <li>4. The link is automatically emailed to the organization contact</li>
          <li>5. Once paid, the transaction is recorded in the Earnings dashboard</li>
        </ol>
      </div>
    </div>
  );
}
