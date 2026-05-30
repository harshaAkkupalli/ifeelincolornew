import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Plus, Trash2, Stethoscope, Pill, Activity, Heart, MapPin, BookOpen, Play, ListChecks, ImageIcon, ExternalLink, ClipboardList, FileDown, Download } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { BRAND } from '../../brand';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CAT_META = {
  diagnosis: { icon: Stethoscope, color: BRAND.pink, label: 'Diagnosis' },
  surgery: { icon: Activity, color: '#A78BFA', label: 'Surgery' },
  therapy: { icon: Heart, color: '#22D3C5', label: 'Therapy' },
  medication: { icon: Pill, color: '#FFD23F', label: 'Medication' },
  general: { icon: MapPin, color: BRAND.blue, label: 'Milestone' },
};

const ACT_META = {
  recommendation_saved: { icon: BookOpen, color: '#9D5BFF', label: 'Saved a recommendation' },
  doctor_subscribed: { icon: Stethoscope, color: '#22D3C5', label: 'Subscribed to a doctor' },
  assessment_completed: { icon: ClipboardList, color: BRAND.orange, label: 'Completed an assessment' },
};

const CONTENT_ICON = { video: Play, image: ImageIcon, steps: ListChecks, link: ExternalLink, text: BookOpen };

export default function PatientRoadmap() {
  const [events, setEvents] = useState([]);
  const [activity, setActivity] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', detail: '', date: '', category: 'general' });
  const [filter, setFilter] = useState('all'); // all | milestones | activity

  const loadEvents = async () => {
    const r = await axios.get(`${API}/patient/history`, { withCredentials: true });
    setEvents(r.data.events || []);
  };
  const loadActivity = async () => {
    const r = await axios.get(`${API}/patient/activity`, { withCredentials: true });
    setActivity(r.data.activity || []);
  };

  useEffect(() => { loadEvents(); loadActivity(); }, []);

  const add = async () => {
    if (!form.title.trim()) return;
    await axios.post(`${API}/patient/history`, form, { withCredentials: true });
    setForm({ title: '', detail: '', date: '', category: 'general' });
    setShowForm(false);
    loadEvents();
  };

  const remove = async (id) => {
    await axios.delete(`${API}/patient/history/${id}`, { withCredentials: true });
    loadEvents();
  };

  const exportCsv = async () => {
    try {
      const r = await axios.get(`${API}/patient/checkins/export`, { withCredentials: true, responseType: 'blob' });
      const blob = new Blob([r.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ifeelincolor-checkins-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* */ }
  };

  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const r = await axios.get(`${API}/patient/checkins/export`, { withCredentials: true });
    const lines = r.data.split(/\r?\n/);
    const headers = (lines[0] || '').split(',');
    const rows = lines.slice(1).filter(Boolean).map((l) => {
      const cols = l.split(',');
      return headers.reduce((acc, h, i) => ({ ...acc, [h]: cols[i] || '' }), {});
    });
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 50;
    doc.setFontSize(20); doc.setTextColor(255, 90, 106);
    doc.text('IFEELINCOLOR · My Journey', 40, y);
    y += 26;
    doc.setFontSize(10); doc.setTextColor(120, 120, 130);
    doc.text(`Exported ${new Date().toLocaleString()} · ${rows.length} check-ins`, 40, y);
    y += 24;
    doc.setFontSize(11); doc.setTextColor(30, 30, 50);
    rows.slice(0, 80).forEach((row, i) => {
      if (y > 760) { doc.addPage(); y = 50; }
      doc.setFont(undefined, 'bold');
      doc.text(`${i + 1}. ${row.date || ''} ${row.time || ''} · ${row.user_selected_emotion || ''}`, 40, y);
      y += 14;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9); doc.setTextColor(90, 90, 110);
      doc.text(`Body: ${row.starting_body_part || '—'} (${row.starting_sensation || '—'}) · Intensity ${row.intensity_rating_before || 0}→${row.intensity_rating_after || 0}`, 50, y);
      y += 12;
      if (row.journal_notes) {
        const wrap = doc.splitTextToSize(`Note: ${row.journal_notes}`, 500);
        doc.text(wrap, 50, y);
        y += wrap.length * 11;
      }
      y += 8;
      doc.setFontSize(11); doc.setTextColor(30, 30, 50);
    });
    doc.setFontSize(9); doc.setTextColor(150, 150, 160);
    doc.text('Developed by Projexino Solutions Pvt Ltd', 40, 820);
    doc.save(`ifeelincolor-journey-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Merge & sort
  const milestones = events.map(ev => ({
    kind: 'milestone',
    sort: ev.date || ev.created_at,
    ...ev,
  }));
  const activityItems = activity.map(a => ({
    kind: 'activity',
    sort: a.created_at,
    ...a,
  }));

  const combined = [...milestones, ...activityItems]
    .filter(it => filter === 'all' || (filter === 'milestones' ? it.kind === 'milestone' : it.kind === 'activity'))
    .sort((a, b) => (b.sort || '').localeCompare(a.sort || ''));

  return (
    <div className="px-5 pt-5 pb-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.pink }}>
          Your Journey
        </p>
        <h1 className="font-fredoka font-semibold text-3xl" style={{ color: '#1F1147' }}>
          Every milestone matters.
        </h1>
        <p className="text-sm font-nunito mt-1" style={{ color: '#5C4A85' }}>
          Your medical history & saved care moments, all in one place.
        </p>
      </motion.div>

      {/* Filter tabs */}
      <div className="mt-4 flex gap-2">
        {[
          { k: 'all', label: 'All' },
          { k: 'milestones', label: 'Milestones' },
          { k: 'activity', label: 'Activity' },
        ].map(t => (
          <button
            key={t.k}
            data-testid={`filter-${t.k}`}
            onClick={() => setFilter(t.k)}
            className="rounded-2xl px-4 py-2 font-nunito font-bold text-xs transition-all"
            style={{
              background: filter === t.k ? `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` : 'white',
              color: filter === t.k ? 'white' : '#1F1147',
              boxShadow: filter === t.k ? `0 10px 22px -8px ${BRAND.pink}66` : '0 6px 14px -8px rgba(0,0,0,0.08)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Button
        data-testid="add-milestone-btn"
        onClick={() => setShowForm(!showForm)}
        className="mt-4 w-full rounded-2xl h-12 font-nunito font-bold text-white border-0"
        style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}
      >
        <Plus className="w-4 h-4 mr-1" /> Add Milestone
      </Button>

      {/* 3D Assessment History entry */}
      <button
        data-testid="open-history-from-journey"
        onClick={() => window.location.assign('/app/history')}
        className="mt-3 w-full rounded-2xl h-12 font-nunito font-bold text-xs flex items-center justify-center gap-2 text-white"
        style={{
          background: 'linear-gradient(135deg, #22D3C5, #A78BFA, #FF4FBF)',
          boxShadow: '0 10px 24px -8px rgba(167,139,250,0.5)',
        }}
      >
        <Activity className="w-4 h-4" /> Open 3D Assessment History
      </button>

      {/* Export bar */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          data-testid="export-csv-btn"
          onClick={exportCsv}
          className="rounded-2xl h-11 font-nunito font-bold text-xs flex items-center justify-center gap-1.5"
          style={{ background: 'white', color: '#1F1147', border: `1px solid ${BRAND.pink}44`, boxShadow: '0 6px 14px -8px rgba(0,0,0,0.08)' }}>
          <FileDown className="w-3.5 h-3.5" style={{ color: BRAND.pink }} /> Export check-ins (CSV)
        </button>
        <button
          data-testid="export-pdf-btn"
          onClick={exportPdf}
          className="rounded-2xl h-11 font-nunito font-bold text-xs flex items-center justify-center gap-1.5"
          style={{ background: 'white', color: '#1F1147', border: `1px solid ${BRAND.orange}44`, boxShadow: '0 6px 14px -8px rgba(0,0,0,0.08)' }}>
          <Download className="w-3.5 h-3.5" style={{ color: BRAND.orange }} /> Download journey PDF
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 rounded-2xl p-4 space-y-2"
          style={{ background: 'white', boxShadow: '0 12px 28px -12px rgba(31,17,71,0.12)' }}
        >
          <input
            data-testid="milestone-title"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="What happened?"
            className="w-full rounded-xl p-3 text-sm font-nunito bg-pink-50/60 outline-none"
          />
          <textarea
            value={form.detail}
            onChange={e => setForm({ ...form, detail: e.target.value })}
            placeholder="Tell us more (optional)..."
            rows={2}
            className="w-full rounded-xl p-3 text-sm font-nunito bg-pink-50/60 outline-none resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              className="rounded-xl p-3 text-sm font-nunito bg-pink-50/60 outline-none"
            />
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className="rounded-xl p-3 text-sm font-nunito bg-pink-50/60 outline-none"
            >
              {Object.entries(CAT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <Button data-testid="save-milestone" onClick={add}
            className="w-full rounded-xl h-10 font-nunito font-bold text-white border-0"
            style={{ background: BRAND.pink }}>
            Save Milestone
          </Button>
        </motion.div>
      )}

      <div className="mt-6 relative">
        {combined.length === 0 ? (
          <p className="text-center text-sm font-nunito mt-12" style={{ color: '#9785B5' }}>
            Nothing yet. Your journey starts now. ✨
          </p>
        ) : (
          <div className="relative pl-8">
            <div className="absolute left-3 top-2 bottom-2 w-0.5 rounded-full"
              style={{ background: `linear-gradient(180deg, ${BRAND.pink}, ${BRAND.orange}, ${BRAND.yellow}, ${BRAND.green}, ${BRAND.blue})` }} />
            {combined.map((it, i) => {
              if (it.kind === 'milestone') {
                const m = CAT_META[it.category] || CAT_META.general;
                return (
                  <motion.div key={`m-${it.event_id}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="relative mb-4">
                    <div className="absolute -left-[1.4rem] top-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: m.color, boxShadow: `0 0 0 4px white, 0 0 14px ${m.color}88` }}>
                      <m.icon className="w-3 h-3 text-white" />
                    </div>
                    <div className="rounded-2xl p-4" style={{ background: 'white', boxShadow: `0 12px 24px -14px ${m.color}77` }}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-fredoka font-semibold text-sm" style={{ color: '#1F1147' }}>{it.title}</p>
                        <button data-testid={`del-${it.event_id}`} onClick={() => remove(it.event_id)} className="text-slate-300 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] font-nunito font-bold mb-1" style={{ color: m.color }}>{m.label} · {it.date}</p>
                      {it.detail && <p className="text-xs font-nunito" style={{ color: '#5C4A85' }}>{it.detail}</p>}
                    </div>
                  </motion.div>
                );
              }
              // activity
              const am = ACT_META[it.type] || { icon: Activity, color: BRAND.blue, label: it.type };
              const CI = it.content_type ? (CONTENT_ICON[it.content_type] || BookOpen) : null;
              return (
                <motion.div key={`a-${it.activity_id}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="relative mb-4">
                  <div className="absolute -left-[1.4rem] top-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: am.color, boxShadow: `0 0 0 4px white, 0 0 14px ${am.color}88` }}>
                    <am.icon className="w-3 h-3 text-white" />
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: 'white', boxShadow: `0 12px 24px -14px ${am.color}66` }}>
                    <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: am.color }}>
                      {am.label} · {(it.created_at || '').slice(0, 10)}
                    </p>
                    <p className="font-fredoka font-semibold text-sm mb-0.5" style={{ color: '#1F1147' }}>{it.title}</p>
                    {it.detail && <p className="text-xs font-nunito" style={{ color: '#5C4A85' }}>{it.detail}</p>}
                    {it.image_url && <img src={it.image_url} alt="" className="mt-2 w-full h-24 object-cover rounded-lg" />}
                    {it.steps?.length > 0 && (
                      <ol className="mt-2 space-y-1">
                        {it.steps.slice(0, 3).map((s, idx) => (
                          <li key={idx} className="text-[11px] font-nunito flex gap-2" style={{ color: '#5C4A85' }}>
                            <span className="font-bold">{idx + 1}.</span> {s}
                          </li>
                        ))}
                      </ol>
                    )}
                    {it.media_url && CI && (
                      <a href={it.media_url} target="_blank" rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold"
                        style={{ color: am.color }}>
                        <CI className="w-3 h-3" /> Open
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
