import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen, Play, Bookmark, ListChecks, Image as ImageIcon, ExternalLink, X, Check, Sparkles,
  Shield, Stethoscope, Building2, Clock, Lock, ClipboardList, CheckCircle2, RotateCw,
} from 'lucide-react';
import { BRAND } from '../../brand';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TYPE_META = {
  video: { icon: Play, color: '#FF3D8A', label: 'Video' },
  image: { icon: ImageIcon, color: BRAND.blue, label: 'Image' },
  steps: { icon: ListChecks, color: '#9D5BFF', label: 'Steps' },
  link: { icon: ExternalLink, color: '#22D3C5', label: 'Link' },
  text: { icon: BookOpen, color: '#FF8C3F', label: 'Read' },
};

const SEV_PILL = { critical: '#FF3B30', high: '#FF8C3F', moderate: '#FFD23F', low: '#22D67E' };

const SOURCE_META = {
  admin:        { icon: Shield,      color: '#A78BFA', label: 'IFEELINCOLOR Portal',     pill: 'PORTAL' },
  clinician:    { icon: Stethoscope, color: '#22D3C5', label: 'From your Clinician',    pill: 'CLINICIAN' },
  organization: { icon: Building2,   color: '#FF8C3F', label: 'From your Organization', pill: 'ORG' },
};

function youtubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  return m ? m[1] : null;
}

const timeAgo = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const ms = Date.now() - d.getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return iso.slice(0, 10); }
};

