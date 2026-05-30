import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCheckinContent } from './CheckinContentContext';
import TTSButton from '../../lib/tts';

/**
 * LinearFeelingsWheel — Low-Stimulus replacement for the radial Feelings
 * Wheel. Predictable, vertical, no spinning, no kaleidoscope colors.
 *
 *  Stack of three glassmorphic panels, top-down:
 *    Level 1: Color (broad emotion family)
 *    Level 2: Specific emotion
 *    Level 3: Deeper feeling
 *
 *  Each panel becomes interactive only after the previous has been chosen
 *  so the user is always guided one decision at a time.
 *
 *  Emits exactly the same `(level1, level2, level3)` triplet via `onSelect`
 *  as the radial wheel so the parent CheckInFlow / 17-point payload
 *  collection stays untouched.
 */
export default function LinearFeelingsWheel({
  suggestedEmotion,
  onSelect,
  selectedLevel1,
  selectedLevel2,
  selectedLevel3,
}) {
  const { emotionFamilies: EMOTION_FAMILIES, feelingsWheel: FEELINGS_WHEEL } = useCheckinContent();
  const [l1, setL1] = useState(selectedLevel1 || null);
  const [l2, setL2] = useState(selectedLevel2 || null);
  const [l3, setL3] = useState(selectedLevel3 || null);

  // If the user arrives from Sensations with a suggestion, surface it as
  // the first hint — they can still override.
  useEffect(() => {
    if (!l1 && suggestedEmotion && EMOTION_FAMILIES[suggestedEmotion]) {
      // Don't auto-pick. Just keep the suggestion visible as a hint chip.
    }
  }, [suggestedEmotion, l1, EMOTION_FAMILIES]);

  const handleL1 = (key) => { setL1(key); setL2(null); setL3(null); onSelect(key, null, null); };
  const handleL2 = (key) => { setL2(key); setL3(null); onSelect(l1, key, null); };
  const handleL3 = (val) => { setL3(val); onSelect(l1, l2, val); };

  const accent = l1 ? '#8FA6C6' : '#92B8B0';   // matte slate for engagement, sea-glass when idle

  const l2Options = useMemo(() => {
    if (!l1 || !FEELINGS_WHEEL[l1]) return [];
    return Object.keys(FEELINGS_WHEEL[l1]);
  }, [l1, FEELINGS_WHEEL]);

  const l3Options = useMemo(() => {
    if (!l1 || !l2 || !FEELINGS_WHEEL[l1]?.[l2]) return [];
    return FEELINGS_WHEEL[l1][l2];
  }, [l1, l2, FEELINGS_WHEEL]);

  const Panel = ({ idx, title, helper, ttsText, active, locked, children, testId }) => (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: locked ? 0.35 : 1, y: 0 }}
      transition={{ duration: 0.28, delay: idx * 0.04 }}
      className="rounded-2xl px-4 py-4"
      data-testid={testId}
      style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(14px)',
        border: `1px solid ${active ? accent + 'cc' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: active ? `0 0 0 2px ${accent}33` : 'none',
        pointerEvents: locked ? 'none' : 'auto',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p
            className="text-[10px] uppercase tracking-widest font-bold mb-0.5"
            style={{ color: accent }}
          >
            Step {idx}
          </p>
          <h3
            className="text-sm font-fredoka font-semibold"
            style={{ color: 'rgba(255,255,255,0.95)' }}
          >
            {title}
          </h3>
          {helper && (
            <p className="text-[11px] font-nunito mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {helper}
            </p>
          )}
        </div>
        <TTSButton text={ttsText} testId={`${testId}-tts`} />
      </div>
      {children}
    </motion.section>
  );

  return (
    <div
      className="h-full overflow-y-auto flex flex-col gap-3 px-3 pt-3 pb-6 max-w-lg mx-auto feelings-wheel-linear"
      data-testid="linear-feelings-wheel"
    >
      {/* LEVEL 1 — Color family */}
      <Panel
        idx={1}
        title="Pick the color that feels closest"
        helper={suggestedEmotion && !l1 ? `Hint based on your sensations: ${EMOTION_FAMILIES[suggestedEmotion]?.label}` : 'Take your time. There is no wrong answer.'}
        ttsText="Pick the color that feels closest to how you feel right now. Take your time. There is no wrong answer."
        active={!l1}
        locked={false}
        testId="lfw-panel-1"
      >
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(EMOTION_FAMILIES).map(([key, ef]) => {
            const selected = l1 === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleL1(key)}
                aria-pressed={selected}
                data-selected={selected ? 'true' : 'false'}
                data-testid={`lfw-l1-${key}`}
                className="ni-target text-left flex items-center gap-3"
              >
                <span
                  aria-hidden
                  className="inline-block rounded-full shrink-0"
                  style={{
                    width: 22, height: 22,
                    background: ef.color,
                    opacity: 0.85,
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                />
                <span className="text-sm font-fredoka font-semibold capitalize" style={{ color: '#ECECF1' }}>
                  {ef.label || key}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* LEVEL 2 — Specific emotion */}
      <Panel
        idx={2}
        title={l1 ? 'Choose the specific feeling' : 'Specific feeling'}
        helper={l1 ? `Inside ${EMOTION_FAMILIES[l1]?.label || l1}` : 'Available after Step 1'}
        ttsText={l1
          ? `Inside ${EMOTION_FAMILIES[l1]?.label || l1}. Choose the specific feeling that matches best.`
          : 'This step will become available after you choose a color.'}
        active={!!l1 && !l2}
        locked={!l1}
        testId="lfw-panel-2"
      >
        {l2Options.length === 0 ? (
          <p className="text-[12px] font-nunito" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {l1 ? 'No deeper layer for this color.' : 'Locked'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {l2Options.map((opt) => {
              const selected = l2 === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleL2(opt)}
                  aria-pressed={selected}
                  data-selected={selected ? 'true' : 'false'}
                  data-testid={`lfw-l2-${opt}`}
                  className="ni-target text-sm font-fredoka capitalize"
                  style={{ color: '#ECECF1' }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}
      </Panel>

      {/* LEVEL 3 — Deeper feeling */}
      <Panel
        idx={3}
        title={l2 ? 'Go one layer deeper' : 'Deeper feeling'}
        helper={l2 ? 'Pick the one that resonates most' : 'Available after Step 2'}
        ttsText={l2
          ? 'Go one layer deeper. Pick the word that resonates most with how this feels in your body.'
          : 'This step will become available after you pick a specific feeling.'}
        active={!!l2 && !l3}
        locked={!l2}
        testId="lfw-panel-3"
      >
        {l3Options.length === 0 ? (
          <p className="text-[12px] font-nunito" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {l2 ? 'No deeper layer.' : 'Locked'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {l3Options.map((opt) => {
              const selected = l3 === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleL3(opt)}
                  aria-pressed={selected}
                  data-selected={selected ? 'true' : 'false'}
                  data-testid={`lfw-l3-${opt}`}
                  className="ni-target text-sm font-fredoka capitalize"
                  style={{ color: '#ECECF1' }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
