import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, Check, ChevronRight } from 'lucide-react';
import { Slider } from '../ui/slider';
import { useCheckinContent } from './CheckinContentContext';
import { Button } from '../ui/button';
import { useNeuroInclusive } from '../../contexts/NeuroInclusiveContext';
import BreathOrb from './BreathOrb';
import TTSButton from '../../lib/tts';

export default function RegulationScreen({
  suggestedEmotion, emotionColor,
  onComplete, onChooseDifferent, onPause,
  endingIntensity, onEndingIntensityChange,
  endingColor, onEndingColorChange,
  regulationStep, onRegulationStepChange,
  stepCompleted, onStepCompletedChange,
  endingEmotion, onEndingEmotionChange,
}) {
  const { regulationActivities: REGULATION_ACTIVITIES, emotionColorsFull: EMOTION_COLORS_FULL, colorRegulationMessage: COLOR_REGULATION_MESSAGE } = useCheckinContent();
  const { isLowStimulusMode } = useNeuroInclusive();
  const [phase, setPhase] = useState('intro'); // intro, countdown, post
  const [countdown, setCountdown] = useState(60);
  const [stepIndex, setStepIndex] = useState(0);
  const [activityIndex, setActivityIndex] = useState(0);
  const timerRef = useRef(null);

  const activities = (REGULATION_ACTIVITIES[suggestedEmotion] && REGULATION_ACTIVITIES[suggestedEmotion].length)
    ? REGULATION_ACTIVITIES[suggestedEmotion]
    : (Object.values(REGULATION_ACTIVITIES).find((a) => a && a.length) || [{ title: 'Take a Breath', steps: ['Breathe in slowly', 'Hold gently', 'Breathe out softly', 'Repeat'] }]);
  const activity = activities[activityIndex] || activities[0];
  const glow = emotionColor || '#FFD166';

  const startCountdown = () => {
    setPhase('countdown');
    setCountdown(60);
    setStepIndex(0);
    onRegulationStepChange(activity.title);
  };

  useEffect(() => {
    if (phase !== 'countdown') return;
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setPhase('post');
          onStepCompletedChange(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto advance steps
  useEffect(() => {
    if (phase !== 'countdown' || !activity.steps) return;
    const stepDuration = 60 / activity.steps.length;
    const elapsed = 60 - countdown;
    const newIdx = Math.min(Math.floor(elapsed / stepDuration), activity.steps.length - 1);
    if (newIdx !== stepIndex) setStepIndex(newIdx);
  }, [countdown, phase, activity.steps, stepIndex]);

  const handleDidIt = () => {
    clearInterval(timerRef.current);
    onStepCompletedChange(true);
    setPhase('post');
  };

  const handleAnotherStep = () => {
    clearInterval(timerRef.current);
    const next = (activityIndex + 1) % activities.length;
    setActivityIndex(next);
    setCountdown(60);
    setStepIndex(0);
    setPhase('intro');
  };

  const progressPct = ((60 - countdown) / 60) * 100;
  const circumference = 2 * Math.PI * 80;
  const dashOffset = circumference - (progressPct / 100) * circumference;

  return (
    <div className="h-full overflow-y-auto flex flex-col items-center justify-start px-3 py-3 max-w-lg mx-auto">
      <AnimatePresence mode="wait">
        {/* INTRO */}
        {phase === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center w-full">
            <h2 className="text-xl font-fredoka font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Try this step for 60 seconds.
            </h2>
            <p className="text-sm font-nunito mb-2 px-2" data-testid="color-regulation-message" style={{ color: glow }}>
              {COLOR_REGULATION_MESSAGE[suggestedEmotion] || 'Your body may need a moment of gentle care.'}
            </p>
            <p className="text-xs font-nunito mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
              A guided activity tailored for you
            </p>
            <motion.div
              className="rounded-3xl p-6 mb-6 text-left"
              style={{ background: `${glow}0A`, border: `1px solid ${glow}33`, boxShadow: `0 0 30px ${glow}12` }}
            >
              <p className="text-lg font-fredoka font-semibold mb-3" style={{ color: glow }}>{activity.title}</p>
              <ol className="space-y-2">
                {activity.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-nunito" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5" style={{ background: `${glow}22`, color: glow }}>
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </motion.div>
            <Button data-testid="start-regulation-button" onClick={startCountdown}
              className="rounded-full px-8 py-3 font-nunito font-bold text-sm border-0"
              style={{ background: glow, color: '#0D0D11' }}>
              <Play className="w-4 h-4 mr-2" /> Start Activity
            </Button>
          </motion.div>
        )}

        {/* COUNTDOWN */}
        {phase === 'countdown' && (
          <motion.div key="countdown" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="text-center w-full">
            {/* Timer circle */}
            <div className="relative w-48 h-48 mx-auto mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 180 180">
                <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                <motion.circle cx="90" cy="90" r="80" fill="none" stroke={glow} strokeWidth="6" strokeLinecap="round"
                  style={{ strokeDasharray: circumference, strokeDashoffset: dashOffset, filter: `drop-shadow(0 0 8px ${glow}66)` }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-fredoka font-semibold" style={{ color: glow, textShadow: `0 0 20px ${glow}44` }}>
                  {countdown}
                </span>
                <span className="text-[10px] font-nunito" style={{ color: 'rgba(255,255,255,0.4)' }}>seconds</span>
              </div>
            </div>

            {/* Breathing visual — calm BreathOrb in low-stim mode, original radial otherwise */}
            {isLowStimulusMode ? (
              <div className="mb-6">
                <BreathOrb accentColor={glow} compact />
              </div>
            ) : (
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="w-16 h-16 rounded-full mx-auto mb-6"
                style={{ background: `radial-gradient(circle, ${glow}33, transparent)` }}
              />
            )}

            {/* Current step + TTS */}
            <AnimatePresence mode="wait">
              <motion.div key={stepIndex} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="flex items-start gap-2 px-4 mb-8 min-h-[48px] justify-center">
                <p className="text-base font-nunito leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {activity.steps[stepIndex]}
                </p>
                <TTSButton text={activity.steps[stepIndex]} testId="regulation-step-tts" />
              </motion.div>
            </AnimatePresence>

            {/* 4 explicit control buttons per spec */}
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button data-testid="regulation-did-it" onClick={handleDidIt}
                className="rounded-full px-4 py-2 text-xs font-nunito font-bold border-0" style={{ background: glow, color: '#0D0D11' }}>
                <Check className="w-3.5 h-3.5 mr-1" /> I did it
              </Button>
              <Button data-testid="regulation-another-step" onClick={handleAnotherStep} variant="ghost"
                className="rounded-full px-4 py-2 text-xs font-nunito font-bold" style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> I need another step
              </Button>
              <Button data-testid="regulation-different-feeling" onClick={onChooseDifferent} variant="ghost"
                className="rounded-full px-4 py-2 text-xs font-nunito font-bold" style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                I want to choose a different feeling
              </Button>
              <Button data-testid="regulation-pause" onClick={() => { clearInterval(timerRef.current); if (onPause) onPause(); }} variant="ghost"
                className="rounded-full px-4 py-2 text-xs font-nunito font-bold" style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                I want to pause
              </Button>
            </div>
          </motion.div>
        )}

        {/* POST-REGULATION */}
        {phase === 'post' && (
          <motion.div key="post" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full space-y-6">
            <div className="text-center">
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.6 }}
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: `${glow}22` }}>
                <Check className="w-7 h-7" style={{ color: glow }} />
              </motion.div>
              <h2 className="text-xl font-fredoka font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                Great job! How do you feel now?
              </h2>
            </div>

            {/* Ending intensity */}
            <div className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-nunito" style={{ color: 'rgba(255,255,255,0.6)' }}>How strong is it now?</p>
                <span className="text-2xl font-fredoka font-semibold" style={{ color: glow }}>{endingIntensity}</span>
              </div>
              <Slider data-testid="ending-intensity-slider" value={[endingIntensity]} onValueChange={([v]) => onEndingIntensityChange(v)}
                min={0} max={10} step={1} className="py-2" />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] font-nunito" style={{ color: 'rgba(255,255,255,0.3)' }}>Not strong</span>
                <span className="text-[10px] font-nunito" style={{ color: 'rgba(255,255,255,0.3)' }}>Very strong</span>
              </div>
            </div>

            {/* Ending color */}
            <div className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm font-nunito mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
                After doing the step, what color are you ending with?
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {EMOTION_COLORS_FULL.map(c => (
                  <motion.button
                    key={c.id}
                    data-testid={`ending-color-${c.id}`}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onEndingColorChange(c)}
                    className="flex flex-col items-center gap-1.5 cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-xl transition-all"
                      style={{
                        background: c.hex,
                        border: endingColor?.id === c.id ? '3px solid white' : '3px solid transparent',
                        boxShadow: endingColor?.id === c.id ? `0 0 20px ${c.hex}66` : 'none',
                      }} />
                    <span className="text-[9px] font-nunito" style={{ color: endingColor?.id === c.id ? c.hex : 'rgba(255,255,255,0.3)' }}>
                      {c.label.split(' ')[0]}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Ending emotion lookup */}
            <div className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm font-nunito mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
                What feeling are you ending with?
              </p>
              <input
                data-testid="ending-emotion-input"
                value={endingEmotion || ''}
                onChange={(e) => onEndingEmotionChange && onEndingEmotionChange(e.target.value)}
                placeholder="e.g. calmer, lighter, settled..."
                className="w-full rounded-2xl px-4 py-3 text-sm font-nunito outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>

            <div className="text-center pt-2">
              <Button data-testid="post-regulation-continue" onClick={onComplete}
                disabled={!endingColor}
                className="rounded-full px-8 py-3 font-nunito font-bold text-sm border-0 disabled:opacity-40"
                style={{ background: endingColor?.hex || glow, color: '#0D0D11' }}>
                See my color shift <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
