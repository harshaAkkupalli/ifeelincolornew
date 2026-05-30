/**
 * Organization Portal — landing/dashboard for users with role=organization.
 *
 * Provides:
 *   • Overview tiles (clinicians, org subscribers, linked patients)
 *   • Quick add-clinician dialog (the clinician created here gets a real
 *     mobile-app login since /api/org/clinicians issues a bcrypt password).
 *   • Roster table of all clinicians under this org.
 *
 * Route: /org/dashboard  (mounted in App.js)
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  Building2, Users, Stethoscope, UserPlus, Trash2, Mail, LogOut, Sparkles,
  ShieldCheck, ChevronRight, UserCog, CreditCard,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { Logo } from '../../components/brand/BrandLogo';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ax = axios.create({ withCredentials: true });

const ORG_GRADIENT = 'linear-gradient(135deg, #FB923C 0%, #F4D58D 50%, #22D67E 100%)';

const emptyForm = {
  name: '', email: '', password: '', mobile: '',
  specialization: 'Mental Health Specialist', license_number: '', years_experience: 5,
};

const emptyManagerForm = {
  name: '', email: '', password: '', mobile: '',
};

export default function OrganizationDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [clinicians, setClinicians] = useState([]);
  const [managers, setManagers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [mgrForm, setMgrForm] = useState(emptyManagerForm);
  const [saving, setSaving] = useState(false);
  const [savingMgr, setSavingMgr] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteMgrId, setDeleteMgrId] = useState(null);

  // Tier derived from /api/auth/me — Admin (default) vs Manager
  const roleTier = user?.role_tier || 'Org_Admin';
  const isManager = roleTier === 'Org_Manager';
  const isAdmin = !isManager;

  useEffect(() => {
    if (!user) { navigate('/org/login'); return; }
    if (user.role !== 'organization') { navigate('/'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    try {
      const calls = [
        ax.get(`${API}/organization/dashboard`),
        ax.get(`${API}/organization/clinicians`),
      ];
      // Admin-only: managers list
      if (isAdmin) calls.push(ax.get(`${API}/organization/managers`));
      const res = await Promise.all(calls);
      setStats(res[0].data);
      setClinicians(res[1].data.clinicians || []);
      if (isAdmin) setManagers(res[2]?.data?.managers || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error('Name, email and password are required');
      return;
    }
    setSaving(true);
    try {
      await ax.post(`${API}/organization/clinicians`, form);
      toast.success(`${form.name} added — login credentials emailed`);
      setShowAdd(false);
      setForm(emptyForm);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not add clinician');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await ax.delete(`${API}/organization/clinicians/${deleteId}`);
      toast.success('Clinician removed from your organization');
      setDeleteId(null);
      load();
    } catch (e) {
      toast.error('Could not remove clinician');
    }
  };

  const doLogout = async () => { await logout(); navigate('/org/login'); };

  // ─── Manager CRUD (Admin only) ──────────────────────────────────
  const handleSaveManager = async () => {
    if (!mgrForm.name || !mgrForm.email || !mgrForm.password) {
      toast.error('Name, email and password are required');
      return;
    }
    setSavingMgr(true);
    try {
      await ax.post(`${API}/organization/managers`, mgrForm);
      toast.success(`${mgrForm.name} added as Manager — login emailed`);
      setShowAddManager(false);
      setMgrForm(emptyManagerForm);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not add manager');
    } finally { setSavingMgr(false); }
  };

  const handleDeleteManager = async () => {
    try {
      await ax.delete(`${API}/organization/managers/${deleteMgrId}`);
      toast.success('Manager removed from your organization');
      setDeleteMgrId(null);
      load();
    } catch (e) {
      toast.error('Could not remove manager');
    }
  };

  if (!user || user.role !== 'organization') return null;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #FFF8EE 0%, #FFFFFF 100%)' }} data-testid="org-dashboard">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between" style={{
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Organization Portal</p>
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              {user.name}
              <span
                className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
                style={
                  isAdmin
                    ? { background: '#FB923C22', color: '#C2410C', border: '1px solid #FB923C55' }
                    : { background: '#6366F122', color: '#4338CA', border: '1px solid #6366F155' }
                }
                data-testid="org-role-tier-badge"
              >
                {isAdmin ? <ShieldCheck className="w-2.5 h-2.5" /> : <UserCog className="w-2.5 h-2.5" />}
                {isAdmin ? 'Admin' : 'Manager'}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              onClick={() => navigate('/org/subscribe')}
              size="sm"
              data-testid="org-subscribe-btn"
              className="text-xs rounded-full text-white border-0"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 6px 14px -4px #10B98166' }}
            >
              <CreditCard className="w-3 h-3 mr-1" />
              {stats?.portal_subscription ? 'Manage Subscription' : 'Subscribe to Portal'}
            </Button>
          )}
          <Button onClick={doLogout} variant="outline" size="sm" data-testid="org-logout" className="text-xs rounded-full">
            <LogOut className="w-3 h-3 mr-1" /> Sign out
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6 mb-6 relative overflow-hidden"
          style={{ background: ORG_GRADIENT, boxShadow: '0 24px 50px -18px #FB923Caa' }}
        >
          <Building2 className="w-7 h-7 text-white mb-2" />
          <h1 className="text-2xl font-fredoka font-bold text-white">Welcome back, {user.name}</h1>
          <p className="text-sm text-white/85 mt-1">
            {isAdmin
              ? 'Add Managers, oversee your clinician network, and manage your organization\u2019s portal subscription.'
              : 'Add and manage clinicians under your scope. Patients linked to your clinicians will appear in your stats automatically.'}
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6" data-testid="org-stats">
          <StatTile icon={Stethoscope} label="Clinicians in your network" value={stats?.clinician_count ?? '—'} color="#FB923C" testid="stat-clinicians" />
          <StatTile icon={Users} label="Patients subscribed to your org" value={stats?.org_subscribers ?? '—'} color="#22D67E" testid="stat-subscribers" />
          <StatTile icon={Sparkles} label="Patient-clinician links" value={stats?.linked_patients ?? '—'} color="#A78BFA" testid="stat-linked" />
        </div>

        {/* Managers section — Admin only */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6" data-testid="managers-section">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-fredoka font-semibold text-slate-800 flex items-center gap-2">
                  <UserCog className="w-4 h-4 text-indigo-500" />
                  Org Managers
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Managers can add and oversee clinicians on your behalf. They sign in with the same Organization portal.
                </p>
              </div>
              <Button onClick={() => setShowAddManager(true)} data-testid="add-org-manager-btn"
                className="text-white border-0 rounded-full text-xs h-9"
                style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', boxShadow: '0 8px 18px -4px #6366F1aa' }}>
                <UserPlus className="w-3.5 h-3.5 mr-1" /> Add Manager
              </Button>
            </div>

            {managers.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400" data-testid="managers-empty">
                <UserCog className="w-10 h-10 mx-auto text-slate-200 mb-2" />
                <p>No managers yet. Add a Manager to delegate clinician onboarding.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-[11px] text-slate-500">
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Email</th>
                    <th className="px-4 py-3 text-left font-semibold">Clinicians</th>
                    <th className="px-4 py-3 text-left font-semibold">Added</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {managers.map(m => (
                    <tr key={m.user_id} className="border-t border-slate-50 text-xs text-slate-700 hover:bg-indigo-50/30" data-testid={`org-mgr-${m.user_id}`}>
                      <td className="px-4 py-3 font-semibold flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full text-white flex items-center justify-center text-[10px] font-bold"
                          style={{ background: '#6366F1' }}>
                          {m.name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'M'}
                        </div>
                        {m.name}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{m.email}</td>
                      <td className="px-4 py-3 font-semibold">{m.clinician_count || 0}</td>
                      <td className="px-4 py-3 text-slate-400">{m.created_at?.split('T')[0]}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${m.status === 'disabled' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                          {m.status === 'disabled' ? 'Disabled' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button onClick={() => setDeleteMgrId(m.user_id)} variant="ghost" size="sm"
                          data-testid={`remove-mgr-${m.user_id}`}
                          className="text-red-500 hover:bg-red-50 h-7 px-2">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Clinicians table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-fredoka font-semibold text-slate-800">
                {isManager ? 'Your Clinicians' : 'Your Clinicians'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isManager
                  ? 'Clinicians you add or are assigned to. Add new clinicians who can be picked by your subscribed patients.'
                  : 'Add clinicians who can be picked by your subscribed patients.'}
              </p>
            </div>
            <Button onClick={() => setShowAdd(true)} data-testid="add-org-clinician-btn"
              className="text-white border-0 rounded-full text-xs h-9"
              style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)', boxShadow: '0 8px 18px -4px #FB923Caa' }}>
              <UserPlus className="w-3.5 h-3.5 mr-1" /> Add Clinician
            </Button>
          </div>

          {clinicians.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              <Stethoscope className="w-10 h-10 mx-auto text-slate-200 mb-2" />
              <p>No clinicians yet. Click <strong>Add Clinician</strong> above to invite your first one.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-[11px] text-slate-500">
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Specialty</th>
                  <th className="px-4 py-3 text-left font-semibold">Patients</th>
                  <th className="px-4 py-3 text-left font-semibold">Joined</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clinicians.map(c => (
                  <tr key={c.user_id} className="border-t border-slate-50 text-xs text-slate-700 hover:bg-orange-50/30" data-testid={`org-clin-${c.user_id}`}>
                    <td className="px-4 py-3 font-semibold flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full text-white flex items-center justify-center text-[10px] font-bold"
                        style={{ background: '#FB923C' }}>
                        {c.name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'C'}
                      </div>
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.email}</td>
                    <td className="px-4 py-3">{c.clinician_info?.specialization || '—'}</td>
                    <td className="px-4 py-3 font-semibold">{c.patient_count || 0}</td>
                    <td className="px-4 py-3 text-slate-400">{c.created_at?.split('T')[0]}</td>
                    <td className="px-4 py-3">
                      <Button onClick={() => setDeleteId(c.user_id)} variant="ghost" size="sm"
                        data-testid={`remove-clin-${c.user_id}`}
                        className="text-red-500 hover:bg-red-50 h-7 px-2">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent activity */}
        {stats?.recent_activity?.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-base font-fredoka font-semibold text-slate-800">Recent patient links</h2>
              <p className="text-xs text-slate-500 mt-0.5">Patients who connected with a clinician inside your network.</p>
            </div>
            <ul className="divide-y divide-slate-50">
              {stats.recent_activity.map((r, i) => (
                <li key={i} className="px-5 py-3 flex items-center gap-3 text-xs">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  <p className="flex-1">
                    A patient subscribed to <strong>{r.name}</strong>
                    {r.via_org_id && <span className="text-[10px] text-orange-500 font-semibold ml-1">(via your org)</span>}
                  </p>
                  <span className="text-slate-400 text-[10px]">{r.subscribed_at?.split('T')[0]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer helper — Admin: portal subscription CTA · Manager: scope note */}
        {isAdmin ? (
          <div className="mt-6 rounded-2xl p-5 flex gap-3 items-center" style={{ background: '#ECFDF5', border: '1px solid #10B98144' }} data-testid="org-billing-card">
            <CreditCard className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#059669' }} />
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-700">Portal subscription</p>
              <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
                Pay for your Organization's IFEELINCOLOR access. Choose a plan, and your patients & clinicians get the full platform.
              </p>
            </div>
            <Button
              onClick={() => navigate('/org/subscribe')}
              size="sm"
              data-testid="manage-subscription-link"
              className="text-white border-0 rounded-full text-xs h-9"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 8px 18px -4px #10B98166' }}
            >
              View plans <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl p-5 flex gap-3" style={{ background: '#EEF2FF', border: '1px solid #6366F144' }} data-testid="org-manager-card">
            <UserCog className="w-5 h-5 shrink-0 mt-0.5 text-indigo-500" />
            <div>
              <p className="text-xs font-bold text-slate-700">Manager scope</p>
              <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
                You can add, edit and remove clinicians. Billing, subscription changes, and other Org Managers are handled by your Org Admin.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add clinician dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md" data-testid="add-clin-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserPlus className="w-4 h-4 text-orange-500" />
              Add a clinician to {user.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Field label="Full name *">
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Dr. Sarah Wells" data-testid="form-name" />
            </Field>
            <Field label="Email (used for mobile app login) *">
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="sarah@your-clinic.com" data-testid="form-email" />
            </Field>
            <Field label="Temporary password *">
              <Input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="They can change this after first login" data-testid="form-password" />
              <p className="text-[10px] text-slate-400 mt-1">The clinician will use this to sign in on the mobile app.</p>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mobile (optional)">
                <Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="+1…" data-testid="form-mobile" />
              </Field>
              <Field label="Years of experience">
                <Input type="number" value={form.years_experience} onChange={e => setForm({ ...form, years_experience: e.target.value })} data-testid="form-years" />
              </Field>
            </div>
            <Field label="Specialization">
              <Input value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} placeholder="Therapy / Psychiatry / …" data-testid="form-spec" />
            </Field>
            <Field label="License number (optional)">
              <Input value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} placeholder="PSY-12345" data-testid="form-license" />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAdd(false)} data-testid="cancel-add">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="text-white border-0"
              data-testid="save-clinician"
              style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}>
              <Mail className="w-3.5 h-3.5 mr-1" /> {saving ? 'Adding…' : 'Add & Email Login'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm" data-testid="confirm-remove-dialog">
          <DialogHeader>
            <DialogTitle>Remove this clinician from your organization?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500">
            Patients already linked to this clinician will keep their access. The clinician will simply stop being included in your org plan.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" onClick={handleDelete} data-testid="confirm-remove">Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Manager dialog — Admin only */}
      <Dialog open={showAddManager} onOpenChange={setShowAddManager}>
        <DialogContent className="max-w-md" data-testid="add-mgr-dialog" aria-describedby="add-mgr-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserCog className="w-4 h-4 text-indigo-500" />
              Add a Manager to {user.name}
            </DialogTitle>
            <p id="add-mgr-desc" className="text-[11px] text-slate-500">
              Managers can sign in to the Organization portal and add clinicians under their own scope.
            </p>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Field label="Full name *">
              <Input value={mgrForm.name} onChange={e => setMgrForm({ ...mgrForm, name: e.target.value })} placeholder="Alex Rivera" data-testid="manager-name-input" />
            </Field>
            <Field label="Email (used to sign in) *">
              <Input type="email" value={mgrForm.email} onChange={e => setMgrForm({ ...mgrForm, email: e.target.value })} placeholder="alex@your-org.com" data-testid="manager-email-input" />
            </Field>
            <Field label="Temporary password *">
              <Input type="text" value={mgrForm.password} onChange={e => setMgrForm({ ...mgrForm, password: e.target.value })} placeholder="Min 6 characters" data-testid="manager-password-input" />
              <p className="text-[10px] text-slate-400 mt-1">They sign in at the Organization Portal with this password.</p>
            </Field>
            <Field label="Mobile (optional)">
              <Input value={mgrForm.mobile} onChange={e => setMgrForm({ ...mgrForm, mobile: e.target.value })} placeholder="+1…" data-testid="manager-mobile-input" />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAddManager(false)} data-testid="cancel-add-mgr">Cancel</Button>
            <Button onClick={handleSaveManager} disabled={savingMgr} className="text-white border-0"
              data-testid="manager-save-btn"
              style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
              <Mail className="w-3.5 h-3.5 mr-1" /> {savingMgr ? 'Adding…' : 'Add & Email Login'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Manager confirm — Admin only */}
      <Dialog open={!!deleteMgrId} onOpenChange={() => setDeleteMgrId(null)}>
        <DialogContent className="max-w-sm" data-testid="confirm-remove-mgr-dialog">
          <DialogHeader>
            <DialogTitle>Remove this Manager?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500">
            The Manager's account will be disabled and they will lose access immediately. Clinicians they added stay in your org
            and become un-assigned (you can re-assign them later).
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMgrId(null)}>Cancel</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" onClick={handleDeleteManager} data-testid="confirm-remove-mgr">Remove Manager</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color, testid }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm flex items-center gap-3" data-testid={testid}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: `${color}22`, color }}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{label}</p>
        <p className="text-xl font-fredoka font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide font-bold text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
