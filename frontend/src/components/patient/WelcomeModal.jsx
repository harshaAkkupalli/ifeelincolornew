import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LOGO_URL, BRAND } from '../../brand';

/**
 * Animated welcome modal shown right after a patient signs in.
 * Greets them by name with a 3D bouncing logo + colorful confetti burst.
 * Auto-dismisses after 4 seconds (or click anywhere to close).
 */
export default function WelcomeModal({ name, onClose, durationMs = 4000 }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setOpen(false);
      onClose?.();
    }, durationMs);
    return () => clearTimeout(t);
  }, [durationMs, onClose]);

  const first = (name || 'friend').split(' ')[0];

  // 24 confetti particles
  const confetti = [BRAND.pink, BRAND.orange, BRAND.yellow, BRAND.green, BRAND.blue, '#A78BFA'];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { setOpen(false); onClose?.(); }}
          className="fixed inset-0 z-[99998] flex items-center justify-center px-6 cursor-pointer"
          style={{
            background:
              'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.97) 0%, rgba(253,244,251,0.97) 60%, rgba(247,237,255,0.97) 100%)',
            backdropFilter: 'blur(14px)',
          }}
          data-testid="welcome-modal"
        >
          {/* Confetti */}
          {[...Array(28)].map((_, i) => {
            const c = confetti[i % confetti.length];
            const startX = 50 + (Math.random() - 0.5) * 10;
            const endX = startX + (Math.random() - 0.5) * 80;
            const endY = 30 + Math.random() * 50;
            const size = 6 + Math.random() * 8;
            return (
              <motion.div
                key={i}
                initial={{ left: `${startX}%`, top: '40%', opacity: 0, scale: 0, rotate: 0 }}
                animate={{
                  left: `${endX}%`,
                  top: `${endY}%`,
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1.2, 1, 0.8],
                  rotate: 360 + Math.random() * 360,
                }}
                transition={{ duration: 2.5 + Math.random(), ease: 'easeOut', delay: i * 0.03 }}
                className="absolute pointer-events-none"
                style={{
                  width: size, height: size, background: c, borderRadius: i % 2 ? '50%' : '3px',
                  boxShadow: `0 0 ${size * 2}px ${c}88`,
                }}
              />
            );
          })}

          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 160, damping: 16 }}
            className="relative flex flex-col items-center text-center"
          >
            {/* 3D Logo bounce */}
            <motion.div
              className="relative mb-6"
              animate={{
                rotateY: [0, 360],
                y: [0, -14, 0],
              }}
              transition={{
                rotateY: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
              }}
              style={{ perspective: 800 }}
            >
              {/* Halo */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                className="absolute -inset-6 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, ${BRAND.pink}, ${BRAND.orange}, ${BRAND.yellow}, ${BRAND.green}, ${BRAND.blue}, ${BRAND.pink})`,
                  filter: 'blur(18px)',
                  opacity: 0.7,
                }}
              />
              <img
                src={LOGO_URL}
                alt="IFEELINCOLOR"
                className="relative w-24 h-24 object-contain drop-shadow-2xl rounded-2xl"
                style={{ background: 'white', padding: 6 }}
              />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xs font-nunito font-bold tracking-[0.25em] uppercase mb-2"
              style={{ color: BRAND.pink }}
            >
              Welcome back
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="font-fredoka font-semibold text-4xl sm:text-5xl mb-3"
              style={{
                background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange}, ${BRAND.yellow})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                lineHeight: 1.05,
              }}
            >
              Hi {first}!
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="font-nunito text-base max-w-xs mx-auto"
              style={{ color: '#5C4D7A' }}
            >
              We're so happy to see you. Take a deep breath — your colors are waiting.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 1.2 }}
              className="mt-6 text-[10px] font-nunito tracking-widest"
              style={{ color: '#A599B8' }}
            >
              tap anywhere to continue
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
