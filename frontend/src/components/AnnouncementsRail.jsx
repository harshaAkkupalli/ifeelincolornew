import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone } from 'lucide-react';

/**
 * AnnouncementsRail — transform-based, auto-scrolling announcement carousel.
 *
 * Behaviour:
 *  • One card visible at a time — no scroll fiddling, the active card is
 *    cross-faded/slid in via Framer Motion. This is rock-solid across iOS /
 *    Android WebViews where browser smooth-scroll quirks bit us before.
 *  • Auto-advances every `intervalMs` ms. Pauses on hover (desktop) and
 *    1.5 s after a touch ends (mobile). Resumes automatically.
 *  • Pagination dots below the rail jump to a specific card.
 *  • Renders the admin-uploaded image, title, and content (admin-saved
 *    body) inside a brand-themed gradient card.
 */
export default function AnnouncementsRail({
  announcements = [],
  intervalMs = 4500,
  color = '#A78BFA',
  accent = '#FF6FB8',
  testid = 'announcements-rail',
  onCardClick,
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Reset to 0 if announcement list shortens unexpectedly.
  useEffect(() => {
    if (active >= announcements.length) setActive(0);
  }, [announcements.length, active]);

  useEffect(() => {
    if (paused || announcements.length < 2) return undefined;
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % announcements.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [paused, announcements.length, intervalMs]);

  if (announcements.length === 0) {
    return (
      <div
        className="rounded-2xl p-4 text-center text-xs font-nunito"
        style={{ background: 'rgba(255,255,255,0.7)', color: '#9785B5', border: '1px dashed rgba(255,61,138,0.2)' }}
        data-testid={`${testid}-empty`}
      >
        <Megaphone className="w-4 h-4 mx-auto mb-1" style={{ color: accent }} />
        No announcements yet. We'll let you know.
      </div>
    );
  }

  const a = announcements[active] || {};
  const body = a.content || a.message || a.body || '';
  const img = a.image_data || a.image_url || a.image;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setTimeout(() => setPaused(false), 1500)}
      data-testid={testid}
    >
      <div className="relative overflow-hidden rounded-2xl" style={{ minHeight: 200 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={a.announcement_id || active}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            data-testid={`${testid}-card-${a.announcement_id || active}`}
            onClick={() => { if (a.link_target && onCardClick) onCardClick(a); }}
            className={`w-full rounded-2xl overflow-hidden flex flex-col ${a.link_target && onCardClick ? 'cursor-pointer hover:scale-[1.01] transition-transform' : ''}`}
            style={{
              background: `linear-gradient(135deg, ${color}, ${accent})`,
              boxShadow: `0 14px 30px -10px ${color}66`,
            }}
          >
            {img && (
              <div className="w-full h-32 overflow-hidden bg-white/10">
                <img
                  src={img}
                  alt={a.title || 'Announcement'}
                  className="w-full h-full object-cover"
                  data-testid={`${testid}-img-${a.announcement_id || active}`}
                />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Megaphone className="w-4 h-4 text-white/80" />
                {announcements.length > 1 && (
                  <span className="text-[10px] font-nunito font-bold text-white/70">
                    {active + 1} / {announcements.length}
                  </span>
                )}
              </div>
              <p className="font-fredoka font-semibold text-base text-white mb-1">{a.title}</p>
              <p className="text-xs font-nunito text-white/90 line-clamp-5 whitespace-pre-wrap">{body}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      {/* Pagination dots */}
      {announcements.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5" data-testid={`${testid}-dots`}>
          {announcements.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Announcement ${i + 1}`}
              data-testid={`${testid}-dot-${i}`}
              onClick={() => setActive(i)}
              className="transition-all rounded-full"
              style={{
                width: i === active ? 18 : 6,
                height: 6,
                background: i === active ? color : `${color}55`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
