import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Save, Pencil, X, GripVertical, HeartPulse, Sparkles, Activity, AlertTriangle, ShieldCheck, Eye } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { useCheckinContent } from '../../components/checkin/CheckinContentContext';
import PreviewTab from './checkin/PreviewTab';
import DraggableBodyEditor from './checkin/DraggableBodyEditor';
import { BRAND } from '../../brand';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ax = axios.create({ withCredentials: true });

const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// ───────── Live compliance warning helper ─────────
// Lightweight client-side mirror of the backend DIAGNOSTIC_PATTERNS so the admin
// sees a warning the moment they type problematic phrasing — the real validation
// still runs on the server before any DB write.
const CLIENT_DIAGNOSTIC_PATTERNS = [
  /\bthis proves\b/i, /\bproves that you\b/i, /\byou definitely\b/i, /\byou clearly\b/i,
  /\byou certainly\b/i, /\byou are diagnosed\b/i, /\byou suffer from\b/i,
  /\bguaranteed to\b/i, /\bwill cure\b/i, /\bmust be\b/i,
  /\bis caused by\b/i, /\bis a symptom of\b/i, /\balways means\b/i, /\bnever means\b/i,
  /\byou have (depression|anxiety|adhd|ptsd|bipolar|ocd)\b/i,
];
function detectDiagnostic(text) {
  if (!text) return [];
  const hits = [];
  CLIENT_DIAGNOSTIC_PATTERNS.forEach((p) => { const m = text.match(p); if (m) hits.push(m[0]); });
  return hits;
}
function ComplianceBadge({ text }) {
  const hits = detectDiagnostic(text);
  if (!text) return null;
  if (hits.length === 0) {
    return (
      <div data-testid="compliance-safe" className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 mt-1">
        <ShieldCheck className="w-3 h-3" /> Clinical-safety phrasing — looks good
      </div>
    );
  }
  return (
    <div data-testid="compliance-warning" className="flex items-start gap-1.5 text-[10px] font-bold text-amber-600 mt-1 p-1.5 rounded-lg" style={{ background: '#FEF3C7' }}>
      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-px" />
      <span>Diagnostic phrasing detected: <code className="bg-white px-1 rounded">{hits.join(', ')}</code> — try "may be telling you" or "may be connected to".</span>
    </div>
  );
}

// ───────── TABS ─────────
const TABS = [
  { id: 'body', label: 'Body Parts', icon: HeartPulse, color: '#F472B6' },
  { id: 'emotions', label: 'Emotion Families', icon: Sparkles, color: '#FFD23F' },
  { id: 'regulation', label: 'Regulation Steps', icon: Activity, color: '#22D3C5' },
  { id: 'preview', label: 'Preview', icon: Eye, color: '#A78BFA' },
];

// ───────── Reusable Multi-Question Editor ─────────
const Q_TYPES = [
  { id: 'yes_no', label: 'Yes / No' },
  { id: 'multiple_choice', label: 'Multiple Choice' },
  { id: 'long_answer', label: 'Long Answer' },
  { id: 'scale', label: 'Scale (0–10)' },
];

