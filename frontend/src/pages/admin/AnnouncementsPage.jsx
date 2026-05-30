import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, Pencil, Image, Users, Stethoscope, Building2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import axios from 'axios';
const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

const AUDIENCES = [
  { id: 'patient', label: 'Patients', icon: Users, color: '#FFD166' },
  { id: 'clinician', label: 'Clinicians', icon: Stethoscope, color: '#118AB2' },
  { id: 'organization', label: 'Organizations', icon: Building2, color: '#06D6A0' },
  { id: 'all', label: 'Everyone', icon: Megaphone, color: '#8B5CF6' },
];

export default function AnnouncementsPage() {
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', target_audience: 'all', image_data: '' });
  const [deleteId, setDeleteId] = useState(null);

  const load = async () => {
    const target = tab === 'all' ? '' : tab;
    const r = await ax.get(`${API}/announcements?target=${target}`);
    setItems(r.data.announcements || []);
  };
  useEffect(() => { load(); }, [tab]); // eslint-disable-line

  const openCreate = () => { setEditItem(null); setForm({ title: '', content: '', target_audience: tab === 'all' ? 'all' : tab, image_data: '' }); setShowForm(true); };
  const openEdit = (a) => { setEditItem(a); setForm({ title: a.title, content: a.content, target_audience: a.target_audience, image_data: a.image_data || '' }); setShowForm(true); };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, image_data: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (editItem) { await ax.put(`${API}/announcements/${editItem.announcement_id}`, form); }
    else { await ax.post(`${API}/announcements`, form); }
    setShowForm(false); load();
  };
  const handleDelete = async () => { await ax.delete(`${API}/announcements/${deleteId}`); setDeleteId(null); load(); };

  const getAudienceInfo = (id) => AUDIENCES.find(a => a.id === id) || AUDIENCES[3];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Announcements</h1>
          <p className="text-sm text-slate-500">Communicate with your community. We partner with parents, caregivers, and professionals.</p>
        </div>
        <Button onClick={openCreate} data-testid="add-announcement-btn" className="text-xs rounded-lg bg-blue-600 text-white border-0">
          <Plus className="w-3.5 h-3.5 mr-1" /> New Announcement
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 rounded-lg bg-slate-100 p-1">
          {AUDIENCES.map(a => <TabsTrigger key={a.id} value={a.id} className="rounded-md text-xs data-[state=active]:bg-white">{a.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value={tab}>
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map(a => {
              const aud = getAudienceInfo(a.target_audience);
              return (
                <div key={a.announcement_id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  {a.image_data && (
                    <div className="h-40 overflow-hidden bg-slate-100">
                      <img src={a.image_data} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${aud.color}15`, color: aud.color }}>
                          {aud.label}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{a.status}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(a)} className="p-1 text-blue-500"><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(a.announcement_id)} className="p-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">{a.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-3">{a.content}</p>
                    <p className="text-[10px] text-slate-400 mt-2">{a.created_at?.split('T')[0]}</p>
                  </div>
                </div>
              );
            })}
            {!items.length && <div className="col-span-full bg-white rounded-xl border p-12 text-center text-sm text-slate-400">No announcements for this audience. Share updates to support your community.</div>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editItem ? 'Edit' : 'Create'} Announcement</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Announcement Title" className="rounded-lg" />
            <Textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} placeholder="We provide whole person, whole life, wholistic red carpet services..." className="rounded-lg min-h-[100px]" />
            <Select value={form.target_audience} onValueChange={v => setForm({...form, target_audience: v})}>
              <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>{AUDIENCES.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
            </Select>
            <div>
              <label className="text-xs text-slate-500 mb-2 block">Image (optional)</label>
              {form.image_data && <img src={form.image_data} alt="" className="w-full h-32 object-cover rounded-lg mb-2" />}
              <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                  <Image className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500">Upload Image</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                {form.image_data && <Button variant="outline" onClick={() => setForm({...form, image_data: ''})} className="rounded-lg text-xs">Remove</Button>}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-lg text-xs">Cancel</Button>
              <Button onClick={handleSave} className="rounded-lg text-xs bg-blue-600 text-white border-0">Publish</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Delete Announcement?</DialogTitle></DialogHeader>
          <div className="flex justify-end gap-2 pt-4"><Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-lg text-xs">Cancel</Button>
            <Button onClick={handleDelete} className="rounded-lg text-xs bg-red-600 text-white border-0">Delete</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