function RecCard({ rec, onOpen, onSave, saved }) {
  const meta = TYPE_META[rec.content_type || rec.media_type || 'text'] || TYPE_META.text;
  const src = SOURCE_META[rec.source] || SOURCE_META.admin;
  const SrcIcon = src.icon;
  const ytId = rec.content_type === 'video' ? youtubeId(rec.media_url) : null;
  const cover = rec.image_url || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null);
  const isCompleted = !!rec.completed;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="rounded-3xl overflow-hidden relative cursor-pointer"
      style={{ background: 'white', boxShadow: `0 16px 36px -14px ${src.color}55`, border: isCompleted ? '1px solid #22D67E55' : `1px solid ${src.color}22` }}
      onClick={() => onOpen(rec)}
      data-testid={`rec-card-${rec.recommendation_id}`}
    >
      <div className="relative h-28 overflow-hidden" style={{
        background: cover ? `url(${cover}) center/cover` : `linear-gradient(135deg, ${src.color}, ${src.color}88)`,
      }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55))' }} />
        <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white flex items-center gap-1"
            style={{ background: src.color }}>
            <SrcIcon className="w-2.5 h-2.5" /> {src.pill}
          </span>
          {rec.severity && SEV_PILL[rec.severity] && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
              style={{ background: SEV_PILL[rec.severity] }}>{rec.severity}</span>
          )}
          {isCompleted && (
            <span data-testid={`rec-completed-badge-${rec.recommendation_id}`} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white flex items-center gap-1" style={{ background: '#22D67E' }}>
              <CheckCircle2 className="w-2.5 h-2.5" /> DONE
            </span>
          )}
        </div>
        <div className="absolute bottom-2 left-3 right-3 flex justify-between items-end text-white">
          <p className="text-[10px] font-nunito flex items-center gap-1 opacity-90">
            <Clock className="w-2.5 h-2.5" /> {timeAgo(rec.assigned_at)}
          </p>
          {!ytId && <meta.icon className="w-4 h-4 opacity-90" />}
        </div>
      </div>
      <div className="p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: src.color }}>
          {rec.source_label || src.label}
        </p>
        <p className="font-fredoka text-base font-semibold leading-snug line-clamp-2" style={{ color: '#2A1A4A' }}>
          {rec.title}
        </p>
        <p className="text-[11px] font-nunito mt-1 line-clamp-2" style={{ color: '#6B5784' }}>
          {rec.description}
        </p>
        <div className="mt-2 flex items-center justify-between">
          {rec.category && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${src.color}22`, color: src.color }}>
              {rec.category}
            </span>
          )}
          {rec.source === 'admin' && (
            <button
              data-testid={`save-${rec.recommendation_id}`}
              onClick={(e) => { e.stopPropagation(); onSave(rec); }}
              className="text-[10px] font-bold flex items-center gap-1"
              style={{ color: saved ? '#22D67E' : '#A599B8' }}>
              {saved ? <Check className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
              {saved ? 'Saved' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function PatientRecommendations() {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState({ by_source: { admin: [], clinician: [], organization: [] }, counts: {} , severity: null, has_assessment: false });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState({});
  const [activeTab, setActiveTab] = useState('all'); // all | admin | clinician | organization
  const [open, setOpen] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [completionToast, setCompletionToast] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/patient/recommendations`, { withCredentials: true });
      setData(r.data || {});
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async (rec) => {
    try {
      await axios.post(`${API}/patient/recommendations/save`, { recommendation_id: rec.recommendation_id }, { withCredentials: true });
      setSaved((s) => ({ ...s, [rec.recommendation_id]: true }));
    } catch { /* */ }
  };

  const complete = async (rec) => {
    if (!rec?.recommendation_id || completing) return;
    setCompleting(true);
    try {
      const r = await axios.post(`${API}/patient/recommendations/complete`, {
        recommendation_id: rec.recommendation_id,
        source: rec.source || 'admin',
        title: rec.title,
      }, { withCredentials: true });
      // Reflect locally so the badge appears immediately
      setData((d) => {
        const stamp = (it) => it.recommendation_id === rec.recommendation_id ? { ...it, completed: true, completed_at: r.data?.entry?.created_at } : it;
        return {
          ...d,
          by_source: {
            admin: (d.by_source?.admin || []).map(stamp),
            clinician: (d.by_source?.clinician || []).map(stamp),
            organization: (d.by_source?.organization || []).map(stamp),
          },
          counts: { ...(d.counts || {}), completed: (d.counts?.completed || 0) + 1 },
        };
      });
      if (open?.recommendation_id === rec.recommendation_id) {
        setOpen((o) => ({ ...o, completed: true, completed_at: r.data?.entry?.created_at }));
      }
      setCompletionToast({
        title: 'Recommendation completed',
        body: `Shared with your care team (${r.data?.shared_with?.clinician_count || 0} clinician${(r.data?.shared_with?.clinician_count || 0) === 1 ? '' : 's'} + IFEELINCOLOR admin).`,
        suggestReassessment: !!r.data?.suggest_reassessment,
      });
    } catch (e) {
      console.error(e);
    } finally { setCompleting(false); }
  };

  const lists = useMemo(() => {
    const bs = data.by_source || { admin: [], clinician: [], organization: [] };
    if (activeTab === 'all') {
      // Unified newest-first sort across sources so the most recently
      // assigned recommendation (admin / clinician / organization) always
      // appears at the top — regardless of which bucket it came from.
      const ts = (x) => {
        const v = x?.assigned_at || x?.created_at;
        const t = v ? new Date(v).getTime() : 0;
        return Number.isNaN(t) ? 0 : t;
      };
      return [...bs.clinician, ...bs.organization, ...bs.admin]
        .sort((a, b) => ts(b) - ts(a));
    }
    // Within a single-source tab the backend already returns newest-first
    // (sort("created_at", -1)) but we re-sort defensively in case mixed
    // shapes (clinician_plan vs clinician_recommendation) shuffle order.
    return [...(bs[activeTab] || [])].sort((a, b) => {
      const va = new Date(a?.assigned_at || a?.created_at || 0).getTime() || 0;
      const vb = new Date(b?.assigned_at || b?.created_at || 0).getTime() || 0;
      return vb - va;
    });
  }, [activeTab, data]);

  // Auto-refresh whenever the tab regains focus (so a freshly-added admin
  // recommendation appears without manually pulling down).
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', load);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', load);
    };
  }, []);

  // Deep-link: when the URL carries `?open=<rec_id>` (set by a notification
  // tap), auto-open the matching recommendation as soon as data is loaded.
  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(location.search);
    const target = params.get('open');
    if (!target) return;
    const all = [
      ...(data.by_source?.admin || []),
      ...(data.by_source?.clinician || []),
      ...(data.by_source?.organization || []),
    ];
    const match = all.find((r) =>
      r.recommendation_id === target || r.ref_id === target || r.title === target
    );
    if (match) {
      setActiveTab(match.source || 'all');
      setOpen(match);
      // Clean the URL so re-mounts don't re-pop the modal forever.
      navigate(location.pathname, { replace: true });
    }
  }, [loading, location.search, data, navigate, location.pathname]);

  // Gate: no assessment → prompt to complete one
  if (!loading && !data.has_assessment) {
    return (
      <div className="px-5 pt-6 pb-8">
        <p className="text-xs font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.pink }}>
          Care Library
        </p>
        <h1 className="font-fredoka font-semibold text-3xl" style={{ color: '#2A1A4A' }}>
          Tailored recommendations
        </h1>
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-3xl p-6 text-center relative overflow-hidden"
          style={{ background: 'white', boxShadow: '0 18px 40px -14px rgba(31,17,71,0.15)' }}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}>
            <Lock className="w-8 h-8 text-white" />
          </div>
          <p className="font-fredoka font-semibold text-lg mb-1" style={{ color: '#2A1A4A' }}>Complete an assessment first</p>
          <p className="text-sm text-slate-500 mb-5 max-w-xs mx-auto">
            We curate recommendations based on your latest assessment results. Take a quick check-in to unlock your library.
          </p>
          <button
            data-testid="goto-assessment-btn"
            onClick={() => navigate('/app/assessment')}
            className="rounded-full px-6 py-2.5 text-sm font-nunito font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})`, boxShadow: `0 12px 30px -8px ${BRAND.pink}66` }}>
            <ClipboardList className="w-4 h-4 inline mr-2" /> Start Assessment
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-5 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.pink }}>
            Care Library · {data.severity ? `Tuned for ${data.severity}` : 'Personalised for you'}
          </p>
          <h1 className="font-fredoka font-semibold text-3xl" style={{ color: '#2A1A4A' }}>
            Recommendations for you
          </h1>
          {data.ending_color && (
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-nunito font-bold" data-testid="ending-color-banner"
              style={{
                background: {
                  yellow: '#FFFAE8', blue: '#EFF6FF', red: '#FEF2F2', orange: '#FFF7ED',
                  green: '#F0FDF4', grey: '#F1F5F9', purple: '#FAF5FF',
                  happy: '#FFFAE8', sad: '#EFF6FF', angry: '#FEF2F2', fearful: '#FFF7ED',
                  disgusted: '#F0FDF4', bad: '#F1F5F9', surprised: '#FAF5FF',
                }[String(data.ending_color).toLowerCase()] || '#F8FAFC',
                color: {
                  yellow: '#B45309', blue: '#1D4ED8', red: '#B91C1C', orange: '#C2410C',
                  green: '#15803D', grey: '#475569', purple: '#7E22CE',
                  happy: '#B45309', sad: '#1D4ED8', angry: '#B91C1C', fearful: '#C2410C',
                  disgusted: '#15803D', bad: '#475569', surprised: '#7E22CE',
                }[String(data.ending_color).toLowerCase()] || '#1F2937',
              }}>
              <span className="w-2 h-2 rounded-full" style={{
                background: {
                  yellow: '#FFD23F', blue: '#3B82F6', red: '#EF4444', orange: '#F97316',
                  green: '#22C55E', grey: '#94A3B8', purple: '#A855F7',
                  happy: '#FFD23F', sad: '#3B82F6', angry: '#EF4444', fearful: '#F97316',
                  disgusted: '#22C55E', bad: '#94A3B8', surprised: '#A855F7',
                }[String(data.ending_color).toLowerCase()] || '#94A3B8',
              }} />
              Triggered by your latest <strong className="capitalize ml-0.5">{data.ending_color}</strong> check-in
            </div>
          )}
        </div>
        <Sparkles className="w-6 h-6 mt-2" style={{ color: BRAND.pink }} />
      </div>

      {/* Source tabs */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none">
        {[
          { k: 'all',          label: 'All',          count: (data.counts?.admin || 0) + (data.counts?.clinician || 0) + (data.counts?.organization || 0), color: BRAND.pink },
          { k: 'clinician',    label: 'Clinician',    count: data.counts?.clinician || 0,    color: SOURCE_META.clinician.color },
          { k: 'organization', label: 'Organization', count: data.counts?.organization || 0, color: SOURCE_META.organization.color },
          { k: 'admin',        label: 'Portal',       count: data.counts?.admin || 0,        color: SOURCE_META.admin.color },
        ].map((t) => (
          <button key={t.k} onClick={() => setActiveTab(t.k)}
            data-testid={`recs-tab-${t.k}`}
            className="shrink-0 rounded-full px-4 py-2 text-xs font-nunito font-bold flex items-center gap-1.5 transition"
            style={{
              background: activeTab === t.k ? `linear-gradient(135deg, ${t.color}, ${t.color}cc)` : 'white',
              color: activeTab === t.k ? 'white' : '#2A1A4A',
              boxShadow: activeTab === t.k ? `0 10px 22px -8px ${t.color}88` : '0 6px 14px -8px rgba(0,0,0,0.08)',
            }}>
            {t.label}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: activeTab === t.k ? 'rgba(255,255,255,0.25)' : `${t.color}22`, color: activeTab === t.k ? 'white' : t.color }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {loading && <p className="mt-6 text-center text-sm text-slate-500">Loading your library…</p>}

      {!loading && (
        <>
          {/* When viewing 'all', show 3 separate sections so source attribution is loud and clear */}
          {activeTab === 'all' ? (
            <>
              {['clinician', 'organization', 'admin'].map((srcKey) => {
                const list = (data.by_source || {})[srcKey] || [];
                if (list.length === 0) return null;
                const sm = SOURCE_META[srcKey];
                const SIcon = sm.icon;
                return (
                  <div key={srcKey} className="mt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: `${sm.color}22`, color: sm.color }}>
                        <SIcon className="w-4 h-4" />
                      </span>
                      <p className="text-sm font-fredoka font-semibold" style={{ color: '#2A1A4A' }}>{sm.label}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: `${sm.color}22`, color: sm.color }}>{list.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {list.map((rec) => (
                        <RecCard key={rec.recommendation_id} rec={rec} onOpen={setOpen} onSave={save} saved={!!saved[rec.recommendation_id]} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {(data.counts?.admin || 0) + (data.counts?.clinician || 0) + (data.counts?.organization || 0) === 0 && (
                <div className="mt-8 rounded-2xl p-6 text-center text-sm text-slate-500"
                  style={{ background: 'white', boxShadow: '0 12px 28px -12px rgba(0,0,0,0.06)' }}>
                  No recommendations yet. Check back after your clinician or organization reviews your assessment.
                </div>
              )}
            </>
          ) : (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {lists.length === 0 ? (
                <div className="col-span-full rounded-2xl p-6 text-center text-sm text-slate-500"
                  style={{ background: 'white', boxShadow: '0 12px 28px -12px rgba(0,0,0,0.06)' }}>
                  Nothing in this section yet.
                </div>
              ) : lists.map((rec) => (
                <RecCard key={rec.recommendation_id} rec={rec} onOpen={setOpen} onSave={save} saved={!!saved[rec.recommendation_id]} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {open && (() => {
          const sm = SOURCE_META[open.source] || SOURCE_META.admin;
          const SIcon = sm.icon;
          const ytId = open.content_type === 'video' ? youtubeId(open.media_url) : null;
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-4"
              onClick={() => setOpen(null)}>
              <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-3xl bg-white overflow-y-auto max-h-[85vh]">
                <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-2 bg-white/95 backdrop-blur border-b border-slate-100">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${sm.color}22`, color: sm.color }}>
                    <SIcon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: sm.color }}>{open.source_label || sm.label}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {timeAgo(open.assigned_at)}</p>
                  </div>
                  <button onClick={() => setOpen(null)} className="text-slate-400"><X className="w-5 h-5" /></button>
                </div>

                {ytId ? (
                  <iframe title="rec-video" className="w-full aspect-video" src={`https://www.youtube.com/embed/${ytId}`} allowFullScreen />
                ) : open.image_url ? (
                  <img src={open.image_url} alt="" className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-32" style={{ background: `linear-gradient(135deg, ${sm.color}, ${sm.color}88)` }} />
                )}

                <div className="p-4">
                  <h2 className="font-fredoka font-bold text-xl mb-2" style={{ color: '#2A1A4A' }}>{open.title}</h2>
                  <p className="text-sm text-slate-700 mb-3 whitespace-pre-line">{open.description}</p>
                  {open.actions && open.actions.length > 0 && (
                    <div className="rounded-2xl p-3 mb-3" style={{ background: `${sm.color}10` }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: sm.color }}>Action Plan</p>
                      <ul className="text-xs text-slate-700 list-disc pl-4 space-y-0.5">
                        {open.actions.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                  {open.timeframe && (
                    <p className="text-xs text-slate-500 mb-2"><strong>Timeframe:</strong> {open.timeframe}</p>
                  )}
                  {open.media_url && !ytId && (
                    <a href={open.media_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold mt-2"
                      style={{ color: sm.color }}>
                      Open link <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {open.source === 'admin' && !open.completed && (
                    <button
                      data-testid={`modal-save-${open.recommendation_id}`}
                      onClick={() => save(open)}
                      className="mt-4 w-full rounded-2xl py-3 text-sm font-nunito font-bold text-white"
                      style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}>
                      <Bookmark className="w-4 h-4 inline mr-2" />
                      {saved[open.recommendation_id] ? 'Saved to my journey' : 'Save to my journey'}
                    </button>
                  )}

                  {/* Mark Complete CTA — visible for all sources, hidden once completed */}
                  {!open.completed ? (
                    <button
                      data-testid={`modal-complete-${open.recommendation_id}`}
                      disabled={completing}
                      onClick={() => complete(open)}
                      className="mt-3 w-full rounded-2xl py-3 text-sm font-nunito font-bold text-white disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #22D67E, #16A34A)' }}>
                      <CheckCircle2 className="w-4 h-4 inline mr-2" />
                      {completing ? 'Marking complete…' : 'Mark as complete'}
                    </button>
                  ) : (
                    <div
                      data-testid={`modal-completed-${open.recommendation_id}`}
                      className="mt-3 rounded-2xl p-3 flex items-center gap-2"
                      style={{ background: '#F0FDF4', border: '1px solid #22D67E55' }}>
                      <CheckCircle2 className="w-5 h-5" style={{ color: '#16A34A' }} />
                      <div className="flex-1">
                        <p className="text-xs font-bold" style={{ color: '#15803D' }}>Completed</p>
                        <p className="text-[10px] text-slate-500">
                          {open.completed_at ? new Date(open.completed_at).toLocaleString() : 'Recorded'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Completion toast — confirms share + offers re-assessment CTA */}
      <AnimatePresence>
        {completionToast && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/55 p-4"
            onClick={() => setCompletionToast(null)}
            data-testid="completion-toast"
          >
            <motion.div
              initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-white p-6"
            >
              <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22D67E, #16A34A)' }}>
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <p className="font-fredoka font-semibold text-xl text-center mb-1" style={{ color: '#2A1A4A' }}>
                {completionToast.title}
              </p>
              <p className="text-sm text-slate-500 text-center mb-5">{completionToast.body}</p>
              {completionToast.suggestReassessment && (
                <button
                  data-testid="toast-retake-assessment"
                  onClick={() => { setCompletionToast(null); navigate('/app/assessment'); }}
                  className="w-full rounded-2xl py-3 text-sm font-nunito font-bold text-white mb-2"
                  style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}
                >
                  <RotateCw className="w-4 h-4 inline mr-2" /> Re-take Assessment now
                </button>
              )}
              <button
                data-testid="toast-dismiss"
                onClick={() => setCompletionToast(null)}
                className="w-full rounded-2xl py-2.5 text-xs font-nunito font-bold border"
                style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
              >
                Maybe later
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
