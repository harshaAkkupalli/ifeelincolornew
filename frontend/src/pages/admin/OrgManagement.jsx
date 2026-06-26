import React, { useState, useEffect } from 'react';
import { Building2, Search, Trash2, Pencil, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import AddUserDialog from '../../components/admin/AddUserDialog';
import axios from 'axios';
const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

export default function OrgManagement() {
  const [items, setItems] = useState([]); const [total, setTotal] = useState(0); const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState(null); const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ name: '', email: '' });
  const [showAdd, setShowAdd] = useState(false);
  const load = async (s = search) => { const r = await ax.get(`${API}/organizations?search=${s}`); setItems(r.data.organizations || []); setTotal(r.data.total || 0); };
  useEffect(() => { load(); }, []); // eslint-disable-line
  const handleEdit = (o) => { setEditItem(o); setForm({ name: o.name || '', email: o.email || '' }); };
  const handleSave = async () => { await ax.put(`${API}/organizations/${editItem.user_id}`, form); setEditItem(null); load(); };
  const handleDelete = async () => { await ax.delete(`${API}/organizations/${deleteId}`); setDeleteId(null); load(); };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-semibold text-slate-800">Organization Management</h1><p className="text-sm text-slate-500">{total} organizations</p></div>
        <Button onClick={() => setShowAdd(true)} className="text-xs rounded-lg bg-green-500 text-white border-0" data-testid="add-org-btn">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add New Organization
        </Button>
      </div>
      <AddUserDialog open={showAdd} onClose={() => setShowAdd(false)} role="organization" onCreated={() => load()} />
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="p-4 border-b border-slate-100"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input data-testid="org-search" value={search} onChange={e => { setSearch(e.target.value); load(e.target.value); }} placeholder="Search organizations..." className="pl-10 rounded-lg border-slate-200 text-sm" /></div></div>
        <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-slate-50 text-xs text-slate-500">
          <th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Joined</th><th className="px-4 py-3 font-medium">Actions</th>
        </tr></thead><tbody>
          {items.map(o => (<tr key={o.user_id} className="border-t border-slate-50 hover:bg-blue-50/30 text-xs text-slate-700">
            <td className="px-4 py-3 font-medium">{o.name}</td><td className="px-4 py-3">{o.email}</td><td className="px-4 py-3">{o.created_at?.split('T')[0]}</td>
            <td className="px-4 py-3 flex gap-1"><Button variant="ghost" size="sm" onClick={() => handleEdit(o)} className="text-blue-500 p-1"><Pencil className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteId(o.user_id)} className="text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></Button></td>
          </tr>))}
          {!items.length && <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-400">No organizations found</td></tr>}
        </tbody></table></div>
      </div>
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Edit Organization</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2"><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Name" className="rounded-lg" /><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" className="rounded-lg" />
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setEditItem(null)} className="rounded-lg text-xs">Cancel</Button><Button onClick={handleSave} className="rounded-lg text-xs bg-blue-600 text-white border-0">Save</Button></div></div></DialogContent></Dialog>
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Delete Organization?</DialogTitle></DialogHeader><p className="text-sm text-slate-500 mt-2">This action cannot be undone.</p>
        <div className="flex justify-end gap-2 pt-4"><Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-lg text-xs">Cancel</Button><Button onClick={handleDelete} className="rounded-lg text-xs bg-red-600 text-white border-0">Delete</Button></div></DialogContent></Dialog>
    </div>
  );
}
