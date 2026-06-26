import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FileDown, History, Sparkles, ArrowLeft, Loader2, ClipboardCheck, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AssessmentDetailModal from '../../components/history/AssessmentDetailModal';
import { generateHealthDossier } from '../../lib/healthDossierPdf';
import { downloadServerPdf, isAndroidWebView } from '../../lib/platform';
import { healReflection } from '../../lib/healReflection';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Onboarding category metadata — mirrors backend ASSESSMENT_CATEGORIES
const CATEGORY_META = {
  treatment_history: { title: 'Treatment History', color: '#FF4FBF', order: 1 },
  health_social: { title: 'Health & Social Info', color: '#22D3C5', order: 2 },
  assessment: { title: 'Assessment', color: '#FFD23F', order: 3 },
};
const CATEGORY_ORDER = ['treatment_history', 'health_social', 'assessment'];

// Map common color names → hex (mirrors backend palette)
const COLOR_HEX = {
  Red: '#FF3B30',
  Orange: '#FF7A00',
  Yellow: '#FFD23F',
  Green: '#22D67E',
  Blue: '#60A5FA',
  Purple: '#A78BFA',
  Grey: '#94A3B8',
  Gray: '#94A3B8',
  Pink: '#FF4FBF',
};

// Reverse lookup (hex → friendly name) — used when newer check-ins persist
// the raw hex string in `user_selected_color` / `ending_color` instead of
// a human-readable name. Includes a fuzzy nearest-name fallback so even
// "off-palette" hex values like #8B8FA0 don't display as a raw code.
const HEX_TO_NAME = Object.entries(COLOR_HEX).reduce((acc, [name, hex]) => {
  acc[hex.toUpperCase()] = name; return acc;
}, {});

const hexToRgb = (hex) => {
  const m = String(hex || '').replace('#', '');
  if (m.length !== 6) return null;
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

/** Accepts either a friendly name ("Blue") or a hex ("#60A5FA") and returns a renderable hex. */
const colorOf = (raw) => {
  if (!raw) return '#7FE3FF';
  const s = String(raw).trim();
  if (COLOR_HEX[s]) return COLOR_HEX[s];
  if (s.startsWith('#')) return s;
  return '#7FE3FF';
};

/** Accepts either a name or hex and returns a friendly label ("Blue"). */
const labelOf = (raw) => {
  if (!raw) return '—';
  const s = String(raw).trim();
  if (!s.startsWith('#')) return s; // already a name
  const exact = HEX_TO_NAME[s.toUpperCase()];
  if (exact) return exact;
  // Nearest brand-palette name by Euclidean RGB distance
  const target = hexToRgb(s);
  if (!target) return 'Color';
  let bestName = 'Color';
  let bestD = Infinity;
  Object.entries(COLOR_HEX).forEach(([name, hex]) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    const d = (rgb[0] - target[0]) ** 2 + (rgb[1] - target[1]) ** 2 + (rgb[2] - target[2]) ** 2;
    if (d < bestD) { bestD = d; bestName = name; }
  });
  return bestName;
};

// Convert a freeform body part string to a zone id when possible.
function normalizeZoneId(raw, bodyZones) {
  if (!raw || !Array.isArray(bodyZones) || bodyZones.length === 0) return null;
  const lower = String(raw).toLowerCase().replace(/\s+/g, '_');
  if (bodyZones.find((z) => z?.id === lower)) return lower;
  const rawLower = String(raw).toLowerCase();
  const found = bodyZones.find((z) => {
    const lbl = String(z?.label || '').toLowerCase();
    return lbl && (lbl.includes(rawLower) || rawLower.includes(lbl));
  });
  return found ? found.id : null;
}

