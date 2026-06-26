/**
 * Clinician → Patient History (rebuilt 2026-06-04)
 *
 * Unified profile page for any patient subscribed to the calling clinician.
 * Replaces the older "3D History" experience with a clean tabbed layout
 * matching the rest of the IFEELINCOLOR clinician portal:
 *
 *   ┌─ Header card (avatar, name, contact, plan, last check-in)
 *   ├─ Quick actions (Send rec, AI follow-up, Roadmap, PDF dossier)
 *   └─ Tabs: Overview · Check-ins · Assessments · Recommendations · Timeline
 *
 * All data comes from existing endpoints — no new backend calls.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, Activity, ClipboardList, Sparkles, FileDown,
  Loader2, AlertCircle, Send, MessageCircle, Map, Heart, BookOpen,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TABS = [
  { id: 'overview',        label: 'Overview',         icon: Activity },
  { id: 'checkins',        label: 'Check-ins',        icon: Heart },
  { id: 'assessments',     label: 'Assessments',      icon: ClipboardList },
  { id: 'recommendations', label: 'Recommendations',  icon: BookOpen },
  { id: 'timeline',        label: 'Timeline',         icon: Map },
];

const COLOR_HEX = {
  Red: '#FF3B30', Orange: '#FF7A00', Yellow: '#FFD23F',
  Green: '#22D67E', Blue: '#60A5FA', Purple: '#7C3AED',
  Grey: '#94A3B8', Gray: '#94A3B8', Pink: '#FF4FBF',
};
const colorOf = (n) => COLOR_HEX[(n || '').trim()] || '#7C5BFF';
const fmtDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return d; } };

export default function ClinicianPatientHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [given, setGiven] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [eligibility, setEligibility] = useState({ can_recommend: false });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showRecModal, setShowRecModal] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2800); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pl, c, a, g, full, can] = await Promise.all([
        axios.get(`${API}/clinician/patients`, { withCredentials: true }).catch(() => ({ data: { patients: [] } })),
        axios.get(`${API}/clinician/patient/${id}/checkins`, { withCredentials: true }).catch(() => ({ data: { checkins: [] } })),
        axios.get(`${API}/clinician/patient/${id}/assessments`, { withCredentials: true }).catch(() => ({ data: { assessments: [] } })),
        axios.get(`${API}/clinician/recommendations-given`, { withCredentials: true }).catch(() => ({ data: { recommendations: [] } })),
        axios.get(`${API}/clinician/patient/${id}/full-history`, { withCredentials: true }).catch(() => ({ data: { timeline: [] } })),
        axios.get(`${API}/clinician/patient/${id}/can-recommend`, { withCredentials: true }).catch(() => ({ data: { can_recommend: false } })),
      ]);
      const found = (pl.data?.patients || []).find((p) => p.user_id === id);
      setPatient(found || null);
      setCheckins(c.data?.checkins || []);
      setAssessments(a.data?.assessments || []);
      // /recommendations-given returns ALL recs by this clinician — filter to this patient.
      const allRecs = g.data?.recommendations || g.data?.items || [];
      setGiven(allRecs.filter((r) => r.user_id === id || r.patient_id === id));
      setTimeline(full.data?.timeline || []);
      setEligibility(can.data || { can_recommend: false });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  // Auto-refresh every 15 s so new check-ins / assessments appear without
  // a manual reload (user directive 2026-06-04).
  useEffect(() => {
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [load]);

  const latestCheckin = checkins[0] || timeline.find(t => t.type === 'checkin');
  const latestAssessment = assessments[0];

  const stats = useMemo(() => ({
    checkin_count: checkins.length,
    assessment_count: assessments.length,
    recs_sent: given.length,
    last_emotion: latestCheckin?.user_selected_emotion,
    last_color: latestCheckin?.user_selected_color,
    severity: latestAssessment?.severity,
  }), [checkins, assessments, given, latestCheckin, latestAssessment]);

  if (loading && !patient) {
    return (
      <div className="px-5 pt-12 text-center" data-testid="clin-history-loading">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
        <p className="mt-3 text-sm text-slate-500 font-nunito">Loading patient history…</p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 pt-4 pb-12 max-w-5xl mx-auto" data-testid="clin-history-page">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-sm font-bold shadow-xl">
          {toast}
        </div>
      )}

      <button
        data-testid="clin-history-back"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-slate-500 font-nunito mb-3 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-5 md:p-6 mb-5 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2FA37A 0%, #1F6F54 100%)', boxShadow: '0 20px 50px -16px rgba(31,111,84,0.45)' }}
      >
        <div className="flex items-start gap-4 relative">
          <div
            className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-fredoka font-bold shrink-0"
            style={{ background: 'rgba(255,255,255,0.18)' }}
          >
            {(patient?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-50/80">Patient profile</p>
            <h1 className="font-fredoka font-bold text-2xl md:text-3xl text-white truncate" data-testid="clin-history-name">
              {patient?.name || 'Patient'}
            </h1>
            <div className="flex flex-wrap gap-3 mt-2 text-xs font-nunito text-emerald-50/90">
              {patient?.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {patient.email}</span>}
              {(patient?.phone || patient?.mobile) && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {patient.phone || patient.mobile}</span>}
              {stats.severity && (
                <span className="px-2 py-0.5 rounded-full font-bold text-[10px] uppercase"
                  style={{ background: { critical: '#FF3B30', high: '#FF8C3F', moderate: '#FFD23F', low: '#22D67E' }[String(stats.severity).toLowerCase()] || '#94A3B8', color: '#0A1B30' }}>
                  Severity: {stats.severity}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <Stat label="Check-ins" value={stats.checkin_count} icon={Heart} />
          <Stat label="Assessments" value={stats.assessment_count} icon={ClipboardList} />
          <Stat label="Recommendations sent" value={stats.recs_sent} icon={BookOpen} />
          <Stat
            label="Last mood"
            value={stats.last_emotion || '—'}
            icon={Activity}
            tone={stats.last_color ? colorOf(stats.last_color) : null}
          />
        </div>
      </motion.div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        <ActionBtn
          testid="open-rec-modal"
          disabled={!eligibility.can_recommend}
          label="Send rec"
          icon={Send}
          color="#2FA37A"
          onClick={() => setShowRecModal(true)}
          tooltip={!eligibility.can_recommend ? 'Patient must complete first assessment' : 'Send a custom recommendation'}
        />
        <ActionBtn
          testid="open-follow-up-modal"
          disabled={!eligibility.can_recommend}
          label="Follow-up"
          icon={MessageCircle}
          color="#A855F7"
          onClick={() => setShowFollowUp(true)}
          tooltip="AI-drafted humanised follow-up message"
        />
        <ActionBtn
          testid="open-roadmap"
          label="Roadmap"
          icon={Map}
          color="#22D3C5"
          onClick={() => navigate(`/clinician/patient/${id}/roadmap`)}
        />
        <ActionBtn
          testid="open-ai-coach"
          label="AI Coach"
          icon={Sparkles}
          color="#FB923C"
          onClick={() => navigate(`/clinician/ai-coach?patient_id=${id}`)}
        />
      </div>

      {!eligibility.can_recommend && (
        <div className="mb-4 rounded-2xl p-3 text-xs font-nunito flex items-center gap-2"
          style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}
          data-testid="assessment-gate-banner">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            Recommendations and follow-ups are locked until <strong>{patient?.name?.split(' ')[0] || 'this patient'}</strong> completes at least one assessment or check-in.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto mb-4 scrollbar-none">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              data-testid={`clin-history-tab-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold font-nunito flex items-center gap-1.5 transition"
              style={{
                background: active ? 'linear-gradient(135deg, #2FA37A, #1F6F54)' : 'white',
                color: active ? 'white' : '#475569',
                boxShadow: active ? '0 8px 18px -8px rgba(31,111,84,0.5)' : '0 4px 12px -8px rgba(0,0,0,0.1)',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="space-y-3" data-testid={`clin-history-panel-${activeTab}`}>
        {activeTab === 'overview' && (
          <OverviewPanel
            patient={patient}
            latestCheckin={latestCheckin}
            latestAssessment={latestAssessment}
            recentRecs={given.slice(0, 3)}
          />
        )}
        {activeTab === 'checkins' && (
          <CheckinList items={checkins} />
        )}
        {activeTab === 'assessments' && (
          <AssessmentList items={assessments} />
        )}
        {activeTab === 'recommendations' && (
          <RecsList items={given} />
        )}
        {activeTab === 'timeline' && (
          <TimelinePanel items={timeline} />
        )}
      </div>

      {/* Send recommendation modal */}
      {showRecModal && (
        <RecommendationModal
          patient={patient}
          patientId={id}
          onClose={() => setShowRecModal(false)}
          onSent={() => { setShowRecModal(false); showToast('Recommendation sent'); load(); }}
        />
      )}
      {/* AI follow-up modal */}
      {showFollowUp && (
        <FollowUpModal
          patient={patient}
          patientId={id}
          onClose={() => setShowFollowUp(false)}
          onSent={() => { setShowFollowUp(false); showToast('Follow-up sent'); load(); }}
        />
      )}
    </div>
  );
}

