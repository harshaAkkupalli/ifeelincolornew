import React from 'react';

/**
 * AAC-style minimalist line pictograms for the Patient Assessment module.
 *
 * Two banks:
 *   • BodyPictograms  — one icon per body zone (matches checkin/checkinData.js)
 *   • SensationPictograms — one per sensation token used in the admin map.
 *
 * Design rules:
 *   – Stroke-only, currentColor-driven so we can recolor per state.
 *   – Generous 24-32px viewBox.
 *   – Single readable concept per icon, no decorative bits.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const Wrap = ({ children, size = 28, label }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 32 32"
    role="img"
    aria-label={label}
    style={stroke}
  >
    {children}
  </svg>
);

// ─── BODY ZONES ───
export const BodyPictograms = {
  head: ({ size = 28 }) => (
    <Wrap size={size} label="Head">
      <circle cx="16" cy="13" r="6" />
      <path d="M10 24 c1.5 -2.5 4 -3.5 6 -3.5 c2 0 4.5 1 6 3.5" />
    </Wrap>
  ),
  eyes_face: ({ size = 28 }) => (
    <Wrap size={size} label="Eyes and face">
      <circle cx="16" cy="16" r="9" />
      <circle cx="13" cy="14" r="1.2" fill="currentColor" />
      <circle cx="19" cy="14" r="1.2" fill="currentColor" />
      <path d="M13 19 c2 1.5 4 1.5 6 0" />
    </Wrap>
  ),
  throat: ({ size = 28 }) => (
    <Wrap size={size} label="Throat">
      <path d="M11 6 v6 c0 5 4 6 5 8 c1 -2 5 -3 5 -8 v-6" />
      <path d="M13 18 h6" />
    </Wrap>
  ),
  shoulders: ({ size = 28 }) => (
    <Wrap size={size} label="Shoulders">
      <path d="M5 22 c2 -7 5 -10 11 -10 s9 3 11 10" />
      <circle cx="16" cy="9" r="2.5" />
    </Wrap>
  ),
  chest: ({ size = 28 }) => (
    <Wrap size={size} label="Chest and heart">
      <path d="M16 26 s-9 -5 -9 -12 a4.5 4.5 0 0 1 9 -2 a4.5 4.5 0 0 1 9 2 c0 7 -9 12 -9 12 z" />
    </Wrap>
  ),
  back: ({ size = 28 }) => (
    <Wrap size={size} label="Back">
      <path d="M16 4 v24" />
      <path d="M16 7 q-5 4 -5 9 q0 5 5 9" />
      <path d="M16 7 q5 4 5 9 q0 5 -5 9" />
    </Wrap>
  ),
  stomach: ({ size = 28 }) => (
    <Wrap size={size} label="Stomach">
      <path d="M9 12 c0 -3 14 -3 14 0 v6 c0 4 -3 8 -7 8 s-7 -4 -7 -8 z" />
      <path d="M11 18 c2 -1 4 1 5 0 c1 -1 3 1 5 0" />
    </Wrap>
  ),
  arms: ({ size = 28 }) => (
    <Wrap size={size} label="Arms and hands">
      <path d="M11 5 v18" />
      <path d="M21 5 v18" />
      <path d="M11 23 c-1 1 -1 3 0 4" />
      <path d="M21 23 c1 1 1 3 0 4" />
    </Wrap>
  ),
  legs: ({ size = 28 }) => (
    <Wrap size={size} label="Legs and feet">
      <path d="M12 4 v20 l-2 4" />
      <path d="M20 4 v20 l2 4" />
      <path d="M7 28 h8" />
      <path d="M17 28 h8" />
    </Wrap>
  ),
  skin: ({ size = 28 }) => (
    <Wrap size={size} label="Skin and whole body">
      <path d="M16 4 c2 4 6 6 6 12 s-3 12 -6 12 s-6 -3 -6 -12 s4 -8 6 -12 z" />
      <circle cx="14" cy="16" r="0.8" fill="currentColor" />
      <circle cx="18" cy="20" r="0.8" fill="currentColor" />
      <circle cx="17" cy="13" r="0.8" fill="currentColor" />
    </Wrap>
  ),
  whole_body: ({ size = 28 }) => (
    <Wrap size={size} label="Whole body energy">
      <circle cx="16" cy="16" r="4" />
      <path d="M16 5 v3 M16 24 v3 M5 16 h3 M24 16 h3 M8 8 l2 2 M22 22 l2 2 M22 10 l2 -2 M8 24 l2 -2" />
    </Wrap>
  ),
};

// ─── SENSATIONS ───
// One pictogram per sensation token used in the admin sensationEmotionMap.
// If a sensation isn't here, the consumer falls back to a generic dot.
export const SensationPictograms = {
  // Cognitive / heady
  foggy: ({ size = 28 }) => (
    <Wrap size={size} label="Foggy">
      <path d="M7 16 c0 -3 3 -4 5 -3 c1 -3 6 -3 7 0 c3 -0.5 5 1 5 4 c0 2 -2 3 -4 3 H10 c-2 0 -3 -1 -3 -4z" />
    </Wrap>
  ),
  headache: ({ size = 28 }) => (
    <Wrap size={size} label="Headache">
      <circle cx="16" cy="16" r="3" />
      <circle cx="16" cy="16" r="6" opacity="0.7" />
      <circle cx="16" cy="16" r="9" opacity="0.4" />
      <path d="M16 4 l1.5 3 M16 28 l1.5 -3 M4 16 l3 1.5 M28 16 l-3 1.5" />
    </Wrap>
  ),
  dizzy: ({ size = 28 }) => (
    <Wrap size={size} label="Dizzy">
      <path d="M8 13 c2 -3 5 -3 8 0 s6 -3 8 0" />
      <path d="M8 19 c2 -3 5 -3 8 0 s6 -3 8 0" />
    </Wrap>
  ),
  // Heart / chest
  racing: ({ size = 28 }) => (
    <Wrap size={size} label="Racing">
      <path d="M4 18 h4 l2 -5 l3 10 l3 -8 l2 3 h10" />
    </Wrap>
  ),
  tight: ({ size = 28 }) => (
    <Wrap size={size} label="Tight">
      <path d="M9 9 l14 14 M23 9 l-14 14" />
      <rect x="10" y="10" width="12" height="12" rx="3" />
    </Wrap>
  ),
  flutter: ({ size = 28 }) => (
    <Wrap size={size} label="Flutter">
      <path d="M16 26 s-9 -5 -9 -12 a4.5 4.5 0 0 1 9 -2 a4.5 4.5 0 0 1 9 2 c0 7 -9 12 -9 12 z" />
      <path d="M20 11 l-2 2 M22 13 l-2 1" />
    </Wrap>
  ),
  // Stomach
  knot: ({ size = 28 }) => (
    <Wrap size={size} label="Knot">
      <path d="M12 12 c4 -4 8 0 4 4 c-4 4 -8 0 -4 -4 z" />
      <path d="M20 20 c-4 4 -8 0 -4 -4 c4 -4 8 0 4 4 z" />
    </Wrap>
  ),
  nauseous: ({ size = 28 }) => (
    <Wrap size={size} label="Nauseous">
      <circle cx="16" cy="16" r="9" />
      <path d="M12 20 c2 -2 4 -2 6 0 c2 2 4 2 6 0" />
      <path d="M11 14 l2 -2 M21 14 l-2 -2" />
    </Wrap>
  ),
  empty: ({ size = 28 }) => (
    <Wrap size={size} label="Empty">
      <circle cx="16" cy="16" r="9" />
      <path d="M11 16 h10" />
    </Wrap>
  ),
  // Muscle / posture
  tense: ({ size = 28 }) => (
    <Wrap size={size} label="Tense">
      <path d="M5 16 h22" />
      <path d="M8 12 l-3 -3 M24 12 l3 -3 M8 20 l-3 3 M24 20 l3 3" />
    </Wrap>
  ),
  heavy: ({ size = 28 }) => (
    <Wrap size={size} label="Heavy">
      <path d="M10 8 h12 l-2 16 H12 z" />
      <path d="M13 4 h6 v4" />
    </Wrap>
  ),
  shaky: ({ size = 28 }) => (
    <Wrap size={size} label="Shaky">
      <path d="M5 12 l4 -2 l4 4 l4 -4 l4 4 l4 -2 l2 0" />
      <path d="M5 22 l4 -2 l4 4 l4 -4 l4 4 l4 -2 l2 0" />
    </Wrap>
  ),
  numb: ({ size = 28 }) => (
    <Wrap size={size} label="Numb">
      <circle cx="16" cy="16" r="9" strokeDasharray="3 3" />
    </Wrap>
  ),
  // Energy
  tired: ({ size = 28 }) => (
    <Wrap size={size} label="Tired">
      <path d="M9 14 c2 -2 4 -2 6 0" />
      <path d="M17 14 c2 -2 4 -2 6 0" />
      <path d="M11 22 c3 -2 7 -2 10 0" />
    </Wrap>
  ),
  buzzing: ({ size = 28 }) => (
    <Wrap size={size} label="Buzzing">
      <path d="M8 10 l4 0 l-3 4 l5 0 l-3 4 l5 0 l-3 4 l5 0" />
    </Wrap>
  ),
  warm: ({ size = 28 }) => (
    <Wrap size={size} label="Warm">
      <path d="M16 6 c0 6 4 7 4 12 a4 4 0 0 1 -8 0 c0 -5 4 -6 4 -12 z" />
    </Wrap>
  ),
  cold: ({ size = 28 }) => (
    <Wrap size={size} label="Cold">
      <path d="M16 4 v24 M5 10 l22 12 M27 10 l-22 12" />
    </Wrap>
  ),
};

export const BodyIcon = ({ token, size = 28 }) => {
  const Comp = BodyPictograms[token];
  if (Comp) return <Comp size={size} />;
  return (
    <Wrap size={size} label={token || 'Body part'}>
      <circle cx="16" cy="16" r="8" />
    </Wrap>
  );
};

export const SensationIcon = ({ token, size = 28 }) => {
  const key = (token || '').toLowerCase().replace(/[^a-z]/g, '_');
  const Comp = SensationPictograms[key]
    || SensationPictograms[key.split('_')[0]]
    || null;
  if (Comp) return <Comp size={size} />;
  return (
    <Wrap size={size} label={token || 'Sensation'}>
      <circle cx="16" cy="16" r="3" fill="currentColor" />
    </Wrap>
  );
};
