import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LOGO_URL } from '../brand';

/**
 * SplashIntro — IFEELINCOLOR brand splash shown immediately when the user
 * first installs the app (or, on web, on first visit until they finish the
 * onboarding carousel). The logo zooms in, sits centered for ~1.5 s, then
 * fades out and triggers `onFinish`.
 *
 * Mounted by the same parent that owns the OnboardingCarousel so the splash
 * and the carousel hand off cleanly.
 *
 * Props
 *   onFinish  — called when splash exits (after ~2 s total)
 *   duration  — total visible time in ms (default 1800)
 */
export default function SplashIntro({ onFinish, duration = 1800 }) {
  useEffect(() => {
    const id = setTimeout(() => {
      if (typeof onFinish === 'function') onFinish();
    }, duration);
    return () => clearTimeout(id);
  }, [duration, onFinish]);

  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        data-testid="splash-intro"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-[250] flex items-center justify-center"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, #FFFFFF 0%, #F4EAFF 55%, #E0E7FF 100%)',
        }}
      >
        {/* Soft brand-coloured halos for depth */}
        <motion.span
          aria-hidden
          className="absolute w-[420px] h-[420px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(255,111,184,0.35), transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          aria-hidden
          className="absolute w-[420px] h-[420px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(124,91,255,0.35), transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{ scale: [1, 1.22, 1], rotate: [0, 12, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Logo + wordmark stack */}
        <motion.div
          className="relative z-10 flex flex-col items-center"
          initial={{ scale: 0.7, opacity: 0, y: 18 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 1.04, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        >
          <motion.img
            src={LOGO_URL}
            alt="IFEELINCOLOR"
            className="w-32 h-32 object-contain"
            data-testid="splash-logo"
            initial={{ y: 0 }}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ filter: 'drop-shadow(0 18px 32px rgba(124,91,255,0.35))' }}
          />
          <motion.p
            className="mt-3 font-fredoka font-bold text-3xl tracking-wide"
            style={{
              background: 'linear-gradient(135deg, #FF6FB8, #7C5BFF, #22D3C5)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.45 }}
          >
            IFEELINCOLOR
          </motion.p>
          <motion.p
            className="mt-1 text-xs font-nunito uppercase tracking-[0.35em]"
            style={{ color: '#7C5BFF' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.5 }}
          >
            Feel · Heal · Bloom
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
