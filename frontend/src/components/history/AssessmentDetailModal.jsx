import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ClipboardCheck, Calendar, ChevronDown, ChevronUp, Sparkles, Heart, ListChecks, ArrowRight, Activity,
} from 'lucide-react';
import HistoryBodyMap from './HistoryBodyMap';
import { useCheckinContent } from '../checkin/CheckinContentContext';
import { healReflection } from '../../lib/healReflection';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Map common color names → hex (mirrors backend palette + PatientHistory map)
const COLOR_HEX = {
  Red: '#FF3B30', Orange: '#FF7A00', Yellow: '#FFD23F', Green: '#22D67E',
  Blue: '#60A5FA', Purple: '#A78BFA', Grey: '#94A3B8', Gray: '#94A3B8', Pink: '#FF4FBF',
};
// Reverse map (uppercase hex → friendly name) for legacy check-ins that stored hex
// values in `user_selected_color`/`ending_color` instead of names.
const HEX_TO_NAME = Object.entries(COLOR_HEX).reduce((acc, [name, hex]) => {
  acc[hex.toUpperCase()] = name; return acc;
}, {});
const colorOf = (name) => COLOR_HEX[(name || '').trim()] || (typeof name === 'string' && name.startsWith('#') ? name : '#7FE3FF');
const labelOf = (name) => {
  if (!name) return '—';
  const s = String(name).trim();
  if (s.startsWith('#')) return HEX_TO_NAME[s.toUpperCase()] || 'Color';
  return s;
};

// Find the patient_checkin closest in time to a submission (within ±30 min)
// — used to enrich Assessment submissions whose answers are body-check-in markers only.
const findClosestCheckin = (checkins, isoTs) => {
  if (!Array.isArray(checkins) || !checkins.length || !isoTs) return null;
  const target = new Date(isoTs).getTime();
  if (Number.isNaN(target)) return null;
  let best = null;
  let bestDelta = Infinity;
  for (const c of checkins) {
    const t = new Date(c.created_at || c.date).getTime();
    if (Number.isNaN(t)) continue;
    const d = Math.abs(t - target);
    if (d < bestDelta) { bestDelta = d; best = c; }
  }
  // Only treat as "matching" if within 30 minutes — same flow window.
  return bestDelta <= 30 * 60 * 1000 ? best : null;
};

// Normalize freeform body-part labels stored on legacy check-ins (e.g. "head",
// "left_arm") to the canonical zone id from the admin-configured body map.
const normalizeZoneId = (raw, bodyZones) => {
  if (!raw || !Array.isArray(bodyZones) || !bodyZones.length) return null;
  const lower = String(raw).toLowerCase().replace(/\s+/g, '_');
  if (bodyZones.find((z) => z?.id === lower)) return lower;
  const rawLower = String(raw).toLowerCase();
  const found = bodyZones.find((z) => {
    const lbl = String(z?.label || '').toLowerCase();
    return lbl && (lbl.includes(rawLower) || rawLower.includes(lbl));
  });
  return found ? found.id : null;
};

// Friendly date+time formatter — e.g. "May 21, 2026 · 6:33 AM"
const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

