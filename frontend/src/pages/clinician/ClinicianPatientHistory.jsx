import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { FileDown, History, Heart, ArrowLeft, Loader2 } from 'lucide-react';import HistoryBodyMap from '../../components/history/HistoryBodyMap';
import TimeSlider from '../../components/history/TimeSlider';
import { generateHealthDossier } from '../../lib/healthDossierPdf';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLOR_HEX = {
  Red: '#FF3B30', Orange: '#FF7A00', Yellow: '#FFD23F',
  Green: '#22D67E', Blue: '#60A5FA', Purple: '#1F6F54',
  Grey: '#94A3B8', Gray: '#94A3B8', Pink: '#FF4FBF',
};
const colorOf = (n) => COLOR_HEX[(n || '').trim()] || '#7FE3FF';

function normalizeZoneId(raw, zones) {
  if (!raw || !Array.isArray(zones) || zones.length === 0) return null;
  const lower = String(raw).toLowerCase().replace(/\s+/g, '_');
  if (zones.find((z) => z?.id === lower)) return lower;
  const rawLower = String(raw).toLowerCase();
  const found = zones.find((z) => {
    const lbl = String(z?.label || '').toLowerCase();
    return lbl && (lbl.includes(rawLower) || rawLower.includes(lbl));
  });
  return found ? found.id : null;
}

