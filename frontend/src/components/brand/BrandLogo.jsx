import React from 'react';
import { motion } from 'framer-motion';
import { LOGO_URL, BRAND } from '../../brand';

export function Logo({ size = 40, showText = true, textSize = 'text-xl', className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img src={LOGO_URL} alt="IFEELINCOLOR" className="object-contain" style={{ width: size, height: size }} />
      {showText && (
        <span className={`${textSize} font-fredoka font-semibold`} style={{
          background: `linear-gradient(90deg, ${BRAND.green}, ${BRAND.blue}, ${BRAND.orange}, ${BRAND.pink})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          IFEELINCOLOR
        </span>
      )}
    </div>
  );
}

export function LogoIcon({ size = 32, className = '' }) {
  return <img src={LOGO_URL} alt="IFEELINCOLOR" className={`object-contain ${className}`} style={{ width: size, height: size }} />;
}

export function AnimatedLogo({ size = 80 }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        animate={{ rotateY: [0, 360], scale: [1, 1.08, 1] }}
        transition={{ rotateY: { duration: 3, repeat: Infinity, ease: 'easeInOut' }, scale: { duration: 1.5, repeat: Infinity } }}
        style={{ perspective: 600 }}
      >
        <img src={LOGO_URL} alt="Loading" style={{ width: size, height: size }} className="object-contain" />
      </motion.div>
      <div className="flex gap-1">
        {[BRAND.green, BRAND.blue, BRAND.orange, BRAND.pink, BRAND.yellow].map((c, i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{ background: c }}
            animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12 }}
          />
        ))}
      </div>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.97)' }}>
      <AnimatedLogo size={90} />
    </div>
  );
}