// Stringify an answer value of any shape (string / number / array / object) for display.
const renderAnswerValue = (val) => {
  if (val === null || val === undefined || val === '') return '—';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

// Severity → palette for pills
const sevPalette = (sev) => {
  switch (sev) {
    case 'critical': return { bg: 'rgba(255,59,48,0.18)', fg: '#FF7A85', border: '#FF3B3055' };
    case 'high': return { bg: 'rgba(255,122,0,0.18)', fg: '#FFB07A', border: '#FF7A0055' };
    case 'moderate': return { bg: 'rgba(255,210,63,0.18)', fg: '#FFE38A', border: '#FFD23F55' };
    case 'low': return { bg: 'rgba(34,214,126,0.18)', fg: '#7CE7B0', border: '#22D67E55' };
    default: return { bg: 'rgba(127,227,255,0.12)', fg: '#7FE3FF', border: '#7FE3FF55' };
  }
};

// Skip internal/synthetic keys we don't want to show in the Q&A list
const isInternalKey = (k) => (
  !k || k.startsWith('_') || k === 'marker' || k === 'triggered_from'
);

function SubmissionCard({ submission, questions, checkins, index, isOpenDefault }) {
  const [open, setOpen] = useState(isOpenDefault);
  const { bodyZones } = useCheckinContent();
  const sev = submission.severity;
  const palette = sevPalette(sev);
  const adminRecs = submission.admin_recs || [];
  const aiPlan = submission.ai_plan;
  // Map question_id → question for fast lookup; fall back to the raw key if not found.
  const qMap = useMemo(() => {
    const m = {};
    for (const q of questions || []) {
      const id = q.question_id || q.id || q.key;
      if (id) m[id] = q;
    }
    return m;
  }, [questions]);

  const answers = submission.answers || {};
  const answerEntries = Object.entries(answers).filter(([k]) => !isInternalKey(k));

  // Enrichment: when this is an Assessment submission tied to a body check-in
  // (i.e. answers contain `_daily_checkin`), look up the patient_checkin that
  // happened in the same flow and surface starting → ending color + intensity Δ.
  const isCheckinSubmission = !!answers._daily_checkin || submission.category_id === 'assessment';
  const linkedCheckin = isCheckinSubmission ? findClosestCheckin(checkins, submission.submitted_at) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-2xl p-3"
      style={{
        background: 'rgba(127,227,255,0.05)',
        border: '1px solid rgba(127,227,255,0.20)',
        boxShadow: '0 0 14px rgba(127,227,255,0.08)',
      }}
      data-testid={`submission-card-${submission.response_id || index}`}
    >
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center gap-2.5 text-left"
        data-testid={`submission-toggle-${index}`}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(34,240,199,0.15)', color: '#7CE7B0', border: '1px solid rgba(34,240,199,0.3)' }}>
          <Calendar className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-fredoka font-bold text-cyan-100 truncate">
            Submission #{index + 1}
          </p>
          <p className="text-[10px] font-nunito text-cyan-200/80 truncate">
            {fmtDateTime(submission.submitted_at)}
          </p>
        </div>
        {sev && (
          <span
            className="text-[9px] font-nunito font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider mr-1"
            style={{ background: palette.bg, color: palette.fg, border: `1px solid ${palette.border}` }}
          >
            {sev}
          </span>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-cyan-200/70" /> : <ChevronDown className="w-4 h-4 text-cyan-200/70" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Body check-in snapshot — surfaces starting → ending color + intensity Δ
                when this Assessment submission was driven by the embedded 9-step flow. */}
            {linkedCheckin && (() => {
              const startC = colorOf(linkedCheckin.user_selected_color);
              const endC = colorOf(linkedCheckin.ending_color);
              const before = Number(linkedCheckin.intensity_rating_before ?? 0);
              const after = Number(linkedCheckin.intensity_rating_after ?? 0);
              const delta = after - before;
              const deltaColor = delta < 0 ? '#22D67E' : delta > 0 ? '#FF7A00' : '#7FE3FF';
              const zoneId = normalizeZoneId(linkedCheckin.starting_body_part, bodyZones);
              return (
                <div className="mt-3 rounded-xl p-2.5"
                  style={{ background: 'rgba(127,227,255,0.06)', border: '1px solid rgba(127,227,255,0.22)' }}
                  data-testid={`somatic-snapshot-${index}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Activity className="w-3 h-3 text-cyan-300" />
                    <p className="text-[10px] uppercase tracking-wider font-bold text-cyan-200/80 font-nunito">
                      Body Check-in Snapshot
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    {/* Mini holographic body — visually shows WHERE the feeling lived */}
                    <div className="shrink-0" style={{ width: 60 }} data-testid={`somatic-thumb-${index}`}>
                      <HistoryBodyMap
                        zoneIds={zoneId ? [zoneId] : []}
                        color={startC}
                        intensity={Math.max(before, after) || 5}
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[9px] uppercase tracking-wider font-bold text-cyan-200/60 font-nunito">Color Shift</div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold font-nunito"
                              style={{ background: `${startC}26`, color: startC, border: `1px solid ${startC}` }}>
                              {labelOf(linkedCheckin.user_selected_color)}
                            </span>
                            <span className="text-cyan-200/50 text-[10px]">→</span>
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold font-nunito"
                              style={{ background: `${endC}26`, color: endC, border: `1px solid ${endC}` }}>
                              {labelOf(linkedCheckin.ending_color)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider font-bold text-cyan-200/60 font-nunito">Intensity Δ</div>
                        <div className="text-sm font-fredoka font-bold" style={{ color: deltaColor }}>
                          {before} → {after}{delta !== 0 ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}
                        </div>
                      </div>
                      {linkedCheckin.starting_body_part && (
                        <p className="text-[10px] font-nunito text-cyan-100/80">
                          <span className="text-cyan-200/60">Focus area:</span> {String(linkedCheckin.starting_body_part).replace(/_/g, ' ')}
                        </p>
                      )}
                      {linkedCheckin.user_selected_emotion && (
                        <p className="text-[10px] font-nunito text-cyan-100/80">
                          <span className="text-cyan-200/60">Felt:</span> {linkedCheckin.user_selected_emotion}
                        </p>
                      )}
                    </div>
                  </div>
                  {linkedCheckin.app_reflection_text && (
                    <p className="text-[10px] font-nunito text-cyan-100/80 mt-2 italic line-clamp-3">
                      "{healReflection(linkedCheckin.app_reflection_text, {
                        body_part: linkedCheckin.starting_body_part,
                        sensation: linkedCheckin.starting_sensation,
                        emotion: linkedCheckin.user_selected_emotion,
                      })}"
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Q&A */}
            <div className="mt-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <ListChecks className="w-3 h-3 text-cyan-300" />
                <p className="text-[10px] uppercase tracking-wider font-bold text-cyan-200/70 font-nunito">Your Answers</p>
              </div>
              {answerEntries.length === 0 ? (
                <p className="text-[11px] font-nunito italic text-cyan-200/60">
                  {linkedCheckin
                    ? 'This assessment was driven by the embedded body check-in — see the snapshot above.'
                    : 'This submission used the embedded 9-step body check-in — see the Time-Slider for the body map snapshot.'}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {answerEntries.map(([qid, val], i) => {
                    const q = qMap[qid];
                    const text = q?.text || q?.label || qid;
                    return (
                      <div key={qid} className="rounded-xl p-2"
                        style={{ background: 'rgba(11,18,51,0.45)', border: '1px solid rgba(127,227,255,0.12)' }}
                        data-testid={`qa-row-${index}-${i}`}>
                        <p className="text-[10px] font-nunito font-bold text-cyan-200/80 leading-snug">Q. {text}</p>
                        <p className="text-xs font-nunito text-cyan-100/90 mt-0.5 leading-snug">
                          <span className="text-emerald-300/90 font-bold">A.</span> {renderAnswerValue(val)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* AI Plan (assessment only) */}
            {aiPlan && (aiPlan.summary || (aiPlan.next_steps || []).length) && (
              <div className="mt-3 rounded-xl p-2.5"
                style={{ background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.30)' }}
                data-testid={`ai-plan-${index}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3 h-3 text-violet-300" />
                  <p className="text-[10px] uppercase tracking-wider font-bold text-violet-200 font-nunito">AI Wellness Plan</p>
                </div>
                {aiPlan.summary && (
                  <p className="text-[11px] font-nunito text-violet-100/90 italic mb-1.5">"{aiPlan.summary}"</p>
                )}
                {(aiPlan.next_steps || []).length > 0 && (
                  <ul className="space-y-0.5">
                    {aiPlan.next_steps.map((s, i) => (
                      <li key={i} className="text-[11px] font-nunito text-cyan-100/90 flex gap-1.5">
                        <span className="text-violet-300">•</span> {s}
                      </li>
                    ))}
                  </ul>
                )}
                {aiPlan.encouragement && (
                  <p className="text-[10px] font-nunito text-emerald-300 mt-1.5 italic">{aiPlan.encouragement}</p>
                )}
              </div>
            )}

            {/* Recommendations */}
            {adminRecs.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Heart className="w-3 h-3 text-pink-300" />
                  <p className="text-[10px] uppercase tracking-wider font-bold text-pink-200/80 font-nunito">
                    Recommendations Given ({adminRecs.length})
                  </p>
                </div>
                <div className="space-y-1.5">
                  {adminRecs.map((r, i) => (
                    <div key={r.recommendation_id || i} className="rounded-xl p-2"
                      style={{ background: 'rgba(255,79,191,0.08)', border: '1px solid rgba(255,79,191,0.25)' }}
                      data-testid={`rec-row-${index}-${i}`}>
                      <p className="text-xs font-fredoka font-bold text-pink-100 truncate">{r.title || 'Recommendation'}</p>
                      {r.description && (
                        <p className="text-[10px] font-nunito text-cyan-100/80 mt-0.5 line-clamp-3">{r.description}</p>
                      )}
                      {(r.category || r.content_type) && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {r.category && (
                            <span className="text-[9px] font-nunito font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                              style={{ background: 'rgba(127,227,255,0.12)', color: '#7FE3FF', border: '1px solid rgba(127,227,255,0.30)' }}>
                              {r.category}
                            </span>
                          )}
                          {r.content_type && r.content_type !== 'text' && (
                            <span className="text-[9px] font-nunito font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                              style={{ background: 'rgba(255,210,63,0.14)', color: '#FFD23F', border: '1px solid rgba(255,210,63,0.30)' }}>
                              {r.content_type}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AssessmentDetailModal({ categoryId, meta, submissions, checkins, onClose, onStartCheckin }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Browser back button closes the modal instead of leaving the Journey page.
  useEffect(() => {
    try { window.history.pushState({ ifcModal: 'assessment-detail' }, ''); } catch { /* ignore */ }
    const onPop = () => onClose?.();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await axios.get(`${API}/patient/assessment-questions/${categoryId}`, { withCredentials: true });
        if (!cancelled) setQuestions(r.data?.questions || []);
      } catch {
        if (!cancelled) setQuestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [categoryId]);

  // Defensive sort newest → oldest (parent should already pass sorted, but never trust)
  const ordered = useMemo(() => (
    [...(submissions || [])].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
  ), [submissions]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #0A1233 0%, #050018 60%, #000000 100%)',
      }}
      data-testid="assessment-detail-modal"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(127,227,255,0.15)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}66` }}>
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-fredoka font-bold text-cyan-100 truncate" data-testid="detail-title">{meta.title}</h2>
            <p className="text-[10px] font-nunito text-cyan-200/70 truncate" data-testid="detail-count">
              {ordered.length} submission{ordered.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          data-testid="detail-close"
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(127,227,255,0.10)', border: '1px solid rgba(127,227,255,0.25)' }}
        >
          <X className="w-4 h-4 text-cyan-100" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {loading ? (
          <p className="text-center text-xs font-nunito text-cyan-200/70 py-10">Loading details…</p>
        ) : ordered.length === 0 ? (
          <p className="text-center text-xs font-nunito text-cyan-200/70 py-10">No submissions yet for this assessment.</p>
        ) : (
          ordered.map((s, i) => (
            <SubmissionCard
              key={s.response_id || i}
              submission={s}
              questions={questions}
              checkins={checkins}
              index={i}
              isOpenDefault={i === 0}
            />
          ))
        )}
      </div>

      {/* Footer CTA */}
      <div className="px-4 pt-3 pb-5 shrink-0"
        style={{ borderTop: '1px solid rgba(127,227,255,0.15)', background: 'rgba(5,0,24,0.6)' }}>
        <button
          onClick={onStartCheckin}
          data-testid="detail-start-checkin"
          className="w-full rounded-2xl py-3 px-4 flex items-center justify-center gap-2 font-nunito font-bold text-sm text-white"
          style={{
            background: 'linear-gradient(135deg, #22F0C7, #7FE3FF, #FF4FBF)',
            backgroundSize: '200% 200%',
            boxShadow: '0 0 28px rgba(127,227,255,0.45), inset 0 0 18px rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.18)',
          }}
        >
          <Sparkles className="w-4 h-4" />
          Start a Regular Check-in
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-center text-[10px] font-nunito text-cyan-200/60 mt-1.5">
          Re-record how you're feeling now — your archive will keep growing.
        </p>
      </div>
    </motion.div>
  );
}