export default function ClinicianPatientHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [checkins, setCheckins] = useState([]);
  const [bodyZones, setBodyZones] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [patientMeta, setPatientMeta] = useState(null);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const bodyMapRef = useRef(null);
  const timelineRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [c, cfg, recs, full] = await Promise.all([
          axios.get(`${API}/clinician/patient/${id}/checkins`, { withCredentials: true }).catch(() => ({ data: { checkins: [] } })),
          axios.get(`${API}/assessments/active`, { withCredentials: true }).catch(() => ({ data: { body_parts: [] } })),
          axios.get(`${API}/clinician/prescribed-care/${id}`, { withCredentials: true }).catch(() => ({ data: { items: [] } })),
          axios.get(`${API}/clinician/patient/${id}/full-history`, { withCredentials: true }).catch(() => ({ data: { timeline: [] } })),
        ]);
        if (cancelled) return;
        const list = (c.data?.checkins || []).slice().sort((a, b) => {
          const ad = new Date(a.created_at || a.date).getTime();
          const bd = new Date(b.created_at || b.date).getTime();
          return ad - bd;
        });
        setCheckins(list);
        setIdx(list.length > 0 ? list.length - 1 : 0);
        setBodyZones(cfg.data?.body_parts || []);
        setRecommendations(recs.data?.items || []);
        setTimeline(full.data?.timeline || []);
        // Try to surface patient name via patients list
        try {
          const pl = await axios.get(`${API}/clinician/patients`, { withCredentials: true });
          const found = (pl.data?.patients || []).find((p) => p.user_id === id);
          if (found) setPatientMeta(found);
        } catch { /* ignore */ }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

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
    const zid = normalizeZoneId(current.starting_body_part, bodyZones);
    return zid ? [zid] : [];
  }, [current, bodyZones]);

  const exportPdf = async () => {
    if (exporting || !current) return;
    setExporting(true);
    try {
      await generateHealthDossier({
        patient: {
          name: patientMeta?.name || 'Patient',
          email: patientMeta?.email,
          role: 'patient',
        },
        checkins: checkins.slice().reverse(),
        recommendations,
        assessments: timeline.filter(t => t.type === 'assessment').map(t => t.raw || t),
        bodyMapEl: bodyMapRef.current,
        timelineEl: timelineRef.current,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="px-4 pt-3 pb-24 text-slate-900"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #0A1233 0%, #050018 60%, #000000 100%)', minHeight: '100%' }}
      data-testid="clinician-patient-history-page">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-cyan-200/80 text-xs font-nunito" data-testid="clin-history-back">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex items-center gap-1.5">
          <History className="w-4 h-4 text-cyan-300" />
          <h1 className="text-sm font-fredoka font-bold text-cyan-100">
            {patientMeta?.name ? `${patientMeta.name} · History` : 'Patient History'}
          </h1>
        </div>
        <button
          data-testid="clin-export-pdf-btn"
          onClick={exportPdf}
          disabled={exporting || !current}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-nunito font-bold disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #22D3C5, #60A5FA)', color: 'white', boxShadow: '0 0 12px rgba(34,211,197,0.55)' }}
        >
          {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
          PDF
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-cyan-200/70 text-sm font-fredoka">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          Loading patient archive…
        </div>
      ) : checkins.length === 0 ? (
        <div className="rounded-3xl p-6 text-center" style={{ background: 'rgba(127,227,255,0.06)', border: '1px solid rgba(127,227,255,0.18)' }}>
          <p className="text-base font-fredoka text-cyan-100 mb-1">No check-ins recorded yet for this patient.</p>
        </div>
      ) : (
        <>
          <div ref={bodyMapRef} className="mx-auto" style={{ maxWidth: 360 }}>
            <HistoryBodyMap
              zoneIds={zoneIds}
              color={currentColor}
              emotion={current?.user_selected_emotion}
              intensity={intensityBefore}
              dateLabel={new Date(current?.created_at || current?.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            />
          </div>

          <motion.div
            key={current?.checkin_id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl p-3"
            style={{ background: 'rgba(127,227,255,0.05)', border: '1px solid rgba(127,227,255,0.18)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-cyan-200/60 font-nunito">Color Shift</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-nunito"
                    style={{ background: `${currentColor}26`, color: currentColor, border: `1px solid ${currentColor}` }}>
                    {current?.user_selected_color || '—'}
                  </span>
                  <span className="text-cyan-200/50 text-xs">→</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-nunito"
                    style={{ background: `${currentEnding}26`, color: currentEnding, border: `1px solid ${currentEnding}` }}>
                    {current?.ending_color || '—'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider font-bold text-cyan-200/60 font-nunito">Intensity Δ</div>
                <div className="text-base font-fredoka font-bold" style={{ color: delta < 0 ? '#22D67E' : delta > 0 ? '#FF7A00' : '#7FE3FF' }}>
                  {intensityBefore} → {intensityAfter} {delta !== 0 && `(${delta > 0 ? '+' : ''}${delta})`}
                </div>
              </div>
            </div>
          </motion.div>

          <div ref={timelineRef} className="mt-5 rounded-2xl p-3"
            style={{ background: 'rgba(11,18,51,0.4)', border: '1px solid rgba(127,227,255,0.18)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-3.5 h-3.5 text-pink-300" />
              <h2 className="text-xs font-fredoka font-bold text-cyan-100">3D Time-Slider</h2>
            </div>
            <TimeSlider items={sliderItems} activeIndex={idx} onChange={setIdx} />
          </div>

          {/* Assessment + Recommendation Roadmap (Q&A + results) */}
          <div className="mt-5 rounded-2xl p-3"
            style={{ background: 'rgba(11,18,51,0.4)', border: '1px solid rgba(127,227,255,0.18)' }}
            data-testid="clinician-assessment-roadmap">
            <button
              onClick={() => setShowRoadmap(!showRoadmap)}
              className="w-full flex items-center justify-between"
              data-testid="toggle-assessment-roadmap"
            >
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-cyan-300" />
                <h2 className="text-xs font-fredoka font-bold text-cyan-100">Assessments &amp; Recommendations Roadmap</h2>
              </div>
              <span className="text-[10px] text-cyan-200/60 font-nunito">
                {timeline.filter(t => t.type !== 'checkin').length} events {showRoadmap ? '▲' : '▼'}
              </span>
            </button>
            {showRoadmap && (
              <ul className="mt-3 space-y-2 max-h-96 overflow-y-auto pr-1">
                {timeline.filter(t => t.type !== 'checkin').map((e) => {
                  const color = e.type === 'assessment' ? '#1F6F54' : '#2FA37A';
                  return (
                    <li key={e.event_id} className="rounded-xl p-2.5 text-[11px] font-nunito"
                      style={{ background: 'rgba(127,227,255,0.05)', border: `1px solid ${color}33` }}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-cyan-100">{e.title}</p>
                        {e.severity && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase text-slate-900"
                            style={{ background: { critical: '#FF3B30', high: '#FF8C3F', moderate: '#FFD23F', low: '#22D67E' }[e.severity] || '#94A3B8' }}>
                            {e.severity}
                          </span>
                        )}
                      </div>
                      <p className="text-cyan-200/50 text-[10px]">{e.date ? new Date(e.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''}</p>
                      {e.type === 'assessment' && e.answers && (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-cyan-300/70 text-[10px] font-bold">
                            {Object.keys(e.answers).length} answer(s)
                          </summary>
                          <div className="mt-1.5 space-y-1 pl-2">
                            {Object.entries(e.answers).slice(0, 10).map(([k, v]) => (
                              <div key={k} className="flex gap-2 text-[10px]">
                                <span className="text-cyan-200/50 w-28 shrink-0 truncate">{k}</span>
                                <span className="text-cyan-100/80 flex-1 break-words">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                      {e.type === 'recommendation' && (e.description || e.body_md) && (
                        <p className="mt-1 text-cyan-100/70 line-clamp-2">{(e.body_md || e.description).slice(0, 200)}</p>
                      )}
                    </li>
                  );
                })}
                {timeline.filter(t => t.type !== 'checkin').length === 0 && (
                  <li className="text-center text-[11px] text-cyan-200/50 font-nunito py-4">
                    No assessment submissions or recommendations yet.
                  </li>
                )}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