function QuestionsEditor({ questions, onChange, accentColor = '#F472B6', testIdPrefix = 'q' }) {
  const update = (idx, patch) => {
    const arr = [...(questions || [])];
    arr[idx] = { ...arr[idx], ...patch };
    onChange(arr);
  };
  const add = () => onChange([...(questions || []), { text: '', type: 'yes_no', options: [], required: false }]);
  const remove = (idx) => onChange((questions || []).filter((_, i) => i !== idx));

  return (
    <div className="rounded-2xl p-3 border" style={{ borderColor: '#EEF2F7', background: '#FAFBFD' }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-bold" style={{ color: BRAND.dark }}>Additional Questions</p>
          <p className="text-[11px] text-slate-500">Patients answer these after the sensation grid.</p>
        </div>
        <Button data-testid={`${testIdPrefix}-add-question`} onClick={add} variant="outline" className="h-8 px-3 text-xs font-bold rounded-xl">
          <Plus className="w-3 h-3 mr-1" /> Add question
        </Button>
      </div>
      {(questions || []).length === 0 && (
        <p className="text-[11px] text-slate-400 italic py-1">No extra questions yet — patients will only see the sensation grid.</p>
      )}
      {(questions || []).map((q, i) => {
        const needsOptions = q.type === 'multiple_choice';
        return (
          <div key={q.id || i} data-testid={`${testIdPrefix}-question-${i}`} className="rounded-xl p-3 mb-2 bg-white border" style={{ borderColor: '#E2E8F0' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${accentColor}22`, color: accentColor }}>Q{i + 1}</span>
              <Input data-testid={`${testIdPrefix}-question-text-${i}`} value={q.text || ''} placeholder="Question text" onChange={(e) => update(i, { text: e.target.value })} className="flex-1" />
              <select data-testid={`${testIdPrefix}-question-type-${i}`} value={q.type} onChange={(e) => update(i, { type: e.target.value, options: e.target.value === 'multiple_choice' ? (q.options || []) : [] })}
                className="rounded-md text-[11px] px-2 py-1.5 border font-bold" style={{ borderColor: '#E2E8F0' }}>
                {Q_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <Button onClick={() => remove(i)} data-testid={`${testIdPrefix}-question-remove-${i}`} variant="ghost" className="h-8 px-2 text-red-500 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <ComplianceBadge text={q.text} />
            {needsOptions && (
              <Textarea data-testid={`${testIdPrefix}-question-options-${i}`} rows={2} value={(q.options || []).join('\n')}
                onChange={(e) => update(i, { options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                placeholder="Option per line — e.g. Less than a day / 1-3 days / Over a week"
                className="mt-2" />
            )}
            <div className="flex items-center gap-2 mt-2">
              <Switch data-testid={`${testIdPrefix}-question-required-${i}`} checked={!!q.required} onCheckedChange={(v) => update(i, { required: v })} />
              <span className="text-[11px] font-bold" style={{ color: q.required ? accentColor : '#64748B' }}>Required</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ───────── BODY PARTS ─────────
function BodyPartsTab() {
  const { emotionColorsFull, refresh: refreshCheckinCtx } = useCheckinContent();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null); // body_part_id or 'new'
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [highlighted, setHighlighted] = useState([]);
  const [saveError, setSaveError] = useState('');

  const load = async () => {
    const r = await ax.get(`${API}/admin/checkin/body-parts`);
    setItems(r.data.body_parts || []);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => {
    setEditing('new');
    setDraft({
      name: '', slug: '', position_x: 50, position_y: 50, sensations: [],
      question_text: '', reflection_template: '',
      sensation_emotion_map: {}, default_emotion_key: 'bad',
      questions: [],
      order: items.length, active: true,
    });
    setSaveError('');
  };
  const startEdit = (bp) => {
    setEditing(bp.body_part_id);
    setDraft({
      question_text: '', reflection_template: '',
      sensation_emotion_map: {}, default_emotion_key: 'bad',
      questions: [],
      ...bp,
    });
    setHighlighted([bp.slug]);
    setSaveError('');
  };
  const cancel = () => { setEditing(null); setDraft(null); setSaveError(''); };

  const save = async () => {
    if (!draft.name) return;
    setSaving(true);
    setSaveError('');
    try {
      const cleanSensations = draft.sensations.filter(Boolean);
      // Prune emotion map to existing sensations only
      const map = {};
      cleanSensations.forEach((s) => { if (draft.sensation_emotion_map?.[s]) map[s] = draft.sensation_emotion_map[s]; });
      const payload = {
        ...draft,
        slug: draft.slug || slugify(draft.name),
        sensations: cleanSensations,
        sensation_emotion_map: map,
      };
      if (editing === 'new') await ax.post(`${API}/admin/checkin/body-parts`, payload);
      else await ax.patch(`${API}/admin/checkin/body-parts/${editing}`, payload);
      await load();
      await refreshCheckinCtx();  // hot-update the patient context preview
      cancel();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.error === 'non_compliant_language') {
        const flat = Object.entries(detail.offending_phrases || {})
          .map(([k, v]) => `${k}: ${v.join(', ')}`).join(' · ');
        setSaveError(`Diagnostic phrasing blocked → ${flat}`);
      } else {
        setSaveError(typeof detail === 'string' ? detail : 'Could not save.');
      }
    } finally { setSaving(false); }
  };

  const remove = async (bp) => {
    if (!window.confirm(`Delete body part "${bp.name}"?`)) return;
    await ax.delete(`${API}/admin/checkin/body-parts/${bp.body_part_id}`);
    await load();
    await refreshCheckinCtx();
  };

  const onBodyPreviewSelect = (zoneIds) => {
    // Single-select behaviour for admin preview
    const ids = Array.isArray(zoneIds) ? zoneIds : [zoneIds];
    const last = ids[ids.length - 1];
    if (!last) return;
    setHighlighted([last]);
    const target = items.find((b) => b.slug === last);
    if (target) startEdit(target);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-nunito text-slate-500">
          Configure the body zones, assessment questions, sensations, and emotion bindings that drive the patient's Daily Check-in.
        </p>
        <Button data-testid="add-body-part-btn" onClick={startNew} className="rounded-2xl h-10 px-4 font-nunito font-bold text-white border-0"
          style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}>
          <Plus className="w-4 h-4 mr-1" /> Add body part
        </Button>
      </div>

      {/* Interactive 3D-style body preview — clicking a node opens the editor for that part */}
      <div className="rounded-3xl p-4 mb-6 overflow-hidden" style={{ background: '#0B1B3F', boxShadow: '0 24px 48px -16px rgba(15,23,42,0.4)' }} data-testid="admin-body-preview">
        <div className="grid md:grid-cols-[420px_1fr] gap-4 items-stretch">
          <DraggableBodyEditor
            items={items}
            onSaved={() => { load(); refreshCheckinCtx?.(); }}
            onSelectZone={(bp) => { setHighlighted([bp.slug]); }}
          />
          <div className="text-white px-2">
            <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: '#7FE3FF' }}>Quick edit chips</p>
            <h3 className="font-fredoka text-xl font-semibold mb-2">Drag dots above · click a chip below to edit a zone's data</h3>
            <p className="text-sm font-nunito opacity-70 leading-relaxed mb-3">
              The body editor on the left is interactive — drag any dot onto the right anatomy, then hit Save.
              Patients see your new positions on their next Daily Check-in.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {items.slice(0, 12).map((bp) => (
                <button
                  key={bp.body_part_id}
                  data-testid={`preview-chip-${bp.slug}`}
                  onClick={() => startEdit(bp)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-bold font-nunito transition-all"
                  style={{ background: 'rgba(127,227,255,0.15)', color: '#7FE3FF', border: '1px solid rgba(127,227,255,0.4)' }}>
                  {bp.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((bp) => (
          <motion.div
            key={bp.body_part_id}
            data-testid={`body-part-card-${bp.slug}`}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 bg-white"
            style={{ border: '1px solid #EEF2F7', boxShadow: '0 4px 12px -8px rgba(15,23,42,0.12)' }}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-fredoka font-semibold text-base" style={{ color: BRAND.dark }}>{bp.name}</p>
                <p className="text-[10px] font-mono text-slate-400">{bp.slug} · ({bp.position_x}, {bp.position_y})</p>
              </div>
              <div className="flex items-center gap-1">
                {bp.active ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">ACTIVE</span>
                  : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">HIDDEN</span>}
              </div>
            </div>
            <p className="text-[11px] font-nunito text-slate-500 mb-3 line-clamp-2">
              {(bp.sensations || []).slice(0, 6).join(' · ') || 'No sensations'}
              {(bp.sensations || []).length > 6 ? ` +${bp.sensations.length - 6}` : ''}
            </p>
            <div className="flex gap-2">
              <Button data-testid={`edit-body-part-${bp.slug}`} onClick={() => startEdit(bp)} variant="outline" className="rounded-xl h-8 px-3 text-xs font-bold">
                <Pencil className="w-3 h-3 mr-1" /> Edit
              </Button>
              <Button data-testid={`delete-body-part-${bp.slug}`} onClick={() => remove(bp)} variant="ghost"
                className="rounded-xl h-8 px-3 text-xs font-bold text-red-500 hover:bg-red-50">
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {draft && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.55)' }}>
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="rounded-3xl bg-white p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              style={{ boxShadow: '0 40px 80px -20px rgba(15,23,42,0.35)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-fredoka text-xl font-semibold" style={{ color: BRAND.dark }}>
                  {editing === 'new' ? 'New body part' : 'Edit body part'}
                </h2>
                <button data-testid="close-body-part-dialog" onClick={cancel} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Display name *</label>
                  <Input data-testid="body-part-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: draft.slug || slugify(e.target.value) })} placeholder="e.g. Chest / Heart" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Slug</label>
                  <Input data-testid="body-part-slug" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })} placeholder="auto from name" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pos X (%)</label>
                    <Input data-testid="body-part-x" type="number" value={draft.position_x} onChange={(e) => setDraft({ ...draft, position_x: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pos Y (%)</label>
                    <Input data-testid="body-part-y" type="number" value={draft.position_y} onChange={(e) => setDraft({ ...draft, position_y: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Order</label>
                    <Input data-testid="body-part-order" type="number" value={draft.order} onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sensations (one per line)</label>
                  <Textarea data-testid="body-part-sensations" rows={5} value={(draft.sensations || []).join('\n')}
                    onChange={(e) => setDraft({ ...draft, sensations: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                    placeholder={'Tight chest\nHeart racing\n...'} />
                  <p className="text-[10px] mt-1 text-slate-400">{(draft.sensations || []).length} sensation{(draft.sensations || []).length !== 1 ? 's' : ''}</p>
                </div>

                {/* NEW — Admin question text patients will see in Step 1 prompt */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Question text (patient sees this)</label>
                  <Textarea data-testid="body-part-question" rows={2} value={draft.question_text || ''}
                    onChange={(e) => setDraft({ ...draft, question_text: e.target.value })}
                    placeholder='e.g. "What do you notice in your chest or heart area?"' />
                  <ComplianceBadge text={draft.question_text} />
                </div>

                {/* NEW — Reflection template (Step 4) */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Reflection template (Step 4)</label>
                  <Textarea data-testid="body-part-reflection" rows={3} value={draft.reflection_template || ''}
                    onChange={(e) => setDraft({ ...draft, reflection_template: e.target.value })}
                    placeholder='Use tokens: "Your [sensation] may be telling you about your [emotion]. This connects with [color]."' />
                  <p className="text-[10px] mt-1 text-slate-400">Tokens: <code>[sensation]</code> · <code>[emotion]</code> · <code>[color]</code> · <code>[body_part]</code></p>
                  <ComplianceBadge text={draft.reflection_template} />
                </div>

                {/* NEW — Sensation → Emotion family mapping matrix */}
                <div className="rounded-2xl p-3 border" style={{ borderColor: '#EEF2F7', background: '#FAFBFD' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold" style={{ color: BRAND.dark }}>Sensation → Color/Emotion Family</p>
                    <span className="text-[10px] text-slate-400">{Object.keys(draft.sensation_emotion_map || {}).length} mapped</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">Each sensation a patient checks here will route them to the matching color on the Feelings Wheel.</p>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {(draft.sensations || []).filter(Boolean).map((s) => (
                      <div key={s} className="flex items-center gap-2 rounded-lg p-1.5 bg-white border" style={{ borderColor: '#E2E8F0' }}>
                        <span className="text-xs font-nunito flex-1 truncate" style={{ color: BRAND.dark }}>{s}</span>
                        <select
                          data-testid={`sensation-emotion-${slugify(s)}`}
                          value={draft.sensation_emotion_map?.[s] || ''}
                          onChange={(e) => setDraft({ ...draft, sensation_emotion_map: { ...(draft.sensation_emotion_map || {}), [s]: e.target.value } })}
                          className="rounded-md text-[11px] px-2 py-1 border font-bold"
                          style={{ borderColor: '#E2E8F0', color: emotionColorsFull.find((c) => c.id === draft.sensation_emotion_map?.[s])?.hex || '#64748B' }}>
                          <option value="">— pick color —</option>
                          {emotionColorsFull.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.hex})</option>)}
                        </select>
                      </div>
                    ))}
                    {(!draft.sensations || draft.sensations.filter(Boolean).length === 0) && (
                      <p className="text-[11px] text-slate-400 italic py-2">Add sensations above to bind them to a color.</p>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: '#EEF2F7' }}>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Fallback color (no match)</label>
                    <select
                      data-testid="body-part-default-emotion"
                      value={draft.default_emotion_key || ''}
                      onChange={(e) => setDraft({ ...draft, default_emotion_key: e.target.value })}
                      className="w-full rounded-md text-xs px-2 py-2 border mt-1" style={{ borderColor: '#E2E8F0' }}>
                      <option value="">— pick —</option>
                      {emotionColorsFull.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl p-3" style={{ background: '#F8FAFC' }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: BRAND.dark }}>Visible to patients</p>
                    <p className="text-[11px] text-slate-500">When off, this part is hidden from the patient body map.</p>
                  </div>
                  <Switch data-testid="body-part-active" checked={!!draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
                </div>

                {/* NEW (Phase M) — Multi-question editor */}
                <QuestionsEditor
                  questions={draft.questions || []}
                  onChange={(qs) => setDraft({ ...draft, questions: qs })}
                  accentColor={BRAND.pink}
                  testIdPrefix="bp"
                />

                {saveError && (
                  <div data-testid="body-part-save-error" className="rounded-xl px-3 py-2 text-[11px] font-bold" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                    {saveError}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-5">
                <Button data-testid="save-body-part" onClick={save} disabled={saving || !draft.name}
                  className="rounded-2xl h-11 px-5 font-nunito font-bold text-white border-0 flex-1"
                  style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}>
                  <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving…' : (editing === 'new' ? 'Create' : 'Save changes')}
                </Button>
                <Button onClick={cancel} variant="outline" className="rounded-2xl h-11 px-5 font-bold">Cancel</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────── EMOTION FAMILIES ─────────
const EMPTY_FAMILY = () => ({
  key: '', label: '', color_hex: '#FFD23F', regulation_message: '',
  level2: [{ label: '', level3: [''] }],
  regulation_activities: [{ title: '', steps: [''] }],
  questions: [],
  order: 0, active: true,
});

function EmotionFamiliesTab() {
  const { refresh: refreshCheckinCtx } = useCheckinContent();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = async () => {
    const r = await ax.get(`${API}/admin/checkin/emotion-families`);
    setItems(r.data.families || []);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing('new'); setDraft({ ...EMPTY_FAMILY(), order: items.length }); setSaveError(''); };
  const startEdit = (f) => { setEditing(f.emotion_id); setDraft({ ...f }); setSaveError(''); };
  const cancel = () => { setEditing(null); setDraft(null); setSaveError(''); };

  const save = async () => {
    if (!draft.key || !draft.label) return;
    setSaving(true);
    setSaveError('');
    try {
      // Clean empties
      const cleaned = {
        ...draft,
        key: slugify(draft.key),
        level2: (draft.level2 || []).filter((l) => l.label?.trim()).map((l) => ({ label: l.label.trim(), level3: (l.level3 || []).map((x) => x.trim()).filter(Boolean) })),
        regulation_activities: (draft.regulation_activities || []).filter((a) => a.title?.trim()).map((a) => ({ title: a.title.trim(), steps: (a.steps || []).map((x) => x.trim()).filter(Boolean) })),
      };
      if (editing === 'new') await ax.post(`${API}/admin/checkin/emotion-families`, cleaned);
      else await ax.patch(`${API}/admin/checkin/emotion-families/${editing}`, cleaned);
      await load();
      await refreshCheckinCtx();
      cancel();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.error === 'non_compliant_language') {
        const flat = Object.entries(detail.offending_phrases || {}).map(([k, v]) => `${k}: ${v.join(', ')}`).join(' · ');
        setSaveError(`Diagnostic phrasing blocked → ${flat}`);
      } else {
        setSaveError(typeof detail === 'string' ? detail : 'Could not save.');
      }
    } finally { setSaving(false); }
  };

  const remove = async (f) => {
    if (!window.confirm(`Delete emotion family "${f.label}"?`)) return;
    await ax.delete(`${API}/admin/checkin/emotion-families/${f.emotion_id}`);
    await load();
    await refreshCheckinCtx();
  };

  // Level 2 helpers
  const updateL2 = (idx, patch) => {
    const arr = [...(draft.level2 || [])];
    arr[idx] = { ...arr[idx], ...patch };
    setDraft({ ...draft, level2: arr });
  };
  const addL2 = () => setDraft({ ...draft, level2: [...(draft.level2 || []), { label: '', level3: [''] }] });
  const removeL2 = (idx) => setDraft({ ...draft, level2: draft.level2.filter((_, i) => i !== idx) });

  // Regulation activity helpers
  const updateAct = (idx, patch) => {
    const arr = [...(draft.regulation_activities || [])];
    arr[idx] = { ...arr[idx], ...patch };
    setDraft({ ...draft, regulation_activities: arr });
  };
  const addAct = () => setDraft({ ...draft, regulation_activities: [...(draft.regulation_activities || []), { title: '', steps: [''] }] });
  const removeAct = (idx) => setDraft({ ...draft, regulation_activities: draft.regulation_activities.filter((_, i) => i !== idx) });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-nunito text-slate-500">
          Top-level colors patients see on the Feelings Wheel + their deeper sub-feelings and regulation activities.
        </p>
        <Button data-testid="add-emotion-btn" onClick={startNew} className="rounded-2xl h-10 px-4 font-nunito font-bold text-white border-0"
          style={{ background: 'linear-gradient(135deg, #FFD23F, #FF8C3F)' }}>
          <Plus className="w-4 h-4 mr-1" /> Add emotion family
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {items.map((f) => (
          <motion.div key={f.emotion_id} data-testid={`emotion-card-${f.key}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 bg-white" style={{ border: `1px solid ${f.color_hex}33`, boxShadow: `0 4px 18px -8px ${f.color_hex}44` }}>
            <div className="flex items-start gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ background: f.color_hex, boxShadow: `0 4px 14px -4px ${f.color_hex}88` }} />
              <div className="flex-1">
                <p className="font-fredoka font-semibold text-base" style={{ color: BRAND.dark }}>{f.label}</p>
                <p className="text-[10px] font-mono text-slate-400">{f.key} · {f.color_hex}</p>
                <p className="text-[11px] mt-1 text-slate-500 italic line-clamp-2">{f.regulation_message}</p>
              </div>
              {f.active ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">ACTIVE</span>
                : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">HIDDEN</span>}
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              {(f.level2 || []).length} sub-feeling group(s) · {(f.regulation_activities || []).length} activities
            </p>
            <div className="flex gap-2">
              <Button data-testid={`edit-emotion-${f.key}`} onClick={() => startEdit(f)} variant="outline" className="rounded-xl h-8 px-3 text-xs font-bold">
                <Pencil className="w-3 h-3 mr-1" /> Edit
              </Button>
              <Button data-testid={`delete-emotion-${f.key}`} onClick={() => remove(f)} variant="ghost"
                className="rounded-xl h-8 px-3 text-xs font-bold text-red-500 hover:bg-red-50">
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {draft && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{ background: 'rgba(15,23,42,0.55)' }}>
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="rounded-3xl bg-white p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              style={{ boxShadow: '0 40px 80px -20px rgba(15,23,42,0.35)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-fredoka text-xl font-semibold" style={{ color: BRAND.dark }}>
                  {editing === 'new' ? 'New emotion family' : 'Edit emotion family'}
                </h2>
                <button data-testid="close-emotion-dialog" onClick={cancel} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Key *</label>
                    <Input data-testid="emotion-key" value={draft.key} onChange={(e) => setDraft({ ...draft, key: slugify(e.target.value) })} placeholder="e.g. happy" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Label *</label>
                    <Input data-testid="emotion-label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Happy" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Color hex *</label>
                    <div className="flex gap-2">
                      <Input data-testid="emotion-color" value={draft.color_hex} onChange={(e) => setDraft({ ...draft, color_hex: e.target.value })} />
                      <input data-testid="emotion-color-picker" type="color" value={draft.color_hex} onChange={(e) => setDraft({ ...draft, color_hex: e.target.value })}
                        className="w-12 h-10 rounded-xl cursor-pointer border" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Order</label>
                    <Input data-testid="emotion-order" type="number" value={draft.order} onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Regulation message</label>
                  <Textarea data-testid="emotion-reg-message" rows={2} value={draft.regulation_message}
                    onChange={(e) => setDraft({ ...draft, regulation_message: e.target.value })}
                    placeholder="Your body may be protecting a boundary…" />
                  <ComplianceBadge text={draft.regulation_message} />
                </div>

                {/* Level 2 / Level 3 */}
                <div className="rounded-2xl p-3 border" style={{ borderColor: '#EEF2F7', background: '#FAFBFD' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold" style={{ color: BRAND.dark }}>Sub-feelings (Level 2 → Level 3)</p>
                    <Button data-testid="add-l2" onClick={addL2} variant="outline" className="h-8 px-3 text-xs font-bold rounded-xl">
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                  {(draft.level2 || []).map((l2, i) => (
                    <div key={i} className="rounded-xl p-3 mb-2 bg-white border" style={{ borderColor: '#E2E8F0' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Input data-testid={`l2-label-${i}`} value={l2.label} placeholder="Level 2 label (e.g. Joyful)"
                          onChange={(e) => updateL2(i, { label: e.target.value })} className="flex-1" />
                        <Button onClick={() => removeL2(i)} data-testid={`l2-remove-${i}`} variant="ghost" className="h-8 px-2 text-red-500 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <Textarea data-testid={`l2-l3-${i}`} rows={2} value={(l2.level3 || []).join('\n')}
                        onChange={(e) => updateL2(i, { level3: e.target.value.split('\n') })}
                        placeholder="Level 3 — one per line (e.g. Playful, Content)" />
                    </div>
                  ))}
                </div>

                {/* Regulation activities */}
                <div className="rounded-2xl p-3 border" style={{ borderColor: '#EEF2F7', background: '#FAFBFD' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold" style={{ color: BRAND.dark }}>Regulation activities (60-sec steps)</p>
                    <Button data-testid="add-activity" onClick={addAct} variant="outline" className="h-8 px-3 text-xs font-bold rounded-xl">
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                  {(draft.regulation_activities || []).map((a, i) => (
                    <div key={i} className="rounded-xl p-3 mb-2 bg-white border" style={{ borderColor: '#E2E8F0' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Input data-testid={`activity-title-${i}`} value={a.title} placeholder="Activity title (e.g. Cool Down Breathing)"
                          onChange={(e) => updateAct(i, { title: e.target.value })} className="flex-1" />
                        <Button onClick={() => removeAct(i)} data-testid={`activity-remove-${i}`} variant="ghost" className="h-8 px-2 text-red-500 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <Textarea data-testid={`activity-steps-${i}`} rows={4} value={(a.steps || []).join('\n')}
                        onChange={(e) => updateAct(i, { steps: e.target.value.split('\n') })}
                        placeholder="Step 1: Breathe in slowly...\nStep 2: Hold gently...\nStep 3: Breathe out softly" />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between rounded-xl p-3" style={{ background: '#F8FAFC' }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: BRAND.dark }}>Visible to patients</p>
                    <p className="text-[11px] text-slate-500">When off, this color is hidden from the Feelings Wheel.</p>
                  </div>
                  <Switch data-testid="emotion-active" checked={!!draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
                </div>

                {/* NEW (Phase M) — Multi-question editor */}
                <QuestionsEditor
                  questions={draft.questions || []}
                  onChange={(qs) => setDraft({ ...draft, questions: qs })}
                  accentColor={draft.color_hex || '#FFD23F'}
                  testIdPrefix="emo"
                />

                {saveError && (
                  <div data-testid="emotion-save-error" className="rounded-xl px-3 py-2 text-[11px] font-bold" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                    {saveError}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-5">
                <Button data-testid="save-emotion" onClick={save} disabled={saving || !draft.key || !draft.label}
                  className="rounded-2xl h-11 px-5 font-nunito font-bold text-white border-0 flex-1"
                  style={{ background: 'linear-gradient(135deg, #FFD23F, #FF8C3F)' }}>
                  <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving…' : (editing === 'new' ? 'Create' : 'Save changes')}
                </Button>
                <Button onClick={cancel} variant="outline" className="rounded-2xl h-11 px-5 font-bold">Cancel</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────── REGULATION STEPS (per-emotion shortcut view) ─────────
function RegulationStepsTab() {
  const [items, setItems] = useState([]);
  useEffect(() => { ax.get(`${API}/admin/checkin/emotion-families`).then((r) => setItems(r.data.families || [])); }, []);
  return (
    <div>
      <p className="text-sm font-nunito text-slate-500 mb-4">
        Read-only summary of every regulation step grouped by emotion family. Manage them inside each family on the <b>Emotion Families</b> tab.
      </p>
      <div className="space-y-4">
        {items.map((f) => (
          <div key={f.emotion_id} className="rounded-2xl p-4 bg-white" style={{ border: `1px solid ${f.color_hex}33`, boxShadow: `0 4px 18px -8px ${f.color_hex}33` }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-7 h-7 rounded-lg" style={{ background: f.color_hex }} />
              <p className="font-fredoka font-semibold" style={{ color: BRAND.dark }}>{f.label}</p>
              <span className="text-[10px] text-slate-400 font-mono">{(f.regulation_activities || []).length} activities</span>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {(f.regulation_activities || []).map((a, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: `${f.color_hex}0A` }}>
                  <p className="text-sm font-bold mb-1.5" style={{ color: f.color_hex }}>{a.title}</p>
                  <ol className="text-[11px] text-slate-600 space-y-1 list-decimal pl-4">
                    {(a.steps || []).map((s, j) => <li key={j}>{s}</li>)}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────── MAIN ─────────
export default function CheckinConfigPage() {
  const [tab, setTab] = useState('body');
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.pink }}>Configure</p>
          <h1 className="font-fredoka font-semibold text-2xl" style={{ color: BRAND.dark }}>Check-in Content</h1>
          <p className="text-sm text-slate-500 mt-1">Manage what patients see on the 9-step Daily Check-in and Assessment body map.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b" style={{ borderColor: '#E2E8F0' }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} data-testid={`checkin-tab-${t.id}`} onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2.5 font-bold text-sm transition-all"
              style={{
                color: active ? t.color : '#64748B',
                borderBottom: `2px solid ${active ? t.color : 'transparent'}`,
              }}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'body' && <BodyPartsTab />}
      {tab === 'emotions' && <EmotionFamiliesTab />}
      {tab === 'regulation' && <RegulationStepsTab />}
      {tab === 'preview' && <PreviewTab />}
    </div>
  );
}
