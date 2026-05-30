import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Brain } from 'lucide-react';
import { Button } from '../ui/button';
import { useCheckinContent, getMajorityEmotionFrom } from './CheckinContentContext';
import SomaticMap from './SomaticMap';
import SensationSheet from './SensationSheet';
import FeelingsWheel from './FeelingsWheel';
import LinearFeelingsWheel from './LinearFeelingsWheel';
import ReflectionCard from './ReflectionCard';
import RegulationScreen from './RegulationScreen';
import ColorShiftSummary from './ColorShiftSummary';
import BreathOrb from './BreathOrb';
import TTSButton from '../../lib/tts';
import { useNeuroInclusive } from '../../contexts/NeuroInclusiveContext';

const STEP_LABELS = ['Body Map', 'Sensations', 'Feelings Wheel', 'Reflection', 'Regulation', 'Summary'];

/**
 * Inline header toggle for the global Low-Stimulus Mode. Placed in every
 * check-in step header so a patient who realises the radial wheel is
 * overwhelming can flip the switch mid-flow without losing their place.
 */
function NeuroToggle() {
  const { isLowStimulusMode, toggle } = useNeuroInclusive();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isLowStimulusMode}
      data-testid="neuro-inclusive-toggle"
      title="Toggle Low-Stimulus Mode"
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold font-nunito"
      style={{
        background: isLowStimulusMode ? 'rgba(168,191,160,0.18)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${isLowStimulusMode ? '#A8BFA0' : 'rgba(255,255,255,0.12)'}`,
        color: isLowStimulusMode ? '#A8BFA0' : 'rgba(255,255,255,0.55)',
      }}
    >
      <Brain className="w-3 h-3" />
      {isLowStimulusMode ? 'Calm' : 'Calm Mode'}
    </button>
  );
}

/**
 * The 9-step Daily Check-In flow.
 *
 * Props:
 *  - onClose:    fires when the patient bails out before the Color-Shift
 *                Summary screen (X button, RegulationScreen pause, etc.).
 *                The check-in is NOT persisted.
 *  - onComplete: optional. Fires when the patient taps "Done" on the
 *                ColorShiftSummary AFTER the check-in has been saved to
 *                MongoDB via POST /api/checkins. When this prop is NOT
 *                supplied (e.g. legacy callers), the summary's Done
 *                button falls back to `onClose` so behaviour is unchanged.
 *                Embedded callers like the Step-3 assessment use
 *                `onComplete` to gate completion behind a real check-in.
 */
