import React, { useState, useEffect } from 'react';
import { Users, Search, Download, Trash2, Pencil, X, Plus, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import AddUserDialog from '../../components/admin/AddUserDialog';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

export default function PatientManagement() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [editPatient, setEditPatient] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', mobile: '', status: '' });
  const [showAdd, setShowAdd] = useState(false);

  const load = async (s = search) => {
    const r = await ax.get(`${API}/patients?search=${s}&limit=100`);
    setPatients(r.data.patients || []); setTotal(r.data.total || 0);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleEdit = (p) => { setEditPatient(p); setForm({ name: p.name || '', email: p.email || '', mobile: p.mobile || '', status: p.status || 'active' }); };
  const handleSave = async () => {
    await ax.put(`${API}/patients/${editPatient.user_id}`, form);
    setEditPatient(null); load();
  };
  const handleDelete = async () => {
    await ax.delete(`${API}/patients/${deleteId}`);
    setDeleteId(null); load();
  };
  const exportCSV = () => ax.get(`${API}/patients/export/csv`, { responseType: 'blob' }).then(r => { const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = 'patients.csv'; a.click(); });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-semibold text-slate-800">Patient Management</h1><p className="text-sm text-slate-500">{total} patients</p></div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAdd(true)} className="text-xs rounded-lg bg-pink-500 text-white border-0" data-testid="add-patient-btn">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add New Patient
          </Button>
          <Button onClick={exportCSV} variant="outline" className="text-xs rounded-lg"><Download className="w-3.5 h-3.5 mr-1" /> Export CSV</Button>
        </div>
      </div>
      <AddUserDialog open={showAdd} onClose={() => setShowAdd(false)} role="patient" onCreated={() => load()} />
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input data-testid="patient-search" value={search} onChange={e => { setSearch(e.target.value); load(e.target.value); }} placeholder="Search patients..." className="pl-10 rounded-lg border-slate-200 text-sm" /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="bg-slate-50 text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Mobile</th>
              <th className="px-4 py-3 font-medium">Subscription</th>
              <th className="px-4 py-3 font-medium">Assigned Clinicians</th>
              <th className="px-4 py-3 font-medium">Check-ins</th><th className="px-4 py-3 font-medium">Joined</th><th className="px-4 py-3 font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {patients.map(p => (
                <tr key={p.user_id} className="border-t border-slate-50 hover:bg-blue-50/30 text-xs text-slate-700 cursor-pointer"
                  onClick={(e) => {
                    // Avoid hijacking clicks on the action buttons
                    if ((e.target.closest && e.target.closest('button'))) return;
                    navigate(`/admin/patient/${p.user_id}`);
                  }}
                  data-testid={`patient-row-${p.user_id}`}
                >
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{p.email}</td>
                  <td className="px-4 py-3">{p.mobile || '-'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.subscription ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{p.subscription ? 'Active' : 'None'}</span></td>
                  <td className="px-4 py-3" data-testid={`patient-clinicians-${p.user_id}`}>
                    {(p.assigned_clinicians || []).length === 0 ? (
                      <span className="text-slate-400 text-[10px]">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {(p.assigned_clinicians || []).slice(0, 2).map((c) => (
                          <span key={c.clinician_id}
                            title={c.email}
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
                            {c.name}
                          </span>
                        ))}
                        {p.assigned_clinician_count > 2 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                            +{p.assigned_clinician_count - 2} more
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.checkin_count || 0}</td>
                  <td className="px-4 py-3">{p.created_at?.split('T')[0]}</td>
                  <td className="px-4 py-3 flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/patient/${p.user_id}`)} className="text-violet-500 p-1" data-testid={`view-patient-${p.user_id}`} title="View roadmap"><Eye className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(p)} className="text-blue-500 p-1"><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(p.user_id)} className="text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              ))}
              {!patients.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">No patients found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {/* Edit Dialog */}
      <Dialog open={!!editPatient} onOpenChange={() => setEditPatient(null)}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Edit Patient</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Name" className="rounded-lg" />
            <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" className="rounded-lg" />
            <Input value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} placeholder="Mobile" className="rounded-lg" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditPatient(null)} className="rounded-lg text-xs">Cancel</Button>
              <Button onClick={handleSave} className="rounded-lg text-xs bg-blue-600 text-white border-0">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Delete Patient?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 mt-2">This will permanently delete the patient and all their check-in data.</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-lg text-xs">Cancel</Button>
            <Button onClick={handleDelete} className="rounded-lg text-xs bg-red-600 text-white border-0">Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
