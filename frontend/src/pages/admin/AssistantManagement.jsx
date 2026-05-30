import React, { useState, useEffect } from 'react';
import { UserCog, Plus, Trash2, Pencil, Eye, EyeOff, Shield, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import axios from 'axios';
import { BRAND } from '../../brand';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

// All admin pages an Assistant can be granted access to
const PAGE_LIST = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'patients', label: 'Patients' },
  { key: 'clinicians', label: 'Clinicians' },
  { key: 'organizations', label: 'Organizations' },
  { key: 'plans', label: 'Plans' },
  { key: 'patient_tiers', label: 'Patient Tiers' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'assessments', label: 'Assessments' },
  { key: 'recommendations', label: 'Recommendations' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'emergency_alerts', label: 'Emergency Alerts' },
  { key: 'email_templates', label: 'Email Templates' },
  { key: 'payment_setup', label: 'Payment Setup' },
  { key: 'earnings', label: 'Earnings' },
];
const ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];

const emptyForm = () => ({
  name: '',
  email: '',
  password: '',
  page_permissions: {}, // { dashboard: ['view'], patients: ['view','edit'] ... }
});

export default function AssistantManagement() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [toast, setToast] = useState('');
  const [savingPerms, setSavingPerms] = useState(false);

  const load = async () => {
    const r = await ax.get(`${API}/assistants`);
    setItems(r.data.assistants || []);
  };
  useEffect(() => { load(); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const toggleAction = (pageKey, action) => {
    setForm(f => {
      const current = f.page_permissions[pageKey] || [];
      const next = current.includes(action)
        ? current.filter(a => a !== action)
        : [...current, action];
      // ensure view is always present if any other action exists
      let finalNext = next;
      if (next.length > 0 && !next.includes('view')) finalNext = ['view', ...next];
      const updated = { ...f.page_permissions, [pageKey]: finalNext };
      if (finalNext.length === 0) delete updated[pageKey];
      return { ...f, page_permissions: updated };
    });
  };

  const togglePageAll = (pageKey, allow) => {
    setForm(f => {
      const updated = { ...f.page_permissions };
      if (allow) updated[pageKey] = [...ACTIONS];
      else delete updated[pageKey];
      return { ...f, page_permissions: updated };
    });
  };

  const grantAll = () => {
    const all = {}; PAGE_LIST.forEach(p => { all[p.key] = [...ACTIONS]; });
    setForm(f => ({ ...f, page_permissions: all }));
  };
  const grantViewOnly = () => {
    const all = {}; PAGE_LIST.forEach(p => { all[p.key] = ['view']; });
    setForm(f => ({ ...f, page_permissions: all }));
  };
  const clearAll = () => setForm(f => ({ ...f, page_permissions: {} }));

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...emptyForm(), page_permissions: { dashboard: ['view'] } });
    setShowForm(true);
  };
  const openEdit = (a) => {
    setEditItem(a);
    setForm({
      name: a.name || '',
      email: a.email || '',
      password: '',
      page_permissions: a.page_permissions || {},
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim() || (!editItem && !form.password.trim())) {
      showToast('Name, email, and password are required'); return;
    }
    setSavingPerms(true);
    try {
      // Save (create or update) keeping legacy permissions[] in sync (page keys)
      const legacyPermissions = Object.keys(form.page_permissions);
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password || undefined,
        permissions: legacyPermissions,
      };
      let adminId = editItem?.admin_id;
      if (editItem) {
        await ax.put(`${API}/assistants/${editItem.admin_id}`, payload);
      } else {
        const r = await ax.post(`${API}/assistants`, payload);
        adminId = r.data.admin_id;
      }
      // Save granular page_permissions
      if (adminId) {
        await ax.put(`${API}/permissions/${adminId}`, { page_permissions: form.page_permissions });
      }
      setShowForm(false);
      showToast(editItem ? 'Assistant updated' : 'Assistant created · welcome email sent (mock)');
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSavingPerms(false);
    }
  };

  const handleDelete = async () => {
    await ax.delete(`${API}/assistants/${deleteId}`);
    setDeleteId(null); load(); showToast('Assistant deleted');
  };

  const pagePermSummary = (a) => {
    const pp = a.page_permissions || {};
    const keys = Object.keys(pp);
    if (!keys.length && (a.permissions || []).length) return `${a.permissions.length} pages (legacy)`;
    if (!keys.length) return 'No access';
    return `${keys.length} pages · ${keys.reduce((sum, k) => sum + (pp[k] || []).length, 0)} actions`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
            className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-2xl text-white text-xs font-bold shadow-xl"
            style={{ background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.blue})` }}>
            <Check className="w-3.5 h-3.5 inline mr-1.5" />{toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.pink }}>Admin Team</p>
          <h1 className="text-2xl font-semibold text-slate-800">Assistant Management</h1>
          <p className="text-sm text-slate-500">{items.length} assistants · granular page permissions</p>
        </div>
        <Button onClick={openCreate} data-testid="add-assistant-btn"
          className="text-xs rounded-xl text-white border-0"
          style={{ background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.green})` }}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Assistant
        </Button>
      </div>

      <div className="grid gap-4">
        {items.map(a => (
          <motion.div key={a.admin_id} whileHover={{ y: -2 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${BRAND.blue}22, ${BRAND.green}22)` }}>
                <UserCog className="w-5 h-5" style={{ color: BRAND.blue }} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{a.name}</p>
                <p className="text-xs text-slate-500">{a.email}</p>
                <p className="text-[10px] font-bold mt-1 flex items-center gap-1" style={{ color: BRAND.blue }}>
                  <Shield className="w-3 h-3" /> {pagePermSummary(a)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.is_active !== false ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                {a.is_active !== false ? 'Active' : 'Disabled'}
              </span>
              <Button variant="ghost" size="sm" onClick={() => openEdit(a)} className="text-blue-500 p-1" data-testid={`edit-assistant-${a.admin_id}`}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteId(a.admin_id)} className="text-red-500 p-1" data-testid={`delete-assistant-${a.admin_id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        ))}
        {!items.length && (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-sm text-slate-400">
            No assistants yet. Create one to delegate admin tasks.
          </div>
        )}
      </div>

      {/* Form modal — wide for permission matrix */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-4 h-4" style={{ color: BRAND.blue }} />
              {editItem ? 'Edit' : 'Create'} Assistant
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Basic info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full Name *" className="rounded-xl" data-testid="assistant-form-name" />
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email *" className="rounded-xl" disabled={!!editItem} data-testid="assistant-form-email" />
              <div className="relative md:col-span-2">
                <Input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={editItem ? "New password (leave blank to keep)" : "Password *"}
                  className="rounded-xl pr-10" data-testid="assistant-form-password" />
                <button onClick={() => setShowPw(!showPw)} type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Quick actions */}
            <div className="rounded-xl p-3 flex items-center justify-between flex-wrap gap-2"
              style={{ background: `linear-gradient(135deg, ${BRAND.blue}10, ${BRAND.green}10)`, border: `1px solid ${BRAND.blue}22` }}>
              <p className="text-xs font-bold text-slate-700">Granular Page Permissions</p>
              <div className="flex gap-1.5">
                <button onClick={grantAll} type="button" className="text-[10px] px-2.5 py-1 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50" data-testid="perms-grant-all">Grant All</button>
                <button onClick={grantViewOnly} type="button" className="text-[10px] px-2.5 py-1 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50" data-testid="perms-view-only">View Only</button>
                <button onClick={clearAll} type="button" className="text-[10px] px-2.5 py-1 rounded-lg bg-white text-red-500 border border-red-100 hover:bg-red-50" data-testid="perms-clear">Clear</button>
              </div>
            </div>

            {/* Permission Matrix */}
            <div className="rounded-2xl border border-slate-100 overflow-hidden">
              <div className="grid grid-cols-7 gap-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2 bg-slate-50">
                <div className="col-span-2">Page</div>
                {ACTIONS.map(a => <div key={a} className="text-center">{a}</div>)}
              </div>
              {PAGE_LIST.map(p => {
                const perms = form.page_permissions[p.key] || [];
                const allOn = ACTIONS.every(a => perms.includes(a));
                return (
                  <div key={p.key} className="grid grid-cols-7 gap-0 items-center px-3 py-2 border-t border-slate-100 hover:bg-slate-50/40">
                    <div className="col-span-2 flex items-center gap-2">
                      <button type="button" onClick={() => togglePageAll(p.key, !allOn)}
                        className={`w-7 h-4 rounded-full transition relative ${allOn ? 'bg-blue-500' : 'bg-slate-200'}`}
                        data-testid={`perm-row-${p.key}`}>
                        <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition" style={{ left: allOn ? '14px' : '2px' }} />
                      </button>
                      <span className="text-xs text-slate-700 font-medium">{p.label}</span>
                    </div>
                    {ACTIONS.map(action => {
                      const on = perms.includes(action);
                      const isView = action === 'view';
                      return (
                        <div key={action} className="flex items-center justify-center">
                          <button type="button" onClick={() => toggleAction(p.key, action)}
                            data-testid={`perm-${p.key}-${action}`}
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition ${on ? 'text-white' : 'bg-slate-100 text-slate-300'}`}
                            style={on ? { background: isView ? BRAND.blue : BRAND.green } : {}}>
                            {on && <Check className="w-3 h-3" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl text-xs">Cancel</Button>
              <Button onClick={handleSave} disabled={savingPerms} className="rounded-xl text-xs text-white border-0"
                data-testid="assistant-form-save"
                style={{ background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.green})` }}>
                {savingPerms ? 'Saving…' : editItem ? 'Update' : 'Create & Email Invite'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Assistant?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 mt-2">This will revoke their access immediately.</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-xl text-xs">Cancel</Button>
            <Button onClick={handleDelete} className="rounded-xl text-xs bg-red-600 text-white border-0" data-testid="confirm-delete-assistant">Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