export default function PatientHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checkins, setCheckins] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [bodyZones, setBodyZones] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [pdfChoiceOpen, setPdfChoiceOpen] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [detailCat, setDetailCat] = useState(null);
  const bodyMapRef = useRef(null);
  const timelineRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [c, r, cfg, assess] = await Promise.all([
          axios.get(`${API}/checkins?limit=200`, { withCredentials: true }),
          axios.get(`${API}/patient/recommendations`, { withCredentials: true }).catch(() => ({ data: { recommendations: [] } })),
          axios.get(`${API}/assessments/active`, { withCredentials: true }).catch(() => ({ data: { body_parts: [] } })),
          axios.get(`${API}/patient/my-responses`, { withCredentials: true }).catch(() => ({ data: { items: [] } })),
        ]);
        if (cancelled) return;
        const list = (c.data?.checkins || []).slice().sort((a, b) => {
          const ad = new Date(a.created_at || a.date).getTime();
          const bd = new Date(b.created_at || b.date).getTime();
          return ad - bd; // ascending so slider goes oldest → newest
        });
        setCheckins(list);
        setIdx(list.length > 0 ? list.length - 1 : 0);
        const recs = r.data?.recommendations
          || (r.data?.by_source ? [...(r.data.by_source.admin || []), ...(r.data.by_source.clinician || []), ...(r.data.by_source.organization || [])] : [])
          || [];
        setRecommendations(recs);
        setBodyZones(cfg.data?.body_parts || []);
        setAssessments(assess.data?.items || assess.data?.responses || []);
      } catch (e) {
        // graceful empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sliderItems = useMemo(() => checkins.map((c) => ({
    id: c.checkin_id,
    date: c.created_at || c.date,
    color: colorOf(c.user_selected_color),
    label: c.user_selected_emotion,
  })), [checkins]);

  const current = checkins[idx];
  const currentColor = colorOf(current?.user_selected_color);
  const currentEnding = colorOf(current?.ending_color);
  const intensityBefore = Number(current?.intensity_rating_before ?? 0);
  const intensityAfter = Number(current?.intensity_rating_after ?? 0);
  const delta = intensityAfter - intensityBefore;

  const zoneIds = useMemo(() => {
    if (!current?.starting_body_part) return [];
    const id = normalizeZoneId(current.starting_body_part, bodyZones);
    return id ? [id] : [];
  }, [current, bodyZones]);

  // Group all submissions by category — used by both the inline summary cards
  // and the AssessmentDetailModal opened on tap.
  const submissionsByCat = useMemo(() => {
    const byCat = {};
    for (const a of assessments) {
      const cid = a?.category_id;
      if (!cid || !CATEGORY_META[cid]) continue;
      if (!byCat[cid]) byCat[cid] = [];
      byCat[cid].push(a);
    }
    return byCat;
  }, [assessments]);

  const goStartCheckin = () => {
    setDetailCat(null);
    navigate('/app/home?checkin=1');
  };

  // Server-rendered PDF — bullet-proof in WebView APKs (Median.co/WebViewGold).
  const exportServerPdf = async () => {
    if (exporting) return;
    setExporting(true); setPdfError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await downloadServerPdf('/api/patient/dossier/pdf', `ifeelincolor-dossier-${today}.pdf`);
      setPdfChoiceOpen(false);
    } catch (e) {
      setPdfError(e?.message || 'Could not download the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Client-rendered PDF (legacy, snapshots the live body map). Works in
  // regular browsers; may silently fail to save in some APK wrappers.
  const exportClientPdf = async () => {
    if (exporting || !current) return;
    setExporting(true); setPdfError(null);
    try {
      await generateHealthDossier({
        patient: {
          name: user?.name || user?.email || 'Patient',
          email: user?.email,
          role: user?.role,
          joinedAt: user?.created_at,
        },
        checkins: checkins.slice().reverse(),
        recommendations,
        assessments,
        bodyMapEl: bodyMapRef.current,
        timelineEl: timelineRef.current,
      });
      setPdfChoiceOpen(false);
    } catch (e) {
      setPdfError(e?.message || 'Could not generate the PDF.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col"
      style={{
        background: 'linear-gradient(180deg, #FAF7FF 0%, #ffffff 60%, #FFF7FB 100%)',
        height: '100%',
        minHeight: 0,
      }}
      data-testid="patient-history-page">
      {/* Header — fixed at top */}
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-500 text-xs font-nunito font-bold hover:text-slate-900"
          data-testid="history-back">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7C5BFF, #FF4FBF)', boxShadow: '0 8px 18px -8px rgba(124,91,255,0.55)' }}>
            <History className="w-3.5 h-3.5 text-white" />
          </div>
          <h1 className="text-sm font-fredoka font-bold text-slate-900">My History</h1>
        </div>
        <button
          data-testid="export-pdf-btn"
          onClick={() => { setPdfError(null); setPdfChoiceOpen(true); }}
          disabled={exporting}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-nunito font-bold disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #FF4FBF, #7C5BFF)',
            color: 'white',
            boxShadow: '0 8px 18px -8px rgba(255,79,191,0.55)',
          }}
          aria-label="Download health dossier PDF"
        >
          {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
          PDF
        </button>
      </div>

      {/* Scrollable inner content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-3">

      {/* Completed Onboarding Assessments — shown whenever any of the 3 are done */}
      {assessments.length > 0 && (() => {
        const distinctDone = Object.keys(submissionsByCat).length;
        return (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-3 rounded-3xl p-3.5 bg-white"
          style={{
            boxShadow: '0 12px 28px -16px rgba(31,17,71,0.18), 0 0 0 1px rgba(124,91,255,0.10)',
          }}
          data-testid="history-completed-assessments"
        >
          <div className="flex items-center gap-1.5 mb-2.5">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #22D67E, #06A86C)' }}>
              <ClipboardCheck className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-xs font-fredoka font-bold text-slate-900">Completed Assessments</h2>
            <span className="ml-auto text-[10px] font-nunito font-bold px-2 py-0.5 rounded-full"
              data-testid="completed-assessments-count"
              style={{ background: '#ECFDF5', color: '#065F46' }}>
              {distinctDone}/3
            </span>
          </div>
          <p className="text-[10px] font-nunito text-slate-500 mb-2.5">
            Tap any completed assessment to review every submission, your answers, and the recommendations sent.
          </p>
          <div className="space-y-1.5">
            {CATEGORY_ORDER.map((cid) => {
              const meta = CATEGORY_META[cid];
              const subs = submissionsByCat[cid] || [];
              const resp = subs[0];
              const done = !!resp;
              const dateLabel = resp?.submitted_at
                ? new Date(resp.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : null;
              const sev = resp?.severity;
              const inner = (
                <>
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: done ? `linear-gradient(135deg, ${meta.color}, ${meta.color}dd)` : '#F1F5F9',
                      color: done ? '#fff' : '#94A3B8',
                      boxShadow: done ? `0 6px 14px -6px ${meta.color}88` : 'none',
                    }}
                  >
                    {done ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <span className="text-[10px] font-fredoka font-bold">{meta.order}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-fredoka font-bold text-slate-900 truncate">{meta.title}</p>
                    <p className="text-[10px] font-nunito text-slate-500 truncate">
                      {done
                        ? `Completed · ${dateLabel}${subs.length > 1 ? ` · ${subs.length} submissions` : ''}`
                        : 'Not yet completed'}
                    </p>
                  </div>
                  {done && sev && (
                    <span
                      className="text-[9px] font-nunito font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                      style={{
                        background: sev === 'critical' ? '#FEE2E2'
                          : sev === 'high' ? '#FFEDD5'
                            : sev === 'moderate' ? '#FEF3C7'
                              : '#D1FAE5',
                        color: sev === 'critical' ? '#991B1B'
                          : sev === 'high' ? '#9A3412'
                            : sev === 'moderate' ? '#92400E'
                              : '#065F46',
                      }}
                    >
                      {sev}
                    </span>
                  )}
                  {done && <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                </>
              );
              const baseStyle = {
                background: done ? '#F8FAFC' : '#FAFBFD',
                border: `1px solid ${done ? '#E2E8F0' : '#F1F5F9'}`,
              };
              return done ? (
                <button
                  key={cid}
                  type="button"
                  onClick={() => setDetailCat(cid)}
                  className="w-full flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5 transition-transform active:scale-[0.99] hover:shadow-md"
                  style={baseStyle}
                  data-testid={`completed-assessment-${cid}`}
                  aria-label={`View all submissions for ${meta.title}`}
                >
                  {inner}
                </button>
              ) : (
                <div
                  key={cid}
                  className="flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5"
                  style={baseStyle}
                  data-testid={`completed-assessment-${cid}`}
                >
                  {inner}
                </div>
              );
            })}
          </div>
        </motion.div>
        );
      })()}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-sm font-fredoka">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          Loading your color archive…
        </div>
      ) : checkins.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6 text-center bg-white"
          style={{
            boxShadow: '0 14px 32px -16px rgba(124,91,255,0.30), 0 0 0 1px rgba(124,91,255,0.12)',
          }}
          data-testid="history-empty"
        >
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7C5BFF, #FF4FBF)', boxShadow: '0 10px 22px -8px rgba(124,91,255,0.55)' }}>
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <p className="text-base font-fredoka font-bold text-slate-900 mb-1">Your archive is empty</p>
          <p className="text-xs text-slate-500 mb-4 font-nunito">
            Complete your first Regular Check-in to start building a record of your feelings over time.
          </p>
          <button
            onClick={() => navigate('/app/home?checkin=1')}
            className="px-5 py-2.5 rounded-full text-xs font-nunito font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #7C5BFF, #FF4FBF)',
              boxShadow: '0 10px 22px -8px rgba(124,91,255,0.55)',
            }}
            data-testid="history-go-checkin"
          >
            Go to Regular Check-in
          </button>
        </motion.div>
      ) : (
        <>
          {/* Latest color-shift summary */}
          <motion.div
            key={current?.checkin_id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-4 bg-white"
            style={{ boxShadow: '0 12px 28px -16px rgba(31,17,71,0.18), 0 0 0 1px rgba(124,91,255,0.10)' }}
            data-testid="history-color-shift"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-nunito">Latest Color Shift</div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap" data-testid="history-color-shift-pills">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold font-nunito"
                    style={{ background: `${currentColor}1A`, color: currentColor, border: `1px solid ${currentColor}66` }}>
                    <span className="inline-block w-3 h-3 rounded-full"
                      style={{ background: currentColor, boxShadow: `0 0 6px ${currentColor}99` }} />
                    {labelOf(current?.user_selected_color)}
                  </span>
                  <span className="text-slate-300 text-xs">→</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold font-nunito"
                    style={{ background: `${currentEnding}1A`, color: currentEnding, border: `1px solid ${currentEnding}66` }}>
                    <span className="inline-block w-3 h-3 rounded-full"
                      style={{ background: currentEnding, boxShadow: `0 0 6px ${currentEnding}99` }} />
                    {labelOf(current?.ending_color)}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-nunito">Intensity Δ</div>
                <div className="text-base font-fredoka font-bold" style={{ color: delta < 0 ? '#06A86C' : delta > 0 ? '#FB923C' : '#7C5BFF' }}>
                  {intensityBefore} → {intensityAfter} {delta !== 0 && `(${delta > 0 ? '+' : ''}${delta})`}
                </div>
              </div>
            </div>
            {current?.app_reflection_text && (
              <p className="mt-3 text-xs text-slate-600 font-nunito italic line-clamp-2 px-3 py-2 rounded-xl"
                style={{ background: '#FAF7FF' }}>
                "{healReflection(current.app_reflection_text, {
                  body_part: current.starting_body_part,
                  sensation: current.starting_sensation,
                  emotion: current.user_selected_emotion,
                })}"
              </p>
            )}
          </motion.div>

          {/* Quick stats */}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="rounded-3xl p-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #ECFDF5 0%, #ffffff 100%)',
                boxShadow: '0 10px 22px -14px rgba(6,168,108,0.30), 0 0 0 1px rgba(34,214,126,0.18)',
              }}>
              <div className="text-[10px] uppercase font-bold font-nunito text-emerald-700/80">Total Check-ins</div>
              <div className="text-3xl font-fredoka font-bold text-emerald-700">{checkins.length}</div>
              <Sparkles className="w-4 h-4 absolute top-3 right-3 text-emerald-400/60" />
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/app/recommendations')}
              data-testid="history-open-recommendations"
              className="rounded-3xl p-4 text-left relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #FDF2F8 0%, #ffffff 100%)',
                boxShadow: '0 10px 22px -14px rgba(255,79,191,0.35), 0 0 0 1px rgba(255,79,191,0.20)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase font-bold font-nunito text-pink-700/80">Recommendations</div>
                <ChevronRight className="w-3.5 h-3.5 text-pink-400" />
              </div>
              <div className="text-3xl font-fredoka font-bold text-pink-600">{recommendations.length}</div>
              <div className="text-[10px] font-nunito text-pink-700/60 mt-0.5">
                {recommendations.length ? 'Tap to view all · play videos & read' : 'Tap when you have recommendations'}
              </div>
            </motion.button>
          </div>
        </>
      )}

      </div>{/* /scrollable inner */}

      {/* Footer CTA — fixed at the bottom, always visible. */}
      <div className="shrink-0 px-4 pb-3 pt-2"
        style={{ background: 'linear-gradient(180deg, rgba(250,247,255,0) 0%, rgba(255,247,251,0.85) 40%, rgba(255,247,251,0.95) 100%)' }}>
        <motion.button
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          onClick={goStartCheckin}
          data-testid="journey-start-checkin"
          className="w-full rounded-2xl py-3 px-4 flex items-center justify-center gap-2 font-nunito font-bold text-sm text-white"
          style={{
            background: 'linear-gradient(135deg, #7C5BFF, #FF4FBF, #FF8C3F)',
            backgroundSize: '200% 200%',
            boxShadow: '0 16px 32px -12px rgba(124,91,255,0.55), inset 0 1px 0 rgba(255,255,255,0.4)',
          }}
        >
          <Sparkles className="w-4 h-4" />
          Start a Regular Check-in
        </motion.button>
        <p className="text-center text-[10px] font-nunito text-slate-500 mt-1.5">
          Track how you're feeling right now — it'll be added to your archive.
        </p>
      </div>

      {/* Per-category detail overlay */}
      <AnimatePresence>
        {detailCat && CATEGORY_META[detailCat] && (
          <AssessmentDetailModal
            categoryId={detailCat}
            meta={CATEGORY_META[detailCat]}
            submissions={submissionsByCat[detailCat] || []}
            checkins={checkins}
            onClose={() => setDetailCat(null)}
            onStartCheckin={goStartCheckin}
          />
        )}
      </AnimatePresence>

      {/* PDF format chooser — server-side (bullet-proof) vs client-side (live body map) */}
      <AnimatePresence>
        {pdfChoiceOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: 'rgba(2,0,15,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => !exporting && setPdfChoiceOpen(false)}
            data-testid="pdf-choice-overlay"
          >
            <motion.div
              initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl p-4 pb-6"
              style={{
                background: 'linear-gradient(160deg, #14123A 0%, #07051E 100%)',
                border: '1px solid rgba(167,139,250,0.35)',
                boxShadow: '0 -8px 32px rgba(167,139,250,0.25)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-violet-300" />
                  <h3 className="text-sm font-fredoka font-bold text-cyan-100">Choose PDF format</h3>
                </div>
                <button
                  onClick={() => !exporting && setPdfChoiceOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(127,227,255,0.10)', border: '1px solid rgba(127,227,255,0.25)' }}
                  data-testid="pdf-choice-close"
                >
                  <X className="w-4 h-4 text-cyan-100" />
                </button>
              </div>

              <p className="text-[11px] font-nunito text-cyan-200/70 mb-3">
                Both formats are downloadable. Pick the one that works best for your device.
              </p>

              {/* Server-rendered (recommended for APK) */}
              <button
                type="button"
                onClick={exportServerPdf}
                disabled={exporting}
                data-testid="pdf-server-btn"
                className="w-full rounded-2xl p-3 mb-2.5 text-left flex items-start gap-3 disabled:opacity-60"
                style={{
                  background: 'rgba(34,240,199,0.10)',
                  border: '1px solid rgba(34,240,199,0.40)',
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(34,240,199,0.20)', color: '#7CE7B0', border: '1px solid #22D67E' }}>
                  <FileDown className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-fredoka font-bold text-emerald-100">Standard PDF</p>
                    <span className="text-[9px] font-nunito font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ background: '#22D67E33', color: '#7CE7B0', border: '1px solid #22D67E' }}>
                      Recommended{isAndroidWebView() ? ' for APK' : ''}
                    </span>
                  </div>
                  <p className="text-[10px] font-nunito text-cyan-200/70 mt-0.5 leading-snug">
                    Clean branded layout · real Q&amp;A · downloads cleanly on every phone/APK · server-rendered.
                  </p>
                </div>
              </button>

              {/* Client-rendered (live body map snapshot) */}
              <button
                type="button"
                onClick={exportClientPdf}
                disabled={exporting || !current}
                data-testid="pdf-client-btn"
                className="w-full rounded-2xl p-3 text-left flex items-start gap-3 disabled:opacity-60"
                style={{
                  background: 'rgba(127,227,255,0.06)',
                  border: '1px solid rgba(127,227,255,0.30)',
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(127,227,255,0.18)', color: '#7FE3FF', border: '1px solid #7FE3FF' }}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-fredoka font-bold text-cyan-100">Animated PDF</p>
                  <p className="text-[10px] font-nunito text-cyan-200/70 mt-0.5 leading-snug">
                    Includes a snapshot of the 3D body map &amp; time-slider. Best on desktop / browser.
                  </p>
                </div>
              </button>

              {pdfError && (
                <p className="text-[10px] font-nunito text-pink-300 mt-2 text-center" data-testid="pdf-choice-error">
                  {pdfError}
                </p>
              )}
              {exporting && (
                <div className="flex items-center justify-center gap-2 mt-3 text-[11px] font-nunito text-cyan-200/80">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing your dossier…
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
