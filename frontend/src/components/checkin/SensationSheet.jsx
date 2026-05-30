import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCheckinContent } from './CheckinContentContext';
import { Slider } from '../ui/slider';
import { Checkbox } from '../ui/checkbox';
import { useNeuroInclusive } from '../../contexts/NeuroInclusiveContext';
import { SensationIcon } from './Pictograms';
import TTSButton from '../../lib/tts';

export default function SensationSheet({ bodyZone, sensations, onSensationsChange, intensity, onIntensityChange, suggestedEmotion, extraAnswers = {}, onExtraAnswersChange = () => {} }) {
  const { zoneSensations: ZONE_SENSATIONS, emotionFamilies: EMOTION_FAMILIES, bodyZones } = useCheckinContent();
  const { isLowStimulusMode } = useNeuroInclusive();
  // Support multi-zone: merge sensations from all selected zones
  const zones = Array.isArray(bodyZone) ? bodyZone : bodyZone ? [bodyZone] : [];
  const zoneSensations = [...new Set(zones.flatMap(z => ZONE_SENSATIONS[z] || []))];
  // Admin-authored question text (from /api/assessments/active). Falls back to the static prompt.
  const zoneObjects = zones.map((z) => bodyZones.find((b) => b.id === z)).filter(Boolean);
  const adminQuestion = zoneObjects.map((z) => z.questionText).filter(Boolean)[0] || 'What does it feel like? Select all that apply.';
  // Admin-authored extra questions across all selected zones (de-dup by id)
  const allQuestions = [];
  const seenIds = new Set();
  zoneObjects.forEach((z) => (z.questions || []).forEach((q) => {
    if (!q?.id || !seenIds.has(q.id)) { seenIds.add(q.id); allQuestions.push(q); }
  }));
  const zoneLabel = zones.map(z => z?.replace(/_/g, ' / ').replace(/\b\w/g, c => c.toUpperCase())).join(', ');

  const setAnswer = (qid, val) => onExtraAnswersChange({ ...(extraAnswers || {}), [qid]: val });

  const toggleSensation = (s) => {
    if (sensations.includes(s)) onSensationsChange(sensations.filter(x => x !== s));
    else onSensationsChange([...sensations, s]);
  };

  const emotionData = suggestedEmotion ? EMOTION_FAMILIES[suggestedEmotion] : null;
  const glowColor = emotionData?.color || '#FFD166';

  return (
    <div className="h-full overflow-y-auto flex flex-col gap-3 px-2 py-3 max-w-lg mx-auto">
      {/* Zone header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="flex items-center justify-center gap-2">
          <p className="text-sm font-nunito uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Selected Zone
          </p>
          <TTSButton text={`Selected zone: ${zoneLabel}. ${adminQuestion}`} testId="sensation-tts" />
        </div>
        <h2 className="text-2xl font-fredoka font-semibold mt-1" style={{ color: glowColor, textShadow: `0 0 20px ${glowColor}44` }}>
          {zoneLabel}
        </h2>
      </motion.div>

      {/* Sensations */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl p-5"
        style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <p className="text-sm font-nunito font-medium mb-4" data-testid="admin-question-text" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {adminQuestion}
        </p>
        <div className="flex flex-wrap gap-2">
          {zoneSensations.map((s, i) => {
            const isChecked = sensations.includes(s);
            return (
              <motion.button
                key={s}
                data-testid={`sensation-${s.toLowerCase().replace(/[^a-z]/g, '-')}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.02 * i }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleSensation(s)}
                aria-pressed={isChecked}
                data-selected={isChecked ? 'true' : 'false'}
                className={`${isLowStimulusMode ? 'ni-target' : 'px-4 py-2 rounded-full text-sm'} font-nunito font-medium transition-all cursor-pointer flex items-center gap-2`}
                style={{
                  background: isChecked ? `${glowColor}22` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isChecked ? `${glowColor}66` : 'rgba(255,255,255,0.08)'}`,
                  color: isChecked ? glowColor : 'rgba(255,255,255,0.7)',
                  boxShadow: isChecked ? `0 0 12px ${glowColor}22` : 'none',
                }}
              >
                <div className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center" style={{ borderColor: isChecked ? glowColor : 'rgba(255,255,255,0.2)', background: isChecked ? glowColor : 'transparent' }}>
                  {isChecked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="#0D0D11" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                {isLowStimulusMode && (
                  <span aria-hidden style={{ color: isChecked ? glowColor : 'rgba(236,236,241,0.85)' }}>
                    <SensationIcon token={s} size={22} />
                  </span>
                )}
                {s}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Intensity slider */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-3xl p-5"
        style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-nunito font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
            How strong is this feeling in your body?
          </p>
          <span className="text-2xl font-fredoka font-semibold" style={{ color: glowColor, textShadow: `0 0 15px ${glowColor}44` }}>
            {intensity}
          </span>
        </div>
        <div className="relative">
          <Slider
            data-testid="intensity-slider"
            value={[intensity]}
            onValueChange={([v]) => onIntensityChange(v)}
            min={0} max={10} step={1}
            className="py-2 [&_[data-orientation=horizontal]]:h-3 [&_[data-orientation=horizontal]]:rounded-full [&_.bg-primary]:rounded-full [&_button]:w-6 [&_button]:h-6 [&_button]:border-2"
            style={{ '--tw-ring-color': glowColor }}
          />
          <div className="flex justify-between mt-2">
            <span className="text-[10px] font-nunito" style={{ color: 'rgba(255,255,255,0.3)' }}>Barely there</span>
            <span className="text-[10px] font-nunito" style={{ color: 'rgba(255,255,255,0.3)' }}>Very strong</span>
          </div>
        </div>
      </motion.div>

      {/* Emotion suggestion */}
      <AnimatePresence>
        {suggestedEmotion && sensations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-3xl p-5 relative overflow-hidden"
            style={{ background: `${glowColor}0A`, border: `1px solid ${glowColor}33`, boxShadow: `0 0 30px ${glowColor}15` }}
          >
            <div className="absolute top-0 left-0 w-full h-1 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)` }} />
            <p className="text-xs font-nunito uppercase tracking-widest mb-2" style={{ color: `${glowColor}99` }}>
              Suggested Match
            </p>
            <p className="text-sm font-nunito leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Based on what you selected, these feelings may match your body signal. You can choose one, or explore the full Feelings Wheel.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <div className="w-10 h-10 rounded-xl" style={{ background: glowColor, boxShadow: `0 0 20px ${glowColor}44` }} />
              <div>
                <p className="text-lg font-fredoka font-semibold" style={{ color: glowColor }}>{emotionData?.label}</p>
                <p className="text-xs font-nunito" style={{ color: 'rgba(255,255,255,0.4)' }}>Core emotion family</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin-authored extra questions (Phase M) */}
      {allQuestions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          data-testid="admin-extra-questions"
          className="rounded-3xl p-5 space-y-4"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-sm font-nunito font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
            A few more questions
          </p>
          {allQuestions.map((q, idx) => (
            <div key={q.id || idx} data-testid={`extra-q-${idx}`} className="space-y-2">
              <p className="text-sm font-nunito" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {q.text} {q.required && <span style={{ color: glowColor }}>*</span>}
              </p>
              {q.type === 'yes_no' && (
                <div className="flex gap-2">
                  {['Yes', 'No'].map((opt) => {
                    const active = extraAnswers[q.id] === opt;
                    return (
                      <button key={opt} data-testid={`extra-q-${idx}-${opt.toLowerCase()}`} onClick={() => setAnswer(q.id, opt)}
                        className="px-4 py-2 rounded-full text-xs font-bold font-nunito"
                        style={{
                          background: active ? `${glowColor}22` : 'rgba(255,255,255,0.06)',
                          color: active ? glowColor : 'rgba(255,255,255,0.7)',
                          border: `1px solid ${active ? glowColor + '88' : 'rgba(255,255,255,0.1)'}`,
                          boxShadow: active ? `0 0 14px ${glowColor}33` : 'none',
                        }}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
              {q.type === 'multiple_choice' && (
                <div className="flex flex-wrap gap-2">
                  {(q.options || []).map((opt) => {
                    const active = extraAnswers[q.id] === opt;
                    return (
                      <button key={opt} data-testid={`extra-q-${idx}-${opt.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} onClick={() => setAnswer(q.id, opt)}
                        className="px-3 py-1.5 rounded-full text-xs font-bold font-nunito"
                        style={{
                          background: active ? `${glowColor}22` : 'rgba(255,255,255,0.06)',
                          color: active ? glowColor : 'rgba(255,255,255,0.7)',
                          border: `1px solid ${active ? glowColor + '88' : 'rgba(255,255,255,0.1)'}`,
                        }}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
              {q.type === 'long_answer' && (
                <textarea data-testid={`extra-q-${idx}-text`} rows={2} value={extraAnswers[q.id] || ''} onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Type your answer…"
                  className="w-full rounded-2xl px-3 py-2 text-sm font-nunito outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }} />
              )}
              {q.type === 'scale' && (
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-nunito" style={{ color: 'rgba(255,255,255,0.3)' }}>0</span>
                    <span className="text-base font-fredoka font-semibold" style={{ color: glowColor }}>{extraAnswers[q.id] ?? 5}</span>
                    <span className="text-[10px] font-nunito" style={{ color: 'rgba(255,255,255,0.3)' }}>10</span>
                  </div>
                  <Slider data-testid={`extra-q-${idx}-scale`} value={[Number(extraAnswers[q.id] ?? 5)]} onValueChange={([v]) => setAnswer(q.id, v)}
                    min={0} max={10} step={1} />
                </div>
              )}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
