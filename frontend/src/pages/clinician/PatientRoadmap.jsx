import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, FileText, Heart, Sparkles, ChevronRight, X, Clock, Palette,
  ScanFace, Send, ArrowLeft, Loader2, BookOpen, FileDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CLIN } from '../../clinicianBrand';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SEVERITY_COLORS = {
  low: '#22D67E', medium: '#F99C2C', high: '#FF6B6B', critical: '#FF3B30',
};

const TYPE_META = {
  checkin: { icon: Heart, color: '#FF8A95', label: 'Daily check-in' },
  assessment: { icon: FileText, color: CLIN.accent, label: 'Assessment' },
  recommendation: { icon: BookOpen, color: CLIN.lilac, label: 'Recommendation' },
};

const CATEGORY_META = {
  mood: { color: '#FFB088', label: 'Mood' },
  body: { color: '#7FE3FF', label: 'Body' },
  color: { color: '#1F6F54', label: 'Color' },
  assessment: { color: CLIN.accent, label: 'Assessment' },
  daily: { color: '#FF8A95', label: 'Daily' },
  clinician_recommendation: { color: CLIN.lilac, label: 'Clinician rec' },
  clinician_plan: { color: CLIN.gold, label: 'AI plan' },
  recommendation: { color: '#86EFAC', label: 'Recommendation' },
};

const fmt = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return d; }
};

