import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Brain, Check, ChevronRight, Send, AlertTriangle, Heart, Clock } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
// Emerald palette — matches clinician portal identity.
const PINE = '#1F6F54';
const EMERALD = '#2FA37A';
const MINT = '#A5DCC7';

export default function ClinicianAICoach() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatient = searchParams.get('patient');
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(initialPatient || '');
  const [focus, setFocus] = useState('');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedSteps, setSelectedSteps] = useState({});
  const [saveDone, setSaveDone] = useState(false);

  useEffect(() => {
    axios.get(`${API}/clinician/patients`, { withCredentials: true })
      .then(r => setPatients(r.data.patients || [])).catch(() => {});
    axios.get(`${API}/ai/clinician-coach/sessions`, { withCredentials: true })
      .then(r => setHistory((r.data.sessions || []).slice(0, 5))).catch(() => {});
  }, []);

  const run = async () => {
    if (!selected) return;
    setLoading(true); setPlan(null); setSaveDone(false); setSelectedSteps({});
    try {
      const r = await axios.post(`${API}/ai/clinician-coach`, { patient_id: selected, focus }, { withCredentials: true });
      setPlan(r.data.session?.plan || null);
    } catch (e) {
      setPlan({ overview: 'AI service is temporarily unavailable. Please try again.', plan: [], red_flags: [], strengths: [] });
    } finally { setLoading(false); }
  };

  const toggleStep = (idx) => setSelectedSteps(prev => ({ ...prev, [idx]: !prev[idx] }));

  const saveToRoadmap = async () => {
    if (!plan?.plan) return;
    const steps = plan.plan.filter((_, i) => selectedSteps[i]);
    if (!steps.length) return;
    await axios.post(`${API}/ai/clinician-coach/save-to-roadmap`, { patient_id: selected, steps }, { withCredentials: true });
    setSaveDone(true);
  };

  const patient = patients.find(p => p.user_id === selected);

  return (
    <div className="px-5 pt-5 pb-6 relative">
      {/* 3D background */}
      <motion.div animate={{ y: [0, -16, 0] }} transition={{ duration: 7, repeat: Infinity }}
        className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, 44, transparent 70%)`, filter: 'blur(28px)' }} />
      <motion.div animate={{ y: [0, 18, 0] }} transition={{ duration: 9, repeat: Infinity }}
        className="absolute top-72 -left-12 w-44 h-44 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${EMERALD}55, transparent 70%)`, filter: 'blur(28px)' }} />

      <div className="relative">
        <p className="text-[11px] font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: PINE }}>AI Coach</p>
        <h1 className="font-fredoka font-semibold text-2xl text-slate-900">Treatment plan builder</h1>
        <p className="text-sm text-slate-500 mt-1">Pick a patient, optionally add focus, and get an evidence-informed 5-step plan.</p>
      </div>

      {/* Patient selector */}
      <div className="mt-5 rounded-3xl p-4 relative"
        style={{ background: 'rgba(255,255,255,0.78)', border: `1px solid ${PINE}22`, backdropFilter: 'blur(14px)', boxShadow: `0 12px 28px -16px ${PINE}55` }}>
        <label className="text-[11px] font-bold uppercase tracking-widest mb-2 block" style={{ color: PINE }}>Patient</label>
        <select value={selected} onChange={e => setSelected(e.target.value)}
          data-testid="coach-patient-select"
          className="w-full rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none cursor-pointer"
          style={{ background: '#FFF', border: `1px solid ${PINE}33` }}>
          <option value="" className="text-slate-800">— Select patient —</option>
          {patients.map(p => <option key={p.user_id} value={p.user_id} className="text-slate-800">{p.name || p.email}</option>)}
        </select>

        <label className="text-[11px] font-bold uppercase tracking-widest mt-3 mb-2 block" style={{ color: PINE }}>Focus (optional)</label>
        <input value={focus} onChange={e => setFocus(e.target.value)}
          data-testid="coach-focus-input"
          placeholder="e.g., social anxiety, sleep hygiene…"
          className="w-full rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none"
          style={{ background: '#FFF', border: `1px solid ${PINE}33` }} />

        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
          onClick={run} disabled={!selected || loading}
          data-testid="coach-generate"
          className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${PINE}, ${EMERALD})`, boxShadow: `0 18px 36px -10px ${PINE}88` }}>
          <Sparkles className="w-4 h-4 inline mr-1.5" /> {loading ? 'Building plan…' : 'Generate plan'}
        </motion.button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="mt-5 space-y-3">
          {[1, 2, 3].map(i => (
            <motion.div key={i} animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
              className="h-20 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(31,111,84,0.18)' }} />
          ))}
        </div>
      )}

      {/* Plan output */}
      {plan && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-3">
          {/* Overview */}
          {plan.overview && (
            <div className="rounded-3xl p-4"
              style={{ background: 'rgba(31,111,84,0.10)', border: '1px solid rgba(31,111,84,0.32)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: PINE }}>Pattern recap</p>
              <p className="text-sm text-slate-900">{plan.overview}</p>
            </div>
          )}

          {/* Plan steps */}
          {plan.plan?.length > 0 && (
            <div className="rounded-3xl p-4"
              style={{ background: 'rgba(255,255,255,0.78)', border: `1px solid ${EMERALD}33`, backdropFilter: 'blur(12px)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: EMERALD }}>5-step plan · tap to select for roadmap</p>
              <div className="space-y-2">
                {plan.plan.map((s, i) => (
                  <motion.button key={i} whileTap={{ scale: 0.98 }} onClick={() => toggleStep(i)}
                    data-testid={`coach-step-${i}`}
                    className="w-full text-left rounded-2xl p-3 transition relative"
                    style={{
                      background: selectedSteps[i] ? `linear-gradient(135deg, ${EMERALD}30, #1F6F5430)` : 'rgba(255,255,255,0.7)',
                      border: `1px solid ${selectedSteps[i] ? EMERALD : '#FFF'}`,
                    }}>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-900 shrink-0"
                        style={{ background: selectedSteps[i] ? EMERALD : 'rgba(31,111,84,0.08)' }}>
                        {selectedSteps[i] ? <Check className="w-3.5 h-3.5" /> : (i + 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900">{s.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{s.rationale}</p>
                        {s.actions?.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {s.actions.map((a, ai) => (
                              <li key={ai} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                                <ChevronRight className="w-3 h-3 mt-0.5" style={{ color: EMERALD }} />
                                <span>{a}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {s.timeframe && (
                          <span className="inline-flex items-center gap-1 mt-2 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            <Clock className="w-2.5 h-2.5" /> {s.timeframe}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
              <motion.button whileTap={{ scale: 0.98 }} onClick={saveToRoadmap}
                disabled={!Object.values(selectedSteps).some(Boolean) || saveDone}
                data-testid="coach-save-to-roadmap"
                className="mt-3 w-full rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${PINE}, ${EMERALD})` }}>
                <Send className="w-3.5 h-3.5 inline mr-1.5" /> {saveDone ? 'Saved to patient roadmap ✓' : 'Save selected steps to patient'}
              </motion.button>
            </div>
          )}

          {/* Red flags */}
          {plan.red_flags?.length > 0 && (
            <div className="rounded-3xl p-4"
              style={{ background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(252,165,165,0.32)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: '#FCA5A5' }}>
                <AlertTriangle className="w-3 h-3" /> Red flags
              </p>
              <ul className="space-y-1">
                {plan.red_flags.map((f, i) => <li key={i} className="text-xs text-slate-700">• {f}</li>)}
              </ul>
            </div>
          )}

          {/* Strengths */}
          {plan.strengths?.length > 0 && (
            <div className="rounded-3xl p-4"
              style={{ background: 'rgba(34,214,126,0.12)', border: '1px solid rgba(34,214,126,0.32)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: '#22D67E' }}>
                <Heart className="w-3 h-3" /> Strengths
              </p>
              <ul className="space-y-1">
                {plan.strengths.map((f, i) => <li key={i} className="text-xs text-slate-700">• {f}</li>)}
              </ul>
            </div>
          )}
        </motion.div>
      )}

      {/* History */}
      {history.length > 0 && !plan && !loading && (
        <div className="mt-6">
          <p className="text-[11px] font-nunito font-bold uppercase tracking-widest mb-2" style={{ color: EMERALD }}>Recent sessions</p>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.session_id} className="rounded-2xl p-3 text-xs"
                style={{ background: 'rgba(255,255,255,0.78)', border: `1px solid ${PINE}22` }}>
                <p className="font-bold text-slate-900">{h.focus || 'General plan'}</p>
                <p className="text-slate-500 line-clamp-2 mt-1">{h.plan?.overview || '—'}</p>
                <p className="text-[10px] text-slate-400 mt-1">{new Date(h.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
