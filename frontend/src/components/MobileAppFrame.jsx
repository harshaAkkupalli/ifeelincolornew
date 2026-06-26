import React from 'react';

/**
 * MobileAppFrame
 * --------------
 * Adaptive shell — phone-width column on small screens, full responsive
 * "website view" on desktop (≥ 768 px).
 *
 *  • <768 px  → no chrome, edge-to-edge mobile experience
 *  • ≥768 px  → expands to a wider container (max-w 1100 px) with the same
 *               soft white card so the Patient / Clinician portals feel
 *               like a desktop web app, not a phone in the middle of the
 *               screen. (Per 2026-06-04 user directive.)
 *
 * `accent` controls the subtle background tint behind the column.
 */
export default function MobileAppFrame({ children, accent = '#7C5BFF', backdropStyle }) {
  return (
    <div
      data-testid="mobile-app-frame"
      className="min-h-screen w-full"
      style={{
        background: backdropStyle || `linear-gradient(135deg, ${accent}1A 0%, #ffffff 40%, ${accent}10 100%)`,
      }}
    >
      <div
        className="
          mx-auto w-full min-h-screen relative
          md:max-w-[1100px]
          md:shadow-[0_30px_80px_-20px_rgba(31,17,71,0.18)]
          md:ring-1 md:ring-black/5
          md:rounded-3xl md:my-6
          bg-white/0
        "
      >
        {children}
      </div>
    </div>
  );
}
