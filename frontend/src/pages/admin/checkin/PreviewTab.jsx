/**
 * /admin/checkin-config → Preview tab
 *
 * Lets editors pick (Body Zone, Sensation, Emotion family + secondary)
 * and instantly see every message a patient would see at each step of
 * the Daily Check-in for that exact combination — without leaving the
 * admin console.
 *
 * Data source: useCheckinContent() (admin saves are reflected on next refresh).
 *
 * Mirrors the patient-side rendering logic:
 *   • bp.reflection_template → fillTemplate() with [sensation]/[emotion]/[body_part]
 *   • Lowercases interpolated values mid-sentence
 *   • Heals legacy "may be telling you about" templates on the fly via
 *     /lib/healReflection
 *   • Surfaces the family's regulation_message + every step of both
 *     regulation_activities
 *   • Renders the same Color Shift Summary narrative formula
 */
import React, { useMemo, useState } from 'react';
import { useCheckinContent } from '../../../components/checkin/CheckinContentContext';
import { healReflection } from '../../../lib/healReflection';
import { Eye, MapPin, Sparkles, MessageCircleHeart, Activity, Palette, Volume2 } from 'lucide-react';

function lower(s) { return (s || '').toString().toLowerCase().trim(); }

function fillTemplate(template, ctx) {
  if (!template) return '';
  return template
    .replace(/\[sensations?\]/gi, lower(ctx.sensation))
    .replace(/\[emotion\]/gi, lower(ctx.emotion))
    .replace(/\[color\]/gi, lower(ctx.colorName))
    .replace(/\[body[_ ]?part\]/gi, lower(ctx.bodyPart));
}

function startStateFor(i) {
  if (i >= 7) return 'high intensity';
  if (i >= 4) return 'moderate intensity';
  return 'mild awareness';
}
function endStateFor(i) {
  if (i >= 7) return 'still processing';
  if (i >= 4) return 'settling down';
  return 'a calmer place';
}

