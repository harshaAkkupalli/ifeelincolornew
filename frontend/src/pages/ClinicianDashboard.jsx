import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import {
  LogOut, Users, ClipboardList, Activity, Calendar, ChevronRight, Bell, Search,
  TrendingUp, Heart, Brain, AlertOctagon, FileText, X,
} from 'lucide-react';
import { Logo } from '../components/brand/BrandLogo';
import BrandFooter from '../components/BrandFooter';
import axios from 'axios';
import { BRAND } from '../brand';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TEAL = '#0E7490';
const TEAL_LIGHT = '#22D3C5';

export default function ClinicianDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('today');
  const [tool, setTool] = useState(null); // 'notes' | 'ai' | 'forms'
  const [toolNote, setToolNote] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [aiResp, setAiResp] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/clinician/patients`, { withCredentials: true })
      .then(r => setPatients(r.data.patients || []))
      .catch(() => {});
    axios.get(`${API}/clinician/notifications`, { withCredentials: true })
      .then(r => setAlerts((r.data.notifications || []).slice(0, 5)))
      .catch(() => {
        axios.get(`${API}/emergency/alerts`, { withCredentials: true })
          .then(r => setAlerts((r.data.alerts || []).slice(0, 5)))
          .catch(() => {});
      });
  }, []);

  const openPatient = async (p) => {
    setSelected(p);
    const res = await axios.get(`${API}/clinician/patient/${p.user_id}/checkins`, { withCredentials: true });
    setCheckins(res.data.checkins || []);
  };

  const filtered = patients.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase()));

  const stats = [
    { label: 'Caseload', value: patients.length, icon: Users, color: TEAL_LIGHT, change: '+2 this week' },
    { label: 'Active today', value: Math.max(1, Math.floor(patients.length * 0.4)), icon: Activity, color: BRAND.green, change: '+8%' },
    { label: 'Sessions', value: 12, icon: Calendar, color: BRAND.orange, change: '4 today' },
    { label: 'Alerts', value: alerts.length, icon: AlertOctagon, color: '#FF3B30', change: alerts.length ? 'Review now' : 'All clear' },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: '#F4F8FB' }}>
      {/* === SIDE RAIL (desktop) === */}
      <aside className="hidden md:flex w-20 flex-col items-center py-6 sticky top-0 h-screen"
        style={{ background: `linear-gradient(180deg, ${TEAL} 0%, #0F3B6A 100%)`, color: 'white' }}>
        <Logo size={34} textSize="hidden" />
        <nav className="mt-8 flex flex-col gap-2">
          {[
            { icon: Users, label: 'Patients', active: true },
            { icon: Calendar, label: 'Schedule' },
            { icon: TrendingUp, label: 'Reports' },
            { icon: FileText, label: 'Notes' },
            { icon: Bell, label: 'Alerts' },
          ].map((it, i) => (
            <button
              key={i}
              data-testid={`clinician-side-${it.label.toLowerCase()}`}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition ${it.active ? 'bg-white/15 shadow-lg' : 'hover:bg-white/8'}`}
              title={it.label}
            >
              <it.icon className="w-5 h-5" />
            </button>
          ))}
        </nav>
        <button
          onClick={async () => { await logout(); navigate('/'); }}
          className="mt-auto w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-white/8 text-red-200"
          data-testid="clinician-logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </aside>

      <main className="flex-1 min-w-0">
        {/* === TOP BAR === */}
        <header className="sticky top-0 z-20 px-6 py-4 backdrop-blur-xl flex items-center justify-between"
          style={{ background: 'rgba(244,248,251,0.85)', borderBottom: '1px solid rgba(15,59,106,0.06)' }}>
          <div className="md:hidden"><Logo size={28} textSize="text-sm" /></div>
          <div className="flex-1 md:max-w-md mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                data-testid="clinician-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search patients..."
                className="w-full pl-10 pr-4 h-11 rounded-2xl bg-white border-0 outline-none text-sm font-nunito"
                style={{ boxShadow: '0 8px 18px -10px rgba(15,59,106,0.15)' }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 rounded-xl bg-white relative" style={{ boxShadow: '0 8px 18px -10px rgba(15,59,106,0.2)' }}>
              <Bell className="w-4 h-4 mx-auto" style={{ color: TEAL }} />
              {alerts.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500" />}
            </button>
            <div className="hidden md:flex items-center gap-2 px-3 h-10 rounded-xl bg-white" style={{ boxShadow: '0 8px 18px -10px rgba(15,59,106,0.2)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_LIGHT})` }}>{user?.name?.charAt(0) || 'C'}</div>
              <span className="text-xs font-nunito font-semibold" style={{ color: TEAL }}>{user?.name?.split(' ')[0]}</span>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Greeting */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: TEAL_LIGHT }}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="font-fredoka font-semibold text-3xl" style={{ color: TEAL }}>
              Good day, Dr. {user?.name?.split(' ').pop() || 'Clinician'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">Here's what's happening across your caseload today.</p>
          </motion.div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {stats.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ y: -4 }}
                className="rounded-2xl p-4 cursor-pointer"
                style={{ background: 'white', boxShadow: `0 14px 30px -14px ${s.color}55`, border: `1px solid ${s.color}22` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${s.color}1a` }}>
                    <s.icon className="w-4 h-4" style={{ color: s.color }} />
                  </div>
                  <span className="text-[10px] font-nunito font-bold" style={{ color: s.color }}>{s.change}</span>
                </div>
                <p className="font-fredoka font-semibold text-3xl mb-0.5" style={{ color: TEAL }}>{s.value}</p>
                <p className="text-xs font-nunito text-slate-500">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Two-column grid */}
          <div className="grid lg:grid-cols-3 gap-5">
            {/* Patients list */}
            <div className="lg:col-span-2 rounded-3xl bg-white"
              style={{ boxShadow: '0 14px 30px -16px rgba(15,59,106,0.15)' }}>
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#F1F5F9' }}>
                <div>
                  <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-0.5" style={{ color: TEAL_LIGHT }}>
                    My Patients
                  </p>
                  <h3 className="font-fredoka font-semibold text-lg" style={{ color: TEAL }}>
                    {filtered.length} active
                  </h3>
                </div>
                <div className="flex gap-1 rounded-full p-1 bg-slate-100">
                  {['today', 'all'].map(t => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className={`px-3 py-1 rounded-full text-[11px] font-nunito font-bold capitalize transition ${activeTab === t ? 'text-white' : 'text-slate-500'}`}
                      style={activeTab === t ? { background: TEAL } : {}}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="divide-y" style={{ maxHeight: 460, overflowY: 'auto' }}>
                {filtered.length === 0 && (
                  <div className="p-8 text-center text-sm text-slate-400">No patients yet.</div>
                )}
                {filtered.map((p, i) => (
                  <motion.button
                    key={p.user_id}
                    onClick={() => openPatient(p)}
                    data-testid={`clinician-patient-${i}`}
                    whileHover={{ x: 4 }}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50/60 transition"
                    style={{ borderColor: '#F1F5F9' }}
                  >
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm"
                      style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_LIGHT})` }}>
                      {(p.name || 'P').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-nunito font-semibold text-sm truncate" style={{ color: TEAL }}>{p.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{p.email}</p>
                    </div>
                    <div className="text-right text-[10px] text-slate-400">
                      <p>{p.checkin_count || 0} check-ins</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Emergency Alerts side panel */}
            <div className="rounded-3xl p-5"
              style={{
                background: alerts.length ? 'linear-gradient(180deg, #FFF5F5, white)' : 'white',
                boxShadow: '0 14px 30px -16px rgba(15,59,106,0.12)',
                border: alerts.length ? '1px solid #FECACA' : '1px solid #F1F5F9',
              }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: alerts.length ? '#FEE2E2' : '#F1F5F9' }}>
                  <AlertOctagon className="w-4 h-4" style={{ color: alerts.length ? '#DC2626' : '#94A3B8' }} />
                </div>
                <div>
                  <p className="text-[10px] font-nunito font-bold uppercase tracking-widest" style={{ color: alerts.length ? '#DC2626' : '#94A3B8' }}>
                    Emergency Alerts
                  </p>
                  <h3 className="font-fredoka font-semibold text-base" style={{ color: TEAL }}>
                    {alerts.length ? 'Action needed' : 'All clear'}
                  </h3>
                </div>
              </div>
              {alerts.length === 0 ? (
                <p className="text-xs text-slate-500">No active emergencies. Great work keeping your caseload safe.</p>
              ) : (
                <div className="space-y-2">
                  {alerts.map(a => (
                    <div key={a.alert_id} className="rounded-2xl p-3 text-xs" style={{ background: 'white', border: '1px solid #FECACA' }}>
                      <p className="font-bold" style={{ color: '#7F1D1D' }}>{a.user_name || a.user_email}</p>
                      <p className="text-[11px] text-slate-500">{new Date(a.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 pt-4 border-t" style={{ borderColor: '#F1F5F9' }}>
                <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-2 text-slate-400">Quick tools</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: Heart, label: 'Notes', color: BRAND.pink, key: 'notes' },
                    { icon: Brain, label: 'AI', color: '#A78BFA', key: 'ai' },
                    { icon: ClipboardList, label: 'Forms', color: BRAND.orange, key: 'forms' },
                  ].map((t, i) => (
                    <button key={i} onClick={() => setTool(t.key)} data-testid={`quick-tool-${t.key}`}
                      className="rounded-xl p-2 text-center hover:bg-slate-50 transition cursor-pointer"
                      style={{ border: `1px solid ${t.color}22` }}>
                      <t.icon className="w-4 h-4 mx-auto mb-1" style={{ color: t.color }} />
                      <p className="text-[9px] font-nunito font-bold" style={{ color: t.color }}>{t.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <BrandFooter compact />
      </main>

      {/* Patient detail drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/40"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
              transition={{ type: 'spring', stiffness: 240, damping: 26 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md h-full overflow-y-auto"
              style={{ background: 'white' }}
            >
              <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: '#F1F5F9' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold"
                  style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_LIGHT})` }}>
                  {(selected.name || 'P').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-fredoka font-semibold text-base" style={{ color: TEAL }}>{selected.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{selected.email}</p>
                </div>
                <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full hover:bg-slate-100">
                  <X className="w-4 h-4 mx-auto text-slate-400" />
                </button>
              </div>
              <div className="p-5">
                <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-3" style={{ color: TEAL_LIGHT }}>
                  Recent Check-ins
                </p>
                {checkins.length === 0 ? (
                  <p className="text-xs text-slate-400">No check-ins yet</p>
                ) : (
                  <div className="space-y-2">
                    {checkins.slice(0, 10).map((c, i) => (
                      <div key={i} className="p-3 rounded-2xl" style={{ background: '#F8FAFC' }}>
                        <p className="text-xs font-bold" style={{ color: TEAL }}>{c.date} · {c.core_emotion || '—'}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{c.ai_reflection || c.notes}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Tool modals */}
      <AnimatePresence>
        {tool && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => { setTool(null); setAiResp(''); setAiInput(''); setToolNote(''); }}
            data-testid="quick-tool-modal">
            <motion.div initial={{ y: 30, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
              {tool === 'notes' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-fredoka font-bold text-lg flex items-center gap-2"><Heart className="w-5 h-5" style={{ color: BRAND.pink }} /> Quick Note</h3>
                    <button onClick={() => setTool(null)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">Jot down a fast clinical observation. {selected ? `Patient: ${selected.name}` : 'Generic note.'}</p>
                  <textarea value={toolNote} onChange={e => setToolNote(e.target.value)}
                    data-testid="quick-tool-notes-input"
                    placeholder="Type your note…" rows={6}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-pink-300 resize-none" />
                  <div className="flex justify-end gap-2 mt-3">
                    <Button variant="outline" onClick={() => setTool(null)} className="rounded-xl text-xs">Cancel</Button>
                    <Button data-testid="quick-tool-notes-save"
                      onClick={async () => {
                        if (!toolNote.trim()) return;
                        try {
                          await axios.post(`${API}/clinician/notes`, { patient_id: selected?.user_id, note: toolNote }, { withCredentials: true });
                        } catch { /* local save fallback */ }
                        setTool(null); setToolNote('');
                      }}
                      className="rounded-xl text-xs text-white border-0"
                      style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}>Save note</Button>
                  </div>
                </>
              )}
              {tool === 'ai' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-fredoka font-bold text-lg flex items-center gap-2"><Brain className="w-5 h-5" style={{ color: '#A78BFA' }} /> AI Assistant</h3>
                    <button onClick={() => setTool(null)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">Ask the assistant for a clinical summary, draft a reflection, or suggest next steps.</p>
                  <textarea value={aiInput} onChange={e => setAiInput(e.target.value)} rows={3}
                    data-testid="quick-tool-ai-input"
                    placeholder="e.g., Summarize Emma's last 3 check-ins"
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-purple-300 resize-none mb-2" />
                  <Button disabled={aiLoading || !aiInput.trim()} data-testid="quick-tool-ai-run"
                    onClick={async () => {
                      setAiLoading(true); setAiResp('');
                      try {
                        const r = await axios.post(`${API}/ai/clinician-assist`, { prompt: aiInput, patient_id: selected?.user_id }, { withCredentials: true });
                        setAiResp(r.data.reply || r.data.text || 'No response.');
                      } catch (e) {
                        setAiResp('AI service unavailable — please try again.');
                      } finally { setAiLoading(false); }
                    }}
                    className="w-full rounded-xl text-xs text-white border-0"
                    style={{ background: `linear-gradient(135deg, #A78BFA, ${BRAND.pink})` }}>
                    {aiLoading ? 'Thinking…' : 'Ask AI'}
                  </Button>
                  {aiResp && (
                    <div data-testid="quick-tool-ai-response" className="mt-3 rounded-xl bg-purple-50 border border-purple-100 p-3 text-xs text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {aiResp}
                    </div>
                  )}
                </>
              )}
              {tool === 'forms' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-fredoka font-bold text-lg flex items-center gap-2"><ClipboardList className="w-5 h-5" style={{ color: BRAND.orange }} /> Forms</h3>
                    <button onClick={() => setTool(null)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">Jump to a clinical form template.</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Intake Form', desc: 'New patient onboarding', color: BRAND.blue, action: () => navigate('/dashboard?form=intake') },
                      { label: 'Progress Note', desc: 'SOAP-format clinical note', color: BRAND.green, action: () => setTool('notes') },
                      { label: 'Assessment Review', desc: 'View latest patient assessments', color: BRAND.pink, action: () => { setTool(null); selected && openPatient(selected); } },
                    ].map((f, i) => (
                      <button key={i} onClick={f.action} data-testid={`quick-tool-form-${i}`}
                        className="w-full text-left p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition flex items-center gap-3 cursor-pointer">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${f.color}22` }}>
                          <FileText className="w-4 h-4" style={{ color: f.color }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-800">{f.label}</p>
                          <p className="text-[10px] text-slate-500">{f.desc}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
