import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCheckinContent } from '../checkin/CheckinContentContext';

/**
 * Read-only animated body silhouette used by the Assessment History
 * 3D Time-Slider. Highlights a single body zone with the color recorded
 * for that historical check-in. Reuses the cyber-neon aesthetic of the
 * live SomaticMap but strips all interactivity.
 */
function MiniHolographicBody({ accent }) {
  return (
    <svg viewBox="0 0 200 500" className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
      <defs>
        <filter id="histGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="histStroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7FE3FF" />
          <stop offset="60%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor={accent || '#FF4FBF'} />
        </linearGradient>
      </defs>
      {/* Floor */}
      <ellipse cx="100" cy="475" rx="38" ry="5" fill={accent || '#FF4FBF'} opacity="0.45" />
      {/* Head */}
      <g stroke="url(#histStroke)" strokeWidth="1.3" fill="none" filter="url(#histGlow)">
        <ellipse cx="100" cy="42" rx="26" ry="32" />
        <path d="M88 70 Q88 80 90 86 L110 86 Q112 80 112 70" />
      </g>
      {/* Torso */}
      <g stroke="url(#histStroke)" strokeWidth="1.3" fill="none" filter="url(#histGlow)">
        <path d="M58 96 Q70 88 90 86 L110 86 Q130 88 142 96 Q150 105 152 130 L150 175 Q146 200 142 230 Q138 250 130 270 L125 285 L75 285 L70 270 Q62 250 58 230 Q54 200 50 175 L48 130 Q50 105 58 96 Z" />
      </g>
      {/* Spine */}
      <path d="M100 74 L100 280" stroke="#FFD23F" strokeWidth="1.6" strokeOpacity="0.6" fill="none" />
      {/* Arms */}
      <g stroke="url(#histStroke)" strokeWidth="1.2" fill="none" filter="url(#histGlow)">
        <path d="M58 96 Q44 110 38 140 Q34 175 36 205 Q40 230 44 255 L52 275 L58 282" />
        <path d="M142 96 Q156 110 162 140 Q166 175 164 205 Q160 230 156 255 L148 275 L142 282" />
      </g>
      {/* Legs */}
      <g stroke="url(#histStroke)" strokeWidth="1.3" fill="none" filter="url(#histGlow)">
        <path d="M75 285 L70 320 Q66 360 64 400 Q62 430 66 462 L70 470 L82 470 L86 462 Q90 430 92 400 Q94 360 96 320 L98 285 Z" />
        <path d="M102 285 L104 320 Q106 360 108 400 Q110 430 114 462 L118 470 L130 470 L134 462 Q138 430 136 400 Q134 360 130 320 L125 285 Z" />
      </g>
    </svg>
  );
}

/**
 * Props:
 *  - zoneIds: string[] - body part ids to highlight (must match BODY_ZONES ids)
 *  - color: string - hex color for the highlight glow
 *  - emotion: string - emotion label rendered as floating text
 *  - intensity: number 0-10 - drives ring pulse speed/size
 *  - dateLabel?: string - small label rendered top-left
 */
export default function HistoryBodyMap({ zoneIds = [], color = '#FF4FBF', emotion, intensity = 5, dateLabel }) {
  const { bodyZones } = useCheckinContent();
  const highlightedZones = useMemo(() => bodyZones.filter(z => zoneIds.includes(z.id)), [bodyZones, zoneIds]);
  const intensityScale = 1 + Math.min(intensity, 10) / 14; // 1.0 - 1.71

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl"
      style={{
        aspectRatio: '200/500',
        maxHeight: '52vh',
        background: 'radial-gradient(ellipse at 50% 35%, #0A0218 0%, #050008 60%, #000000 100%)',
      }}
      data-testid="history-body-map"
    >
      {/* Neon vertical bars */}
      {[
        { left: '12%', color: '#22F0C7', delay: 0 },
        { left: '88%', color: '#FF4FBF', delay: 0.6 },
      ].map((bar, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.25 }}
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, delay: bar.delay }}
          style={{
            position: 'absolute', left: bar.left, top: '-5%', height: '110%', width: 1.5,
            background: `linear-gradient(180deg, transparent 0%, ${bar.color} 50%, transparent 100%)`,
            boxShadow: `0 0 10px ${bar.color}aa`,
          }}
        />
      ))}

      {/* Date pill (top-left) */}
      {dateLabel && (
        <div className="absolute top-2 left-2 z-20 px-2.5 py-1 rounded-full text-[10px] font-bold font-nunito"
          style={{ background: 'rgba(127,227,255,0.15)', border: '1px solid rgba(127,227,255,0.4)', color: '#7FE3FF' }}>
          {dateLabel}
        </div>
      )}

      {/* Emotion label (top-right) */}
      {emotion && (
        <motion.div
          key={emotion}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-2 right-2 z-20 px-3 py-1 rounded-full text-[11px] font-bold font-nunito"
          style={{
            background: `${color}26`,
            border: `1px solid ${color}`,
            color,
            boxShadow: `0 0 14px ${color}77`,
          }}
          data-testid="history-emotion-label"
        >
          {emotion}
        </motion.div>
      )}

      {/* Body silhouette */}
      <MiniHolographicBody accent={color} />

      {/* Highlights */}
      <div className="relative w-full h-full" style={{ aspectRatio: '200/500' }}>
        <AnimatePresence>
          {highlightedZones.map((z) => (
            <motion.div
              key={z.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute"
              style={{ left: `${z.x}%`, top: `${z.y}%`, transform: 'translate(-50%, -50%)', width: 0, height: 0, pointerEvents: 'none' }}
              data-testid={`history-zone-${z.id}`}
            >
              {/* Outer breathing ring */}
              <motion.div
                animate={{ scale: [1, intensityScale * 1.8, 1], opacity: [0.55, 0, 0.55] }}
                transition={{ duration: 1.6 - Math.min(intensity, 10) * 0.08, repeat: Infinity }}
                className="absolute rounded-full -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2"
                style={{ width: 30, height: 30, background: color, filter: 'blur(3px)' }}
              />
              {/* Mid ring */}
              <motion.div
                animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
                className="absolute rounded-full -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2"
                style={{ width: 22, height: 22, border: `2px solid ${color}` }}
              />
              {/* Core dot */}
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="rounded-full border-2 -translate-x-1/2 -translate-y-1/2 absolute left-1/2 top-1/2"
                style={{
                  width: 14, height: 14,
                  background: color,
                  borderColor: '#FFFFFF',
                  boxShadow: `0 0 14px ${color}, 0 0 28px ${color}cc, inset 0 0 4px rgba(255,255,255,0.6)`,
                }}
              />
              {/* Floating label */}
              <div className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(-50%, ${z.y > 65 ? '-46px' : '34px'})`,
                  whiteSpace: 'nowrap',
                }}>
                <span className="text-[9px] font-nunito font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(11,27,63,0.9)', color: '#E0F7FF', border: `1px solid ${color}`, boxShadow: `0 0 8px ${color}77` }}>
                  {z.label}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Intensity bar (bottom) */}
      <div className="absolute bottom-2 left-2 right-2 z-20">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-nunito text-cyan-200/70 font-bold">INTENSITY</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(127,227,255,0.15)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(intensity / 10) * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{
                height: '100%',
                background: `linear-gradient(90deg, #22F0C7, ${color})`,
                boxShadow: `0 0 8px ${color}aa`,
              }}
            />
          </div>
          <span className="text-[10px] font-nunito font-bold" style={{ color }}>{intensity}/10</span>
        </div>
      </div>
    </div>
  );
}