export default function PatientRoadmap() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    axios.get(`${API}/clinician/dashboard-stats`, { withCredentials: true })
      .then(r => {
        setPatients(r.data.patients || []);
        if (r.data.patients?.[0]) setSelectedId(r.data.patients[0].user_id);
      }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true); setData(null);
    axios.get(`${API}/clinician/patient/${selectedId}/full-history`, { withCredentials: true })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const filtered = (data?.timeline || []).filter(e => filter === 'all' || e.type === filter);

  return (
    <div className="px-5 pt-5 pb-6 relative">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate('/clinician/patients')} className="text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[11px] font-nunito font-bold uppercase tracking-widest" style={{ color: CLIN.accent }}>Patient Roadmap</p>
          <h1 className="font-fredoka font-semibold text-2xl text-slate-900">Full history timeline</h1>
        </div>
      </div>

      {/* Patient selector */}
      <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
        data-testid="roadmap-patient-select"
        className="w-full rounded-2xl px-3 py-2.5 text-sm text-slate-900 outline-none mb-3"
        style={{ background: CLIN.faint, border: `1px solid ${CLIN.border}`, backdropFilter: 'blur(12px)' }}>
        <option value="" className="text-slate-900">— Select patient —</option>
        {patients.map(p => <option key={p.user_id} value={p.user_id} className="text-slate-900">{p.name || p.email}</option>)}
      </select>

      {/* Export CSV */}
      {selectedId && (
        <button
          data-testid="export-patient-csv"
          onClick={async () => {
            try {
              const r = await axios.get(`${API}/clinician/patient/${selectedId}/checkins/export`,
                { withCredentials: true, responseType: 'blob' });
              const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
              const a = document.createElement('a');
              a.href = url;
              a.download = `patient-${selectedId}-checkins.csv`;
              a.click();
              URL.revokeObjectURL(url);
            } catch { /* */ }
          }}
          className="w-full mb-4 rounded-2xl py-2.5 text-xs font-bold flex items-center justify-center gap-2"
          style={{ background: CLIN.faint, color: CLIN.accent, border: `1px solid ${CLIN.border}` }}>
          <FileDown className="w-3.5 h-3.5" /> Export patient check-ins (CSV)
        </button>
      )}

      {/* Counts + filters */}
      {data && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { k: 'checkin', label: 'Check-ins', value: data.counts.checkins, color: '#FF8A95' },
              { k: 'assessment', label: 'Assessments', value: data.counts.assessments, color: CLIN.accent },
              { k: 'recommendation', label: 'Recs', value: data.counts.recommendations_given, color: CLIN.lilac },
            ].map(s => (
              <button key={s.k} onClick={() => setFilter(filter === s.k ? 'all' : s.k)}
                data-testid={`stat-filter-${s.k}`}
                className="rounded-2xl p-2.5 text-left transition"
                style={{
                  background: filter === s.k ? `${s.color}22` : CLIN.faint,
                  border: `1px solid ${filter === s.k ? s.color : CLIN.border}`,
                  backdropFilter: 'blur(12px)',
                }}>
                <p className="font-fredoka font-bold text-lg" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] text-slate-500">{s.label}</p>
              </button>
            ))}
          </div>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="text-[11px] text-slate-500 mb-3">
              Showing only "{filter}" — clear filter
            </button>
          )}
        </>
      )}

      {/* Timeline */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: CLIN.accent }} />
        </div>
      )}
      {!loading && data && (
        <div className="relative pl-7">
          {/* Vertical rail */}
          <div className="absolute left-2.5 top-1 bottom-1 w-0.5 rounded-full"
            style={{ background: `linear-gradient(180deg, ${CLIN.accent}88, ${CLIN.lilac}88, ${CLIN.gold}33)` }} />

          {filtered.length === 0 && (
            <div className="rounded-2xl p-6 text-center text-sm text-slate-400"
              style={{ background: CLIN.faint, border: '1px dashed rgba(31,111,84,0.08)' }}>
              No events yet for the selected filter.
            </div>
          )}

          {filtered.map((e, i) => {
            const meta = TYPE_META[e.type] || TYPE_META.checkin;
            const Cat = CATEGORY_META[e.category] || { color: meta.color, label: e.category };
            return (
              <motion.div key={e.event_id || i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.6) }}
                className="relative mb-3"
                data-testid={`timeline-event-${i}`}>
                {/* Dot */}
                <motion.div
                  whileHover={{ scale: 1.2 }}
                  className="absolute -left-7 top-3 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: `${Cat.color}`,
                    boxShadow: `0 0 14px ${Cat.color}aa`,
                  }}>
                  <meta.icon className="w-2.5 h-2.5 text-slate-900" />
                </motion.div>
                {/* Event card */}
                <motion.button onClick={() => setDetail(e)} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                  className="w-full text-left rounded-2xl p-3"
                  style={{
                    background: CLIN.faint,
                    border: `1px solid ${Cat.color}33`,
                    backdropFilter: 'blur(12px)',
                  }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{e.title}</p>
                    {e.severity && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: `${SEVERITY_COLORS[e.severity] || '#94A3B8'}33`, color: SEVERITY_COLORS[e.severity] || '#94A3B8' }}>
                        {e.severity}
                      </span>
                    )}
                    {e.progress && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: `${Cat.color}33`, color: Cat.color }}>
                        {e.progress}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> {fmt(e.date)}
                  </p>
                  {e.emotion && (
                    <p className="text-xs text-slate-600 mt-1">
                      Emotion: <strong className="text-slate-900">{e.emotion}</strong>
                      {e.body_part && <> · Body: <strong className="text-slate-900">{e.body_part}</strong></>}
                    </p>
                  )}
                  {e.ai_plan?.summary && (
                    <p className="text-[11px] text-slate-500 italic line-clamp-2 mt-1">"{e.ai_plan.summary}"</p>
                  )}
                  {e.description && !e.ai_plan?.summary && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{e.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${Cat.color}22`, color: Cat.color }}>
                      {Cat.label}
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-400 ml-auto" />
                  </div>
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {detail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
            onClick={() => setDetail(null)}
            data-testid="timeline-detail-modal">
            <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl max-h-[88vh] overflow-y-auto"
              style={{ background: `linear-gradient(180deg, ${CLIN.bg1} 0%, ${CLIN.bg2} 100%)`, border: `1px solid ${CLIN.border}` }}>
              <div className="sticky top-0 z-10 p-4 backdrop-blur-xl flex items-center gap-3"
                style={{ background: 'rgba(255,255,255,0.94)', borderBottom: '1px solid rgba(31,111,84,0.08)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${(CATEGORY_META[detail.category]?.color || CLIN.accent)}22` }}>
                  {React.createElement((TYPE_META[detail.type] || TYPE_META.checkin).icon, { className: 'w-4 h-4', style: { color: CATEGORY_META[detail.category]?.color || CLIN.accent } })}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{detail.title}</p>
                  <p className="text-[10px] text-slate-500">{fmt(detail.date)}</p>
                </div>
                <button onClick={() => setDetail(null)} className="text-slate-600"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 space-y-3">
                {detail.color && (
                  <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: CLIN.faint, border: `1px solid ${CLIN.border}` }}>
                    <Palette className="w-4 h-4" style={{ color: CLIN.accent }} />
                    <div className="flex-1">
                      <p className="text-[10px] text-slate-500">Color of feeling</p>
                      <p className="text-sm font-bold text-slate-900">{detail.color}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full" style={{ background: detail.color, boxShadow: `0 0 12px ${detail.color}88` }} />
                  </div>
                )}
                {detail.reflection && (
                  <div className="rounded-xl p-3" style={{ background: CLIN.faint, border: `1px solid ${CLIN.border}` }}>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Reflection</p>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">{detail.reflection}</p>
                  </div>
                )}
                {detail.body_part && (
                  <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: CLIN.faint, border: `1px solid ${CLIN.border}` }}>
                    <ScanFace className="w-4 h-4" style={{ color: CLIN.accent }} />
                    <div>
                      <p className="text-[10px] text-slate-500">Body area</p>
                      <p className="text-sm font-bold text-slate-900">{detail.body_part} · {detail.sensation}</p>
                    </div>
                  </div>
                )}
                {detail.ai_plan && (
                  <div className="rounded-xl p-3" style={{ background: `${CLIN.lilac}14`, border: `1px solid ${CLIN.lilac}33` }}>
                    <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: CLIN.lilac }}>AI Plan</p>
                    {detail.ai_plan.summary && <p className="text-sm text-slate-900 mb-2">{detail.ai_plan.summary}</p>}
                    {detail.ai_plan.next_steps && (
                      <ul className="space-y-1">
                        {detail.ai_plan.next_steps.map((s, i) => (
                          <li key={i} className="text-[11px] text-slate-700 flex items-start gap-1">
                            <ChevronRight className="w-3 h-3 mt-0.5" style={{ color: CLIN.lilac }} /> {s}
                          </li>
                        ))}
                      </ul>
                    )}
                    {detail.ai_plan.encouragement && (
                      <p className="text-[11px] italic mt-2" style={{ color: CLIN.lilac }}>"{detail.ai_plan.encouragement}"</p>
                    )}
                  </div>
                )}
                {Array.isArray(detail.answers) && detail.answers.length > 0 && (
                  <div className="rounded-xl p-3" style={{ background: CLIN.faint, border: `1px solid ${CLIN.border}` }}>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Assessment responses ({detail.answers.length})</p>
                    <div className="space-y-1.5">
                      {detail.answers.slice(0, 10).map((a, i) => (
                        <div key={i} className="text-[11px]">
                          <p className="text-slate-500">Q{i + 1}: {a.question_text || a.question || '—'}</p>
                          <p className="text-slate-900"><strong>→</strong> {String(a.answer ?? a.value ?? '—').slice(0, 200)}</p>
                        </div>
                      ))}
                      {detail.answers.length > 10 && (
                        <p className="text-[10px] text-slate-400">+ {detail.answers.length - 10} more responses</p>
                      )}
                    </div>
                  </div>
                )}
                {Array.isArray(detail.recommendations) && detail.recommendations.length > 0 && (
                  <div className="rounded-xl p-3" style={{ background: `${CLIN.gold}14`, border: `1px solid ${CLIN.gold}33` }}>
                    <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: CLIN.gold }}>Auto-assigned recommendations</p>
                    <ul className="space-y-1">
                      {detail.recommendations.map((r, i) => (
                        <li key={i} className="text-[11px] text-slate-700">• {typeof r === 'string' ? r : (r.title || JSON.stringify(r))}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
