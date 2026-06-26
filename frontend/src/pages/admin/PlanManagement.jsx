import React, { useState, useEffect, useMemo } from 'react';
import { Tag, Plus, Trash2, Pencil, Stethoscope, Building2, Shield, User, Users, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

// ─── The 5 subscription audiences ────────────────────────────────────────
const AUDIENCES = [
  {
    key: 'patient_clinician',
    label: 'Patient → Clinician',
    icon: Stethoscope,
    color: '#14b8a6',
    desc: 'A patient pays a specific clinician for ongoing care.',
    supportsClinicianFilter: true,
  },
  {
    key: 'patient_portal',
    label: 'Patient → Portal',
    icon: Shield,
    color: '#A78BFA',
    desc: 'A patient subscribes to the IFEELINCOLOR platform.',
  },
  {
    key: 'patient_organization',
    label: 'Patient → Organization',
    icon: Building2,
    color: '#FB923C',
    desc: 'A patient pays an organization once and unlocks all its clinicians for free.',
    supportsOrgFilter: true,
  },
  {
    key: 'clinician_portal',
    label: 'Clinician → Portal',
    icon: User,
    color: '#FF5A6A',
    desc: 'A clinician pays IFEELINCOLOR to use the platform.',
  },
  {
    key: 'organization_portal',
    label: 'Organization → Portal',
    icon: Users,
    color: '#22D67E',
    desc: 'An organization pays IFEELINCOLOR for network-wide access.',
  },
];

const emptyForm = {
  name: '', description: '', price: '', duration_days: '30',
  is_trial: false, trial_days: '15', features: '', color: '#7C5BFF', order: '99',
  clinician_id: null, org_id: null,
};

export default function PlanManagement() {
  const [audience, setAudience] = useState('patient_clinician');
  const [plans, setPlans] = useState([]);
  const [clinicians, setClinicians] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [filterClinician, setFilterClinician] = useState('all');  // 'all' | 'global' | clinician_id
  const [filterOrg, setFilterOrg] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const aud = AUDIENCES.find(a => a.key === audience);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const r = await ax.get(`${API}/plans-v2`, { params: { audience } });
      setPlans(r.data.plans || []);
    } finally { setLoading(false); }
  };

  const loadDropdowns = async () => {
    const [c, o] = await Promise.all([
      ax.get(`${API}/clinicians-simple`).catch(() => ({ data: { clinicians: [] } })),
      ax.get(`${API}/organizations-simple`).catch(() => ({ data: { organizations: [] } })),
    ]);
    setClinicians(c.data.clinicians || []);
    setOrgs(o.data.organizations || []);
  };

  useEffect(() => { loadDropdowns(); }, []);
  useEffect(() => { loadPlans(); setFilterClinician('all'); setFilterOrg('all'); }, [audience]);

  const filteredPlans = useMemo(() => {
    let list = plans;
    if (aud.supportsClinicianFilter) {
      if (filterClinician === 'global') list = list.filter(p => !p.clinician_id);
      else if (filterClinician !== 'all') list = list.filter(p => p.clinician_id === filterClinician);
    }
    if (aud.supportsOrgFilter) {
      if (filterOrg === 'global') list = list.filter(p => !p.org_id);
      else if (filterOrg !== 'all') list = list.filter(p => p.org_id === filterOrg);
    }
    return list;
  }, [plans, filterClinician, filterOrg, aud]);

  const openCreate = () => {
    setEditItem(null);
    setForm({
      ...emptyForm,
      clinician_id: aud.supportsClinicianFilter && filterClinician !== 'all' && filterClinician !== 'global' ? filterClinician : null,
      org_id: aud.supportsOrgFilter && filterOrg !== 'all' && filterOrg !== 'global' ? filterOrg : null,
    });
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditItem(p);
    setForm({
      name: p.name || '',
      description: p.description || '',
      price: String(p.price ?? p.price_usd ?? 0),
      duration_days: String(p.duration_days || 30),
      is_trial: p.is_trial || false,
      trial_days: String(p.trial_days || 15),
      features: (p.features || []).join(', '),
      color: p.color || '#7C5BFF',
      order: String(p.order ?? 99),
      clinician_id: p.clinician_id || null,
      org_id: p.org_id || null,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const payload = {
      audience,
      name: form.name,
      description: form.description,
      price: parseFloat(form.price || '0'),
      duration_days: parseInt(form.duration_days || '30', 10),
      is_trial: !!form.is_trial,
      trial_days: parseInt(form.trial_days || '15', 10),
      features: form.features.split(',').map(s => s.trim()).filter(Boolean),
      color: form.color,
      order: parseInt(form.order || '99', 10),
      clinician_id: audience === 'patient_clinician' ? (form.clinician_id || null) : null,
      org_id: audience === 'patient_organization' ? (form.org_id || null) : null,
    };
    if (editItem) {
      await ax.put(`${API}/plans-v2/${editItem.plan_id}`, payload);
    } else {
      await ax.post(`${API}/plans-v2`, payload);
    }
    setShowForm(false);
    loadPlans();
  };

  const handleDelete = async () => {
    await ax.delete(`${API}/plans-v2/${deleteId}`);
    setDeleteId(null);
    loadPlans();
  };

  const clinicianName = (id) => clinicians.find(c => c.user_id === id)?.name || id;
  const orgName = (id) => orgs.find(o => o.user_id === id)?.name || id;

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="plan-management-v2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Subscriptions</h1>
          <p className="text-sm text-slate-500">Manage every plan for the 5 subscription flows in IFEELINCOLOR.</p>
        </div>
        <Button onClick={openCreate} data-testid="add-plan-btn" className="text-xs rounded-lg text-white border-0"
          style={{ background: aud.color }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add {aud.label} Plan
        </Button>
      </div>

      <Tabs value={audience} onValueChange={setAudience}>
        <TabsList className="mb-4 rounded-xl bg-slate-100 p-1 grid grid-cols-5 gap-1 w-full h-auto">
          {AUDIENCES.map(a => {
            const Icon = a.icon;
            return (
              <TabsTrigger
                key={a.key}
                value={a.key}
                data-testid={`tab-${a.key}`}
                className="rounded-lg text-[11px] data-[state=active]:bg-white data-[state=active]:shadow-sm flex flex-col items-center gap-1 py-2 px-2"
              >
                <Icon className="w-3.5 h-3.5" style={{ color: a.color }} />
                <span className="text-center leading-tight font-semibold">{a.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={audience}>
          <div className="rounded-xl mb-4 p-3 flex items-center gap-2 text-[11px] font-nunito"
            style={{ background: `${aud.color}10`, border: `1px solid ${aud.color}33`, color: '#475569' }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: aud.color }} />
            {aud.desc}
          </div>

          {/* Filters for per-clinician / per-org */}
          {(aud.supportsClinicianFilter || aud.supportsOrgFilter) && (
            <div className="flex items-center gap-3 mb-4">
              {aud.supportsClinicianFilter && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">Filter by clinician:</span>
                  <Select value={filterClinician} onValueChange={setFilterClinician}>
                    <SelectTrigger className="h-8 text-xs w-60" data-testid="filter-clinician">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All plans</SelectItem>
                      <SelectItem value="global">Global (default for all clinicians)</SelectItem>
                      {clinicians.map(c => (
                        <SelectItem key={c.user_id} value={c.user_id}>{c.name} · {c.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {aud.supportsOrgFilter && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">Filter by organization:</span>
                  <Select value={filterOrg} onValueChange={setFilterOrg}>
                    <SelectTrigger className="h-8 text-xs w-60" data-testid="filter-org">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All plans</SelectItem>
                      <SelectItem value="global">Global (default for all orgs)</SelectItem>
                      {orgs.map(o => (
                        <SelectItem key={o.user_id} value={o.user_id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Plan grid */}
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading…</div>
          ) : filteredPlans.length === 0 ? (
            <div className="rounded-2xl p-8 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 bg-slate-50">
              No plans yet. Click <span className="font-semibold text-slate-600">Add {aud.label} Plan</span> to create one.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="plans-grid">
              {filteredPlans.map(p => (
                <div key={p.plan_id} className="rounded-2xl p-4 bg-white border border-slate-200 shadow-sm hover:shadow-md transition"
                  data-testid={`plan-card-${p.plan_id}`}
                  style={{ borderLeftColor: aud.color, borderLeftWidth: 4 }}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 text-sm truncate">{p.name}</h3>
                      <p className="text-[10px] text-slate-400 truncate">{p.purpose || p.description}</p>
                    </div>
                    <div className="text-right ml-2">
                      <div className="text-lg font-bold" style={{ color: aud.color }}>${p.price}</div>
                      <div className="text-[9px] text-slate-400">/ {p.duration_days}d</div>
                    </div>
                  </div>

                  {/* Scope badge */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {p.clinician_id && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#14b8a622', color: '#0d9488' }}>
                        {clinicianName(p.clinician_id)} only
                      </span>
                    )}
                    {p.org_id && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#FB923C22', color: '#c2410c' }}>
                        {orgName(p.org_id)} only
                      </span>
                    )}
                    {!p.clinician_id && !p.org_id && (aud.supportsClinicianFilter || aud.supportsOrgFilter) && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-500">
                        Global default
                      </span>
                    )}
                    {p.is_trial && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold bg-yellow-100 text-yellow-700">Trial · {p.trial_days}d</span>
                    )}
                    {!p.active && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700">Inactive</span>
                    )}
                  </div>

                  {p.features?.length > 0 && (
                    <ul className="text-[10px] text-slate-500 mb-3 space-y-0.5">
                      {p.features.slice(0, 3).map((f, i) => <li key={i}>· {f}</li>)}
                      {p.features.length > 3 && <li className="italic text-slate-400">+ {p.features.length - 3} more</li>}
                    </ul>
                  )}

                  <div className="flex gap-1.5">
                    <Button onClick={() => openEdit(p)} variant="outline" size="sm"
                      data-testid={`edit-${p.plan_id}`}
                      className="text-[10px] h-7 px-2 flex-1">
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button onClick={() => setDeleteId(p.plan_id)} variant="outline" size="sm"
                      data-testid={`delete-${p.plan_id}`}
                      className="text-[10px] h-7 px-2 text-red-600 border-red-200 hover:bg-red-50">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Create/Edit modal ─── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden" data-testid="plan-form-dialog">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-base">
              <aud.icon className="w-4 h-4" style={{ color: aud.color }} />
              {editItem ? 'Edit' : 'New'} {aud.label} plan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs px-6 py-4 overflow-y-auto flex-1" data-testid="plan-form-body">
            <Field label="Plan name *">
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Premium Care" data-testid="plan-name" />
            </Field>
            <Field label="Description">
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="What patients get…" data-testid="plan-description" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (USD) *">
                <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="49" data-testid="plan-price" />
              </Field>
              <Field label="Duration (days) *">
                <Input type="number" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: e.target.value })} placeholder="30" data-testid="plan-duration" />
              </Field>
            </div>

            {audience === 'patient_clinician' && (
              <Field label="Applies to clinician">
                <Select value={form.clinician_id || 'global'} onValueChange={v => setForm({ ...form, clinician_id: v === 'global' ? null : v })}>
                  <SelectTrigger className="h-9 text-xs" data-testid="plan-clinician-picker">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">All clinicians (Global default)</SelectItem>
                    {clinicians.map(c => (
                      <SelectItem key={c.user_id} value={c.user_id}>{c.name} · {c.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Pick a clinician to make this plan exclusive to them. Patients only see this plan when subscribing to that clinician.
                </p>
              </Field>
            )}

            {audience === 'patient_organization' && (
              <Field label="Applies to organization">
                <Select value={form.org_id || 'global'} onValueChange={v => setForm({ ...form, org_id: v === 'global' ? null : v })}>
                  <SelectTrigger className="h-9 text-xs" data-testid="plan-org-picker">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">All organizations (Global default)</SelectItem>
                    {orgs.map(o => (
                      <SelectItem key={o.user_id} value={o.user_id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Pick an org to make this plan exclusive to it. Patients who buy this plan unlock all clinicians inside that org for free.
                </p>
              </Field>
            )}

            <Field label="Features (comma-separated)">
              <Textarea value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} rows={2}
                placeholder="Weekly sessions, Direct chat, Care plan reviews" data-testid="plan-features" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Color">
                <Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} data-testid="plan-color" className="h-9" />
              </Field>
              <Field label="Display order">
                <Input type="number" value={form.order} onChange={e => setForm({ ...form, order: e.target.value })} data-testid="plan-order" />
              </Field>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
              <div>
                <p className="text-xs font-semibold text-slate-700">Trial plan</p>
                <p className="text-[10px] text-slate-400">Mark as trial (lets users sample before paying)</p>
              </div>
              <Switch checked={form.is_trial} onCheckedChange={v => setForm({ ...form, is_trial: v })} data-testid="plan-trial-toggle" />
            </div>
            {form.is_trial && (
              <Field label="Trial days">
                <Input type="number" value={form.trial_days} onChange={e => setForm({ ...form, trial_days: e.target.value })} data-testid="plan-trial-days" />
              </Field>
            )}
          </div>
          <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-100 bg-white shrink-0">
            <Button variant="outline" onClick={() => setShowForm(false)} data-testid="cancel-plan-btn">Cancel</Button>
            <Button onClick={handleSave} className="text-white" style={{ background: aud.color }} data-testid="save-plan-btn">
              {editItem ? 'Save changes' : 'Create plan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm" data-testid="delete-dialog">
          <DialogHeader>
            <DialogTitle className="text-base">Delete this plan?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500">Patients with active subscriptions to this plan will keep their access until their period ends, but no new sign-ups will be possible.</p>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => setDeleteId(null)} data-testid="cancel-delete-btn">Cancel</Button>
            <Button onClick={handleDelete} className="bg-red-600 text-white hover:bg-red-700" data-testid="confirm-delete-btn">Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
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
