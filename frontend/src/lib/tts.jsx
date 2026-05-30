import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Square } from 'lucide-react';

/**
 * Lightweight Web Speech API wrapper. We deliberately do NOT pull in a
 * remote TTS service so the patient gets zero-latency playback even on a
 * spotty connection. The fallback is graceful: if the browser doesn't
 * support speech synthesis (very rare in 2026), the button is hidden.
 *
 * Voice selection prefers calm, even-paced female English voices that
 * map well to a neurodivergent-friendly affect. We cache the resolved
 * voice once per session.
 */
let cachedVoice = null;
let voicesReadyPromise = null;

function ensureVoices() {
  if (voicesReadyPromise) return voicesReadyPromise;
  voicesReadyPromise = new Promise((resolve) => {
    const s = window.speechSynthesis;
    if (!s) return resolve([]);
    const ready = () => {
      const v = s.getVoices() || [];
      if (v.length) resolve(v);
    };
    ready();
    // Chrome populates voices asynchronously
    s.onvoiceschanged = ready;
    // Final fallback timeout so we never hang
    setTimeout(() => resolve(s.getVoices() || []), 600);
  });
  return voicesReadyPromise;
}

async function pickCalmVoice() {
  if (cachedVoice) return cachedVoice;
  const voices = await ensureVoices();
  if (!voices.length) return null;
  // Preference order: Google UK English Female → Samantha → any
  // English female → any English.
  const score = (v) => {
    const n = (v.name || '').toLowerCase();
    const l = (v.lang || '').toLowerCase();
    if (!l.startsWith('en')) return 0;
    let s = 10;
    if (n.includes('female')) s += 12;
    if (n.includes('samantha')) s += 25;
    if (n.includes('google') && n.includes('uk')) s += 24;
    if (n.includes('google')) s += 8;
    if (n.includes('jenny')) s += 18;
    if (n.includes('aria')) s += 16;
    if (n.includes('serena')) s += 14;
    if (l === 'en-gb') s += 4;
    return s;
  };
  cachedVoice = [...voices].sort((a, b) => score(b) - score(a))[0] || null;
  return cachedVoice;
}

export function speak(text, opts = {}) {
  if (!text || typeof window === 'undefined') return null;
  const s = window.speechSynthesis;
  if (!s) return null;
  // Stop anything currently playing first — patients shouldn't hear two
  // headers overlapping.
  s.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(/\s+/g, ' ').trim());
  u.rate = opts.rate ?? 0.92;     // slightly slower than default for calm cadence
  u.pitch = opts.pitch ?? 1.0;
  u.volume = opts.volume ?? 1.0;
  pickCalmVoice().then((v) => { if (v) u.voice = v; });
  s.speak(u);
  return u;
}

export function stop() {
  const s = (typeof window !== 'undefined') && window.speechSynthesis;
  if (s) s.cancel();
}

/**
 * <TTSButton text="..." /> — pill audio trigger to drop next to any
 * instruction header. Toggles between play / stop visually.
 */
export default function TTSButton({
  text,
  className = '',
  size = 36,
  ariaLabel = 'Listen to this instruction',
  testId = 'tts-play',
  variant = 'pill',     // 'pill' | 'inline'
}) {
  const [playing, setPlaying] = useState(false);
  const utterRef = useRef(null);

  // Hide the button entirely if the browser has no TTS.
  const supported = typeof window !== 'undefined' && !!window.speechSynthesis;

  useEffect(() => () => { stop(); }, []);
  useEffect(() => {
    const s = window.speechSynthesis;
    if (!s) return;
    const i = setInterval(() => setPlaying(!!s.speaking), 250);
    return () => clearInterval(i);
  }, []);

  if (!supported || !text) return null;

  const onClick = () => {
    if (playing) { stop(); setPlaying(false); return; }
    utterRef.current = speak(text);
    setPlaying(true);
  };

  const baseStyle = variant === 'pill'
    ? {
        width: size, height: size,
        borderRadius: '50%',
        background: playing ? 'rgba(168, 191, 160, 0.18)' : 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
      }
    : { padding: '4px 8px', borderRadius: 999, background: 'transparent' };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={playing}
      data-testid={testId}
      className={`inline-flex items-center justify-center text-white/80 hover:text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${className}`}
      style={baseStyle}
    >
      {playing
        ? <Square className="w-4 h-4" fill="currentColor" />
        : <Volume2 className="w-4 h-4" />}
    </button>
  );
}
