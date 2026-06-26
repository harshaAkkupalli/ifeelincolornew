import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Send, Edit3, Plus, Trash2, Eye, Check, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { BRAND } from '../../brand';
import SendTestEmailButton from '../../components/admin/SendTestEmailButton';
import EmailProviderCard from '../../components/admin/EmailProviderCard';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

const CATEGORY_COLORS = {
  onboarding: '#22D67E',
  team: '#A78BFA',
  auth: '#F99C2C',
  engagement: '#12A4F0',
  general: '#94A3B8',
};

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [sentList, setSentList] = useState([]);
  const [sendOpen, setSendOpen] = useState(null); // template_id
  const [sendForm, setSendForm] = useState({ to_email: '', to_name: '' });
  const [toast, setToast] = useState('');
  const [formError, setFormError] = useState('');

  // AI draft/edit flow removed per 2026-06 user directive — manual-only
  // template authoring keeps the page predictable on self-host installs
  // where AI keys may not be configured.

  const load = async () => {
    const r = await ax.get(`${API}/email-templates`);
    setTemplates(r.data.templates || []);
    const s = await ax.get(`${API}/email/sent`).catch(() => ({ data: { emails: [] } }));
    setSentList(s.data.emails || []);
  };
  useEffect(() => { load(); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const openCreate = () => {
    setFormError('');
    setEditing({
      name: '',
      subject: '',
      body: '',
      cta_label: '',
      cta_url: '',
      category: 'general',
      include_app_ctas: false,
    });
  };
  const openEdit = (t) => { setFormError(''); setEditing({ include_app_ctas: false, ...t }); };

  const save = async () => {
    if (!editing.name?.trim()) { setFormError('Internal name is required.'); return; }
    if (!editing.subject?.trim()) { setFormError('Subject line is required.'); return; }
    if (!editing.body?.trim()) { setFormError('Email body is required.'); return; }
    setFormError('');
    await ax.post(`${API}/email-templates`, editing);
    setEditing(null); load(); showToast('Saved');
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this template? System templates cannot be deleted.')) return;
    try {
      await ax.delete(`${API}/email-templates/${id}`);
      load(); showToast('Deleted');
    } catch (e) {
      showToast(e.response?.data?.detail || 'Delete failed');
    }
  };

  const preview = async (t) => {
    const r = await ax.post(`${API}/email-templates/preview`, {
      subject: t.subject,
      body: t.body,
      cta_label: t.cta_label || '',
      cta_url: t.cta_url || '',
      include_app_ctas: !!t.include_app_ctas,
    });
    setPreviewHtml(r.data.html);
  };

  const sendTest = async () => {
    if (!sendForm.to_email) return;
    await ax.post(`${API}/email/send`, { template_id: sendOpen, to_email: sendForm.to_email, to_name: sendForm.to_name });
    setSendOpen(null); setSendForm({ to_email: '', to_name: '' });
    load(); showToast('Test email dispatched');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      {/* Floating toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
            className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-2xl text-white text-xs font-bold shadow-xl"
            style={{ background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.blue})` }}>
            <Check className="w-3.5 h-3.5 inline mr-1.5" />{toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.pink }}>Admin · Communications</p>
          <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2"><Mail className="w-6 h-6" style={{ color: BRAND.blue }} /> Email Templates</h1>
          <p className="text-sm text-slate-500">{templates.length} templates · {sentList.length} sent</p>
        </div>
        <div className="flex gap-2">
          <Button data-testid="email-create-btn" onClick={openCreate}
            className="rounded-xl text-xs text-white border-0"
            style={{ background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.green})` }}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Template
          </Button>
        </div>
      </div>

      {/* Sender mailbox configuration */}
      <EmailProviderCard onSaved={() => showToast('Sender mailbox updated — future emails use the new account')} />

      {/* Template grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <motion.div key={t.template_id} whileHover={{ y: -4 }}
            className="rounded-2xl p-5 bg-white border border-slate-100 shadow-sm hover:shadow-lg transition"
            data-testid={`email-tpl-${t.template_id}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: `${CATEGORY_COLORS[t.category] || '#94A3B8'}22`, color: CATEGORY_COLORS[t.category] || '#475569' }}>
                  {t.category || 'general'}{t.system && ' · system'}
                </span>
                <h3 className="text-sm font-bold text-slate-800 mt-2 truncate">{t.name}</h3>
                <p className="text-xs text-slate-500 truncate mt-1">{t.subject}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button onClick={() => preview(t)} className="text-[10px] px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center gap-1"
                data-testid={`email-preview-${t.template_id}`}>
                <Eye className="w-3 h-3" /> Preview
              </button>
              <button onClick={() => openEdit(t)} className="text-[10px] px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center gap-1"
                data-testid={`email-edit-${t.template_id}`}>
                <Edit3 className="w-3 h-3" /> Edit
              </button>
              <button onClick={() => setSendOpen(t.template_id)} className="text-[10px] px-2 py-1 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 flex items-center gap-1"
                data-testid={`email-send-${t.template_id}`}>
                <Send className="w-3 h-3" /> Send test
              </button>
              {!t.system && (
                <button onClick={() => remove(t.template_id)} className="text-[10px] px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center gap-1"
                  data-testid={`email-delete-${t.template_id}`}>
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              )}
            </div>
          </motion.div>
        ))}
        {!templates.length && (
          <div className="col-span-full bg-white rounded-2xl border border-slate-100 p-12 text-center text-sm text-slate-400">
            No templates yet. Use <strong>AI Generate</strong> or <strong>New Template</strong> to create one.
          </div>
        )}
      </div>

      {/* Recent sent (mock) */}
      {sentList.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold text-slate-700 mb-3">Recent sends</h2>
          <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100">
            {sentList.slice(0, 6).map(e => (
              <div key={e.email_id} className="px-4 py-3 text-xs flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{e.subject}</p>
                  <p className="text-slate-500">to <span className="font-mono">{e.to_email}</span> · {new Date(e.sent_at).toLocaleString()}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-bold">{e.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor modal */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-4 h-4" style={{ color: BRAND.blue }} />
              {editing?.template_id ? 'Edit' : 'New'} Template
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 mt-2">
              {/* Internal name */}
              <div>
                <label htmlFor="email-name" className="block text-xs font-bold text-slate-700 mb-1">
                  Internal name <span className="text-rose-500">*</span>
                </label>
                <Input
                  id="email-name"
                  value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Welcome email — Patient"
                  className="rounded-xl"
                  data-testid="email-form-name"
                  aria-required="true"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Only you and other admins see this — used to find the template in the list.
                </p>
              </div>

              {/* Subject line */}
              <div>
                <label htmlFor="email-subject" className="block text-xs font-bold text-slate-700 mb-1">
                  Subject line <span className="text-rose-500">*</span>
                </label>
                <Input
                  id="email-subject"
                  value={editing.subject}
                  onChange={e => setEditing({ ...editing, subject: e.target.value })}
                  placeholder="e.g. Welcome to IFEELINCOLOR, {{name}} 🎉"
                  className="rounded-xl"
                  data-testid="email-form-subject"
                  aria-required="true"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  This is what your recipients see in their inbox. Supports placeholders like
                  <code className="mx-1 px-1 rounded bg-slate-100 text-purple-600">{'{{name}}'}</code>.
                </p>
              </div>

              {/* Body */}
              <div>
                <label htmlFor="email-body" className="block text-xs font-bold text-slate-700 mb-1">
                  Email body (HTML) <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  id="email-body"
                  value={editing.body}
                  onChange={e => setEditing({ ...editing, body: e.target.value })}
                  placeholder="<p>Hi {{name}},</p>\n<p>Welcome to IFEELINCOLOR — we're delighted to have you here.</p>"
                  className="rounded-xl min-h-[180px] font-mono text-xs"
                  data-testid="email-form-body"
                  aria-required="true"
                />
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                  Use simple HTML tags (<code className="px-1 rounded bg-slate-100">&lt;p&gt;</code>,
                  <code className="px-1 rounded bg-slate-100">&lt;strong&gt;</code>,
                  <code className="px-1 rounded bg-slate-100">&lt;em&gt;</code>,
                  <code className="px-1 rounded bg-slate-100">&lt;a href&gt;</code>).
                  Available placeholders:
                  <code className="mx-1 px-1 rounded bg-slate-100 text-purple-600">{'{{name}}'}</code>
                  <code className="mx-1 px-1 rounded bg-slate-100 text-purple-600">{'{{login_url}}'}</code>
                  <code className="mx-1 px-1 rounded bg-slate-100 text-purple-600">{'{{app_url}}'}</code>
                  <code className="mx-1 px-1 rounded bg-slate-100 text-purple-600">{'{{temp_password}}'}</code>.
                </p>
              </div>

              {/* CTA button */}
              <div>
                <p className="block text-xs font-bold text-slate-700 mb-1">
                  Call-to-action button <span className="text-slate-400 font-normal">(optional)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="email-cta-label" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Button label
                    </label>
                    <Input
                      id="email-cta-label"
                      value={editing.cta_label || ''}
                      onChange={e => setEditing({ ...editing, cta_label: e.target.value })}
                      placeholder="Sign in"
                      className="rounded-xl"
                    />
                  </div>
                  <div>
                    <label htmlFor="email-cta-url" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Button URL
                    </label>
                    <Input
                      id="email-cta-url"
                      value={editing.cta_url || ''}
                      onChange={e => setEditing({ ...editing, cta_url: e.target.value })}
                      placeholder="{{login_url}}"
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Leave both empty to skip the button. URL can be a placeholder like
                  <code className="mx-1 px-1 rounded bg-slate-100 text-purple-600">{'{{login_url}}'}</code>
                  or any absolute https:// link.
                </p>
              </div>

              {/* App Store + Google Play CTA toggle */}
              <div>
                <p className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile app badges <span className="text-slate-400 font-normal">(optional)</span>
                </p>
                <label
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer select-none transition"
                  style={{
                    background: editing.include_app_ctas ? 'linear-gradient(135deg, #FFF7ED, #FEF3C7)' : '#F8FAFC',
                    border: `1px solid ${editing.include_app_ctas ? '#FCD34D' : '#E2E8F0'}`,
                  }}
                  data-testid="email-form-app-ctas-toggle"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-pink-500"
                    checked={!!editing.include_app_ctas}
                    onChange={e => setEditing({ ...editing, include_app_ctas: e.target.checked })}
                  />
                  <span className="flex-1">
                    <span className="block text-xs font-semibold text-slate-800">
                      Append App Store + Google Play download badges
                    </span>
                    <span className="block text-[10px] text-slate-500 leading-snug">
                      Adds the official iOS &amp; Android download buttons under the main CTA.
                      Saved with the template — also honored on test sends &amp; live sends.
                    </span>
                  </span>
                </label>
              </div>

              {/* Category */}
              <div>
                <p className="block text-xs font-bold text-slate-700 mb-1.5">
                  Category
                </p>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
                  {Object.keys(CATEGORY_COLORS).map(c => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={editing.category === c}
                      onClick={() => setEditing({ ...editing, category: c })}
                      className={`text-[10px] px-3 py-1.5 rounded-lg font-semibold transition ${editing.category === c ? 'text-white' : 'bg-slate-50 text-slate-500'}`}
                      style={editing.category === c ? { background: CATEGORY_COLORS[c] } : {}}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Helps you organize templates. Visible only in the admin UI.
                </p>
              </div>

              {formError && (
                <div
                  data-testid="email-form-error"
                  className="text-xs rounded-xl px-3 py-2"
                  style={{ background: '#FEF2F2', color: '#7F1D1D', border: '1px solid #FCA5A5' }}
                  role="alert"
                >
                  {formError}
                </div>
              )}

              <div className="flex justify-between items-center pt-2 gap-2 flex-wrap border-t border-slate-100">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => preview(editing)} className="rounded-xl text-xs" data-testid="email-form-preview">
                    <Eye className="w-3.5 h-3.5 mr-1.5" /> Live preview
                  </Button>
                  {editing.template_id && (
                    <SendTestEmailButton
                      templateId={editing.template_id}
                      label="Test send"
                      size="md"
                      testId="email-form-test-send"
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(null)} className="rounded-xl text-xs">Cancel</Button>
                  <Button onClick={save} className="rounded-xl text-xs text-white border-0" data-testid="email-form-save"
                    style={{ background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.green})` }}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Generate / Edit-with-AI dialogs removed per 2026-06 user directive
          — admins now author templates manually only. */}

      {/* Send test modal */}
      <Dialog open={!!sendOpen} onOpenChange={(v) => !v && setSendOpen(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="w-4 h-4" style={{ color: BRAND.green }} /> Send test email</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input value={sendForm.to_email} onChange={e => setSendForm({ ...sendForm, to_email: e.target.value })} placeholder="Recipient email *" className="rounded-xl" data-testid="email-send-to" />
            <Input value={sendForm.to_name} onChange={e => setSendForm({ ...sendForm, to_name: e.target.value })} placeholder="Recipient name (optional)" className="rounded-xl" />
            <p className="text-[10px] text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1.5">
              Live Gmail SMTP if configured · otherwise stored as <code>mock_sent</code>.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSendOpen(null)} className="rounded-xl text-xs">Cancel</Button>
              <Button onClick={sendTest} className="rounded-xl text-xs text-white border-0" data-testid="email-send-confirm"
                style={{ background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.blue})` }}>Send</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview modal */}
      <Dialog open={!!previewHtml} onOpenChange={(v) => !v && setPreviewHtml('')}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden p-0">
          <div className="flex items-center justify-between p-4 border-b">
            <DialogTitle className="flex items-center gap-2"><Eye className="w-4 h-4" style={{ color: BRAND.blue }} /> Preview</DialogTitle>
            <button onClick={() => setPreviewHtml('')} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
          </div>
          <iframe title="preview" srcDoc={previewHtml} className="w-full h-[70vh] border-0" data-testid="email-preview-iframe" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
