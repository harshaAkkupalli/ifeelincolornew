import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * 3D Time-Slider — horizontal interactive timeline showing all check-ins as
 * glowing dots colored by the check-in's user_selected_color. Drag the
 * slider thumb (or tap a dot) to navigate history. Tilted with CSS3D
 * perspective for premium feel.
 *
 * Props:
 *  - items: Array<{ id, date (Date | ISO string), color, label?, severity? }>
 *  - activeIndex: number
 *  - onChange: (index: number) => void
 */
export default function TimeSlider({ items = [], activeIndex = 0, onChange }) {
  const safe = items.length > 0 ? items : [];
  const idx = Math.max(0, Math.min(activeIndex, safe.length - 1));
  const pct = safe.length > 1 ? (idx / (safe.length - 1)) * 100 : 50;

  const dates = useMemo(() => safe.map((it) => {
    const d = it.date instanceof Date ? it.date : new Date(it.date);
    return Number.isNaN(d.getTime()) ? null : d;
  }), [safe]);

  const formatLabel = (d) => {
    if (!d) return '';
    const opts = { month: 'short', day: 'numeric' };
    return d.toLocaleDateString(undefined, opts);
  };

  const formatFull = (d) => {
    if (!d) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const current = safe[idx];
  const currentDate = dates[idx];

  if (!safe.length) {
    return (
      <div className="px-4 py-6 rounded-2xl text-center"
        style={{ background: 'rgba(127,227,255,0.06)', border: '1px solid rgba(127,227,255,0.2)' }}
        data-testid="time-slider-empty">
        <p className="text-sm font-fredoka text-cyan-100/80">No check-ins yet. Complete your first Daily Check-In to build your archive.</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ perspective: 1200 }} data-testid="time-slider">
      {/* Top: current date headline */}
      <motion.div
        key={current?.id || idx}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-3 px-1"
      >
        <div>
          <div className="text-[10px] uppercase tracking-wider font-nunito font-bold text-cyan-200/60">Viewing</div>
          <div className="text-base font-fredoka font-bold" style={{ color: current?.color || '#7FE3FF', textShadow: `0 0 12px ${current?.color || '#7FE3FF'}77` }}>
            {formatFull(currentDate)}
          </div>
        </div>
        <div className="text-[10px] font-nunito font-bold px-2 py-1 rounded-full"
          style={{ background: 'rgba(127,227,255,0.12)', border: '1px solid rgba(127,227,255,0.35)', color: '#7FE3FF' }}
          data-testid="time-slider-counter">
          {idx + 1} / {safe.length}
        </div>
      </motion.div>

      {/* 3D-tilted track */}
      <div
        className="relative h-20"
        style={{ transform: 'rotateX(18deg)', transformStyle: 'preserve-3d' }}
      >
        {/* Track line */}
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full"
          style={{
            background: 'linear-gradient(90deg, rgba(127,227,255,0.18) 0%, rgba(167,139,250,0.32) 50%, rgba(255,79,191,0.18) 100%)',
            boxShadow: '0 0 14px rgba(127,227,255,0.2)',
          }}
        />
        {/* Progress overlay */}
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full"
          style={{
            background: `linear-gradient(90deg, #22F0C7, ${current?.color || '#FF4FBF'})`,
            boxShadow: `0 0 12px ${current?.color || '#FF4FBF'}aa`,
          }}
        />

        {/* Dots */}
        {safe.map((it, i) => {
          const p = safe.length > 1 ? (i / (safe.length - 1)) * 100 : 50;
          const active = i === idx;
          const c = it.color || '#7FE3FF';
          return (
            <motion.button
              type="button"
              data-testid={`time-dot-${i}`}
              key={it.id || i}
              onClick={() => onChange?.(i)}
              whileHover={{ scale: 1.4 }}
              whileTap={{ scale: 0.85 }}
              animate={{
                scale: active ? 1.5 : 1,
                boxShadow: active
                  ? `0 0 18px ${c}, 0 0 36px ${c}aa, inset 0 0 6px rgba(255,255,255,0.6)`
                  : `0 0 6px ${c}88`,
              }}
              className="absolute top-1/2 rounded-full border-2"
              style={{
                left: `${p}%`,
                transform: 'translate(-50%, -50%)',
                width: 14, height: 14,
                background: c,
                borderColor: active ? '#FFFFFF' : `${c}66`,
                zIndex: active ? 20 : 10,
                cursor: 'pointer',
              }}
              aria-label={`Open check-in ${i + 1}`}
            />
          );
        })}

        {/* Slider range input on top */}
        <input
          type="range"
          min={0}
          max={Math.max(0, safe.length - 1)}
          value={idx}
          onChange={(e) => onChange?.(Number(e.target.value))}
          aria-label="History timeline"
          data-testid="time-slider-range"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: 30 }}
        />
      </div>

      {/* Date axis labels (sparse — first / mid / last) */}
      <div className="flex justify-between mt-1 px-1">
        <span className="text-[9px] font-nunito text-cyan-200/55">{formatLabel(dates[0])}</span>
        {safe.length > 4 && (
          <span className="text-[9px] font-nunito text-cyan-200/55">{formatLabel(dates[Math.floor(safe.length / 2)])}</span>
        )}
        <span className="text-[9px] font-nunito text-cyan-200/55">{formatLabel(dates[safe.length - 1])}</span>
      </div>

      {/* Stepper buttons */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          data-testid="time-slider-prev"
          disabled={idx === 0}
          onClick={() => onChange?.(Math.max(0, idx - 1))}
          className="px-3 py-1.5 rounded-full text-[11px] font-nunito font-bold disabled:opacity-40"
          style={{ background: 'rgba(127,227,255,0.1)', color: '#7FE3FF', border: '1px solid rgba(127,227,255,0.35)' }}
        >
          ← Previous
        </button>
        <button
          type="button"
          data-testid="time-slider-next"
          disabled={idx === safe.length - 1}
          onClick={() => onChange?.(Math.min(safe.length - 1, idx + 1))}
          className="px-3 py-1.5 rounded-full text-[11px] font-nunito font-bold disabled:opacity-40"
          style={{ background: 'rgba(127,227,255,0.1)', color: '#7FE3FF', border: '1px solid rgba(127,227,255,0.35)' }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
