import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import TTSButton from '../../lib/tts';

/**
 * BreathOrb — visually-guided breathing coach.
 *
 * No text-only ticks. A frosted-glass orb rhythmically expands (inhale),
 * holds (settle), and shrinks (exhale). Pattern defaults to a calm 4-6-2
 * cadence (inhale 4s, exhale 6s, settle 2s) which is well-tolerated by
 * neurodivergent users. The current phase label is announced via TTS so
 * eyes-closed practice still works.
 *
 * Props:
 *   accentColor — tint of the orb halo (defaults to soft slate blue)
 *   compact     — half-size variant used in summary cards
 */
const PHASES = [
  { name: 'Breathe in',  ms: 4000, scale: 1.18 },
  { name: 'Hold',        ms: 2000, scale: 1.18 },
  { name: 'Breathe out', ms: 6000, scale: 0.86 },
  { name: 'Settle',      ms: 2000, scale: 0.86 },
];

export default function BreathOrb({
  accentColor = '#8FA6C6',
  compact = false,
  autoStart = true,
  size,
  testId = 'breath-orb',
}) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [running, setRunning] = useState(autoStart);
  const phase = PHASES[phaseIdx];
  const dim = size || (compact ? 140 : 240);

  useEffect(() => {
    if (!running) return undefined;
    const t = setTimeout(() => {
      setPhaseIdx((i) => (i + 1) % PHASES.length);
    }, phase.ms);
    return () => clearTimeout(t);
  }, [phaseIdx, running, phase.ms]);

  // Announce phase change via TTS once per change (best-effort, silent if
  // unsupported). We only announce the two action phases.
  useEffect(() => {
    if (!running) return;
    if (phase.name === 'Breathe in' || phase.name === 'Breathe out') {
      const u = new SpeechSynthesisUtterance(phase.name);
      u.rate = 0.78; u.pitch = 1.0; u.volume = 0.85;
      try { window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch {}
    }
  }, [phaseIdx, running, phase.name]);

  return (
    <div
      className="flex flex-col items-center justify-center select-none"
      data-testid={testId}
      style={{ minHeight: dim + 60 }}
    >
      {/* Halo layers — single tinted blur, no kaleidoscope */}
      <div className="relative flex items-center justify-center" style={{ width: dim, height: dim }}>
        <motion.div
          aria-hidden
          className="absolute rounded-full"
          animate={{ scale: phase.scale, opacity: 0.22 }}
          transition={{ duration: phase.ms / 1000, ease: 'easeInOut' }}
          style={{
            width: dim, height: dim,
            background: `radial-gradient(circle, ${accentColor}55 0%, transparent 70%)`,
            filter: 'blur(18px)',
          }}
        />
        <motion.div
          className="rounded-full flex items-center justify-center"
          animate={{ scale: phase.scale }}
          transition={{ duration: phase.ms / 1000, ease: 'easeInOut' }}
          style={{
            width: dim * 0.6,
            height: dim * 0.6,
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(14px)',
            border: `1px solid ${accentColor}55`,
            boxShadow: `0 0 28px ${accentColor}33`,
          }}
        >
          <p
            className="font-nunito tracking-widest uppercase text-[11px]"
            style={{ color: accentColor }}
          >
            {phase.name}
          </p>
        </motion.div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          aria-pressed={running}
          data-testid={`${testId}-toggle`}
          className="px-4 py-2 rounded-full text-xs font-bold font-nunito"
          style={{
            color: accentColor,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${accentColor}66`,
          }}
        >
          {running ? 'Pause' : 'Start'}
        </button>
        <TTSButton
          text={`We will breathe together. ${PHASES.map(p => p.name).join('. ')}. Settle.`}
          testId={`${testId}-tts`}
          ariaLabel="Listen to the breathing instructions"
        />
      </div>
    </div>
  );
}
