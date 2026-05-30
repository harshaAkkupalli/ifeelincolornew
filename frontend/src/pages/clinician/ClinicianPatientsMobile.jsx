import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, ChevronRight, Sparkles, X, BookOpen, Check, Bell, Plus,
  Image as ImageIcon, Video, Heart, Filter, Send, Loader2, History,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TEAL_LIGHT = '#2FA37A';
const TEAL = '#1F6F54';

const PROGRESS_COLORS = {
  assigned: '#1F6F54',
  reminded: '#F99C2C',
  in_progress: '#2FA37A',
  completed: '#22D67E',
};

export default function ClinicianPatientsMobile() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [given, setGiven] = useState([]);
  const [library, setLibrary] = useState([]);
  const [q, setQ] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAssign, setShowAssign] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [toast, setToast] = useState('');
  const [progressEditing, setProgressEditing] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const load = async () => {
    try {
      const r = await axios.get(`${API}/clinician/dashboard-stats`, { withCredentials: true });
      setPatients(r.data.patients || []);
    } catch { /* */ }
    try {
      const r = await axios.get(`${API}/clinician/recommendations-given`, { withCredentials: true });
      setGiven(r.data.recommendations || []);
    } catch { /* */ }
    try {
      const r = await axios.get(`${API}/clinician/recommendation-library`, { withCredentials: true });
      setLibrary(r.data.recommendations || []);
    } catch { /* */ }
  };
  useEffect(() => { load(); }, []);

  const assign = async (rec) => {
    if (!selectedPatient) return;
    setAssigning(true);
    try {
      await axios.post(`${API}/clinician/recommend`, {
        patient_id: selectedPatient.user_id,
        recommendation_id: rec.recommendation_id,
      }, { withCredentials: true });
      showToast(`Sent "${rec.title}" to ${selectedPatient.name}`);
      setShowAssign(false);
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Failed to assign');
    } finally { setAssigning(false); }
  };

  const remind = async (activity_id, progress = 'reminded') => {
    try {
      await axios.post(`${API}/clinician/recommend/${activity_id}/progress`, { progress }, { withCredentials: true });
      showToast(progress === 'reminded' ? 'Patient reminded' : `Marked ${progress}`);
      load();
    } catch { showToast('Action failed'); }
    setProgressEditing(null);
  };

  const filteredPatients = patients.filter(p => !q || p.name?.toLowerCase().includes(q.toLowerCase()) || p.email?.toLowerCase().includes(q.toLowerCase()));
  const filteredGiven = given.filter(g => !selectedPatient || g.user_id === selectedPatient.user_id);
  const categories = ['all', ...new Set(library.map(r => r.category).filter(Boolean))];
  const filteredLibrary = library.filter(r => filterCat === 'all' || r.category === filterCat);

  return (
    <div className="px-5 pt-5 pb-6 relative">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-slate-900 text-xs font-bold shadow-xl"
            style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_LIGHT})` }}>
            <Check className="w-3.5 h-3.5 inline mr-1.5" />{toast}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[11px] font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: TEAL_LIGHT }}>Recommendations</p>
      <h1 className="font-fredoka font-semibold text-2xl text-slate-900">Patients & Care Plans</h1>

      {/* Patient search row */}
      <div className="relative mt-3 mb-2">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search patient…"
          data-testid="patients-search"
          className="w-full rounded-2xl pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none"
          style={{ background: 'rgba(255,255,255,0.78)', border: `1px solid ${TEAL_LIGHT}33`, backdropFilter: 'blur(12px)' }} />
      </div>

      {/* Horizontal patient pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-none">
        <button onClick={() => setSelectedPatient(null)}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition"
          style={{
            background: !selectedPatient ? `linear-gradient(135deg, ${TEAL_LIGHT}, #1F6F54)` : 'rgba(255,255,255,0.78)',
            color: !selectedPatient ? '#fff' : 'rgba(10,42,32,0.62)',
            border: `1px solid ${TEAL_LIGHT}33`,
          }}>
          All Patients
        </button>
        {filteredPatients.slice(0, 12).map(p => (
          <button key={p.user_id} onClick={() => setSelectedPatient(p)}
            data-testid={`patient-pill-${p.user_id}`}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5"
            style={{
              background: selectedPatient?.user_id === p.user_id ? `linear-gradient(135deg, ${TEAL_LIGHT}, #1F6F54)` : 'rgba(255,255,255,0.78)',
              color: selectedPatient?.user_id === p.user_id ? '#fff' : 'rgba(255,255,255,0.6)',
              border: `1px solid ${TEAL_LIGHT}22`,
            }}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
              style={{ background: 'rgba(255,255,255,0.18)' }}>
              {(p.name || '?').charAt(0).toUpperCase()}
            </span>
            {p.name?.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Assign button */}
      {selectedPatient && (
        <div className="flex gap-2 mt-2">
          <motion.button initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            onClick={() => setShowAssign(true)}
            data-testid="open-assign-rec"
            className="flex-1 rounded-2xl py-3 text-sm font-bold text-slate-900 flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${TEAL_LIGHT}, #1F6F54)`,
              boxShadow: `0 18px 36px -10px ${TEAL_LIGHT}88`,
            }}>
            <Plus className="w-4 h-4" /> Send rec to {selectedPatient.name?.split(' ')[0]}
          </motion.button>
          <motion.button initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate(`/clinician/patient/${selectedPatient.user_id}/history`)}
            data-testid={`open-patient-history-${selectedPatient.user_id}`}
            className="rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 flex items-center gap-1.5"
            style={{
              background: `linear-gradient(135deg, #22D3C5, #60A5FA)`,
              boxShadow: `0 18px 36px -10px #22D3C588`,
            }}>
            <History className="w-4 h-4" /> 3D History
          </motion.button>
        </div>
      )}

      {/* Given recommendations list */}
      <div className="mt-5">
        <p className="text-[11px] font-nunito font-bold uppercase tracking-widest mb-3" style={{ color: TEAL_LIGHT }}>
          {selectedPatient ? `Given to ${selectedPatient.name}` : 'All your recommendations'} · {filteredGiven.length}
        </p>
        <div className="space-y-2">
          {filteredGiven.length === 0 && (
            <div className="rounded-2xl p-8 text-center text-sm text-slate-400"
              style={{ background: 'rgba(255,255,255,0.78)', border: '1px dashed rgba(31,111,84,0.08)' }}>
              {selectedPatient
                ? <>No recommendations yet for <strong>{selectedPatient.name}</strong>. Tap the button above to send one.</>
                : 'Pick a patient above, then send recommendations from the curated library.'}
            </div>
          )}
          {filteredGiven.map(g => (
            <motion.div key={g.activity_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-3"
              style={{ background: 'rgba(255,255,255,0.78)', border: `1px solid ${TEAL_LIGHT}22`, backdropFilter: 'blur(10px)' }}>
              <div className="flex items-start gap-3">
                {g.image_url
                  ? <img src={g.image_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  : <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${TEAL_LIGHT}22` }}><Heart className="w-5 h-5" style={{ color: TEAL_LIGHT }} /></div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 truncate">{g.title}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: `${PROGRESS_COLORS[g.progress] || '#94A3B8'}33`,
                        color: PROGRESS_COLORS[g.progress] || '#94A3B8',
                      }}>
                      {g.progress || 'assigned'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    To <strong className="text-slate-700">{g.patient_name}</strong> · {g.created_at ? new Date(g.created_at).toLocaleDateString() : ''}
                  </p>
                  {g.description && <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{g.description}</p>}
                </div>
              </div>
              {/* Progress actions */}
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <button onClick={() => remind(g.activity_id, 'reminded')}
                  data-testid={`remind-${g.activity_id}`}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={{ background: 'rgba(249,156,44,0.18)', color: '#FCBE7B', border: '1px solid rgba(249,156,44,0.3)' }}>
                  <Bell className="w-2.5 h-2.5" /> Remind
                </button>
                <button onClick={() => remind(g.activity_id, 'in_progress')}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={{ background: 'rgba(34,211,197,0.18)', color: TEAL_LIGHT, border: `1px solid ${TEAL_LIGHT}55` }}>
                  In progress
                </button>
                <button onClick={() => remind(g.activity_id, 'completed')}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={{ background: 'rgba(34,214,126,0.18)', color: '#86EFAC', border: '1px solid rgba(34,214,126,0.3)' }}>
                  <Check className="w-2.5 h-2.5" /> Done
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Assign recommendation modal */}
      <AnimatePresence>
        {showAssign && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-4"
            onClick={() => setShowAssign(false)}
            data-testid="assign-rec-modal">
            <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
              transition={{ type: 'spring', stiffness: 220, damping: 26 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl max-h-[85vh] overflow-y-auto"
              style={{ background: `linear-gradient(180deg, #0A1B30 0%, ${TEAL} 100%)`, border: `1px solid ${TEAL_LIGHT}44` }}>
              <div className="sticky top-0 z-10 p-4 flex items-center gap-2 backdrop-blur-xl"
                style={{ background: 'rgba(255,255,255,0.94)', borderBottom: '1px solid rgba(31,111,84,0.08)' }}>
                <BookOpen className="w-4 h-4" style={{ color: TEAL_LIGHT }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">Choose a recommendation</p>
                  <p className="text-[10px] text-slate-500">For {selectedPatient?.name}</p>
                </div>
                <button onClick={() => setShowAssign(false)} className="text-slate-600"><X className="w-4 h-4" /></button>
              </div>

              {/* Category filter */}
              {categories.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto px-4 pt-3 pb-2 scrollbar-none">
                  {categories.map(c => (
                    <button key={c} onClick={() => setFilterCat(c)}
                      className="shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition"
                      style={{
                        background: filterCat === c ? TEAL_LIGHT : 'rgba(255,255,255,0.78)',
                        color: filterCat === c ? '#0A1B30' : 'rgba(255,255,255,0.6)',
                      }}>
                      {c}
                    </button>
                  ))}
                </div>
              )}

              <div className="p-4 space-y-2">
                {filteredLibrary.length === 0 && (
                  <div className="text-center text-sm text-slate-400 py-8">
                    No recommendations in the library yet. Admins can add them in <strong>Admin → Recommendations</strong>.
                  </div>
                )}
                {filteredLibrary.map(r => (
                  <motion.button key={r.recommendation_id} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                    onClick={() => assign(r)} disabled={assigning}
                    data-testid={`assign-rec-${r.recommendation_id}`}
                    className="w-full text-left rounded-2xl p-3 flex items-start gap-3 disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(31,111,84,0.08)' }}>
                    {r.image_url
                      ? <img src={r.image_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                      : <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${TEAL_LIGHT}22` }}>
                          {r.media_type === 'video' ? <Video className="w-5 h-5" style={{ color: TEAL_LIGHT }} /> : <ImageIcon className="w-5 h-5" style={{ color: TEAL_LIGHT }} />}
                        </div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{r.title}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{r.description}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {r.category && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(167,139,250,0.2)', color: '#C4B5FD' }}>{r.category}</span>}
                        {r.severity && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(249,156,44,0.18)', color: '#FCBE7B' }}>{r.severity}</span>}
                      </div>
                    </div>
                    {assigning ? <Loader2 className="w-4 h-4 animate-spin text-slate-900 shrink-0" /> : <Send className="w-4 h-4 text-slate-400 shrink-0" />}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
