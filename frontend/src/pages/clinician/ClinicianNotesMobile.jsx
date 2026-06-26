import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Heart, Plus, Trash2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TEAL_LIGHT = '#2FA37A';

export default function ClinicianNotesMobile() {
  const [notes, setNotes] = useState([]);
  const [patients, setPatients] = useState([]);
  const [text, setText] = useState('');
  const [patientId, setPatientId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await axios.get(`${API}/clinician/notes`, { withCredentials: true });
    setNotes(r.data.notes || []);
  };
  useEffect(() => {
    load();
    axios.get(`${API}/clinician/patients`, { withCredentials: true })
      .then(r => setPatients(r.data.patients || [])).catch(() => {});
  }, []);

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/clinician/notes`, { note: text, patient_id: patientId || null }, { withCredentials: true });
      setText(''); setPatientId(''); load();
    } finally { setSaving(false); }
  };

  const patientName = (id) => patients.find(p => p.user_id === id)?.name || 'General';

  return (
    <div className="px-5 pt-5 pb-6 relative">
      <p className="text-[11px] font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: TEAL_LIGHT }}>Notes</p>
      <h1 className="font-fredoka font-semibold text-2xl text-slate-900">Clinical Notes</h1>

      {/* Composer */}
      <div className="mt-4 rounded-3xl p-4"
        style={{ background: 'rgba(255,255,255,0.78)', border: `1px solid ${TEAL_LIGHT}33`, backdropFilter: 'blur(12px)' }}>
        <label className="text-[11px] font-bold uppercase tracking-widest mb-2 block" style={{ color: TEAL_LIGHT }}>For patient (optional)</label>
        <select value={patientId} onChange={e => setPatientId(e.target.value)}
          data-testid="notes-patient-select"
          className="w-full rounded-xl px-3 py-2 text-sm text-slate-900 outline-none mb-3"
          style={{ background: 'rgba(31,111,84,0.08)', border: '1px solid rgba(31,111,84,0.22)' }}>
          <option value="" className="text-slate-800">— General note —</option>
          {patients.map(p => <option key={p.user_id} value={p.user_id} className="text-slate-800">{p.name || p.email}</option>)}
        </select>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          data-testid="notes-text"
          placeholder="Capture the moment — clinical observation, plan, follow-up…"
          className="w-full rounded-xl p-3 text-sm text-slate-900 outline-none resize-none"
          style={{ background: 'rgba(31,111,84,0.08)', border: '1px solid rgba(31,111,84,0.22)' }} />
        <motion.button whileTap={{ scale: 0.97 }} onClick={save} disabled={saving || !text.trim()}
          data-testid="notes-save"
          className="mt-3 w-full rounded-xl py-2.5 text-xs font-bold text-slate-900 disabled:opacity-40"
          style={{ background: `linear-gradient(135deg, ${TEAL_LIGHT}, #1F6F54)` }}>
          <Plus className="w-3.5 h-3.5 inline mr-1.5" /> {saving ? 'Saving…' : 'Save note'}
        </motion.button>
      </div>

      {/* Notes list */}
      <div className="mt-5 space-y-2">
        {notes.map(n => (
          <motion.div key={n.note_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-3"
            style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(31,111,84,0.08)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-3 h-3" style={{ color: TEAL_LIGHT }} />
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: TEAL_LIGHT }}>
                {patientName(n.patient_id)}
              </p>
              <span className="ml-auto text-[10px] text-slate-400">{new Date(n.created_at).toLocaleDateString()}</span>
            </div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{n.note}</p>
          </motion.div>
        ))}
        {!notes.length && (
          <div className="text-center text-sm text-slate-400 py-12 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.78)', border: '1px dashed rgba(31,111,84,0.08)' }}>
            No notes yet — capture your first observation above.
          </div>
        )}
      </div>
    </div>
  );
}
