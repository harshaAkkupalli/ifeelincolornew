import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * IFEELINCOLOR Health Dossier — v3 (premium / non-overlapping layout).
 *
 * Every section uses a single shared `y` cursor and `ensureSpace()` before
 * drawing so blocks never overlap. No absolutely positioned cards. Each
 * "card" is computed first (so we know its height), then we ensureSpace
 * and draw it, then advance `y`.
 *
 * Pages produced (in order):
 *   • Cover hero (logo + brand + timestamp + patient strip)
 *   • Patient demographics card
 *   • Wellbeing snapshot (severity + intensity Δ + color shift)
 *   • AI plan (if any)
 *   • Somatic summary (body-map snapshot if provided)
 *   • Assessment Q&A (Cat 1/2/3 first time, latest-only on recurring)
 *   • Color shift analytics
 *   • Care blueprint (recommendations)
 *   • Optional time-slider snapshot
 *
 * Args:
 *   opts.patient        { name, email, dob?, role, joinedAt? }
 *   opts.checkins       Array<PatientCheckIn>  (newest first)
 *   opts.recommendations Array
 *   opts.assessments?   Array (newest first)
 *   opts.bodyMapEl?     HTMLElement to snapshot
 *   opts.timelineEl?    HTMLElement to snapshot
 */