export default function CheckInFlow({ onClose, onComplete }) {
  const { emotionFamilies, emotionColorNames, sensationEmotionMap, zoneSensationEmotionMap } = useCheckinContent();
  const { isLowStimulusMode } = useNeuroInclusive();
  const [step, setStep] = useState(0);

  // State
  const [bodyZone, setBodyZone] = useState([]);
  const [sensations, setSensations] = useState([]);
  const [intensity, setIntensity] = useState(5);
  const [extraAnswers, setExtraAnswers] = useState({});  // {question_id: value}
  const [suggestedEmotion, setSuggestedEmotion] = useState(null);
  const [level1, setLevel1] = useState(null);
  const [level2, setLevel2] = useState(null);
  const [level3, setLevel3] = useState(null);
  const [reflectionText, setReflectionText] = useState('');
  const [regulationStep, setRegulationStep] = useState('');
  const [stepCompleted, setStepCompleted] = useState(false);
  const [endingIntensity, setEndingIntensity] = useState(5);
  const [endingColor, setEndingColor] = useState(null);
  const [endingEmotion, setEndingEmotion] = useState('');

  const emotionColor = level1 ? emotionFamilies[level1]?.color : (suggestedEmotion ? emotionFamilies[suggestedEmotion]?.color : '#FFD166');

  const handleBodySelect = (zones) => {
    setBodyZone(zones);
    setSensations([]);
    setSuggestedEmotion(null);
  };

  const handleSensationsChange = useCallback((newSensations) => {
    setSensations(newSensations);
    if (newSensations.length > 0) {
      // Prefer the per-zone admin map; fall back to the global map.
      let combinedMap = { ...sensationEmotionMap };
      const zones = Array.isArray(bodyZone) ? bodyZone : (bodyZone ? [bodyZone] : []);
      zones.forEach((z) => { combinedMap = { ...combinedMap, ...(zoneSensationEmotionMap?.[z] || {}) }; });
      setSuggestedEmotion(getMajorityEmotionFrom(newSensations, combinedMap));
    } else {
      setSuggestedEmotion(null);
    }
  }, [sensationEmotionMap, zoneSensationEmotionMap, bodyZone]);

  const handleWheelSelect = (l1, l2, l3) => {
    setLevel1(l1); setLevel2(l2); setLevel3(l3);
  };

  const handleChooseDifferent = () => setStep(2);

  // Required-question IDs for the currently selected zones (Phase M)
  const { bodyZones: ctxBodyZones } = useCheckinContent();
  const requiredQuestionIds = React.useMemo(() => {
    const zones = Array.isArray(bodyZone) ? bodyZone : (bodyZone ? [bodyZone] : []);
    const seen = new Set();
    const ids = [];
    zones.forEach((z) => {
      const zoneObj = ctxBodyZones.find((b) => b.id === z);
      (zoneObj?.questions || []).forEach((q) => {
        if (q.required && q.id && !seen.has(q.id)) { seen.add(q.id); ids.push(q.id); }
      });
    });
    return ids;
  }, [bodyZone, ctxBodyZones]);

  const canNext = () => {
    if (step === 0) return Array.isArray(bodyZone) ? bodyZone.length > 0 : !!bodyZone;
    if (step === 1) {
      if (sensations.length === 0) return false;
      return requiredQuestionIds.every((id) => extraAnswers[id] !== undefined && extraAnswers[id] !== '' && extraAnswers[id] !== null);
    }
    if (step === 2) return !!level3;
    return true;
  };

  const next = () => { if (step < 5 && canNext()) setStep(step + 1); };
  const prev = () => { if (step > 0) setStep(step - 1); };

  const slideVariants = {
    enter: { opacity: 0, x: 60 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -60 },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[99999] flex flex-col checkin-flow"
      style={{ background: '#0D0D11' }}
      data-stage="checkin"
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <Button data-testid="close-checkin-flow" onClick={onClose} variant="ghost" className="rounded-full p-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <X className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-xs font-nunito tracking-widest uppercase truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {STEP_LABELS[step]}
            </p>
            <TTSButton text={STEP_LABELS[step]} testId="checkin-step-tts" />
          </div>
          <NeuroToggle />
        </div>
        {/* Progress bar */}
        <div className="flex gap-1">
          {STEP_LABELS.map((_, i) => (
            <motion.div
              key={i}
              className="flex-1 h-1 rounded-full"
              animate={{ background: i <= step ? emotionColor : 'rgba(255,255,255,0.06)' }}
              style={{ boxShadow: i <= step ? `0 0 6px ${emotionColor}44` : 'none' }}
            />
          ))}
        </div>
      </div>

      {/* Content — every step is height-locked so it fits the viewport
          without scrolling. Each step component decides its own internal
          scrolling for any dense child lists. */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={step} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }} className="h-full">
            {step === 0 && <SomaticMap selected={bodyZone} onSelect={handleBodySelect} />}
            {step === 1 && <SensationSheet bodyZone={bodyZone} sensations={sensations} onSensationsChange={handleSensationsChange} intensity={intensity} onIntensityChange={setIntensity} suggestedEmotion={suggestedEmotion} extraAnswers={extraAnswers} onExtraAnswersChange={setExtraAnswers} />}
            {step === 2 && (
              isLowStimulusMode
                ? <LinearFeelingsWheel suggestedEmotion={suggestedEmotion} selectedLevel1={level1} selectedLevel2={level2} selectedLevel3={level3} onSelect={handleWheelSelect} />
                : <FeelingsWheel suggestedEmotion={suggestedEmotion} selectedLevel1={level1} selectedLevel2={level2} selectedLevel3={level3} onSelect={handleWheelSelect} />
            )}
            {step === 3 && <ReflectionCard bodyZone={bodyZone} sensations={sensations} emotion={level2 || emotionFamilies[level1]?.label} colorName={emotionColorNames[level1] || 'Unknown'} deeperFeeling={level3} emotionColor={emotionColor} onReflectionGenerated={setReflectionText} />}
            {step === 4 && <RegulationScreen suggestedEmotion={level1 || suggestedEmotion} emotionColor={emotionColor} endingIntensity={endingIntensity} onEndingIntensityChange={setEndingIntensity} endingColor={endingColor} onEndingColorChange={setEndingColor} endingEmotion={endingEmotion} onEndingEmotionChange={setEndingEmotion} regulationStep={regulationStep} onRegulationStepChange={setRegulationStep} stepCompleted={stepCompleted} onStepCompletedChange={setStepCompleted} onComplete={next} onChooseDifferent={handleChooseDifferent} onPause={onClose} />}
            {step === 5 && <ColorShiftSummary bodyZone={bodyZone} sensations={sensations} intensity={intensity} suggestedEmotion={level1 || suggestedEmotion} level1={level1} level2={level2} level3={level3} reflectionText={reflectionText} regulationStep={regulationStep} stepCompleted={stepCompleted} endingIntensity={endingIntensity} endingColor={endingColor} endingEmotion={endingEmotion} emotionColor={emotionColor} onDone={onComplete || onClose} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer nav - not shown on regulation (has own controls) or summary */}
      {step !== 4 && step !== 5 && (
        <div className="flex-shrink-0 px-4 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <Button data-testid="checkin-flow-prev" onClick={prev} disabled={step === 0} variant="ghost"
            className="rounded-full px-4 py-2 text-sm font-nunito disabled:opacity-20" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex gap-1.5">
            {STEP_LABELS.map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === step ? emotionColor : 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>
          <Button data-testid="checkin-flow-next" onClick={next} disabled={!canNext()}
            className="rounded-full px-5 py-2 text-sm font-nunito font-bold border-0 disabled:opacity-30"
            style={{ background: emotionColor, color: '#0D0D11' }}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}
