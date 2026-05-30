import React, { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback } from 'react';

/**
 * NeuroInclusiveContext — global "Low Stimulus Mode" toggle.
 *
 * One source of truth for the assessment module's sensory accommodations:
 *   • Matte pastel theme overrides (CSS variables on <html>)
 *   • AAC pictogram-first labels
 *   • Linear feelings wheel (replaces radial)
 *   • Frosted breath orb (replaces percussive animations)
 *   • TTS playback affordance everywhere
 *
 * Persistence: localStorage so it survives reloads. Best-effort sync to
 * the backend `users.preferences.low_stimulus_mode` so the patient gets
 * the same experience on the APK + web.
 */
const Ctx = createContext({
  isLowStimulusMode: false,
  toggle: () => {},
  setEnabled: () => {},
});

const STORAGE_KEY = 'ifc_low_stimulus_mode_v1';
const HTML_CLASS = 'neuro-inclusive';

export function NeuroInclusiveProvider({ children }) {
  const [isLowStimulusMode, setIsLowStimulusMode] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === '1' || v === 'true';
    } catch {
      return false;
    }
  });

  // Reflect the state onto <html> so global CSS overrides can latch on
  // without every component having to import a hook. useLayoutEffect (not
  // useEffect) makes the class flip happen BEFORE the browser paints, so
  // toggling Calm Mode OFF instantly clears the dark canvas instead of
  // lingering for one render frame.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (isLowStimulusMode) root.classList.add(HTML_CLASS);
    else root.classList.remove(HTML_CLASS);
  }, [isLowStimulusMode]);

  // Persistence + remote sync run after paint — non-blocking.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, isLowStimulusMode ? '1' : '0'); } catch {}
    if (typeof window !== 'undefined' && window.fetch) {
      const url = `${process.env.REACT_APP_BACKEND_URL}/api/patient/preferences`;
      fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ low_stimulus_mode: isLowStimulusMode }),
      }).catch(() => {});
    }
  }, [isLowStimulusMode]);

  const setEnabled = useCallback((v) => setIsLowStimulusMode(Boolean(v)), []);
  const toggle = useCallback(() => setIsLowStimulusMode((s) => !s), []);

  return (
    <Ctx.Provider value={{ isLowStimulusMode, toggle, setEnabled }}>
      {children}
    </Ctx.Provider>
  );
}

export const useNeuroInclusive = () => useContext(Ctx);
