import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LOGO_URL, BRAND } from '../../brand';

/**
 * Global animated route loader.
 * Shows the IFEELINCOLOR logo with a colorful animation briefly
 * on every route change. Designed for a sensory-friendly,
 * autism-aware experience: gentle, never jarring.
 */
export default function RouteLoader() {
  const location = useLocation();
  const [show, setShow] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  useEffect(() => {
    setShow(true);
    const dur = firstLoad ? 1100 : 650;
    const t = setTimeout(() => {
      setShow(false);
      setFirstLoad(false);
    }, dur);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="route-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none"
          data-testid="global-route-loader"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.92) 0%, rgba(253,251,244,0.88) 100%)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex flex-col items-center gap-5">
            {/* Conic gradient halo */}
            <div className="relative w-32 h-32 flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, ${BRAND.green}, ${BRAND.blue}, ${BRAND.orange}, ${BRAND.pink}, ${BRAND.yellow}, ${BRAND.green})`,
                  filter: 'blur(14px)',
                  opacity: 0.55,
                }}
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-2 rounded-full border-2"
                style={{ borderColor: 'rgba(255,255,255,0.6)', borderTopColor: BRAND.pink, borderRightColor: BRAND.blue }}
              />
              <motion.img
                src={LOGO_URL}
                alt="IFEELINCOLOR"
                className="relative z-10 object-contain drop-shadow-xl"
                style={{ width: 72, height: 72 }}
                animate={{ scale: [1, 1.08, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            {/* Dots */}
            <div className="flex gap-1.5">
              {[BRAND.green, BRAND.blue, BRAND.orange, BRAND.pink, BRAND.yellow].map((c, i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: c }}
                  animate={{ y: [0, -7, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-xs font-nunito font-semibold tracking-[0.25em] uppercase"
              style={{
                background: `linear-gradient(90deg, ${BRAND.pink}, ${BRAND.orange})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              IFEELINCOLOR
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
