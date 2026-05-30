// ─── Dynamic check-in content provider ───
// Pulls body parts + emotion families from the admin-configured backend
// (/api/checkin/body-parts, /api/checkin/emotion-families) once and exposes
// the same shape the legacy hardcoded `checkinData.js` constants used to.
// Components consume via `useCheckinContent()`.
//
// Falls back to the static constants if the network call fails so the
// patient flow never breaks.

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import {
  BODY_ZONES as FALLBACK_ZONES,
  ZONE_SENSATIONS as FALLBACK_SENS,
  EMOTION_FAMILIES as FALLBACK_FAMILIES,
  FEELINGS_WHEEL as FALLBACK_WHEEL,
  REGULATION_ACTIVITIES as FALLBACK_REG,
  COLOR_REGULATION_MESSAGE as FALLBACK_REG_MSG,
  EMOTION_COLORS_FULL as FALLBACK_COLORS_FULL,
  EMOTION_COLOR_NAMES as FALLBACK_COLOR_NAMES,
  SENSATION_EMOTION_MAP as FALLBACK_SENS_EMO_MAP,
} from './checkinData';

const API = process.env.REACT_APP_BACKEND_URL;
const CheckinContentContext = createContext(null);

function buildFromApi(bodyPartsApi, familiesApi, sensationEmotionMapApi) {
  // body zones
  const bodyZones = (bodyPartsApi || []).map((bp) => ({
    id: bp.slug,
    label: bp.name,
    x: Number(bp.position_x) || 50,
    y: Number(bp.position_y) || 50,
    questionText: bp.question_text || '',
    reflectionTemplate: bp.reflection_template || '',
    defaultEmotionKey: bp.default_emotion_key || '',
    questions: bp.questions || [],
  }));
  const zoneSensations = {};
  const zoneSensationEmotionMap = {};
  (bodyPartsApi || []).forEach((bp) => {
    zoneSensations[bp.slug] = bp.sensations || [];
    zoneSensationEmotionMap[bp.slug] = bp.sensation_emotion_map || {};
  });

  // emotion families
  const emotionFamilies = {};
  const feelingsWheel = {};
  const regulationActivities = {};
  const colorRegulationMessage = {};
  const emotionColorsFull = [];
  const emotionColorNames = {};

  (familiesApi || []).forEach((f) => {
    emotionFamilies[f.key] = {
      color: f.color_hex,
      label: f.label,
      darkBg: `${f.color_hex}14`,
    };
    feelingsWheel[f.key] = {};
    (f.level2 || []).forEach((l2) => {
      feelingsWheel[f.key][l2.label.toLowerCase()] = l2.level3 || [];
    });
    regulationActivities[f.key] = f.regulation_activities || [];
    colorRegulationMessage[f.key] = f.regulation_message || '';
    emotionColorsFull.push({ id: f.key, hex: f.color_hex, label: f.label });
    emotionColorNames[f.key] = f.label;
  });

  // Global sensation → emotion family map (admin-authored, dynamic)
  const sensationEmotionMap = { ...(sensationEmotionMapApi || {}) };

  return {
    bodyZones, zoneSensations, zoneSensationEmotionMap,
    emotionFamilies, feelingsWheel, regulationActivities,
    colorRegulationMessage, emotionColorsFull, emotionColorNames,
    sensationEmotionMap,
  };
}

const FALLBACK = {
  bodyZones: FALLBACK_ZONES,
  zoneSensations: FALLBACK_SENS,
  zoneSensationEmotionMap: {},
  emotionFamilies: FALLBACK_FAMILIES,
  feelingsWheel: FALLBACK_WHEEL,
  regulationActivities: FALLBACK_REG,
  colorRegulationMessage: FALLBACK_REG_MSG,
  emotionColorsFull: FALLBACK_COLORS_FULL,
  emotionColorNames: FALLBACK_COLOR_NAMES,
  sensationEmotionMap: FALLBACK_SENS_EMO_MAP,
};

export function CheckinContentProvider({ children }) {
  const [data, setData] = useState(FALLBACK);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      // Phase L: single aggregate endpoint feeds the entire patient check-in flow
      const res = await axios.get(`${API}/api/assessments/active`);
      const built = buildFromApi(
        res.data?.body_parts || [],
        res.data?.families || [],
        res.data?.sensation_emotion_map || {},
      );
      if (built.bodyZones.length && Object.keys(built.emotionFamilies).length) {
        setData(built);
      }
    } catch {
      // keep fallback
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({ ...data, loaded, refresh }), [data, loaded, refresh]);
  return (
    <CheckinContentContext.Provider value={value}>{children}</CheckinContentContext.Provider>
  );
}

export function useCheckinContent() {
  const ctx = useContext(CheckinContentContext);
  if (ctx) return ctx;
  // Lazy default when consumer is rendered outside provider (e.g. unit test)
  return { ...FALLBACK, loaded: true, refresh: () => Promise.resolve() };
}

// Helper that depends on dynamic bodyZones
export function getZoneLabelFrom(zones, zoneId) {
  if (Array.isArray(zoneId)) return zoneId.map((z) => getZoneLabelFrom(zones, z)).filter(Boolean).join(', ');
  if (!zoneId || typeof zoneId !== 'string') return '';
  const zone = zones.find((z) => z.id === zoneId);
  return zone?.label || zoneId.replace(/_/g, ' ');
}

// Majority-emotion calculation using a dynamic admin-driven map.
// Falls back to the bundled static map when caller doesn't supply one.
export function getMajorityEmotionFrom(sensations, dynamicMap) {
  const map = (dynamicMap && Object.keys(dynamicMap).length) ? dynamicMap : FALLBACK_SENS_EMO_MAP;
  const counts = {};
  sensations.forEach((s) => {
    const emotion = map[s] || 'bad';
    counts[emotion] = (counts[emotion] || 0) + 1;
  });
  let max = 0, result = 'bad';
  Object.entries(counts).forEach(([emotion, count]) => {
    if (count > max) { max = count; result = emotion; }
  });
  return result;
}

// Soften diagnostic phrasing on the client too (defence-in-depth — server already
// validates inputs, but if a legacy record slipped through we never want to render
// definitive diagnostic language to a patient).
const DIAGNOSTIC_REPLACEMENTS = [
  [/\bthis proves\b/gi, 'your body may be telling you'],
  [/\byou definitely\b/gi, 'you may'],
  [/\byou clearly\b/gi, 'you may'],
  [/\byou certainly\b/gi, 'you may'],
  [/\byou are diagnosed\b/gi, 'you may be experiencing'],
  [/\byou suffer from\b/gi, 'you may be experiencing'],
  [/\bguaranteed to\b/gi, 'may help to'],
  [/\bwill cure\b/gi, 'may help with'],
  [/\bmust be\b/gi, 'may be'],
  [/\bis caused by\b/gi, 'may be connected to'],
  [/\bis a symptom of\b/gi, 'may be linked with'],
  [/\balways means\b/gi, 'may suggest'],
  [/\bnever means\b/gi, 'may not always mean'],
];
export function softenClinicalPhrase(text) {
  if (!text) return text;
  let out = text;
  DIAGNOSTIC_REPLACEMENTS.forEach(([pat, rep]) => { out = out.replace(pat, rep); });
  return out;
}
