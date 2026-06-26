import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Pause, Play } from 'lucide-react';

/**
 * OnboardingCarousel — full-screen, edge-to-edge intro that runs once per
 * install (Patient or Clinician).
 *
 * Layout
 *   • Always full-screen, no chrome added — looks identical on desktop and
 *     mobile so the experience matches the APK exactly.
 *   • A LARGE 3D-illustrated woman (transparent-bg PNG) is the SOLE hero —
 *     she is physically holding the IFEELINCOLOR phone showing the relevant
 *     app screen. There is no separate floating phone mock; the phone she
 *     holds *is* the screenshot we want the user to see (per user
 *     directive 2026-06-04).
 *   • Text content sits centred under her on a clean white surface and
 *     scales gracefully on small screens (text-base on phones, text-xl on
 *     md+).
 *
 * Behaviour
 *   • Auto-advances every `intervalMs` (default 6 s).
 *   • Touch & hold pauses; release resumes.
 *   • Active pagination dot doubles as a progress bar.
 *   • Persists "seen" via localStorage (1×/install on Capacitor cold start).
 */
export default function OnboardingCarousel({
  screens = [],
  intervalMs = 6000,
  onFinish,
  skipLabel = 'Skip',
  testidPrefix = 'onboarding',
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const safeFinish = () => { if (typeof onFinish === 'function') onFinish(); };

  useEffect(() => {
    if (paused) return undefined;
    timerRef.current = setTimeout(() => {
      setActive((prev) => {
        if (prev >= screens.length - 1) {
          setTimeout(safeFinish, 250);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused, screens.length, intervalMs]);

  if (screens.length === 0) return null;
  const s = screens[active];

  const goNext = () => {
    if (active >= screens.length - 1) safeFinish();
    else setActive(active + 1);
  };
  const holdOn = () => setPaused(true);
  const holdOff = () => setPaused(false);

  return (
    <div
      data-testid={`${testidPrefix}-carousel`}
      className="fixed inset-0 z-[200] flex flex-col select-none overflow-hidden"
      style={{
        background: '#FFFFFF',
        WebkitTouchCallout: 'none',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      onMouseDown={holdOn}
      onMouseUp={holdOff}
      onMouseLeave={holdOff}
      onTouchStart={holdOn}
      onTouchEnd={holdOff}
      onTouchCancel={holdOff}
    >
      {/* Brand-coloured wash */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: `linear-gradient(180deg, ${s.accent2}33 0%, #FFFFFF 50%, ${s.accent}26 100%)` }}
      />
      {/* Animated glow orbs */}
      <motion.span
        aria-hidden
        className="absolute -top-24 -left-24 w-[340px] h-[340px] rounded-full"
        style={{ background: `radial-gradient(circle, ${s.accent2}55, transparent 70%)`, filter: 'blur(48px)' }}
        animate={{ scale: [1, 1.18, 1], rotate: [0, 12, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        aria-hidden
        className="absolute -bottom-24 -right-24 w-[340px] h-[340px] rounded-full"
        style={{ background: `radial-gradient(circle, ${s.accent}55, transparent 70%)`, filter: 'blur(48px)' }}
        animate={{ scale: [1, 1.22, 1], rotate: [0, -10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Top bar: status + skip */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-3">
        <span
          className="inline-flex items-center gap-1 text-[10px] font-nunito font-bold uppercase tracking-widest"
          style={{ color: s.accent }}
          data-testid={`${testidPrefix}-status`}
        >
          {paused ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {paused ? 'Paused' : 'Auto-playing'}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); safeFinish(); }}
          data-testid={`${testidPrefix}-skip`}
          className="text-[11px] font-nunito font-bold uppercase tracking-widest px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.92)', color: s.accent, boxShadow: `0 4px 10px ${s.accent}33` }}
        >
          {skipLabel}
        </button>
      </div>

      {/* Stage — central woman holding her IFEELINCOLOR phone (one hero, no extra phone mock) */}
      <div className="relative z-10 flex-1 overflow-hidden flex items-end justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`stage-${active}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 flex items-end justify-center"
          >
            <motion.img
              src={s.image}
              alt={s.title}
              data-testid={`${testidPrefix}-image-${active}`}
              draggable={false}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{
                opacity: 1, scale: 1, y: [0, -10, 0],
                transition: {
                  opacity: { duration: 0.55 },
                  scale: { type: 'spring', stiffness: 220, damping: 22 },
                  y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                },
              }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.3 } }}
              className="h-[58vh] sm:h-[62vh] md:h-[68vh] max-h-[640px] w-auto object-contain pointer-events-none mx-auto"
              style={{ filter: `drop-shadow(0 24px 40px ${s.accent}66)` }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Content + controls — centred under the woman */}
      <div className="relative z-10 px-5 pb-5 sm:pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`txt-${active}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="text-center max-w-md mx-auto"
          >
            <p
              className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-1.5"
              style={{ color: s.accent }}
            >
              Step {active + 1} of {screens.length}
            </p>
            <h2
              className="font-fredoka font-bold text-[22px] sm:text-2xl leading-tight"
              style={{ color: '#1F1547' }}
              data-testid={`${testidPrefix}-title-${active}`}
            >
              {s.title}
            </h2>
            <p
              className="text-[13px] sm:text-sm font-nunito mt-2 leading-snug"
              style={{ color: '#56506B' }}
            >
              {s.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Pagination dots — active dot doubles as progress bar */}
        <div className="mt-4 flex items-center justify-center gap-1.5"
          data-testid={`${testidPrefix}-dots`}>
          {screens.map((_, i) => {
            const isActive = i === active;
            return (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); setActive(i); }}
                aria-label={`Go to screen ${i + 1}`}
                data-testid={`${testidPrefix}-dot-${i}`}
                className="rounded-full overflow-hidden transition-all"
                style={{
                  width: isActive ? 32 : 8,
                  height: 8,
                  background: isActive ? '#E8E5F2' : `${s.accent}55`,
                }}
              >
                {isActive && (
                  <motion.span
                    key={`fill-${active}-${paused}`}
                    initial={{ width: '0%' }}
                    animate={{ width: paused ? '0%' : '100%' }}
                    transition={{ duration: paused ? 0 : intervalMs / 1000, ease: 'linear' }}
                    className="block h-full"
                    style={{ background: `linear-gradient(90deg, ${s.accent}, ${s.accent2})` }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          data-testid={`${testidPrefix}-next`}
          className="mt-4 w-full max-w-md mx-auto rounded-full py-3 text-sm font-nunito font-bold text-white flex items-center justify-center gap-2"
          style={{
            background: `linear-gradient(135deg, ${s.accent}, ${s.accent2})`,
            boxShadow: `0 14px 30px -10px ${s.accent}99, inset 0 -4px 8px rgba(0,0,0,0.18), inset 0 3px 6px rgba(255,255,255,0.35)`,
          }}
        >
          {active >= screens.length - 1 ? 'Get started' : 'Continue'} <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-[10px] text-center text-slate-400 font-nunito mt-2">
          Touch &amp; hold to pause
        </p>
      </div>
    </div>
  );
}