// ── Helpers / sub-components ────────────────────────────────────────────

function Stat({ label, value, icon: Icon, tone }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.22)' }}>
      <Icon className="w-3.5 h-3.5 mb-1 text-white/80" />
      <p className="text-[10px] uppercase tracking-wider font-bold text-white/70">{label}</p>
      <p className="font-fredoka font-bold text-base text-white truncate" style={{ color: tone || 'white' }}>{value ?? '—'}</p>
    </div>
  );
}

function ActionBtn({ label, icon: Icon, color, onClick, disabled, testid, tooltip }) {
  return (
    <button
      title={tooltip}
      data-testid={testid}
      onClick={onClick}
      disabled={disabled}
      className="rounded-2xl px-3 py-3 text-xs font-bold font-nunito flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: disabled ? '#E2E8F0' : `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: disabled ? '#94A3B8' : 'white',
        boxShadow: disabled ? 'none' : `0 10px 20px -10px ${color}80`,
      }}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function OverviewPanel({ patient, latestCheckin, latestAssessment, recentRecs }) {
  return (
    <>
      <Card title="Last check-in">
        {latestCheckin ? (
          <div className="space-y-1 text-xs">
            <p><strong>Emotion:</strong> {latestCheckin.user_selected_emotion || '—'}</p>
            <p><strong>Colour:</strong> <span style={{ color: colorOf(latestCheckin.user_selected_color), fontWeight: 700 }}>{latestCheckin.user_selected_color || '—'}</span></p>
            {latestCheckin.intensity_rating_before != null && (
              <p><strong>Intensity:</strong> {latestCheckin.intensity_rating_before} → {latestCheckin.intensity_rating_after}</p>
            )}
            <p className="text-slate-400">{fmtDate(latestCheckin.created_at || latestCheckin.date)}</p>
          </div>
        ) : <Empty>No check-ins yet.</Empty>}
      </Card>
      <Card title="Last assessment">
        {latestAssessment ? (
          <div className="space-y-1 text-xs">
            <p><strong>Severity:</strong> {latestAssessment.severity || '—'}</p>
            <p><strong>Score:</strong> {latestAssessment.score ?? '—'}</p>
            <p className="text-slate-400">{fmtDate(latestAssessment.submitted_at)}</p>
          </div>
        ) : <Empty>No assessments completed yet.</Empty>}
      </Card>
      <Card title="Recent recommendations">
        {recentRecs.length === 0 ? <Empty>No recommendations sent yet.</Empty> : (
          <ul className="space-y-2">
            {recentRecs.map((r) => (
              <li key={r.activity_id} className="rounded-xl p-2 bg-slate-50 text-xs">
                <p className="font-bold text-slate-900">{r.title}</p>
                <p className="text-slate-500">{fmtDate(r.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl p-4 bg-white" style={{ boxShadow: '0 8px 22px -12px rgba(0,0,0,0.1)' }}>
      <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: '#2FA37A' }}>{title}</p>
      {children}
    </div>
  );
}
function Empty({ children }) {
  return <p className="text-xs text-slate-400 italic">{children}</p>;
}

function CheckinList({ items }) {
  if (items.length === 0) return <Card title="Check-ins"><Empty>No check-ins recorded yet.</Empty></Card>;
  return (
    <>
      {items.map((c) => (
        <div key={c.checkin_id || c.created_at} className="rounded-2xl p-3 bg-white"
          style={{ boxShadow: '0 6px 18px -12px rgba(0,0,0,0.1)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorOf(c.user_selected_color) }} />
              <span className="text-sm font-bold text-slate-900">{c.user_selected_emotion || '—'}</span>
            </div>
            <span className="text-[10px] text-slate-400">{fmtDate(c.created_at)}</span>
          </div>
          {(c.intensity_rating_before != null) && (
            <p className="text-xs text-slate-500 mt-1">Intensity {c.intensity_rating_before} → {c.intensity_rating_after} · Body: {c.starting_body_part || '—'}</p>
          )}
          {c.note && <p className="text-xs italic text-slate-600 mt-1">"{c.note}"</p>}
        </div>
      ))}
    </>
  );
}

function AssessmentList({ items }) {
  if (items.length === 0) return <Card title="Assessments"><Empty>No assessments completed yet.</Empty></Card>;
  return (
    <>
      {items.map((a, i) => (
        <details key={i} className="rounded-2xl bg-white p-3"
          style={{ boxShadow: '0 6px 18px -12px rgba(0,0,0,0.1)' }}>
          <summary className="cursor-pointer flex items-center justify-between">
            <span className="font-bold text-sm text-slate-900">{a.assessment_title || a.title || 'Assessment'}</span>
            <span className="text-[10px] text-slate-400">{fmtDate(a.submitted_at)}</span>
          </summary>
          <div className="mt-2 text-xs space-y-1">
            <p><strong>Severity:</strong> {a.severity || '—'}</p>
            <p><strong>Score:</strong> {a.score ?? '—'}</p>
            {a.answers && Object.entries(a.answers).slice(0, 12).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-slate-400 w-32 truncate shrink-0">{k}</span>
                <span className="text-slate-700 flex-1 break-words">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
              </div>
            ))}
          </div>
        </details>
      ))}
    </>
  );
}

function RecsList({ items }) {
  if (items.length === 0) return <Card title="Recommendations"><Empty>You haven't sent any recommendations yet.</Empty></Card>;
  return (
    <>
      {items.map((r) => (
        <div key={r.activity_id || r.created_at} className="rounded-2xl bg-white p-3"
          style={{ boxShadow: '0 6px 18px -12px rgba(0,0,0,0.1)' }}>
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm text-slate-900">{r.title}</p>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full"
              style={{ background: '#ECFDF5', color: '#065F46' }}>{r.progress || 'assigned'}</span>
          </div>
          {r.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.description}</p>}
          {r.media_url && <a className="text-xs text-blue-600 underline" href={r.media_url} target="_blank" rel="noreferrer">Open video</a>}
          {r.steps && Array.isArray(r.steps) && r.steps.length > 0 && (
            <ol className="mt-2 list-decimal list-inside text-xs text-slate-600 space-y-0.5">
              {r.steps.slice(0, 6).map((s, i) => <li key={i}>{typeof s === 'string' ? s : s.text}</li>)}
            </ol>
          )}
          <p className="text-[10px] text-slate-400 mt-1">{fmtDate(r.created_at)}</p>
        </div>
      ))}
    </>
  );
}

function TimelinePanel({ items }) {
  if (items.length === 0) return <Card title="Timeline"><Empty>No events yet.</Empty></Card>;
  return (
    <div className="space-y-2">
      {items.map((e) => (
        <div key={e.event_id || e.created_at} className="rounded-xl p-3 bg-white"
          style={{ boxShadow: '0 4px 14px -10px rgba(0,0,0,0.1)' }}>
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm text-slate-900 truncate">{e.title}</p>
            <span className="text-[10px] text-slate-400">{fmtDate(e.date)}</span>
          </div>
          {e.body_md && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{e.body_md}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Send-recommendation modal ───────────────────────────────────────────
function RecommendationModal({ patient, patientId, onClose, onSent }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [category, setCategory] = useState('therapy');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    if (!title.trim()) { setErr('Title is required'); return; }
    setBusy(true); setErr('');
    try {
      const steps = stepsText.split('\n').map(s => s.trim()).filter(Boolean);
      await axios.post(`${API}/clinician/recommend`, {
        patient_id: patientId,
        title: title.trim(),
        description: description.trim(),
        media_url: mediaUrl.trim() || undefined,
        steps,
        category,
        content_type: mediaUrl ? 'video' : 'text',
      }, { withCredentials: true });
      onSent?.();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Could not send recommendation');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="custom-rec-modal" className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-3 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 md:p-6" onClick={e => e.stopPropagation()}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#2FA37A' }}>Send recommendation</p>
        <h2 className="font-fredoka font-bold text-xl text-slate-900 mt-0.5">For {patient?.name?.split(' ')[0] || 'patient'}</h2>

        <div className="mt-4 space-y-3">
          <Field label="Title *">
            <input data-testid="rec-title-input" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Daily grounding exercise"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
          </Field>
          <Field label="Category">
            <select data-testid="rec-category-input" value={category} onChange={e => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400">
              {['therapy', 'mindfulness', 'breathing', 'movement', 'sleep', 'nutrition', 'medication', 'general'].map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Description">
            <textarea data-testid="rec-desc-input" value={description} onChange={e => setDescription(e.target.value)}
              rows={3} placeholder="Short summary of why this helps…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 resize-none" />
          </Field>
          <Field label="Video URL (optional)">
            <input data-testid="rec-video-input" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
              placeholder="https://youtu.be/…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
          </Field>
          <Field label="Steps to follow (one per line)">
            <textarea data-testid="rec-steps-input" value={stepsText} onChange={e => setStepsText(e.target.value)}
              rows={5} placeholder={'1. Sit comfortably\n2. Inhale for 4 seconds\n…'}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 resize-none font-mono" />
          </Field>
        </div>

        {err && <p className="mt-3 text-xs text-red-600 font-bold">{err}</p>}

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} disabled={busy}
            className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-slate-600 bg-slate-100">
            Cancel
          </button>
          <button data-testid="rec-send-btn" onClick={send} disabled={busy}
            className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #2FA37A, #1F6F54)', boxShadow: '0 12px 24px -10px rgba(31,111,84,0.6)' }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send recommendation'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">{label}</span>
      {children}
    </label>
  );
}

// ── AI follow-up modal ──────────────────────────────────────────────────
function FollowUpModal({ patient, patientId, onClose, onSent }) {
  const [tone, setTone] = useState('warm');
  const [extraNote, setExtraNote] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [err, setErr] = useState('');

  const generate = useCallback(async () => {
    setDrafting(true); setErr('');
    try {
      const r = await axios.post(`${API}/clinician/patient/${patientId}/follow-up`, { tone, note: extraNote }, { withCredentials: true });
      setDraft(r.data?.draft || '');
    } catch (e) {
      setErr(e.response?.data?.detail || 'Could not draft follow-up');
    } finally { setDrafting(false); }
  }, [patientId, tone, extraNote]);

  // Auto-draft on open
  useEffect(() => { generate(); /* eslint-disable-next-line */ }, []);

  const send = async () => {
    if (!draft.trim()) { setErr('Message cannot be empty'); return; }
    setBusy(true); setErr('');
    try {
      await axios.post(`${API}/clinician/recommend`, {
        patient_id: patientId,
        title: 'Follow-up from your clinician',
        description: draft.trim(),
        body_md: draft.trim(),
        category: 'follow_up',
        content_type: 'text',
      }, { withCredentials: true });
      onSent?.();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Could not send follow-up');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="follow-up-modal" className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-3 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 md:p-6" onClick={e => e.stopPropagation()}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#A855F7' }}>AI follow-up</p>
        <h2 className="font-fredoka font-bold text-xl text-slate-900 mt-0.5">Check in with {patient?.name?.split(' ')[0] || 'patient'}</h2>
        <p className="text-xs text-slate-500 mt-1">
          The AI uses their last assessment + check-in + your previous recommendations to draft a warm message. Edit before sending.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Tone">
            <select data-testid="follow-up-tone" value={tone} onChange={e => setTone(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-400">
              <option value="warm">Warm &amp; supportive</option>
              <option value="check_in">Light check-in</option>
              <option value="celebration">Celebrate progress</option>
            </select>
          </Field>
          <Field label="Extra note for the AI (optional)">
            <input data-testid="follow-up-note" value={extraNote} onChange={e => setExtraNote(e.target.value)}
              placeholder="e.g. mention they tried meditation last week"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-400" />
          </Field>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Draft</span>
              <button onClick={generate} disabled={drafting}
                className="text-[11px] font-bold text-purple-600 hover:underline">
                {drafting ? 'Drafting…' : 'Regenerate'}
              </button>
            </div>
            <textarea data-testid="follow-up-draft" value={draft} onChange={e => setDraft(e.target.value)}
              rows={6} placeholder={drafting ? 'AI is drafting a warm message…' : ''}
              className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-purple-400 resize-none" />
          </div>
        </div>

        {err && <p className="mt-3 text-xs text-red-600 font-bold">{err}</p>}

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} disabled={busy}
            className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-slate-600 bg-slate-100">
            Cancel
          </button>
          <button data-testid="follow-up-send-btn" onClick={send} disabled={busy || !draft.trim()}
            className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #A855F7, #7C3AED)', boxShadow: '0 12px 24px -10px rgba(124,58,237,0.6)' }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send follow-up'}
          </button>
        </div>
      </div>
    </div>
  );
}
