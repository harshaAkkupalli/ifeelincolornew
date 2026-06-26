import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Calendar, ClipboardList, Heart, Sparkles, Download, Send,
  FileText, Loader2, ChevronDown, ChevronUp, Activity, Video, Link2,
  ListChecks, Image as ImageIcon, X, Plus, Stethoscope, Crown,
} from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { generateHealthDossier } from '../../lib/healthDossierPdf';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SEV_COLOR = { critical: '#FF3B30', high: '#FF8C3F', moderate: '#FFD23F', low: '#22D67E' };
const TYPE_META = {
  checkin:        { color: '#FF4FBF', icon: Heart, label: 'Daily Check-in' },
  assessment:     { color: '#A78BFA', icon: ClipboardList, label: 'Assessment' },
  recommendation: { color: '#22D3C5', icon: Sparkles, label: 'Recommendation' },
};

const CONTENT_TYPES = [
  { value: 'text', label: 'Text body', icon: FileText },
  { value: 'video', label: 'Video link', icon: Video },
  { value: 'image', label: 'Image', icon: ImageIcon },
  { value: 'steps', label: 'Step list', icon: ListChecks },
  { value: 'link', label: 'External link', icon: Link2 },
];

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtDateShort(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminPatientRoadmap() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { admin } = useAdminAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openEvent, setOpenEvent] = useState(null);
  const [showRecModal, setShowRecModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recList, setRecList] = useState([]);
  const bodyMapRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/patient/${id}/full-history`, { credentials: 'include' });
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      setData(j);
    } catch (e) {
      setData({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const loadRecLibrary = async () => {
    try {
      const r = await fetch(`${API}/admin/recommendations`, { credentials: 'include' });
      if (r.ok) {
        const j = await r.json();
        setRecList(j.recommendations || j || []);
      }
    } catch {}
  };

  useEffect(() => { load(); loadRecLibrary(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const patient = data?.patient;
  const timeline = data?.timeline || [];
  const counts = data?.counts || {};
  const sub = data?.subscription;

  const checkins = useMemo(() => timeline.filter(e => e.type === 'checkin').map(e => e.raw), [timeline]);
  const recommendations = useMemo(() => timeline.filter(e => e.type === 'recommendation'), [timeline]);
  const assessments = useMemo(() => timeline.filter(e => e.type === 'assessment'), [timeline]);

  const exportPdf = async () => {
    if (!patient || exporting) return;
    setExporting(true);
    try {
      await generateHealthDossier({
        patient: {
          name: patient.name,
          email: patient.email,
          role: patient.role,
          joinedAt: patient.created_at,
        },
        checkins,
        recommendations: recommendations.map(r => ({
          title: r.title,
          description: r.description,
          body_md: r.body_md,
          source: r.source,
          content_type: r.content_type,
        })),
        assessments: assessments.map(a => a.raw || a),
        bodyMapEl: bodyMapRef.current,
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="px-6 py-10 flex flex-col items-center text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <p className="text-sm font-nunito">Loading patient roadmap…</p>
      </div>
    );
  }
  if (!patient) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm text-red-500 font-nunito">{data?.error || 'Patient not found'}</p>
        <Button onClick={() => navigate('/admin/patients')} className="mt-3 rounded-xl text-xs">Back to Patients</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto" data-testid="admin-patient-roadmap">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/admin/patients')} className="flex items-center gap-1 text-xs font-nunito text-slate-500 hover:text-slate-700"
          data-testid="admin-roadmap-back">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowRecModal(true)}
            data-testid="admin-send-rec-btn"
            className="rounded-xl h-9 px-3 text-xs font-bold border-0 text-white"
            style={{ background: 'linear-gradient(135deg, #FF4FBF, #A78BFA)' }}
          >
            <Send className="w-3.5 h-3.5 mr-1" /> Send Recommendation
          </Button>
          <Button
            onClick={exportPdf}
            disabled={exporting}
            data-testid="admin-export-pdf-btn"
            className="rounded-xl h-9 px-3 text-xs font-bold border-0 text-white"
            style={{ background: 'linear-gradient(135deg, #22D3C5, #60A5FA)' }}
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
            PDF
          </Button>
        </div>
      </div>

      {/* Patient summary card */}
      <div className="rounded-2xl p-5 mb-5"
        style={{ background: 'linear-gradient(135deg, #FF4FBF15, #A78BFA15, #22D3C515)', border: '1px solid rgba(167,139,250,0.18)' }}>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF4FBF, #A78BFA)' }}>
            {(patient.name || patient.email || 'P').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-fredoka font-semibold text-xl text-slate-900">{patient.name || '—'}</h1>
            <p className="text-xs text-slate-500 font-nunito">{patient.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] font-nunito">
              <span className="px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                <Calendar className="w-3 h-3 inline mr-1" /> Joined {fmtDateShort(patient.created_at)}
              </span>
              {sub?.status && (
                <span className="px-2 py-0.5 rounded-full text-white font-bold"
                  style={{ background: sub.status === 'active' ? '#22D67E' : '#FF8C3F' }}>
                  <Crown className="w-3 h-3 inline mr-1" /> {sub.plan_type || 'plan'} · {sub.status}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                {counts.checkins || 0} check-ins
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                {counts.assessments || 0} assessments
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                {counts.recommendations_given || 0} recs given
              </span>
            </div>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <StatTile label="Check-ins" value={counts.checkins || 0} color="#FF4FBF" />
          <StatTile label="Assessments" value={counts.assessments || 0} color="#A78BFA" />
          <StatTile label="Recs given" value={counts.recommendations_given || 0} color="#22D3C5" />
        </div>
      </div>

      {/* Tabs */}
      <RoadmapTimeline
        timeline={timeline}
        openEvent={openEvent}
        setOpenEvent={setOpenEvent}
        joinedAt={patient.created_at}
      />

      {/* Send-rec modal */}
      <AnimatePresence>
        {showRecModal && (
          <SendRecModal
            patient={patient}
            recList={recList}
            adminName={admin?.name || admin?.email || 'Admin'}
            onClose={() => setShowRecModal(false)}
            onSent={() => { setShowRecModal(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatTile({ label, value, color }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: `${color}1f`, border: `1px solid ${color}33` }}>
      <div className="text-2xl font-fredoka font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] font-nunito uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function RoadmapTimeline({ timeline, openEvent, setOpenEvent, joinedAt }) {
  const items = [
    {
      event_id: '__signup__',
      type: 'signup',
      title: 'Patient signed up',
      date: joinedAt,
    },
    ...timeline,
  ];
  return (
    <div className="relative pl-6" data-testid="admin-roadmap-timeline">
      {/* vertical line */}
      <div className="absolute left-2 top-2 bottom-2 w-0.5"
        style={{ background: 'linear-gradient(180deg, #FF4FBF, #A78BFA, #22D3C5)' }} />
      <ul className="space-y-3">
        {items.map((e) => {
          const meta = TYPE_META[e.type] || { color: '#94A3B8', icon: Activity, label: 'Event' };
          const Icon = e.type === 'signup' ? Sparkles : meta.icon;
          const color = e.type === 'signup' ? '#FFD23F' : meta.color;
          const isOpen = openEvent === e.event_id;
          return (
            <li key={e.event_id} className="relative" data-testid={`timeline-item-${e.type}-${e.event_id}`}>
              <span className="absolute -left-[18px] top-3 w-4 h-4 rounded-full border-2 border-white"
                style={{ background: color, boxShadow: `0 0 8px ${color}aa` }} />
              <div className="rounded-2xl bg-white p-3 border"
                style={{ borderColor: `${color}33`, boxShadow: '0 6px 18px -10px rgba(31,17,71,0.18)' }}>
                <button
                  onClick={() => setOpenEvent(isOpen ? null : e.event_id)}
                  className="w-full text-left flex items-start gap-3"
                  data-testid={`timeline-toggle-${e.event_id}`}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${color}1f`, color }}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-fredoka font-semibold text-sm text-slate-900 truncate">{e.title}</p>
                      {e.type === 'recommendation' && e.raw?.auto_assigned && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase text-white"
                          style={{ background: 'linear-gradient(135deg, #22D3C5, #60A5FA)' }}
                          title="Automatically assigned based on the patient's color or severity"
                          data-testid="rec-auto-badge">AUTO</span>
                      )}
                      {e.type === 'recommendation' && e.from_admin && e.trigger === 'manual' && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase text-white"
                          style={{ background: 'linear-gradient(135deg, #FF4FBF, #A78BFA)' }}
                          data-testid="rec-manual-badge">MANUAL</span>
                      )}
                      {e.severity && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase text-white"
                          style={{ background: SEV_COLOR[e.severity] || '#94A3B8' }}>{e.severity}</span>
                      )}
                      {e.color && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase"
                          style={{ background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>{e.color}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-nunito mt-0.5">{fmtDate(e.date)}</p>
                  </div>
                  {e.type !== 'signup' && (isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />)}
                </button>
                <AnimatePresence>
                  {isOpen && e.type !== 'signup' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden">
                      <div className="pt-3 mt-3 border-t border-slate-100 text-xs font-nunito text-slate-700 space-y-2">
                        {e.type === 'checkin' && (
                          <CheckinDetail e={e} />
                        )}
                        {e.type === 'assessment' && (
                          <AssessmentDetail e={e} />
                        )}
                        {e.type === 'recommendation' && (
                          <RecDetail e={e} />
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function KV({ k, v }) {
  if (v === undefined || v === null || v === '') return null;
  return (
    <div className="flex gap-2"><span className="text-slate-400 w-28 shrink-0">{k}</span><span className="text-slate-700 flex-1 break-words">{String(v)}</span></div>
  );
}

// Old check-ins were saved with a grammatically-broken template
// ("Your <body> feeling <Tight shoulders> may be telling you something about
// your <grateful>."). If we detect that legacy pattern, regenerate a clean,
// emotion-linking sentence on the fly from the structured fields so clinicians
// always see a sentence that makes sense.
const LEGACY_REFLECTION_RX = /\bmay be telling you (?:something about your|that you are feeling|about your)\b/i;
function renderReflection(e) {
  const raw = e.reflection;
  if (!raw) return null;
  if (!LEGACY_REFLECTION_RX.test(raw)) return raw;
  const sensation = (e.sensation || 'sensation').toString().toLowerCase().trim();
  const bodyPart = (e.body_part || 'body').toString().toLowerCase().trim();
  const emotion = (e.emotion || '').toString().toLowerCase().trim();
  if (!emotion) return raw;
  return `The ${sensation} in your ${bodyPart} often shows up when you're feeling ${emotion}. Your body is sharing something — pause and listen with kindness.`;
}

function CheckinDetail({ e }) {
  const reflection = renderReflection(e);
  return (
    <>
      <KV k="Body part" v={e.body_part} />
      <KV k="Sensation" v={e.sensation} />
      <KV k="Emotion" v={e.emotion} />
      <KV k="Color (start)" v={e.color} />
      <KV k="Color (end)" v={e.ending_color} />
      <KV k="Intensity" v={`${e.intensity_before ?? '—'} → ${e.intensity_after ?? '—'}`} />
      {reflection && (
        <div className="mt-1 italic text-slate-600 bg-slate-50 rounded-lg p-2" data-testid="checkin-reflection">"{reflection}"</div>
      )}
    </>
  );
}

function AssessmentDetail({ e }) {
  const ans = e.answers || {};
  const keys = Object.keys(ans);
  return (
    <>
      {e.severity && <KV k="Severity" v={e.severity} />}
      {e.ai_plan && (
        <div className="rounded-lg p-2 bg-violet-50 text-violet-800 border border-violet-100">
          <p className="text-[10px] uppercase tracking-wider font-bold mb-0.5">AI plan</p>
          {typeof e.ai_plan === 'string' ? (
            <p className="leading-snug">{e.ai_plan}</p>
          ) : (
            <>
              {e.ai_plan.summary && <p className="leading-snug">{String(e.ai_plan.summary)}</p>}
              {Array.isArray(e.ai_plan.next_steps) && e.ai_plan.next_steps.length > 0 && (
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  {e.ai_plan.next_steps.map((s, i) => (<li key={i}>{String(s)}</li>))}
                </ul>
              )}
              {e.ai_plan.encouragement && (
                <p className="mt-1 italic opacity-80">{String(e.ai_plan.encouragement)}</p>
              )}
            </>
          )}
        </div>
      )}
      {keys.length > 0 && (
        <details className="mt-1" data-testid="assessment-answers-toggle">
          <summary className="cursor-pointer text-[11px] font-bold text-slate-500 hover:text-slate-700">
            {keys.length} answer{keys.length !== 1 ? 's' : ''} — tap to expand
          </summary>
          <div className="mt-2 space-y-1.5">
            {keys.map((k) => (
              <KV key={k} k={k} v={typeof ans[k] === 'string' ? ans[k] : JSON.stringify(ans[k])} />
            ))}
          </div>
        </details>
      )}
      {Array.isArray(e.recommendations) && e.recommendations.length > 0 && (
        <div className="rounded-lg p-2 bg-emerald-50 text-emerald-800 border border-emerald-100">
          <p className="text-[10px] uppercase tracking-wider font-bold mb-1">Auto recommendations</p>
          <ul className="list-disc list-inside space-y-0.5">
            {e.recommendations.slice(0, 5).map((r, i) => (
              <li key={i}>{r.title || r}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function RecDetail({ e }) {
  return (
    <>
      <KV k="Source" v={(e.from_admin ? 'Admin' : e.from_clinician ? `Clinician${e.clinician_name ? ` (${e.clinician_name})` : ''}` : e.source) || '—'} />
      <KV k="Type" v={e.content_type} />
      {e.body_md && <div className="bg-slate-50 rounded-lg p-2 whitespace-pre-line">{e.body_md.slice(0, 600)}</div>}
      {e.description && !e.body_md && <p>{e.description.slice(0, 400)}</p>}
      {e.media_url && (
        <a href={e.media_url} target="_blank" rel="noopener noreferrer" className="text-violet-600 underline text-xs">{e.media_url}</a>
      )}
      {e.image_url && (
        <img src={e.image_url} alt="" className="mt-1 rounded-lg max-h-40 object-cover" />
      )}
    </>
  );
}

function SendRecModal({ patient, recList, onClose, onSent }) {
  const [mode, setMode] = useState('library'); // 'library' | 'manual'
  const [selectedId, setSelectedId] = useState('');
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState('text');
  const [bodyMd, setBodyMd] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    setSending(true);
    setErr('');
    try {
      const payload = mode === 'library'
        ? { recommendation_id: selectedId }
        : {
            title,
            body_md: bodyMd,
            content_type: contentType,
            media_url: mediaUrl,
            image_url: imageUrl,
            steps: stepsText.split('\n').map(s => s.trim()).filter(Boolean),
          };
      const r = await fetch(`${API}/admin/patient/${patient.user_id}/recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || `HTTP ${r.status}`);
      }
      onSent();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSending(false);
    }
  };

  const canSend = mode === 'library' ? !!selectedId : (title.trim() && (bodyMd.trim() || mediaUrl.trim() || imageUrl.trim() || stepsText.trim()));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="send-rec-modal"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-md max-h-[88vh] overflow-y-auto shadow-2xl"
      >
        <div className="sticky top-0 bg-white p-4 border-b flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-pink-500">Send to</p>
            <h3 className="font-fredoka font-semibold text-base text-slate-900">{patient.name || patient.email}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" data-testid="send-rec-close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Mode tabs */}
          <div className="flex gap-2 p-1 rounded-xl bg-slate-100">
            <button
              onClick={() => setMode('library')}
              data-testid="rec-mode-library"
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${mode === 'library' ? 'bg-white shadow-sm text-violet-600' : 'text-slate-500'}`}
            >
              From library
            </button>
            <button
              onClick={() => setMode('manual')}
              data-testid="rec-mode-manual"
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${mode === 'manual' ? 'bg-white shadow-sm text-violet-600' : 'text-slate-500'}`}
            >
              Custom
            </button>
          </div>

          {mode === 'library' && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600">Select a recommendation</p>
              {recList.length === 0 ? (
                <p className="text-xs text-slate-400">No saved recommendations yet — switch to <strong>Custom</strong> to send one inline, or create entries in the Recommendations page.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-1.5">
                  {recList.map((r) => (
                    <label key={r.recommendation_id}
                      className={`flex items-start gap-2 p-2.5 rounded-xl cursor-pointer border ${selectedId === r.recommendation_id ? 'border-violet-400 bg-violet-50' : 'border-slate-200'}`}
                      data-testid={`rec-library-${r.recommendation_id}`}>
                      <input type="radio" checked={selectedId === r.recommendation_id} onChange={() => setSelectedId(r.recommendation_id)} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-slate-900">{r.title}</p>
                        {r.body_md && <p className="text-[11px] text-slate-500 line-clamp-2">{r.body_md.slice(0, 120)}</p>}
                        {Array.isArray(r.trigger_colors) && r.trigger_colors.length > 0 && (
                          <p className="text-[10px] text-slate-400 mt-0.5">Auto for: {r.trigger_colors.join(', ')}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'manual' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Title *</label>
                <Input data-testid="rec-title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Box-breathing reset" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Content type</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {CONTENT_TYPES.map((t) => (
                    <button key={t.value} type="button"
                      data-testid={`rec-ctype-${t.value}`}
                      onClick={() => setContentType(t.value)}
                      className={`rounded-lg p-2 flex flex-col items-center gap-1 text-[9px] font-bold transition ${contentType === t.value ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                      <t.icon className="w-3.5 h-3.5" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Body / instructions</label>
                <Textarea data-testid="rec-body-input" value={bodyMd} onChange={(e) => setBodyMd(e.target.value)} rows={4} placeholder="What should the patient do?" />
              </div>
              {(contentType === 'video' || contentType === 'link') && (
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">URL</label>
                  <Input data-testid="rec-media-input" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." />
                </div>
              )}
              {contentType === 'image' && (
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Image URL</label>
                  <Input data-testid="rec-image-input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
                </div>
              )}
              {contentType === 'steps' && (
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Steps (one per line)</label>
                  <Textarea data-testid="rec-steps-input" value={stepsText} onChange={(e) => setStepsText(e.target.value)} rows={4} placeholder={`1. Sit comfortably\n2. Inhale 4 counts\n3. Hold 4 counts`} />
                </div>
              )}
            </div>
          )}

          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        <div className="sticky bottom-0 bg-white p-4 border-t flex gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl text-xs flex-1">Cancel</Button>
          <Button onClick={send} disabled={!canSend || sending}
            data-testid="rec-send-confirm"
            className="rounded-xl text-xs flex-1 text-white border-0"
            style={{ background: 'linear-gradient(135deg, #FF4FBF, #A78BFA)' }}>
            {sending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
            Send
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
