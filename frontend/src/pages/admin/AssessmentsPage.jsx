import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Pencil, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import axios from 'axios';
const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

const TYPES = [
  { id: 'treatment_history', label: 'Treatment History', desc: 'Patient treatment history questionnaires' },
  { id: 'health_social', label: 'Health & Social', desc: 'Health and social information gathering' },
];
const Q_TYPES = ['yes_no', 'multiple_choice', 'long_answer', 'scale', 'dropdown', 'file_upload', 'date_picker', 'image_based'];
const Q_LABELS = { yes_no: 'Yes / No', multiple_choice: 'Multiple Choice', long_answer: 'Long Answer', scale: 'Scale (0-10)', dropdown: 'Dropdown', file_upload: 'File Upload', date_picker: 'Date Picker', image_based: 'Image Based' };
const EMOTIONS = ['Happy', 'Sad', 'Angry', 'Fearful', 'Disgusted', 'Bad', 'Surprised'];

export default function AssessmentsPage() {
  const [tab, setTab] = useState('treatment_history');
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [bodyParts, setBodyParts] = useState([]);
  const [newBP, setNewBP] = useState('');

  const [form, setForm] = useState({ title: '', description: '', linked_emotion: '', linked_body_part: '', questions: [] });
  const [qForm, setQForm] = useState({ text: '', type: 'yes_no', options: '', required: true, scale_min_label: 'Not at all', scale_max_label: 'Extremely', image_url: '', accepted_types: '.pdf,.jpg,.png' });

  const load = async () => {
    const r = await ax.get(`${API}/assessments?assessment_type=${tab}`);
    setItems(r.data.assessments || []);
    if (tab === 'body') { const bp = await ax.get(`${API}/body-parts`); setBodyParts(bp.data.body_parts || []); }
  };
  useEffect(() => { load(); }, [tab]); // eslint-disable-line

  const openCreate = () => {
    setEditItem(null);
    setForm({ title: '', description: '', linked_emotion: '', linked_body_part: '', questions: [] });
    setShowForm(true);
  };
  const openEdit = (a) => {
    setEditItem(a);
    setForm({ title: a.title, description: a.description || '', linked_emotion: a.linked_emotion || '', linked_body_part: a.linked_body_part || '', questions: a.questions || [] });
    setShowForm(true);
  };

  const addQuestion = () => {
    const q = {
      question_id: `q_new_${Date.now()}`,
      text: qForm.text, type: qForm.type, required: qForm.required,
      options: qForm.type === 'multiple_choice' || qForm.type === 'dropdown' ? qForm.options.split(',').map(s => s.trim()).filter(Boolean) : [],
      scale_min: 0, scale_max: 10, scale_min_label: qForm.scale_min_label, scale_max_label: qForm.scale_max_label,
      image_url: qForm.image_url, accepted_types: qForm.accepted_types, order: form.questions.length + 1,
    };
    setForm(f => ({ ...f, questions: [...f.questions, q] }));
    setQForm({ text: '', type: 'yes_no', options: '', required: true, scale_min_label: 'Not at all', scale_max_label: 'Extremely', image_url: '', accepted_types: '.pdf,.jpg,.png' });
  };

  const removeQuestion = (idx) => setForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    const payload = { ...form, assessment_type: tab };
    if (editItem) { await ax.put(`${API}/assessments/${editItem.template_id}`, payload); }
    else { await ax.post(`${API}/assessments`, payload); }
    setShowForm(false); load();
  };

  const handleDelete = async (id) => { await ax.delete(`${API}/assessments/${id}`); load(); };

  const addBodyPart = async () => {
    if (!newBP.trim()) return;
    await ax.post(`${API}/body-parts`, { name: newBP, description: '' });
    setNewBP(''); load();
  };
  const removeBodyPart = async (id) => { await ax.delete(`${API}/body-parts/${id}`); load(); };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Assessment Setup</h1>
          <p className="text-sm text-slate-500">Configure assessment questions for patients. Whole-person, whole-life care starts with understanding.</p>
        </div>
        <Button onClick={openCreate} data-testid="add-assessment-btn" className="text-xs rounded-lg bg-blue-600 text-white border-0">
          <Plus className="w-3.5 h-3.5 mr-1" /> New Assessment
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 rounded-lg bg-slate-100 p-1">
          {TYPES.map(t => <TabsTrigger key={t.id} value={t.id} className="rounded-md text-xs data-[state=active]:bg-white">{t.label}</TabsTrigger>)}
        </TabsList>

        <TabsContent value={tab}>
          {/* Body Parts Manager (only for body tab) */}
          {tab === 'body' && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Custom Body Parts</h3>
              <div className="flex gap-2 mb-3">
                <Input value={newBP} onChange={e => setNewBP(e.target.value)} placeholder="New body part name..." className="rounded-lg text-sm flex-1" />
                <Button onClick={addBodyPart} className="rounded-lg text-xs bg-emerald-600 text-white border-0">Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {bodyParts.map(bp => (
                  <span key={bp.body_part_id} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200">
                    {bp.name}
                    <button onClick={() => removeBodyPart(bp.body_part_id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                  </span>
                ))}
                {!bodyParts.length && <span className="text-xs text-slate-400">No custom body parts added yet</span>}
              </div>
            </div>
          )}

          {/* Assessment List */}
          <div className="space-y-4">
            {items.map(a => (
              <div key={a.template_id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 flex items-start justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === a.template_id ? null : a.template_id)}>
                  <div className="flex items-start gap-3">
                    <ClipboardList className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">{a.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{a.description || 'No description'}</p>
                      <div className="flex gap-2 mt-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{a.questions?.length || 0} questions</span>
                        {a.linked_emotion && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700">{a.linked_emotion}</span>}
                        {a.linked_body_part && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">{a.linked_body_part}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); openEdit(a); }} className="p-1 text-blue-500"><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); handleDelete(a.template_id); }} className="p-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
                    {expandedId === a.template_id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
                {expandedId === a.template_id && (
                  <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                    {(a.questions || []).map((q, i) => (
                      <div key={q.question_id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                        <span className="text-xs font-mono text-slate-400 mt-0.5 w-5">{i + 1}.</span>
                        <div className="flex-1">
                          <p className="text-xs text-slate-700">{q.text}</p>
                          <div className="flex gap-1.5 mt-1">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{Q_LABELS[q.type] || q.type}</span>
                            {q.required && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-500">Required</span>}
                            {q.options?.length > 0 && <span className="text-[9px] text-slate-400">{q.options.length} options</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {!a.questions?.length && <p className="text-xs text-slate-400 py-3">No questions configured</p>}
                  </div>
                )}
              </div>
            ))}
            {!items.length && <div className="bg-white rounded-xl border p-12 text-center text-sm text-slate-400">No assessments for this type yet. We partner with caregivers to build whole-person treatment plans.</div>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog — 3D glassmorphic */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto border-0 p-0"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(244,238,247,0.94) 100%)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 40px 80px -20px rgba(124,91,255,0.35), inset 0 1px 0 rgba(255,255,255,0.7)',
            borderRadius: '24px',
          }}>
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.4), transparent 70%)', filter: 'blur(20px)' }} />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(78,168,255,0.4), transparent 70%)', filter: 'blur(20px)' }} />
          <div className="relative p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-fredoka font-bold"
                style={{ background: 'linear-gradient(135deg, #EC4899, #FB923C, #4EA8FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {editItem ? 'Edit' : 'Create'} {TYPES.find(t => t.id === tab)?.label}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-3">
              <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Assessment Title"
                className="rounded-2xl border-0 bg-white/70 shadow-md text-sm h-11 px-4 focus-visible:ring-2 focus-visible:ring-pink-300" />
              <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Description — helping families understand their whole-person care journey"
                className="rounded-2xl border-0 bg-white/70 shadow-md min-h-[70px] px-4 py-3 focus-visible:ring-2 focus-visible:ring-pink-300" />
              {tab === 'mood' && (
                <Select value={form.linked_emotion} onValueChange={v => setForm({...form, linked_emotion: v})}>
                  <SelectTrigger className="rounded-2xl border-0 bg-white/70 shadow-md h-11"><SelectValue placeholder="Link to Emotion" /></SelectTrigger>
                  <SelectContent>{EMOTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {tab === 'body' && (
                <Input value={form.linked_body_part} onChange={e => setForm({...form, linked_body_part: e.target.value})}
                  placeholder="Linked Body Part (e.g., Head, Chest)"
                  className="rounded-2xl border-0 bg-white/70 shadow-md h-11 px-4 focus-visible:ring-2 focus-visible:ring-pink-300" />
              )}

              {/* Questions — 3D card */}
              <div className="rounded-3xl p-5 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(245,243,255,0.95))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 18px 36px -16px rgba(124,91,255,0.35)',
                  border: '1px solid rgba(236,72,153,0.18)',
                }}>
                <h4 className="text-[11px] font-bold uppercase tracking-widest mb-3"
                  style={{ background: 'linear-gradient(90deg, #EC4899, #4EA8FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Questions · {form.questions.length}
                </h4>
                {form.questions.map((q, i) => (
                  <div key={i} className="flex items-center gap-2 py-2 px-3 rounded-xl bg-white/60 hover:bg-white/90 transition mb-1.5 shadow-sm">
                    <span className="text-xs font-mono text-slate-400 w-5">{i+1}.</span>
                    <span className="text-xs text-slate-700 flex-1 truncate">{q.text}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{Q_LABELS[q.type]}</span>
                    <button onClick={() => removeQuestion(i)} className="text-red-400 p-1 hover:scale-110 transition"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}

                {/* Add Question Form — gradient pill */}
                <div className="mt-3 pt-3 border-t border-pink-100/60 space-y-2">
                  <Input value={qForm.text} onChange={e => setQForm({...qForm, text: e.target.value})} placeholder="Question text…"
                    className="rounded-2xl border-0 bg-white/80 shadow-md h-10 px-4 text-sm focus-visible:ring-2 focus-visible:ring-pink-300" />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={qForm.type} onValueChange={v => setQForm({...qForm, type: v})}>
                      <SelectTrigger className="rounded-2xl border-0 bg-white/80 shadow-md text-xs h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>{Q_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{Q_LABELS[t]}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 px-3 rounded-2xl bg-white/80 shadow-md h-10">
                      <Switch checked={qForm.required} onCheckedChange={v => setQForm({...qForm, required: v})} />
                      <span className="text-xs text-slate-500">Required</span>
                    </div>
                  </div>
                  {(qForm.type === 'multiple_choice' || qForm.type === 'dropdown') && (
                    <Input value={qForm.options} onChange={e => setQForm({...qForm, options: e.target.value})} placeholder="Options (comma-separated)"
                      className="rounded-2xl border-0 bg-white/80 shadow-md h-10 px-4 text-sm focus-visible:ring-2 focus-visible:ring-pink-300" />
                  )}
                  {qForm.type === 'scale' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={qForm.scale_min_label} onChange={e => setQForm({...qForm, scale_min_label: e.target.value})} placeholder="Min label"
                        className="rounded-2xl border-0 bg-white/80 shadow-md h-10 px-4 text-sm" />
                      <Input value={qForm.scale_max_label} onChange={e => setQForm({...qForm, scale_max_label: e.target.value})} placeholder="Max label"
                        className="rounded-2xl border-0 bg-white/80 shadow-md h-10 px-4 text-sm" />
                    </div>
                  )}
                  {qForm.type === 'image_based' && (
                    <Input value={qForm.image_url} onChange={e => setQForm({...qForm, image_url: e.target.value})} placeholder="Image URL"
                      className="rounded-2xl border-0 bg-white/80 shadow-md h-10 px-4 text-sm" />
                  )}
                  <Button onClick={addQuestion} disabled={!qForm.text}
                    className="rounded-2xl text-xs text-white border-0 w-full h-10 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition"
                    style={{ background: 'linear-gradient(135deg, #EC4899, #FB923C)' }}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Question
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-2xl text-xs bg-white/60 backdrop-blur border-slate-200">Cancel</Button>
                <Button onClick={handleSave}
                  className="rounded-2xl text-xs text-white border-0 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition"
                  style={{ background: 'linear-gradient(135deg, #4EA8FF, #22D67E)' }}>
                  Save Assessment
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
