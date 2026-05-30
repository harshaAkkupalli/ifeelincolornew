import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { useCheckinContent, getZoneLabelFrom } from './CheckinContentContext';
import { Check, Loader2, Save } from 'lucide-react';
import axios from 'axios';
import TTSButton from '../../lib/tts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ColorShiftSummary({
  bodyZone, sensations, intensity, suggestedEmotion,
  level1, level2, level3, reflectionText,
  regulationStep, stepCompleted,
  endingIntensity, endingColor, endingEmotion,
  emotionColor, onDone,
}) {
  const { emotionFamilies: EMOTION_FAMILIES, bodyZones } = useCheckinContent();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const startColor = emotionColor || '#FFD166';
  const endColorHex = endingColor?.hex || '#06D6A0';
  // Respect the patient's exact pick on the Feelings Wheel:
  //   level3 (most specific) ?? level2 (secondary) ?? family.label.
  // Falling back to the family label only when the patient stopped early.
  const familyLabel = EMOTION_FAMILIES[suggestedEmotion]?.label || 'Unknown';
  const startLabel = level3 || level2 || familyLabel;
  const startFamilyContext = (level2 || level3) && (familyLabel !== startLabel) ? familyLabel : '';
  const endLabel = endingColor?.label || 'Unknown';
  const zoneLabel = getZoneLabelFrom(bodyZones, bodyZone);
  const sensationLabel = (sensations || []).join(', ') || '—';

  const startState = intensity >= 7 ? 'high intensity' : intensity >= 4 ? 'moderate intensity' : 'mild awareness';
  const endState = endingIntensity >= 7 ? 'still processing' : endingIntensity >= 4 ? 'settling down' : 'a calmer place';
  const intensityDelta = (endingIntensity === intensity)
    ? 'Your intensity stayed the same. Your body may need more time, or a different step.'
    : `Your body intensity moved from ${intensity} to ${endingIntensity}.`;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const now = new Date();
      await axios.post(`${API}/checkins`, {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        starting_body_part: zoneLabel,
        starting_sensation: sensations.join(', '),
        suggested_color: startColor,
        suggested_emotions: [startLabel],
        user_selected_color: startColor,
        user_selected_emotion: level2 || startLabel,
        deeper_feeling: level3 || '',
        app_reflection_text: reflectionText || '',
        regulation_step_chosen: regulationStep || '',
        step_completed: stepCompleted,
        ending_color: endColorHex,
        ending_emotion: (endingEmotion && endingEmotion.trim()) || endLabel.split(' ')[0],
        ending_body_sensation: '',
        intensity_rating_before: intensity,
        intensity_rating_after: endingIntensity,
        journal_notes: notes,
      }, { withCredentials: true });
      setSubmitted(true);
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="h-full overflow-y-auto flex flex-col items-center justify-center px-4 py-6 text-center">
        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.6 }}
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: `${endColorHex}22`, boxShadow: `0 0 40px ${endColorHex}33` }}>
          <Check className="w-10 h-10" style={{ color: endColorHex }} />
        </motion.div>
        <h2 className="text-2xl font-fredoka font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>Check-in Saved</h2>
        <p className="text-sm font-nunito mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>Great job exploring your feelings today</p>
        <Button data-testid="finish-checkin-button" onClick={onDone}
          className="rounded-full px-8 py-3 font-nunito font-bold text-sm border-0" style={{ background: endColorHex, color: '#0D0D11' }}>
          Back to Dashboard
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col gap-3 px-4 py-4 max-w-lg mx-auto">
      {/* Color shift card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-6 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${startColor}12, ${endColorHex}12)`,
          border: `1px solid rgba(255,255,255,0.08)`,
          boxShadow: `0 0 40px ${startColor}10, 0 0 40px ${endColorHex}10`,
        }}
      >
        {/* Gradient bar */}
        <div className="h-2 rounded-full mb-5" style={{ background: `linear-gradient(90deg, ${startColor}, ${endColorHex})`, boxShadow: `0 0 12px ${startColor}44, 0 0 12px ${endColorHex}44` }} />

        {/* Color dots */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl" style={{ background: startColor, boxShadow: `0 0 15px ${startColor}44` }} />
            <div>
              <p className="text-[10px] font-nunito uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Started</p>
              <p className="text-sm font-fredoka font-semibold" style={{ color: startColor }}>
                {startLabel}
                {startFamilyContext && (
                  <span className="ml-1 font-nunito text-[10px] font-normal" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    ({startFamilyContext})
                  </span>
                )}
              </p>
            </div>
          </div>
          <motion.div animate={{ x: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
              <path d="M0 6H20M20 6L15 1M20 6L15 11" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] font-nunito uppercase tracking-wider text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>Ended</p>
              <p className="text-sm font-fredoka font-semibold text-right" style={{ color: endColorHex }}>{endLabel.split(' ')[0]}</p>
            </div>
            <div className="w-10 h-10 rounded-xl" style={{ background: endColorHex, boxShadow: `0 0 15px ${endColorHex}44` }} />
          </div>
        </div>

        {/* Summary text - exact spec formula */}
        <div className="flex items-start gap-2">
          <p className="text-sm font-nunito leading-relaxed flex-1" data-testid="color-shift-formula" style={{ color: 'rgba(255,255,255,0.78)' }}>
            You started with <span style={{ color: startColor, fontWeight: 600 }}>{zoneLabel}</span>,{' '}
            <span style={{ color: startColor, fontWeight: 600 }}>{sensationLabel}</span>, and{' '}
            <span style={{ color: startColor, fontWeight: 600 }}>{startLabel}</span>.
            After regulation, you ended with{' '}
            <span style={{ color: endColorHex, fontWeight: 600 }}>
              {endingEmotion && endingEmotion.trim() ? endingEmotion : endLabel.split(' ')[0]}
            </span>.
            Your body shifted from <span style={{ color: startColor, fontWeight: 600 }}>{startState}</span> toward{' '}
            <span style={{ color: endColorHex, fontWeight: 600 }}>{endState}</span>.
          </p>
          <TTSButton
            text={`You started with ${zoneLabel}, ${sensationLabel}, and ${startLabel}. After regulation you ended with ${endingEmotion || endLabel.split(' ')[0]}. Your body shifted from ${startState} toward ${endState}. ${intensityDelta}`}
            testId="summary-tts"
            ariaLabel="Listen to my check-in summary"
          />
        </div>
        <p className="text-xs font-nunito mt-2" data-testid="intensity-delta" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {intensityDelta}
        </p>

        {/* Intensity shift */}
        <div className="flex items-center gap-4 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex-1 text-center">
            <p className="text-2xl font-fredoka font-semibold" style={{ color: startColor }}>{intensity}</p>
            <p className="text-[10px] font-nunito" style={{ color: 'rgba(255,255,255,0.3)' }}>Before</p>
          </div>
          <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
            <path d="M0 6H16M16 6L11 1M16 6L11 11" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div className="flex-1 text-center">
            <p className="text-2xl font-fredoka font-semibold" style={{ color: endColorHex }}>{endingIntensity}</p>
            <p className="text-[10px] font-nunito" style={{ color: 'rgba(255,255,255,0.3)' }}>After</p>
          </div>
        </div>
      </motion.div>

      {/* Journal notes */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-sm font-nunito font-medium mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Anything you want to remember? (Optional)
        </p>
        <Textarea
          data-testid="summary-journal-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Today I noticed that..."
          className="rounded-2xl border min-h-[100px] resize-none font-nunito text-sm"
          style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}
        />
      </motion.div>

      {/* Submit */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="text-center">
        <Button data-testid="save-checkin-button" onClick={handleSubmit} disabled={submitting}
          className="rounded-full px-10 py-3 font-nunito font-bold text-sm border-0 disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${startColor}, ${endColorHex})`, color: '#0D0D11' }}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {submitting ? 'Saving...' : 'Save Check-in'}
        </Button>
      </motion.div>
    </div>
  );
}