function Card({ icon: Icon, color, title, subtitle, children, testId }) {
  return (
    <div data-testid={testId} className="rounded-2xl bg-white border p-4 shadow-sm" style={{ borderColor: '#E2E8F0' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}22`, color }}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color }}>{title}</p>
          {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function PreviewTab() {
  const {
    bodyZones, emotionFamilies, emotionColorsFull, zoneSensations,
    feelingsWheel, regulationActivities, colorRegulationMessage,
  } = useCheckinContent();
  const bodyPartList = useMemo(() => bodyZones || [], [bodyZones]);

  const [zoneId, setZoneId] = useState(bodyPartList[0]?.id || '');
  const zone = bodyPartList.find((z) => z.id === zoneId) || bodyPartList[0];
  const sensations = (zoneSensations && zone) ? (zoneSensations[zone.id] || []) : [];
  const [sensation, setSensation] = useState(sensations[0] || '');

  // Emotion family selector
  const familyKeys = Object.keys(emotionFamilies || {});
  const defaultFamily = zone?.defaultEmotionKey || familyKeys[0] || 'happy';
  const [familyKey, setFamilyKey] = useState(defaultFamily);
  const family = emotionFamilies?.[familyKey];

  // Level 2 (secondary feeling) → derived from feelingsWheel { familyKey: { l2_label_lower: [l3...] } }
  const wheelForFamily = feelingsWheel?.[familyKey] || {};
  const level2List = Object.keys(wheelForFamily).map((labelLower) => ({
    label: labelLower.charAt(0).toUpperCase() + labelLower.slice(1),
    level3: wheelForFamily[labelLower],
  }));
  const [l2Idx, setL2Idx] = useState(0);
  const level2 = level2List[l2Idx]?.label || family?.label || '';
  const level3List = level2List[l2Idx]?.level3 || [];
  const [l3Idx, setL3Idx] = useState(0);
  const level3 = level3List[l3Idx] || '';

  // Intensity sliders
  const [intensityBefore, setIntensityBefore] = useState(7);
  const [intensityAfter, setIntensityAfter] = useState(3);

  // Ending color picker — defaults to a calmer family
  const [endingColorKey, setEndingColorKey] = useState('happy');
  const endingColor = (emotionColorsFull || []).find((c) => c.id === endingColorKey)
    || { id: 'happy', label: 'Happy', hex: '#FFD23F' };
  const startColor = family?.color || '#FFD23F';

  // Re-sync sensation when zone changes
  React.useEffect(() => {
    const nextSens = (zoneSensations && zone) ? (zoneSensations[zone.id] || []) : [];
    if (zone && !nextSens.includes(sensation)) {
      setSensation(nextSens[0] || '');
    }
    if (zone?.defaultEmotionKey && familyKey !== zone.defaultEmotionKey) {
      setFamilyKey(zone.defaultEmotionKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId]);

  React.useEffect(() => {
    setL2Idx(0);
    setL3Idx(0);
  }, [familyKey]);
  React.useEffect(() => { setL3Idx(0); }, [l2Idx]);

  // Build the reflection sentence — with legacy heal
  const rawReflection = fillTemplate(zone?.reflectionTemplate || '', {
    sensation,
    emotion: level2,
    bodyPart: zone?.label,
    colorName: family?.label,
  });
  const reflectionText = healReflection(rawReflection, {
    sensation,
    emotion: level2,
    body_part: zone?.label,
  });

  const startLabel = level3 || level2 || family?.label || '';
  const familyContext = (level2 || level3) && family?.label && family?.label !== startLabel ? family.label : '';
  const startState = startStateFor(intensityBefore);
  const endState = endStateFor(intensityAfter);

  if (!bodyPartList.length || !family) {
    return (
      <div className="p-8 text-center text-sm text-slate-400" data-testid="preview-empty">
        Save body parts and emotion families first to use the Preview.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5" data-testid="checkin-preview-tab">
      {/* ─── Controls ─── */}
      <div className="space-y-3">
        <div className="rounded-2xl bg-white border p-4 space-y-3" style={{ borderColor: '#E2E8F0' }}>
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Patient choices</p>

          <label className="block">
            <span className="text-[11px] font-bold text-slate-600">Body zone</span>
            <select data-testid="preview-zone-select" value={zoneId} onChange={(e) => setZoneId(e.target.value)}
              className="mt-1 w-full rounded-lg border text-sm px-2 py-2" style={{ borderColor: '#E2E8F0' }}>
              {bodyPartList.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold text-slate-600">Sensation</span>
            <select data-testid="preview-sensation-select" value={sensation} onChange={(e) => setSensation(e.target.value)}
              className="mt-1 w-full rounded-lg border text-sm px-2 py-2" style={{ borderColor: '#E2E8F0' }}>
              {sensations.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold text-slate-600">Intensity (before regulation)</span>
            <input data-testid="preview-intensity-before" type="range" min={0} max={10} value={intensityBefore}
              onChange={(e) => setIntensityBefore(Number(e.target.value))} className="w-full mt-1" />
            <span className="text-[11px] text-slate-500">{intensityBefore}/10 · {startState}</span>
          </label>
        </div>

        <div className="rounded-2xl bg-white border p-4 space-y-3" style={{ borderColor: '#E2E8F0' }}>
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Feelings wheel pick</p>

          <label className="block">
            <span className="text-[11px] font-bold text-slate-600">Emotion family (level 1)</span>
            <select data-testid="preview-family-select" value={familyKey} onChange={(e) => setFamilyKey(e.target.value)}
              className="mt-1 w-full rounded-lg border text-sm px-2 py-2" style={{ borderColor: '#E2E8F0' }}>
              {familyKeys.map((k) => <option key={k} value={k}>{emotionFamilies[k]?.label || k}</option>)}
            </select>
          </label>

          {level2List.length > 0 && (
            <label className="block">
              <span className="text-[11px] font-bold text-slate-600">Secondary (level 2)</span>
              <select data-testid="preview-l2-select" value={l2Idx} onChange={(e) => setL2Idx(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border text-sm px-2 py-2" style={{ borderColor: '#E2E8F0' }}>
                {level2List.map((l, i) => <option key={l.label + i} value={i}>{l.label}</option>)}
              </select>
            </label>
          )}

          {level3List.length > 0 && (
            <label className="block">
              <span className="text-[11px] font-bold text-slate-600">Specific (level 3)</span>
              <select data-testid="preview-l3-select" value={l3Idx} onChange={(e) => setL3Idx(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border text-sm px-2 py-2" style={{ borderColor: '#E2E8F0' }}>
                {level3List.map((l, i) => <option key={l + i} value={i}>{l}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="rounded-2xl bg-white border p-4 space-y-3" style={{ borderColor: '#E2E8F0' }}>
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">After regulation</p>

          <label className="block">
            <span className="text-[11px] font-bold text-slate-600">Intensity (after)</span>
            <input data-testid="preview-intensity-after" type="range" min={0} max={10} value={intensityAfter}
              onChange={(e) => setIntensityAfter(Number(e.target.value))} className="w-full mt-1" />
            <span className="text-[11px] text-slate-500">{intensityAfter}/10 · {endState}</span>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold text-slate-600">Ending color</span>
            <select data-testid="preview-ending-color" value={endingColorKey} onChange={(e) => setEndingColorKey(e.target.value)}
              className="mt-1 w-full rounded-lg border text-sm px-2 py-2" style={{ borderColor: '#E2E8F0' }}>
              {(emotionColorsFull || []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        </div>

        <div className="rounded-2xl p-3 text-[11px] text-slate-500 leading-relaxed border border-dashed" style={{ borderColor: '#CBD5E1' }}>
          This preview renders the exact patient-facing messages from your live config — including admin question text, sensation chips, the templated reflection sentence (with legacy auto-heal), the family-specific regulation message + activities, and the Color Shift Summary narrative.
        </div>
      </div>

      {/* ─── Live patient-side preview ─── */}
      <div className="space-y-4">
        {/* STEP 1: Body Map */}
        <Card testId="preview-step1" icon={MapPin} color="#F472B6" title="Step 1 · Body Map" subtitle="Top bar header">
          <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Body Map</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Patient taps body zone: <strong>{zone?.label}</strong></p>
        </Card>

        {/* STEP 2: Sensations */}
        <Card testId="preview-step2" icon={Sparkles} color="#FB923C" title="Step 2 · Sensations" subtitle={`Patient sees this on the ${zone?.label} zone`}>
          <p className="text-xs italic text-slate-700 mb-2">"{zone?.questionText || `What do you notice in your ${zone?.label?.toLowerCase()} area?`}"</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {sensations.map((s) => (
              <span key={s} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: s === sensation ? `${startColor}33` : '#F1F5F9',
                  color: s === sensation ? '#0F172A' : '#64748B',
                  border: `1px solid ${s === sensation ? startColor : 'transparent'}`,
                }}>{s}</span>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">
            <strong>Selected sensation:</strong> {sensation || '—'} ·
            <strong> Suggested family:</strong>{' '}
            <span style={{ color: startColor, fontWeight: 700 }}>{family?.label}</span>
          </p>
          {(zone?.questions || []).length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Additional questions</p>
              {zone.questions.map((q, i) => (
                <p key={q.id || i} className="text-[11px] text-slate-700 mb-1">
                  <span className="text-[9px] font-bold mr-1" style={{ color: '#FB923C' }}>Q{i + 1}</span>
                  {q.text} <span className="text-[9px] text-slate-400">({q.type})</span>
                </p>
              ))}
            </div>
          )}
        </Card>

        {/* STEP 3: Feelings Wheel pick */}
        <Card testId="preview-step3" icon={Palette} color={startColor} title="Step 3 · Feelings Wheel" subtitle="Patient picks level 1 → 2 → 3">
          <p className="text-sm">
            <span className="font-semibold" style={{ color: startColor }}>{family?.label}</span>
            <span className="text-slate-400 mx-1">→</span>
            <span className="font-semibold">{level2}</span>
            {level3 && <><span className="text-slate-400 mx-1">→</span><span className="font-semibold">{level3}</span></>}
          </p>
        </Card>

        {/* STEP 4: Reflection */}
        <Card testId="preview-step4" icon={MessageCircleHeart} color="#A78BFA" title="Step 4 · Reflection" subtitle="Templated sentence rendered with the patient's picks">
          <p className="text-sm italic text-slate-700 leading-relaxed" data-testid="preview-reflection-text">
            "{reflectionText || '— no reflection_template set on this zone —'}"
          </p>
          <p className="text-[10px] text-slate-400 mt-2">
            Template: <code className="bg-slate-50 px-1 rounded">{zone?.reflectionTemplate || 'none'}</code>
          </p>
          {!zone?.reflectionTemplate && (
            <p className="text-[10px] text-amber-600 mt-1 font-semibold">
              Tip: set a <code>reflection_template</code> on the Body Parts tab to give patients a personalized takeaway here.
            </p>
          )}
        </Card>

        {/* STEP 5: Regulation */}
        <Card testId="preview-step5" icon={Activity} color="#22D3C5" title="Step 5 · Regulation" subtitle={`Routed by emotion family: ${family?.label}`}>
          <p className="text-xs font-semibold" style={{ color: family?.color }} data-testid="preview-regulation-message">
            "{colorRegulationMessage?.[familyKey] || '— set a regulation_message on the Emotion Families tab —'}"
          </p>
          <div className="mt-3 space-y-3">
            {(regulationActivities?.[familyKey] || []).map((act, i) => (
              <div key={(act.title || 'act') + i} className="rounded-xl border p-3" style={{ borderColor: '#E2E8F0', background: '#FAFBFD' }}>
                <p className="text-[11px] font-bold" style={{ color: '#0F172A' }}>★ {act.title || `Activity ${i + 1}`}</p>
                <ol className="mt-1.5 list-decimal list-inside text-[11px] text-slate-600 space-y-0.5">
                  {(act.steps || []).map((s, j) => <li key={j}>{s}</li>)}
                </ol>
              </div>
            ))}
            {(!regulationActivities?.[familyKey] || regulationActivities[familyKey].length === 0) && (
              <p className="text-[10px] text-amber-600 font-semibold">
                Tip: add regulation_activities to this family on the Emotion Families tab — patients see them during the 60-second guided activity.
              </p>
            )}
          </div>
        </Card>

        {/* STEP 6: Color Shift Summary */}
        <Card testId="preview-step6" icon={Volume2} color="#EC4899" title="Step 6 · Color Shift Summary" subtitle="Narrative with the patient's exact picks">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg" style={{ background: startColor }} />
            <div className="flex-1 text-center text-slate-400 text-xs">→</div>
            <div className="w-8 h-8 rounded-lg" style={{ background: endingColor.hex }} />
          </div>
          <p className="text-sm text-slate-700 leading-relaxed" data-testid="preview-summary-text">
            You started with{' '}
            <strong style={{ color: startColor }}>{zone?.label}</strong>,{' '}
            <strong style={{ color: startColor }}>{sensation}</strong>, and{' '}
            <strong style={{ color: startColor }}>{startLabel}</strong>
            {familyContext && <span className="text-slate-400 text-xs"> ({familyContext})</span>}.
            After regulation, you ended with{' '}
            <strong style={{ color: endingColor.hex }}>{endingColor.label.split(' ')[0]}</strong>.
            Your body shifted from <strong style={{ color: startColor }}>{startState}</strong> toward{' '}
            <strong style={{ color: endingColor.hex }}>{endState}</strong>.
          </p>
          <p className="text-[11px] text-slate-500 mt-2" data-testid="preview-intensity-delta">
            {intensityBefore === intensityAfter
              ? 'Your intensity stayed the same. Your body may need more time, or a different step.'
              : `Your body intensity moved from ${intensityBefore} to ${intensityAfter}.`}
          </p>
        </Card>
      </div>
    </div>
  );
}
