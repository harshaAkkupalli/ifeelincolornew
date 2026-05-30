import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2, Pencil, Send, Search, Users } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import axios from 'axios';
const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

export default function RecommendationsPage() {
  const [items, setItems] = useState([]); const [showForm, setShowForm] = useState(false); const [editItem, setEditItem] = useState(null); const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', target_conditions: '', category: 'general', content_type: 'text', media_url: '', image_url: '', steps: '', severity_filter: [], duration_minutes: '', trigger_colors: [], body_md: '' });
  const [sendModal, setSendModal] = useState(null); // { rec } | null
  const load = async () => { const r = await ax.get(`${API}/recommendations`); setItems(r.data.recommendations || []); };
  useEffect(() => { load(); }, []);

  const empty = { title: '', description: '', target_conditions: '', category: 'general', content_type: 'text', media_url: '', image_url: '', steps: '', severity_filter: [], duration_minutes: '', trigger_colors: [], body_md: '' };
  const openCreate = () => { setEditItem(null); setForm(empty); setShowForm(true); };
  const openEdit = (r) => { setEditItem(r); setForm({ ...empty, ...r, target_conditions: (r.target_conditions || []).join(', '), steps: (r.steps || []).join('\n'), trigger_colors: r.trigger_colors || [], body_md: r.body_md || '' }); setShowForm(true); };
  const handleSave = async () => {
    const payload = {
      ...form,
      target_conditions: (form.target_conditions || '').split(',').map(s => s.trim()).filter(Boolean),
      steps: typeof form.steps === 'string' ? form.steps.split('\n').map(s => s.trim()).filter(Boolean) : (form.steps || []),
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
    };
    if (editItem) { await ax.put(`${API}/recommendations/${editItem.recommendation_id}`, payload); } else { await ax.post(`${API}/recommendations`, payload); }
    setShowForm(false); load();
  };
  const handleDelete = async () => { await ax.delete(`${API}/recommendations/${deleteId}`); setDeleteId(null); load(); };

  const CATEGORIES = ['general', 'anxiety', 'anger', 'sadness', 'fear', 'sensory', 'social', 'sleep', 'focus'];
  // Color triggers map directly to the 7 emotion families on the Feelings Wheel.
  const TRIGGER_COLORS = [
    { key: 'yellow', label: 'Yellow · Happy', hex: '#FFD23F' },
    { key: 'blue', label: 'Blue · Sad', hex: '#3B82F6' },
    { key: 'red', label: 'Red · Angry', hex: '#EF4444' },
    { key: 'orange', label: 'Orange · Fearful', hex: '#F97316' },
    { key: 'green', label: 'Green · Disgusted', hex: '#22C55E' },
    { key: 'grey', label: 'Grey · Bad', hex: '#94A3B8' },
    { key: 'purple', label: 'Purple · Surprised', hex: '#A855F7' },
  ];
  const toggleColor = (key) => setForm(f => ({ ...f, trigger_colors: f.trigger_colors?.includes(key) ? f.trigger_colors.filter(c => c !== key) : [...(f.trigger_colors || []), key] }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-semibold text-slate-800">Recommendations</h1><p className="text-sm text-slate-500">Assessment-based recommendations for patients</p></div>
        <Button onClick={openCreate} data-testid="add-recommendation-btn" className="text-xs rounded-lg bg-blue-600 text-white border-0"><Plus className="w-3.5 h-3.5 mr-1" /> Add Recommendation</Button>
      </div>
      <div className="grid gap-4">
        {items.map(r => (
          <div key={r.recommendation_id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center mt-0.5"><BookOpen className="w-4 h-4 text-purple-500" /></div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{r.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xl">{r.description}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 capitalize">{r.category}</span>
                    {(r.target_conditions || []).map(c => <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{c}</span>)}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{r.status}</span>
                    {(r.trigger_colors || []).map(c => {
                      const COL = { yellow:'#FFD23F', blue:'#3B82F6', red:'#EF4444', orange:'#F97316', green:'#22C55E', grey:'#94A3B8', purple:'#A855F7' }[c] || '#64748B';
                      return <span key={c} data-testid={`trigger-color-chip-${c}`} className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white capitalize" style={{ background: COL }}>{c}</span>;
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setSendModal({ rec: r })} className="text-pink-500 p-1" data-testid={`send-rec-${r.recommendation_id}`} title="Send to specific patient based on results"><Send className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(r)} className="text-blue-500 p-1"><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteId(r.recommendation_id)} className="text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </div>
        ))}
        {!items.length && <div className="bg-white rounded-xl border p-12 text-center text-sm text-slate-400">No recommendations yet. Create one based on assessment patterns.</div>}
      </div>
      <Dialog open={showForm} onOpenChange={setShowForm}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editItem ? 'Edit' : 'Create'} Recommendation</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2 max-h-[70vh] overflow-y-auto pr-2">
          <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Title" className="rounded-lg" />
          <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Description / instructions" className="rounded-lg min-h-[100px]" />
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-slate-500 mb-1 block">Category</label>
              <Select value={form.category} onValueChange={v => setForm({...form, category: v})}><SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-xs text-slate-500 mb-1 block">Content Type</label>
              <Select value={form.content_type} onValueChange={v => setForm({...form, content_type: v})}><SelectTrigger className="rounded-lg" data-testid="rec-content-type"><SelectValue /></SelectTrigger>
                <SelectContent>{['text','video','image','steps','link'].map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent></Select></div>
          </div>
          {(form.content_type === 'video' || form.content_type === 'link') && (
            <Input value={form.media_url} onChange={e => setForm({...form, media_url: e.target.value})} placeholder={form.content_type === 'video' ? 'YouTube URL' : 'Resource URL'} className="rounded-lg" data-testid="rec-media-url" />
          )}
          {form.content_type === 'image' && (
            <Input value={form.media_url} onChange={e => setForm({...form, media_url: e.target.value})} placeholder="Image URL" className="rounded-lg" />
          )}
          {form.content_type === 'steps' && (
            <Textarea value={form.steps} onChange={e => setForm({...form, steps: e.target.value})} placeholder="One step per line..." className="rounded-lg min-h-[100px]" data-testid="rec-steps" />
          )}
          <Input value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} placeholder="Cover image URL (optional)" className="rounded-lg" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={form.target_conditions} onChange={e => setForm({...form, target_conditions: e.target.value})} placeholder="Target conditions (comma-separated)" className="rounded-lg" />
            <Input type="number" value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: e.target.value})} placeholder="Duration (min)" className="rounded-lg" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Severity filter (auto-show to patients with this severity)</label>
            <div className="flex gap-2 flex-wrap">
              {['critical','high','moderate','low'].map(s => {
                const on = (form.severity_filter || []).includes(s);
                return (
                  <button key={s} type="button" onClick={() => setForm({...form, severity_filter: on ? form.severity_filter.filter(x => x !== s) : [...(form.severity_filter || []), s]})}
                    className="text-[10px] font-bold px-2 py-1 rounded-full border capitalize"
                    style={{ background: on ? '#7C3AED' : 'white', color: on ? 'white' : '#7C3AED', borderColor: '#7C3AED' }}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          {/* NEW (Workflow 1) — Color triggers gate this Portal Recommendation by patient ending check-in color */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Trigger colors <span className="text-slate-400">(show only when patient's check-in ends on one of these)</span></label>
            <div className="flex gap-2 flex-wrap" data-testid="trigger-colors-row">
              {TRIGGER_COLORS.map(c => {
                const on = form.trigger_colors?.includes(c.key);
                return (
                  <button key={c.key} type="button" data-testid={`trigger-color-${c.key}`} onClick={() => toggleColor(c.key)}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all"
                    style={{ background: on ? c.hex : 'white', color: on ? '#fff' : c.hex, borderColor: c.hex, boxShadow: on ? `0 4px 12px -4px ${c.hex}88` : 'none' }}>
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Leave empty to broadcast to all patients regardless of color state.</p>
          </div>
          {/* NEW (Workflow 1) — Markdown body for richer instructions */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Rich instructions (Markdown supported)</label>
            <Textarea data-testid="rec-body-md" rows={4} value={form.body_md || ''} onChange={e => setForm({ ...form, body_md: e.target.value })} placeholder="**Try this** when…" className="rounded-lg min-h-[80px]" />
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setShowForm(false)} className="rounded-lg text-xs">Cancel</Button><Button onClick={handleSave} data-testid="save-rec-btn" className="rounded-lg text-xs bg-blue-600 text-white border-0">Save</Button></div>
        </div></DialogContent></Dialog>
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Delete Recommendation?</DialogTitle></DialogHeader>
        <div className="flex justify-end gap-2 pt-4"><Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-lg text-xs">Cancel</Button><Button onClick={handleDelete} className="rounded-lg text-xs bg-red-600 text-white border-0">Delete</Button></div></DialogContent></Dialog>
      {sendModal && (
        <SendToPatientModal
          rec={sendModal.rec}
          onClose={() => setSendModal(null)}
          onSent={() => setSendModal(null)}
        />
      )}
    </div>
  );
}

/**
 * Send-to-Patient modal — picks a patient (with severity / latest color preview)
 * and dispatches the recommendation via POST /api/admin/patient/{id}/recommendation.
 * The list is filtered by the rec's `severity_filter` so admins are nudged toward
 * patients whose results match the rec's intent.
 */
function SendToPatientModal({ rec, onClose, onSent }) {
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState('');
  const [filterSev, setFilterSev] = useState(rec.severity_filter?.[0] || 'all');
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await ax.get(`${API}/patients?limit=200&with_severity=1`);
        if (!cancelled) setPatients(r.data.patients || []);
      } catch {
        // fallback to plain patients list
        try {
          const r2 = await ax.get(`${API}/patients?limit=200`);
          if (!cancelled) setPatients(r2.data.patients || []);
        } catch { /* ignore */ }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const send = async (p) => {
    setSendingId(p.user_id);
    try {
      await ax.post(`${API}/patient/${p.user_id}/recommendation`, {
        recommendation_id: rec.recommendation_id,
      });
      onSent();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to send recommendation');
    } finally {
      setSendingId(null);
    }
  };

  const SEV_COLOR = { critical: 'bg-red-500', high: 'bg-orange-500', moderate: 'bg-yellow-500', low: 'bg-emerald-500' };
  const filtered = patients
    .filter((p) => {
      const q = query.trim().toLowerCase();
      if (q && !((p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q))) return false;
      if (filterSev !== 'all') {
        const sev = (p.latest_severity || p.severity || '').toLowerCase();
        if (sev !== filterSev) return false;
      }
      return true;
    });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" data-testid="send-to-patient-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4 text-pink-500" /> Send to patient
          </DialogTitle>
          <p className="text-[11px] text-slate-500 -mt-1">
            Sending <span className="font-bold text-slate-800">{rec.title}</span>
            {rec.severity_filter?.length > 0 && (
              <> · matches severity: {rec.severity_filter.join(', ')}</>
            )}
          </p>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-slate-400" />
              <Input
                data-testid="send-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="rounded-lg pl-7 text-sm h-9"
              />
            </div>
            <Select value={filterSev} onValueChange={setFilterSev}>
              <SelectTrigger className="w-32 h-9 rounded-lg text-xs" data-testid="send-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All results</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
            {loading && <p className="text-xs text-slate-400 text-center py-6">Loading patients…</p>}
            {!loading && filtered.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">
                <Users className="w-4 h-4 mx-auto mb-1" /> No patients match this filter.
              </p>
            )}
            {filtered.map((p) => {
              const sev = (p.latest_severity || p.severity || '').toLowerCase();
              return (
                <div key={p.user_id}
                  className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-100 hover:bg-slate-50"
                  data-testid={`send-patient-row-${p.user_id}`}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, #FF4FBF, #A78BFA)' }}>
                    {(p.name || p.email || 'P').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-800 truncate">{p.name || '—'}</p>
                      {sev && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase text-white ${SEV_COLOR[sev] || 'bg-slate-400'}`}
                          data-testid={`patient-sev-${p.user_id}`}>{sev}</span>
                      )}
                      {p.latest_color && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-100 text-slate-600">{p.latest_color}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{p.email}</p>
                  </div>
                  <Button
                    onClick={() => send(p)}
                    disabled={sendingId === p.user_id}
                    data-testid={`send-rec-confirm-${p.user_id}`}
                    className="h-7 rounded-lg text-[10px] text-white border-0"
                    style={{ background: 'linear-gradient(135deg, #FF4FBF, #A78BFA)' }}
                  >
                    {sendingId === p.user_id ? 'Sending…' : (<><Send className="w-3 h-3 mr-1" /> Send</>)}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
