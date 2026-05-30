import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { History, Users, Brain, CheckCircle2, Lock, ChevronRight, Download, Sparkles } from 'lucide-react';
import jsPDF from 'jspdf';
import { Button } from '../../components/ui/button';
import { LOGO_URL, BRAND } from '../../brand';
import CheckInFlow from '../../components/checkin/CheckInFlow';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ICONS = { history: History, users: Users, brain: Brain };

// Convert remote logo (or any image URL) to base64 data URI for PDF embedding
async function urlToDataUri(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Severity icon as colored SVG → base64 PNG via canvas
function severityVisual(severity) {
  if (typeof document === 'undefined') return null;
  const map = {
    critical: { c: '#FF3B30', face: '😟', label: 'Needs immediate care' },
    high: { c: '#FF8C3F', face: '😣', label: 'Reach out soon' },
    moderate: { c: '#FFD23F', face: '😐', label: 'Keep an eye on it' },
    low: { c: '#22D67E', face: '🙂', label: 'Looking good' },
  };
  const m = map[severity] || map.low;
  const canvas = document.createElement('canvas');
  canvas.width = 220; canvas.height = 220;
  const ctx = canvas.getContext('2d');
  // background ring
  const g = ctx.createRadialGradient(110, 110, 20, 110, 110, 110);
  g.addColorStop(0, m.c + 'EE');
  g.addColorStop(1, m.c + '22');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(110, 110, 105, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(110, 110, 80, 0, Math.PI * 2); ctx.fill();
  // emoji-like circle
  ctx.fillStyle = m.c;
  ctx.font = 'bold 90px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(m.face, 110, 115);
  return canvas.toDataURL('image/png');
}

export default function PatientAssessmentHub() {
  const navigate = useNavigate();
  const [cats, setCats] = useState([]);
  const [progress, setProgress] = useState({});
  const [sub, setSub] = useState(null);
  const [responses, setResponses] = useState([]);

  const [lockToast, setLockToast] = useState('');

  const load = async () => {
    const c = await axios.get(`${API}/assessment-categories`);
    setCats(c.data.categories || []);
    const s = await axios.get(`${API}/me/subscription`, { withCredentials: true });
    setSub(s.data);
    const p = await axios.get(`${API}/patient/progress`, { withCredentials: true });
    setProgress(p.data.progress || {});
    const r = await axios.get(`${API}/patient/my-responses`, { withCredentials: true });
    setResponses(r.data.responses || []);
  };

  useEffect(() => { load(); }, []);

  // First-run flow: show all 3 category cards.
  // Once every category is completed (>=1 submission per cat), the hub
  // collapses into a single "Regular Check-in" launcher so the patient
  // doesn't repeat Treatment History & Health/Social Info each visit.
  const allCompleted = cats.length > 0 && cats.every((c) => progress[c.id]?.completed);
  const [showCheckin, setShowCheckin] = useState(false);

  const isLocked = (idx) => {
    if (!sub?.active) return true;
    if (idx === 0) return false;
    const prev = cats[idx - 1];
    return prev ? !progress[prev.id]?.completed : false;
  };

  const handleCategoryClick = (idx, cat) => {
    // Subscription gate — explicit, friendly redirect
    if (!sub?.active) {
      setLockToast('Please subscribe to a plan before starting the assessment.');
      setTimeout(() => navigate('/app/subscribe', { state: { fromAssessment: true } }), 1200);
      return;
    }
    // Sequence gate
    if (idx > 0) {
      const prev = cats[idx - 1];
      if (prev && !progress[prev.id]?.completed) {
        setLockToast(`Please complete "${prev.title}" first.`);
        setTimeout(() => setLockToast(''), 2400);
        return;
      }
    }
    navigate(`/app/assessment/run/${cat.id}`);
  };

  const finalResp = responses.find(r => r.category_id === 'assessment');

  // Fetch the EXACT question templates that the patient was shown, keyed by
  // category_id. Used by generatePDF to render real "Q: …  A: …" pairs
  // instead of opaque answer keys.
  const fetchQuestionsByCategory = async () => {
    const map = {};
    for (const c of cats) {
      try {
        const r = await axios.get(
          `${API}/patient/assessment-questions/${c.id}`,
          { withCredentials: true },
        );
        map[c.id] = r.data?.questions || [];
      } catch {
        map[c.id] = [];
      }
    }
    return map;
  };

  // Resolve a single answer value against its question template so the PDF
  // shows the patient-facing option label (e.g. "Often") rather than the
  // raw value "3" that the backend stored.
  const formatAnswer = (q, raw) => {
    if (raw === null || raw === undefined || raw === '') return '—';
    if (Array.isArray(raw)) {
      if (q?.options?.length) {
        // multi-select with option labels
        return raw
          .map((v) => q.options.find((o) => (o.value ?? o.id ?? o.label) === v)?.label || v)
          .join(', ');
      }
      return raw.join(', ');
    }
    if (typeof raw === 'object') return JSON.stringify(raw);
    if (q?.options?.length) {
      const opt = q.options.find((o) => (o.value ?? o.id ?? o.label) === raw);
      if (opt?.label) return opt.label;
    }
    if (q?.type === 'scale' && typeof raw === 'number') return `${raw}/10`;
    if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
    return String(raw);
  };

  // ── PDF Generation (Branded, neat, fully legible) ──
  const generatePDF = async () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const MARGIN = 40;
    const CONTENT_W = w - MARGIN * 2;

    // Pull EXACT questions the patient was shown, so the PDF prints
    // "Q1. <real question> — A: <real answer label>" for every response.
    const questionsByCat = await fetchQuestionsByCategory();

    // Brand palette (RGB tuples)
    const C = {
      ink:        [42, 26, 74],
      ink2:       [80, 80, 100],
      muted:      [120, 124, 148],
      line:       [228, 228, 240],
      pink:       [255, 79, 191],
      orange:     [255, 140, 63],
      yellow:     [255, 210, 63],
      green:      [34, 214, 126],
      teal:       [34, 211, 197],
      violet:     [167, 139, 250],
      // LIGHT tinted card backgrounds (no alpha hacks — jsPDF doesn't support alpha)
      tintViolet: [243, 240, 255],   // light lavender for Recommendations
      tintPink:   [255, 240, 250],
      tintTeal:   [232, 251, 249],
      tintYellow: [255, 250, 230],
      tintInk:    [248, 248, 252],   // neutral light surface
    };
    const setFill   = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    const setText   = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    const setStroke = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

    const ensure = (need) => { if (y + need > h - 50) { doc.addPage(); y = MARGIN + 20; } };

    /* ─── COVER HEADER ─────────────────────────────────────────────── */
    setFill(C.pink);   doc.rect(0, 0, w, 110, 'F');
    setFill(C.orange); doc.rect(0, 105, w, 6, 'F');
    setFill(C.yellow); doc.rect(0, 111, w, 3, 'F');

    const logoData = await urlToDataUri(LOGO_URL);
    if (logoData) { try { doc.addImage(logoData, 'JPEG', MARGIN, 22, 60, 60); } catch {} }

    setText([255, 255, 255]);
    doc.setFont('helvetica', 'bold').setFontSize(26);
    doc.text('IFEELINCOLOR', 115, 50);
    doc.setFont('helvetica', 'normal').setFontSize(11);
    doc.text('Patient Assessment & Wellbeing Report', 115, 70);
    doc.setFontSize(9);
    doc.text(
      new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      115, 86,
    );

    let y = 150;

    /* ─── TODAY'S SNAPSHOT ─────────────────────────────────────────── */
    if (finalResp?.severity) {
      const visual = severityVisual(finalResp.severity);
      if (visual) { try { doc.addImage(visual, 'PNG', w - 130, 22, 80, 80); } catch {} }

      setText(C.ink);
      doc.setFont('helvetica', 'bold').setFontSize(20);
      doc.text("Today's Snapshot", MARGIN, y);
      y += 6;
      setStroke(C.pink); doc.setLineWidth(2); doc.line(MARGIN, y + 2, MARGIN + 70, y + 2);
      y += 22;

      // Severity pill
      const sevMap = {
        critical: C.pink, high: C.orange, moderate: C.yellow, low: C.green,
      };
      const sevCol = sevMap[finalResp.severity] || C.muted;
      setFill(sevCol);
      doc.roundedRect(MARGIN, y - 14, 160, 26, 13, 13, 'F');
      setText([255, 255, 255]);
      doc.setFont('helvetica', 'bold').setFontSize(11);
      doc.text(`SEVERITY · ${finalResp.severity.toUpperCase()}`, MARGIN + 12, y + 3);
      y += 30;

      const blurbs = {
        critical: "We see you're going through a hard time. Your care team has been notified. Please consider reaching out today.",
        high: "Some signals are elevated. Schedule a check-in with your clinician this week.",
        moderate: "You're doing okay overall — a few areas to gently focus on.",
        low: "Your patterns look healthy. Keep showing up for yourself.",
      };
      setText(C.ink2);
      doc.setFont('helvetica', 'normal').setFontSize(11);
      const blurb = doc.splitTextToSize(blurbs[finalResp.severity] || '', CONTENT_W);
      blurb.forEach(line => { doc.text(line, MARGIN, y); y += 14; });
      y += 12;
    }

    /* ─── YOUR RESPONSES ───────────────────────────────────────────── */
    ensure(60);
    setText(C.ink);
    doc.setFont('helvetica', 'bold').setFontSize(16);
    doc.text('Your Responses', MARGIN, y);
    y += 4;
    setStroke(C.teal); doc.setLineWidth(1.5);
    doc.line(MARGIN, y + 2, MARGIN + 90, y + 2);
    y += 20;

    const catTints = {
      treatment_history: { accent: C.pink,   tint: C.tintPink },
      health_social:     { accent: C.teal,   tint: C.tintTeal },
      assessment:        { accent: C.yellow, tint: C.tintYellow },
    };

    responses.forEach((r) => {
      ensure(40);
      const { accent, tint } = catTints[r.category_id] || { accent: C.muted, tint: C.tintInk };
      const catLabel = (cats.find((c) => c.id === r.category_id)?.name)
        || r.category_id.replace(/_/g, ' ');

      // Category banner
      setFill(tint);
      setStroke(accent); doc.setLineWidth(0.6);
      doc.roundedRect(MARGIN, y - 4, CONTENT_W, 22, 6, 6, 'FD');
      setFill(accent);
      doc.roundedRect(MARGIN, y - 4, 3, 22, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(10.5);
      setText(accent);
      doc.text(catLabel.toUpperCase(), MARGIN + 12, y + 11);
      y += 28;

      // Build a quick lookup from answer-key → question template, so we can
      // print the EXACT question text the patient saw on screen.
      const qList = questionsByCat[r.category_id] || [];
      const qById = {};
      qList.forEach((q, idx) => {
        const key = q.id ?? q.key ?? q.slug ?? `q${idx + 1}`;
        qById[key] = { ...q, _idx: idx };
      });

      // Render every saved answer as a Q/A pair.
      const entries = Object.entries(r.answers || {});
      if (entries.length === 0) {
        ensure(14);
        doc.setFont('helvetica', 'italic').setFontSize(9.5);
        setText(C.muted);
        doc.text('(No answers recorded)', MARGIN + 12, y);
        y += 14;
      }
      entries.forEach(([k, v], i) => {
        const q = qById[k];
        const qText = q?.text || q?.question || q?.label || k;
        const aText = formatAnswer(q, v);
        const qNum = q ? q._idx + 1 : i + 1;

        // ── Question line ──
        ensure(18);
        doc.setFont('helvetica', 'bold').setFontSize(9.5);
        setText(C.ink);
        const qPrefix = `Q${qNum}. `;
        doc.text(qPrefix, MARGIN + 12, y);
        const qPrefixW = doc.getTextWidth(qPrefix);
        doc.setFont('helvetica', 'normal');
        const qLines = doc.splitTextToSize(qText, CONTENT_W - 24 - qPrefixW);
        qLines.forEach((ln, idx) => {
          if (idx > 0) { ensure(12); }
          doc.text(ln, MARGIN + 12 + (idx === 0 ? qPrefixW : qPrefixW), y);
          y += 12;
        });

        // ── Answer line (indented, with "A:" label) ──
        ensure(14);
        doc.setFont('helvetica', 'bold').setFontSize(9);
        setText(accent);
        doc.text('A: ', MARGIN + 24, y);
        const aPrefixW = doc.getTextWidth('A: ');
        doc.setFont('helvetica', 'normal').setFontSize(9.5);
        setText(C.ink2);
        const aLines = doc.splitTextToSize(aText, CONTENT_W - 36 - aPrefixW);
        aLines.forEach((ln, idx) => {
          if (idx > 0) { ensure(12); }
          doc.text(ln, MARGIN + 24 + (idx === 0 ? aPrefixW : aPrefixW), y);
          y += 12;
        });
        y += 4;
      });
      y += 8;
    });

    /* ─── YOUR CARE RECOMMENDATIONS ────────────────────────────────── */
    if (finalResp?.recommendations?.length) {
      ensure(80);
      setText(C.ink);
      doc.setFont('helvetica', 'bold').setFontSize(16);
      doc.text('Your Care Recommendations', MARGIN, y);
      y += 4;
      setStroke(C.violet); doc.setLineWidth(1.5);
      doc.line(MARGIN, y + 2, MARGIN + 160, y + 2);
      y += 20;

      finalResp.recommendations.forEach((rec, idx) => {
        // Pre-compute card height so we can ensure space + draw a single card
        doc.setFont('helvetica', 'bold').setFontSize(11.5);
        const titleLines = doc.splitTextToSize(rec.title || `Recommendation ${idx + 1}`, CONTENT_W - 60);
        doc.setFont('helvetica', 'normal').setFontSize(9.5);
        const bodyLines = doc.splitTextToSize(rec.description || '', CONTENT_W - 60);
        const cardH = 18 + titleLines.length * 14 + bodyLines.length * 12 + 14;
        ensure(cardH + 8);

        // Card — LIGHT lavender background (was the bug: solid dark purple)
        setFill(C.tintViolet);
        setStroke(C.violet); doc.setLineWidth(0.6);
        doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 10, 10, 'FD');
        // Accent stripe
        setFill(C.violet);
        doc.roundedRect(MARGIN, y, 3, cardH, 1.5, 1.5, 'F');
        // Numbered violet circle
        setFill(C.violet);
        doc.circle(MARGIN + 24, y + 22, 11, 'F');
        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(10);
        doc.text(String(idx + 1), MARGIN + 24, y + 26, { align: 'center' });
        // Title
        setText(C.ink);
        doc.setFont('helvetica', 'bold').setFontSize(11.5);
        let ty = y + 18;
        titleLines.forEach((ln) => { doc.text(ln, MARGIN + 44, ty); ty += 14; });
        // Body
        setText(C.ink2);
        doc.setFont('helvetica', 'normal').setFontSize(9.5);
        ty += 2;
        bodyLines.forEach((ln) => { doc.text(ln, MARGIN + 44, ty); ty += 12; });
        y += cardH + 10;
      });
    }

    /* ─── FOOTER on every page ────────────────────────────────────── */
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      setFill([31, 17, 71]);
      doc.rect(0, h - 30, w, 30, 'F');
      doc.setFontSize(8);
      setText([255, 255, 255]);
      doc.text(`Developed by Projexino Solutions Pvt Ltd  ·  © ${new Date().getFullYear()} IFEELINCOLOR`, MARGIN, h - 12);
      doc.text(`Page ${i} of ${total}`, w - 80, h - 12);
    }

    doc.save(`IFEELINCOLOR_Report_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div className="px-5 pt-5 pb-6">
      {/* Lock toast */}
      <AnimatePresence>
        {lockToast && (
          <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
            data-testid="assessment-lock-toast"
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl text-white font-bold text-sm max-w-[300px] text-center shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #FF6B6B, #FF3B30)' }}>
            <Lock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />{lockToast}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.pink }}>
          Your Journey
        </p>
        <h1 className="font-fredoka font-semibold text-3xl" style={{ color: '#2A1A4A' }}>
          Three steps to feel seen.
        </h1>
        <p className="text-sm font-nunito mt-1" style={{ color: '#6B5784' }}>
          Take your time. Each step builds on the last.
        </p>
      </motion.div>

      {!sub?.active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="mt-4 rounded-2xl p-4 flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})`, boxShadow: `0 12px 30px -10px ${BRAND.pink}66` }}
        >
          <Lock className="w-5 h-5 text-white shrink-0" />
          <div className="flex-1">
            <p className="font-fredoka font-semibold text-white text-sm">Subscription required</p>
            <p className="text-[11px] font-nunito text-white/85">Unlock to start your assessments</p>
          </div>
          <Button
            data-testid="hub-subscribe-cta"
            onClick={() => navigate('/app/subscribe')}
            className="rounded-full h-9 px-4 text-xs font-bold bg-white text-pink-600 border-0"
            style={{ color: BRAND.pink }}
          >
            Subscribe
          </Button>
        </motion.div>
      )}

      <div className="mt-6 space-y-3">
        {allCompleted ? (
          /* All 3 categories completed: collapse into a single "Regular Check-in" launcher.
             Tapping it mounts the same 9-step CheckInFlow used by Step-3 — directly
             starting at the 3D Body Map. After completion the patient lands on the
             result/PDF screen and the Journey page auto-refreshes on next visit. */
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 160, damping: 18 }}
            className="rounded-3xl p-6 text-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #FFE4F6 0%, #F0E4FF 50%, #E0F8FF 100%)',
              boxShadow: '0 20px 50px -16px rgba(167,139,250,0.45)',
              border: '1px solid rgba(167,139,250,0.25)',
            }}
            data-testid="regular-checkin-launcher"
          >
            <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-30"
              style={{ background: `radial-gradient(circle, ${BRAND.pink}, transparent 70%)` }} />
            <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full opacity-25"
              style={{ background: `radial-gradient(circle, #22D3C5, transparent 70%)` }} />
            <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-2"
              style={{ color: BRAND.pink }} data-testid="all-completed-hint">
              <CheckCircle2 className="w-3 h-3 inline -mt-0.5 mr-1" />
              All onboarding assessments completed
            </p>
            <h2 className="font-fredoka font-semibold text-2xl mb-1" style={{ color: '#2A1A4A' }}>
              Welcome back ✨
            </h2>
            <p className="text-sm font-nunito mb-5 max-w-xs mx-auto" style={{ color: '#6B5784' }}>
              From here on, your Regular Check-in is the heartbeat of your care plan.
              It takes ~2 minutes and updates your Journey instantly.
            </p>
            <motion.button
              whileHover={{ scale: 1.06, rotate: -2 }}
              whileTap={{ scale: 0.95 }}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              onClick={() => setShowCheckin(true)}
              data-testid="start-regular-checkin"
              className="relative inline-flex items-center justify-center w-32 h-32 rounded-full text-white font-fredoka font-bold"
              style={{
                background: `radial-gradient(circle at 30% 25%, #ffffff44, transparent 55%), conic-gradient(from 200deg, ${BRAND.pink}, #FF7AB6, #A78BFA, #22D3C5, ${BRAND.pink})`,
                boxShadow: '0 24px 60px -16px rgba(255,79,191,0.6), 0 0 0 6px rgba(255,255,255,0.5) inset',
                transformStyle: 'preserve-3d',
              }}
            >
              <span className="absolute inset-2 rounded-full"
                style={{ background: 'radial-gradient(circle at 40% 30%, rgba(255,255,255,0.85), rgba(255,255,255,0) 55%)' }} />
              <span className="relative flex flex-col items-center">
                <Sparkles className="w-7 h-7 mb-1" />
                <span className="text-base">Regular</span>
                <span className="text-base -mt-1">Check-in</span>
              </span>
            </motion.button>
            <p className="text-[11px] font-nunito mt-5" style={{ color: '#8F84A8' }}>
              Goes straight to the 3D Body Map — no extra steps.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                data-testid="view-journey-from-hub"
                onClick={() => navigate('/app/roadmap')}
                className="text-xs font-nunito font-bold px-3 py-1.5 rounded-full"
                style={{ background: 'white', color: BRAND.pink, border: `1px solid ${BRAND.pink}33` }}
              >
                View Journey →
              </button>
            </div>
          </motion.div>
        ) : cats.map((cat, idx) => {
          const Icon = ICONS[cat.icon] || History;
          const done = progress[cat.id]?.completed;
          const locked = isLocked(idx);
          return (
            <motion.button
              key={cat.id}
              data-testid={`assessment-card-${cat.id}`}
              data-completed={done ? 'true' : 'false'}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleCategoryClick(idx, cat)}
              className="w-full text-left rounded-3xl p-5 flex items-center gap-4 relative overflow-hidden"
              style={{
                background: done
                  ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 60%, #A7F3D0 100%)'
                  : 'white',
                boxShadow: done
                  ? `0 16px 38px -10px ${BRAND.green}88, inset 0 0 0 2px ${BRAND.green}55`
                  : `0 16px 38px -12px ${cat.color}44`,
                border: done ? `1px solid ${BRAND.green}66` : `1px solid ${cat.color}22`,
              }}
            >
              {/* Completed ribbon — top-right corner */}
              {done && (
                <motion.div
                  initial={{ scale: 0, rotate: -20, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                  className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${BRAND.green}, #16A34A)`,
                    boxShadow: `0 8px 18px -4px ${BRAND.green}aa`,
                  }}
                  data-testid={`completed-badge-${cat.id}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  <span className="text-[10px] font-nunito font-bold text-white tracking-wide uppercase">Completed</span>
                </motion.div>
              )}
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-30"
                style={{ background: `radial-gradient(circle, ${done ? BRAND.green : cat.color}, transparent 70%)` }} />
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 relative"
                style={{
                  background: done ? `linear-gradient(135deg, ${BRAND.green}, #16A34A)` : `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)`,
                  boxShadow: done ? `0 10px 20px -6px ${BRAND.green}aa` : `0 10px 20px -6px ${cat.color}88`,
                }}>
                {done ? <CheckCircle2 className="w-7 h-7 text-white" strokeWidth={2.5} /> : <Icon className="w-7 h-7 text-white" />}
              </div>
              <div className="flex-1 min-w-0 relative">
                <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-0.5" style={{ color: done ? '#059669' : '#A599B8' }}>
                  Step {idx + 1}{done ? ' · Done' : ''}
                </p>
                <p className="font-fredoka font-semibold text-lg" style={{ color: done ? '#064E3B' : '#2A1A4A' }}>{cat.title}</p>
                <p className="text-[11px] font-nunito mt-0.5" style={{ color: done ? '#047857' : (progress[cat.id]?.has_partial ? '#FF8C3F' : '#8F84A8') }}>
                  {done ? 'You completed this assessment — tap to review your answers.' : locked ? 'Complete previous step first'
                    : progress[cat.id]?.has_partial ? `Resume from question ${(progress[cat.id]?.partial_question_index || 0) + 1}`
                    : 'Tap to begin'}
                </p>
              </div>
              {locked
                ? <Lock data-testid={`lock-${cat.id}`} className="w-5 h-5 text-slate-300" />
                : done
                  ? <CheckCircle2 className="w-6 h-6" style={{ color: BRAND.green }} strokeWidth={2.5} />
                  : <ChevronRight className="w-5 h-5" style={{ color: cat.color }} />}
            </motion.button>
          );
        })}
      </div>

      {finalResp && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl p-5"
          style={{ background: 'white', boxShadow: '0 16px 38px -14px rgba(26,35,50,0.15)' }}
        >
          <p className="text-xs font-nunito font-bold uppercase tracking-widest mb-2" style={{ color: BRAND.pink }}>
            Your Report
          </p>
          <p className="font-fredoka font-semibold text-base mb-2" style={{ color: '#2A1A4A' }}>
            All done! Download your branded report below.
          </p>
          <Button
            data-testid="download-pdf-btn"
            onClick={generatePDF}
            className="w-full rounded-2xl h-12 font-nunito font-bold text-white border-0"
            style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}
          >
            <Download className="w-4 h-4 mr-2" /> Download IFEELINCOLOR PDF
          </Button>
          {finalResp.severity === 'critical' && (
            <div className="mt-3 rounded-xl p-3 text-xs font-nunito"
              style={{ background: '#FFF1F1', color: '#B91C1C', border: '1px solid #FCA5A5' }}>
              Your responses suggest you may need immediate support. The Home tab has an Emergency button.
            </div>
          )}
        </motion.div>
      )}

      {/* Mounted overlay: Regular Check-in (returning patients only) */}
      {showCheckin && (
        <CheckInFlow
          onClose={() => setShowCheckin(false)}
          onComplete={async () => {
            setShowCheckin(false);
            // Record the recurring Regular Check-in as a Step-3 assessment
            // submission too, so /api/patient/progress + /api/patient/my-responses
            // reflect the latest result on the Journey page. CheckInFlow already
            // wrote a row to patient_checkins via its internal POST /api/checkins.
            try {
              await axios.post(`${API}/patient/assessment-submit`, {
                category_id: 'assessment',
                answers: { _daily_checkin: 'completed', triggered_from: 'regular_checkin_hub' },
                is_final: true,
              }, { withCredentials: true });
            } catch { /* non-fatal — check-in is already saved */ }
            await load();
            navigate('/app/roadmap');
          }}
        />
      )}
    </div>
  );
}
