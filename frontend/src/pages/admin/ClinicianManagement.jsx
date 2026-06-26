import React, { useState, useEffect } from 'react';
import { Stethoscope, Search, Download, Trash2, Pencil, Plus, Building2, Link2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import AddUserDialog from '../../components/admin/AddUserDialog';
import axios from 'axios';
const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

export default function ClinicianManagement() {
  const [items, setItems] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [orgItem, setOrgItem] = useState(null);   // clinician currently being assigned
  const [orgChoice, setOrgChoice] = useState('none');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', mobile: '' });

  const load = async (s = search) => {
    const [r, o] = await Promise.all([
      ax.get(`${API}/clinicians?search=${s}&limit=100`),
      ax.get(`${API}/organizations-simple`).catch(() => ({ data: { organizations: [] } })),
    ]);
    setItems(r.data.clinicians || []); setTotal(r.data.total || 0);
    setOrgs(o.data.organizations || []);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleEdit = (c) => { setEditItem(c); setForm({ name: c.name || '', email: c.email || '', mobile: c.mobile || '' }); };
  const handleSave = async () => { await ax.put(`${API}/clinicians/${editItem.user_id}`, form); setEditItem(null); load(); };
  const handleDelete = async () => { await ax.delete(`${API}/clinicians/${deleteId}`); setDeleteId(null); load(); };
  const exportCSV = () => ax.get(`${API}/clinicians/export/csv`, { responseType: 'blob' }).then(r => { const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = 'clinicians.csv'; a.click(); });

  const openAssignOrg = (c) => { setOrgItem(c); setOrgChoice(c.org_id || 'none'); };
  const saveOrgAssignment = async () => {
    await ax.put(`${API}/clinicians/${orgItem.user_id}/org`, { org_id: orgChoice === 'none' ? null : orgChoice });
    setOrgItem(null);
    load();
  };
  const orgName = (id) => orgs.find(o => o.user_id === id)?.name || '—';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-semibold text-slate-800">Clinician Management</h1><p className="text-sm text-slate-500">{total} clinicians</p></div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAdd(true)} className="text-xs rounded-lg bg-blue-500 text-white border-0" data-testid="add-clinician-btn">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add New Clinician
          </Button>
          <Button onClick={exportCSV} variant="outline" className="text-xs rounded-lg"><Download className="w-3.5 h-3.5 mr-1" /> Export CSV</Button>
        </div>
      </div>
      <AddUserDialog open={showAdd} onClose={() => setShowAdd(false)} role="clinician" onCreated={() => load()} />
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="p-4 border-b border-slate-100"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input data-testid="clinician-search" value={search} onChange={e => { setSearch(e.target.value); load(e.target.value); }} placeholder="Search clinicians..." className="pl-10 rounded-lg border-slate-200 text-sm" /></div></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left"><thead><tr className="bg-slate-50 text-xs text-slate-500">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Organization</th>
            <th className="px-4 py-3 font-medium">Subscription</th>
            <th className="px-4 py-3 font-medium">Assigned Patients</th>
            <th className="px-4 py-3 font-medium">Joined</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr></thead><tbody>
            {items.map(c => (
              <tr key={c.user_id} className="border-t border-slate-50 hover:bg-blue-50/30 text-xs text-slate-700">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.email}</td>
                <td className="px-4 py-3">
                  {c.org_id ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-700">
                      <Building2 className="w-3 h-3" /> {orgName(c.org_id)}
                    </span>
                  ) : (
                    <span className="text-slate-300 text-[10px]">— independent</span>
                  )}
                </td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${c.subscription ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{c.subscription ? 'Active' : 'None'}</span></td>
                <td className="px-4 py-3" data-testid={`clinician-patients-${c.user_id}`}>
                  {(c.assigned_patient_count || 0) === 0 ? (
                    <span className="text-slate-400 text-[10px]">—</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                        {c.assigned_patient_count}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate max-w-[180px]" title={(c.assigned_patients || []).map((p) => p.name).join(', ')}>
                        {(c.assigned_patients || []).slice(0, 2).map((p) => p.name).join(', ')}
                        {c.assigned_patient_count > 2 && ` +${c.assigned_patient_count - 2}`}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">{c.created_at?.split('T')[0]}</td>
                <td className="px-4 py-3 flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openAssignOrg(c)} className="text-orange-500 p-1" title="Assign to organization" data-testid={`assign-org-${c.user_id}`}>
                    <Link2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(c)} className="text-blue-500 p-1"><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(c.user_id)} className="text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></Button>
                </td>
              </tr>))}
            {!items.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">No clinicians found</td></tr>}
          </tbody></table></div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Edit Clinician</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2"><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Name" className="rounded-lg" /><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" className="rounded-lg" /><Input value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} placeholder="Mobile" className="rounded-lg" />
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setEditItem(null)} className="rounded-lg text-xs">Cancel</Button><Button onClick={handleSave} className="rounded-lg text-xs bg-blue-600 text-white border-0">Save</Button></div></div></DialogContent></Dialog>

      {/* Assign-to-org dialog */}
      <Dialog open={!!orgItem} onOpenChange={() => setOrgItem(null)}>
        <DialogContent className="sm:max-w-md" data-testid="assign-org-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="w-4 h-4 text-orange-500" /> Assign Clinician to Organization</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <p className="text-xs text-slate-500">
              When a patient subscribes to an organization, every clinician belonging to that org becomes free for that patient.
            </p>
            <div>
              <label className="block text-[10px] uppercase tracking-wide font-bold text-slate-500 mb-1">Organization</label>
              <Select value={orgChoice} onValueChange={setOrgChoice}>
                <SelectTrigger className="text-xs" data-testid="org-choice-trigger"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Independent (no organization)</SelectItem>
                  {orgs.map(o => (
                    <SelectItem key={o.user_id} value={o.user_id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOrgItem(null)} className="rounded-lg text-xs">Cancel</Button>
              <Button onClick={saveOrgAssignment} className="rounded-lg text-xs bg-orange-500 text-white border-0" data-testid="save-org-assignment">Save assignment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Delete Clinician?</DialogTitle></DialogHeader><p className="text-sm text-slate-500 mt-2">This action cannot be undone.</p>
        <div className="flex justify-end gap-2 pt-4"><Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-lg text-xs">Cancel</Button><Button onClick={handleDelete} className="rounded-lg text-xs bg-red-600 text-white border-0">Delete</Button></div></DialogContent></Dialog>
    </div>
  );
}