export async function generateHealthDossier({
  patient = {},
  checkins = [],
  recommendations = [],
  assessments = [],
  bodyMapEl,
  timelineEl,
}) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const PAGE_W = pdf.internal.pageSize.getWidth();
  const PAGE_H = pdf.internal.pageSize.getHeight();
  const MARGIN = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let y = MARGIN;

  /* ─── Palette ─────────────────────────────────────────────────── */
  const C = {
    ink:    [20, 24, 60],
    ink2:   [55, 60, 90],
    muted:  [120, 124, 148],
    line:   [228, 228, 240],
    pink:   [255, 79, 191],
    orange: [255, 122, 0],
    yellow: [255, 210, 63],
    green:  [34, 214, 126],
    teal:   [34, 211, 197],
    blue:   [96, 165, 250],
    violet: [167, 139, 250],
    sky:    [240, 247, 255],
    surface:[250, 250, 254],
  };
  const SEV = { critical: C.pink, high: C.orange, moderate: C.yellow, low: C.green };
  const HEX = {
    Red:[255,59,48], Orange:[255,122,0], Yellow:[255,210,63],
    Green:[34,214,126], Blue:[96,165,250], Purple:[167,139,250],
    Grey:[148,163,184], Gray:[148,163,184], Pink:[255,79,191], Teal:[34,211,197],
  };
  const colorOf = (n) => HEX[(n || '').trim()] || [127, 227, 255];

  /* ─── Primitive helpers ───────────────────────────────────────── */
  const setText = (rgb) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFill = (rgb) => pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setStroke = (rgb) => pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);

  const ensureSpace = (h) => {
    if (y + h > PAGE_H - MARGIN - 30) {
      pdf.addPage();
      y = MARGIN;
    }
  };

  const gradientBar = (yPos, h, stops) => {
    const strips = 140;
    for (let i = 0; i < strips; i++) {
      const t = i / (strips - 1);
      const seg = t * (stops.length - 1);
      const s = Math.min(stops.length - 2, Math.floor(seg));
      const k = seg - s;
      const a = stops[s], b = stops[s + 1];
      setFill([
        Math.round(a[0] + (b[0] - a[0]) * k),
        Math.round(a[1] + (b[1] - a[1]) * k),
        Math.round(a[2] + (b[2] - a[2]) * k),
      ]);
      pdf.rect(MARGIN + i * (CONTENT_W / strips), yPos, (CONTENT_W / strips) + 0.6, h, 'F');
    }
  };

  const text = (str, x, yy, opts = {}) => {
    const { size = 10, bold = false, italic = false, color = C.ink, align = 'left' } = opts;
    pdf.setFont('helvetica', bold ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal'));
    pdf.setFontSize(size);
    setText(color);
    pdf.text(str, x, yy, { align });
  };

  const wrap = (str, maxW, opts = {}) => {
    const { size = 10, bold = false, italic = false, color = C.ink2, lineH = 1.35 } = opts;
    if (!str) return 0;
    pdf.setFont('helvetica', bold ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal'));
    pdf.setFontSize(size);
    setText(color);
    const lines = pdf.splitTextToSize(String(str), maxW);
    const step = size * lineH;
    lines.forEach((ln) => {
      ensureSpace(step + 2);
      pdf.text(ln, MARGIN, y);
      y += step;
    });
    return lines.length * step;
  };

  const sectionTitle = (label, accent = C.pink, eyebrow = null) => {
    ensureSpace(50);
    if (eyebrow) {
      text(eyebrow.toUpperCase(), MARGIN, y, { size: 8, bold: true, color: accent });
      y += 12;
    }
    // Accent block + title
    setFill(accent);
    pdf.rect(MARGIN, y, 4, 22, 'F');
    text(label, MARGIN + 14, y + 16, { size: 16, bold: true, color: C.ink });
    // Hairline
    setStroke(C.line);
    pdf.setLineWidth(0.4);
    pdf.line(MARGIN, y + 30, PAGE_W - MARGIN, y + 30);
    y += 40;
  };

  const drawCard = (h, fill = [255, 255, 255], border = C.line, radius = 12) => {
    ensureSpace(h + 4);
    setFill(fill);
    setStroke(border);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(MARGIN, y, CONTENT_W, h, radius, radius, 'FD');
    return { cardY: y, cardH: h };
  };

  const pill = (label, color, x, yy, padX = 8, padY = 4) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    const w = pdf.getTextWidth(label) + padX * 2;
    setFill(color);
    pdf.roundedRect(x, yy - 9, w, 14, 7, 7, 'F');
    setText([255, 255, 255]);
    pdf.text(label, x + padX, yy);
    return w;
  };

  const keyValueRow = (k, v, leftX = MARGIN + 18, valX = MARGIN + 150) => {
    ensureSpace(18);
    text(k, leftX, y, { size: 9.5, bold: true, color: C.muted });
    const split = pdf.splitTextToSize(String(v ?? '—'), CONTENT_W - 130);
    text(split[0] || '—', valX, y, { size: 10, color: C.ink });
    if (split.length > 1) {
      let yy = y + 13;
      for (let i = 1; i < split.length; i++) {
        text(split[i], valX, yy, { size: 10, color: C.ink });
        yy += 13;
      }
      y = yy + 4;
    } else {
      y += 18;
    }
  };

  const captureNode = async (el) => {
    if (!el) return null;
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#0B0218',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      return { url: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height };
    } catch (e) {
      console.warn('html2canvas failed:', e);
      return null;
    }
  };

  /* ─────────────────────────────────────────────────────────────────
   *  PAGE 1 — Cover hero
   * ───────────────────────────────────────────────────────────────── */
  // Full-bleed top band
  pdf.setFillColor(20, 12, 50);
  pdf.rect(0, 0, PAGE_W, 220, 'F');
  // Gradient strip
  const stripY = 0;
  const strips = 240;
  const stops = [[20, 12, 50], [123, 36, 110], [255, 79, 191], [255, 122, 0], [255, 210, 63]];
  for (let i = 0; i < strips; i++) {
    const t = i / (strips - 1);
    const seg = t * (stops.length - 1);
    const s = Math.min(stops.length - 2, Math.floor(seg));
    const k = seg - s;
    const a = stops[s], b = stops[s + 1];
    setFill([
      Math.round(a[0] + (b[0] - a[0]) * k),
      Math.round(a[1] + (b[1] - a[1]) * k),
      Math.round(a[2] + (b[2] - a[2]) * k),
    ]);
    pdf.rect(i * (PAGE_W / strips), stripY, (PAGE_W / strips) + 0.6, 220, 'F');
  }
  // Soft overlay for legibility
  pdf.setFillColor(0, 0, 0);
  pdf.setGState(new pdf.GState({ opacity: 0.18 }));
  pdf.rect(0, 0, PAGE_W, 220, 'F');
  pdf.setGState(new pdf.GState({ opacity: 1 }));

  // Brand chip
  text('IFEELINCOLOR', MARGIN, 60, { size: 9, bold: true, color: [255, 255, 255] });
  // Title
  text('Health Dossier', MARGIN, 110, { size: 32, bold: true, color: [255, 255, 255] });
  text('Personal wellbeing report', MARGIN, 138, { size: 12, color: [240, 220, 255] });
  // Date stamp
  const now = new Date();
  text(now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    MARGIN, 168, { size: 10, color: [220, 200, 240] });
  // Hero patient name (top-right block)
  text((patient.name || 'Patient').toUpperCase(),
    PAGE_W - MARGIN, 110, { size: 16, bold: true, color: [255, 255, 255], align: 'right' });
  text(patient.email || '',
    PAGE_W - MARGIN, 130, { size: 10, color: [220, 200, 240], align: 'right' });
  // Decorative dots
  [120, 170, 220].forEach((cx, i) => {
    pdf.setFillColor([255, 79, 191], [255, 210, 63], [34, 211, 197][i]);
  });
  // Skip decorative dots loop above — placeholder
  // Move cursor below band
  y = 246;

  /* ─── Patient demographics card ───────────────────────────────── */
  sectionTitle('Patient Demographics', C.violet, 'Section 01');
  const demoRows = [
    ['Full name', patient.name || '—'],
    ['Email', patient.email || '—'],
    patient.dob ? ['Date of birth', patient.dob] : null,
    ['Role', (patient.role || 'patient').replace(/^./, c => c.toUpperCase())],
    ['Member since', patient.joinedAt ? new Date(patient.joinedAt).toLocaleDateString() : '—'],
    ['Total check-ins', String(checkins.length)],
    ['Assessments completed', String(assessments.length)],
  ].filter(Boolean);
  const demoH = demoRows.length * 18 + 18;
  drawCard(demoH, C.surface);
  y += 10;
  demoRows.forEach(([k, v]) => keyValueRow(k, v));
  y += 10;

  /* ─── Wellbeing snapshot (severity + intensity Δ + color shift) ─ */
  const latestStep3 = assessments.find(a => (a.category_id || '') === 'assessment');
  const latestCheckin = checkins[0];
  const sev = String(latestStep3?.severity || 'low').toLowerCase();
  const sevColor = SEV[sev] || C.green;

  sectionTitle('Wellbeing Snapshot', sevColor, 'Section 02');

  // Card 1: severity ring (its own card)
  const ringH = 150;
  drawCard(ringH);
  const ringCx = MARGIN + 90;
  const ringCy = y + 75;
  // halo
  for (let i = 5; i >= 1; i--) {
    setFill(sevColor);
    pdf.setGState(new pdf.GState({ opacity: 0.08 + (6 - i) * 0.02 }));
    pdf.circle(ringCx, ringCy, 38 + i * 4, 'F');
  }
  pdf.setGState(new pdf.GState({ opacity: 1 }));
  setFill(sevColor); pdf.circle(ringCx, ringCy, 38, 'F');
  setFill([255, 255, 255]); pdf.circle(ringCx, ringCy, 28, 'F');
  text(sev.charAt(0).toUpperCase(), ringCx, ringCy + 7, { size: 22, bold: true, color: sevColor, align: 'center' });
  text('SEVERITY', ringCx, ringCy + 22, { size: 7, bold: true, color: C.muted, align: 'center' });
  // Side meta
  text('Current state', MARGIN + 150, y + 30, { size: 9, bold: true, color: C.muted });
  text(sev.toUpperCase(), MARGIN + 150, y + 50, { size: 20, bold: true, color: sevColor });
  text(latestStep3?.submitted_at
    ? `Last assessment · ${new Date(latestStep3.submitted_at).toLocaleDateString()}`
    : 'No assessment on record yet',
    MARGIN + 150, y + 70, { size: 9, color: C.muted });
  // legend pills
  let px = MARGIN + 150;
  ['low', 'moderate', 'high', 'critical'].forEach((s) => {
    px += pill(s.toUpperCase(), s === sev ? SEV[s] : C.muted, px, y + 110, 7, 3) + 6;
  });
  y += ringH + 14;

  // Card 2: color shift journey
  if (latestCheckin) {
    const cardH = 130;
    drawCard(cardH);
    text('Color Shift', MARGIN + 16, y + 24, { size: 11, bold: true, color: C.ink });
    text('Where the body energy started and where it ended.',
      MARGIN + 16, y + 40, { size: 9, color: C.muted });
    const startName = latestCheckin.user_selected_color || 'Blue';
    const endName = latestCheckin.ending_color || startName;
    const sc = colorOf(startName);
    const ec = colorOf(endName);
    const journeyY = y + 80;
    const trackLeft = MARGIN + 30;
    const trackRight = MARGIN + CONTENT_W - 30;
    // line gradient
    const dotR = 12;
    const trackW = trackRight - trackLeft - dotR * 2;
    const segments = 80;
    for (let i = 0; i < segments; i++) {
      const t = i / (segments - 1);
      setFill([
        Math.round(sc[0] + (ec[0] - sc[0]) * t),
        Math.round(sc[1] + (ec[1] - sc[1]) * t),
        Math.round(sc[2] + (ec[2] - sc[2]) * t),
      ]);
      pdf.rect(trackLeft + dotR + i * (trackW / segments), journeyY - 2, trackW / segments + 0.6, 4, 'F');
    }
    // start dot
    setFill(sc); pdf.circle(trackLeft + dotR, journeyY, dotR, 'F');
    setFill([255, 255, 255]); pdf.circle(trackLeft + dotR, journeyY, dotR - 3, 'F');
    setFill(sc); pdf.circle(trackLeft + dotR, journeyY, dotR - 7, 'F');
    text(startName, trackLeft + dotR, journeyY + 24, { size: 9, bold: true, color: C.ink, align: 'center' });
    text('STARTED', trackLeft + dotR, journeyY + 35, { size: 7, color: C.muted, align: 'center' });
    // end dot
    setFill(ec); pdf.circle(trackRight - dotR, journeyY, dotR, 'F');
    setFill([255, 255, 255]); pdf.circle(trackRight - dotR, journeyY, dotR - 3, 'F');
    setFill(ec); pdf.circle(trackRight - dotR, journeyY, dotR - 7, 'F');
    text(endName, trackRight - dotR, journeyY + 24, { size: 9, bold: true, color: C.ink, align: 'center' });
    text('ENDED', trackRight - dotR, journeyY + 35, { size: 7, color: C.muted, align: 'center' });
    y += cardH + 14;

    // Card 3: intensity delta
    const ib = Number(latestCheckin.intensity_rating_before ?? 0);
    const ia = Number(latestCheckin.intensity_rating_after ?? 0);
    const delta = ia - ib;
    const deltaColor = delta < 0 ? C.green : delta > 0 ? C.orange : C.violet;
    const intH = 70;
    drawCard(intH);
    text('Intensity', MARGIN + 16, y + 24, { size: 11, bold: true, color: C.ink });
    text(`${ib} → ${ia}`, MARGIN + 16, y + 50, { size: 22, bold: true, color: deltaColor });
    const deltaLabel = `${delta > 0 ? '+' : ''}${delta}`;
    text(deltaLabel, MARGIN + CONTENT_W - 28, y + 44, { size: 28, bold: true, color: deltaColor, align: 'right' });
    text(delta < 0 ? 'IMPROVED' : delta > 0 ? 'INCREASED' : 'STEADY',
      MARGIN + CONTENT_W - 28, y + 58, { size: 8, bold: true, color: C.muted, align: 'right' });
    y += intH + 14;
  }

  /* ─── AI plan ─────────────────────────────────────────────────── */
  if (latestStep3?.ai_plan) {
    const ap = latestStep3.ai_plan;
    sectionTitle('Personalized AI Plan', C.violet, 'Section 03');
    if (ap.summary) wrap(ap.summary, CONTENT_W);
    if (Array.isArray(ap.next_steps) && ap.next_steps.length) {
      y += 6;
      text('Next steps', MARGIN, y, { size: 11, bold: true, color: C.ink });
      y += 16;
      ap.next_steps.forEach((s) => wrap(`•  ${s}`, CONTENT_W - 12, { color: C.ink2 }));
    }
    if (ap.encouragement) {
      y += 4;
      wrap(`"${ap.encouragement}"`, CONTENT_W, { italic: true, color: C.violet });
    }
    y += 8;
  }

  /* ─── Somatic summary (body map snapshot) ─────────────────────── */
  if (bodyMapEl) {
    sectionTitle('Somatic Summary', C.teal, 'Section 04');
    const cap = await captureNode(bodyMapEl);
    if (cap) {
      const imgW = 200;
      const imgH = Math.min(280, (cap.h / cap.w) * imgW);
      ensureSpace(imgH + 20);
      // Card backing
      const innerH = Math.max(imgH + 16, 220);
      drawCard(innerH, C.sky, C.line);
      // image
      pdf.addImage(cap.url, 'PNG', MARGIN + 16, y + 8, imgW, imgH);
      // sidebar
      const sx = MARGIN + 16 + imgW + 18;
      let sy = y + 24;
      text('SELECTED CHECK-IN', sx, sy, { size: 8, bold: true, color: C.muted }); sy += 14;
      if (latestCheckin) {
        const rows = [
          ['Date', latestCheckin.created_at ? new Date(latestCheckin.created_at).toLocaleDateString() : '—'],
          ['Body part', String(latestCheckin.starting_body_part || '—').replace(/_/g, ' ')],
          ['Sensation', latestCheckin.starting_sensation || '—'],
          ['Emotion', latestCheckin.user_selected_emotion || '—'],
          ['Start color', latestCheckin.user_selected_color || '—'],
          ['End color', latestCheckin.ending_color || '—'],
        ];
        rows.forEach(([k, v]) => {
          text(k, sx, sy, { size: 9, color: C.muted });
          text(String(v), sx + 70, sy, { size: 9.5, bold: true, color: C.ink });
          sy += 16;
        });
      }
      y += innerH + 14;
    }
  }

  /* ─── Assessment Q&A ──────────────────────────────────────────── */
  const cat1 = assessments.find(a => (a.category_id || '') === 'treatment_history');
  const cat2 = assessments.find(a => (a.category_id || '') === 'health_social');
  const step3List = assessments.filter(a => (a.category_id || '') === 'assessment');
  const isRecurring = step3List.length > 1;

  // Friendly fallback labels for legacy seed question IDs
  const LEGACY_Q = {
    th1: 'Have you been hospitalised in the past 5 years?',
    th2: 'Any chronic conditions or ongoing treatments?',
    th3: 'Are you currently on any medication?',
    th4: 'Have you spoken to a mental-health professional before?',
    hs1: 'How would you describe your current social support?',
    hs2: 'Are you experiencing any major life stressors right now?',
    hs3: 'How is your overall sleep quality?',
    hs4: 'How active have you been this week?',
    a1: 'Over the past 2 weeks, how often have you felt down or hopeless?',
    a2: 'Over the past 2 weeks, how often have you felt anxious or on edge?',
    a3: 'Over the past 2 weeks, how often have you lost interest in things you usually enjoy?',
    a4: 'How would you describe your energy levels?',
    a5: 'Do you currently have thoughts of harming yourself?',
  };
  const questionText = (qId, cat) => {
    const qs = cat?.questions || cat?.question_template || [];
    const lookup = (qs || []).find(q => (q.question_id || q.id || q.key) === qId);
    if (lookup) return lookup.text || lookup.label || lookup.question || qId;
    return LEGACY_Q[qId] || String(qId).replace(/_/g, ' ');
  };
  const formatAns = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'object') return Object.entries(v).map(([k, vv]) => `${k}: ${vv}`).join(', ');
    return String(v);
  };

  const renderQA = (sub, label, color, idx) => {
    if (!sub) return;
    sectionTitle(label, color, `Q&A ${idx}`);
    // meta strip
    ensureSpace(28);
    let mx = MARGIN;
    const sevLocal = String(sub.severity || '').toLowerCase();
    if (sevLocal) {
      mx += pill(`SEVERITY: ${sevLocal.toUpperCase()}`, SEV[sevLocal] || C.green, mx, y + 10) + 8;
    }
    if (sub.submitted_at) {
      text(`Submitted ${new Date(sub.submitted_at).toLocaleString()}`,
        mx, y + 10, { size: 9, color: C.muted });
    }
    y += 24;

    const answers = sub.answers || {};
    const entries = Object.entries(answers).filter(([k]) =>
      !k.startsWith('_') && !['marker', 'triggered_from'].includes(k)
    );
    if (entries.length === 0) {
      wrap('This submission was driven by the embedded body check-in (no questionnaire).',
        CONTENT_W, { italic: true, color: C.muted });
      y += 6;
      return;
    }

    entries.forEach(([qId, val], i) => {
      const qStr = questionText(qId, sub);
      const aStr = formatAns(val);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10);
      const qLines = pdf.splitTextToSize(`Q${i + 1}. ${qStr}`, CONTENT_W - 32);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
      const aLines = pdf.splitTextToSize(aStr, CONTENT_W - 40);
      const cardH = qLines.length * 13 + aLines.length * 12 + 22;
      ensureSpace(cardH + 8);
      drawCard(cardH, C.surface);
      // left accent
      setFill(color);
      pdf.rect(MARGIN, y, 3, cardH, 'F');
      let yy = y + 14;
      setText(color);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10);
      qLines.forEach((ln) => { pdf.text(ln, MARGIN + 14, yy); yy += 13; });
      setText(C.ink2);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
      yy += 2;
      aLines.forEach((ln) => { pdf.text(ln, MARGIN + 22, yy); yy += 12; });
      y += cardH + 8;
    });

    // AI plan inline (if not already rendered globally)
    const ap = sub.ai_plan;
    if (ap?.summary || (Array.isArray(ap?.next_steps) && ap.next_steps.length)) {
      ensureSpace(40);
      text('AI Wellness Plan', MARGIN, y + 14, { size: 10, bold: true, color: C.violet });
      y += 22;
      if (ap.summary) wrap(`"${ap.summary}"`, CONTENT_W, { italic: true, color: C.ink2 });
      (ap.next_steps || []).forEach((s) => wrap(`•  ${s}`, CONTENT_W - 12, { color: C.ink2 }));
      y += 4;
    }
  };

  if (isRecurring) {
    renderQA(step3List[0], 'Latest Assessment', C.orange, '03 · Latest');
  } else {
    if (cat1) renderQA(cat1, 'Treatment History', C.pink, '01');
    if (cat2) renderQA(cat2, 'Health & Social Info', C.violet, '02');
    if (step3List[0]) renderQA(step3List[0], 'Assessment', C.orange, '03');
  }

  /* ─── Color shift analytics ───────────────────────────────────── */
  const safeCheckins = checkins.slice(0, 30);
  if (safeCheckins.length > 0) {
    sectionTitle('Color Shift Analytics', C.orange, 'Section 05');
    const colorTally = {};
    const emotionTally = {};
    let ibSum = 0, iaSum = 0;
    safeCheckins.forEach((c) => {
      const col = c.user_selected_color || 'Unknown';
      colorTally[col] = (colorTally[col] || 0) + 1;
      const emo = c.user_selected_emotion || 'Unknown';
      emotionTally[emo] = (emotionTally[emo] || 0) + 1;
      ibSum += Number(c.intensity_rating_before || 0);
      iaSum += Number(c.intensity_rating_after || 0);
    });
    const avgBefore = (ibSum / safeCheckins.length).toFixed(1);
    const avgAfter = (iaSum / safeCheckins.length).toFixed(1);
    const avgDelta = (iaSum / safeCheckins.length - ibSum / safeCheckins.length).toFixed(1);

    const analyticsH = 90;
    drawCard(analyticsH, C.surface);
    const colW = CONTENT_W / 3;
    [['Avg intensity before', avgBefore, C.blue],
     ['Avg intensity after', avgAfter, C.teal],
     ['Average Δ', avgDelta, Number(avgDelta) < 0 ? C.green : Number(avgDelta) > 0 ? C.orange : C.violet]]
    .forEach(([k, v, col], i) => {
      const cx = MARGIN + colW * i + colW / 2;
      text(k, cx, y + 26, { size: 9, color: C.muted, align: 'center' });
      text(String(v), cx, y + 60, { size: 22, bold: true, color: col, align: 'center' });
    });
    y += analyticsH + 14;

    // Top colors
    text('Top colors', MARGIN, y, { size: 10, bold: true, color: C.ink });
    y += 14;
    Object.entries(colorTally).sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([k, v]) => {
      ensureSpace(18);
      setFill(colorOf(k)); pdf.circle(MARGIN + 6, y - 3, 5, 'F');
      text(`${k} — ${v} check-in${v > 1 ? 's' : ''}`, MARGIN + 18, y, { size: 10, color: C.ink2 });
      y += 16;
    });
    y += 6;

    // Top emotions
    text('Top emotions', MARGIN, y, { size: 10, bold: true, color: C.ink });
    y += 14;
    Object.entries(emotionTally).sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([k, v]) => {
      ensureSpace(16);
      text(`•  ${k} — ${v}×`, MARGIN + 4, y, { size: 10, color: C.ink2 });
      y += 14;
    });
    y += 8;
  }

  /* ─── Care blueprint ──────────────────────────────────────────── */
  sectionTitle('Care Blueprint', C.violet, 'Section 06');
  if (recommendations.length === 0) {
    wrap('No recommendations on file yet. Your clinician can assign personalized care content from the Recommendations tab.',
      CONTENT_W, { color: C.muted });
  } else {
    recommendations.slice(0, 12).forEach((r, i) => {
      const title = r.title || 'Recommendation';
      const body = (r.body_md || r.body || r.description || '').replace(/[#*`>]/g, '');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
      const titleLines = pdf.splitTextToSize(`${i + 1}. ${title}`, CONTENT_W - 24);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5);
      const bodyLines = body ? pdf.splitTextToSize(body.slice(0, 500), CONTENT_W - 24) : [];
      const cardH = titleLines.length * 14 + bodyLines.length * 12 + 28;
      ensureSpace(cardH + 8);
      drawCard(cardH);
      // accent stripe
      setFill(C.violet); pdf.rect(MARGIN, y, 3, cardH, 'F');
      let yy = y + 18;
      setText(C.ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
      titleLines.forEach((ln) => { pdf.text(ln, MARGIN + 14, yy); yy += 14; });
      if (r.source || r.content_type) {
        text(`${r.source || ''}${r.content_type ? ` · ${r.content_type}` : ''}`,
          MARGIN + 14, yy, { size: 9, italic: true, color: C.muted });
        yy += 12;
      }
      if (bodyLines.length) {
        setText(C.ink2); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5);
        bodyLines.forEach((ln) => { pdf.text(ln, MARGIN + 14, yy); yy += 12; });
      }
      y += cardH + 8;
    });
  }

  /* ─── Timeline snapshot (optional) ───────────────────────────── */
  if (timelineEl) {
    pdf.addPage(); y = MARGIN;
    sectionTitle('Check-in Timeline', C.teal, 'Section 07');
    const cap = await captureNode(timelineEl);
    if (cap) {
      const imgW = CONTENT_W;
      const imgH = Math.min(220, (cap.h / cap.w) * imgW);
      ensureSpace(imgH + 8);
      pdf.addImage(cap.url, 'PNG', MARGIN, y, imgW, imgH);
      y += imgH + 8;
    }
  }

  /* ─── Footers on every page ───────────────────────────────────── */
  const total = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    // gradient hairline
    gradientBar(PAGE_H - 28, 2, [C.pink, C.violet, C.teal, C.green]);
    // text
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
    setText(C.muted);
    pdf.text('Developed by Projexino Solutions · IFEELINCOLOR © 2026', MARGIN, PAGE_H - 14);
    pdf.text(`Page ${i} / ${total}`, PAGE_W - MARGIN, PAGE_H - 14, { align: 'right' });
  }

  const filename = `ifeelincolor-dossier-${(patient.name || 'patient').replace(/\s+/g, '_').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
  return filename;
}
