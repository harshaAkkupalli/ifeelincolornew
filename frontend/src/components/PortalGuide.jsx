import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { PORTAL_GUIDES } from '../lib/portalGuides';

/**
 * PortalGuide — floating "we'll guide you" bubble + role-specific roadmap.
 *
 * Visual identity:
 *  • Bubble icon is a hand-holding gesture (Lucide `HandHelping`) — reinforces
 *    that this is a friendly guide that takes the user by the hand, not a
 *    generic FAQ help question-mark.
 *  • Modal interior is a vertical ROADMAP — features are numbered "stops"
 *    along a centre-line. Each stop has a 3D-infographic icon node, a card
 *    with title + description + deep-link CTA, and a soft gradient "trail"
 *    stroked between consecutive stops.
 *
 * Rendered through React Portal so the parent's overflow doesn't clip it.
 */
export default function PortalGuide({ role }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const guide = PORTAL_GUIDES[role];
  if (!guide) return null;

  // Hand-holding metaphor — fall back to a generic hand if the symbol isn't
  // bundled in this Lucide version.
  const HandIcon = LucideIcons.HandHelping || LucideIcons.Hand || LucideIcons.HandHeart;
  const accent = guide.accent;
  const accent2 = guide.accent2;

  const go = (link) => {
    setOpen(false);
    if (link) navigate(link);
  };

  const bubble = createPortal(
    <motion.button
      type="button"
      data-testid="portal-guide-bubble"
      aria-label="Open guide"
      onClick={() => setOpen(true)}
      whileHover={{ scale: 1.08, rotate: -6 }}
      whileTap={{ scale: 0.92 }}
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.4 }}
      className="fixed z-[60] flex items-center justify-center rounded-full select-none"
      style={{
        right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
        width: 60,
        height: 60,
        background: `radial-gradient(circle at 30% 30%, ${accent}, ${accent2})`,
        boxShadow:
          `0 18px 40px -8px ${accent}aa,
           0 8px 14px -6px ${accent2}88,
           inset 0 -6px 14px rgba(0,0,0,0.18),
           inset 0 4px 10px rgba(255,255,255,0.35)`,
        color: 'white',
      }}
    >
      <motion.span
        animate={{ rotate: [-6, 6, -6] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="flex items-center justify-center"
      >
        <HandIcon className="w-7 h-7 drop-shadow" strokeWidth={2.4} />
      </motion.span>
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{ border: `2px solid ${accent}`, opacity: 0.7 }}
        animate={{ scale: [1, 1.5, 1], opacity: [0.45, 0, 0.45] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.button>,
    document.body,
  );

  return (
    <>
      {bubble}
      {open && createPortal(
        <AnimatePresence>
          <motion.div
            key="bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-slate-900/55 backdrop-blur-md p-0 md:p-6"
            data-testid="portal-guide-overlay"
            onClick={() => setOpen(false)}
          >
            <motion.div
              key="modal"
              initial={{ y: 60, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full md:max-w-md rounded-t-3xl md:rounded-3xl max-h-[92vh] md:max-h-[88vh] overflow-y-auto relative"
              style={{
                background: 'rgba(255,255,255,0.97)',
                backdropFilter: 'blur(28px)',
                boxShadow: `0 60px 120px -24px ${accent}80`,
              }}
              data-testid="portal-guide-modal"
            >
              {/* Sticky header */}
              <div
                className="sticky top-0 z-10 px-5 pt-5 pb-4 border-b"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${accent2})`,
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.18)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.18)' }}
                    >
                      <HandIcon className="w-5 h-5" strokeWidth={2.4} />
                    </span>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold opacity-85">Your Guided Roadmap</p>
                      <h2 className="font-fredoka font-bold text-lg leading-tight" data-testid="portal-guide-title">
                        {guide.title}
                      </h2>
                    </div>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    data-testid="portal-guide-close"
                    className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
                  >
                    <LucideIcons.X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs mt-2 font-nunito opacity-95 leading-relaxed">{guide.intro}</p>
              </div>

              {/* Roadmap timeline */}
              <div className="px-4 py-5 relative" data-testid="portal-guide-roadmap">
                {/* Continuous gradient trail down the centre-left, behind the
                    icon nodes. The animated shimmer hints "this is a path". */}
                <div
                  aria-hidden
                  className="absolute top-6 bottom-12 left-[44px] w-1 rounded-full"
                  style={{
                    background: `linear-gradient(180deg, ${accent} 0%, ${accent2} 100%)`,
                    opacity: 0.22,
                  }}
                />
                <div
                  aria-hidden
                  className="absolute top-6 bottom-12 left-[44px] w-1 rounded-full overflow-hidden"
                >
                  <motion.span
                    className="absolute inset-0 block"
                    style={{
                      background: `linear-gradient(180deg, transparent, ${accent}, transparent)`,
                    }}
                    animate={{ y: ['-100%', '100%'] }}
                    transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>

                {guide.sections.map((s, i) => {
                  const FIcon = LucideIcons[s.icon] || LucideIcons.Sparkles;
                  const [g1, g2] = s.gradient;
                  const isLast = i === guide.sections.length - 1;
                  return (
                    <motion.div
                      key={`${s.title}-${i}`}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.06 * i, type: 'spring', stiffness: 220, damping: 22 }}
                      className={`relative flex items-start gap-3 ${isLast ? '' : 'pb-5'}`}
                      data-testid={`portal-guide-tile-${i}`}
                    >
                      {/* Roadmap node — numbered 3D gradient cube */}
                      <div className="relative shrink-0" style={{ zIndex: 2 }}>
                        <motion.div
                          whileHover={{ rotate: -6, scale: 1.06 }}
                          className="w-[68px] h-[68px] rounded-2xl flex items-center justify-center text-white relative"
                          style={{
                            background: `linear-gradient(135deg, ${g1}, ${g2})`,
                            boxShadow:
                              `0 14px 22px -10px ${g1}cc,
                               inset 0 -6px 14px rgba(0,0,0,0.22),
                               inset 0 4px 10px rgba(255,255,255,0.35)`,
                          }}
                        >
                          <FIcon className="w-8 h-8 drop-shadow" strokeWidth={2.2} />
                          <span
                            aria-hidden
                            className="absolute inset-1 rounded-xl opacity-25"
                            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.5), transparent 40%)' }}
                          />
                          {/* Step-number badge */}
                          <span
                            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center bg-white"
                            style={{
                              color: g1,
                              boxShadow: `0 4px 10px -2px ${g1}88`,
                              border: `1.5px solid ${g1}`,
                            }}
                          >
                            {i + 1}
                          </span>
                        </motion.div>
                      </div>

                      {/* Roadmap card with a small notch pointing to the node */}
                      <div
                        className="flex-1 min-w-0 rounded-2xl p-3 bg-white relative"
                        style={{
                          boxShadow: `0 16px 32px -22px ${g1}aa, 0 3px 6px rgba(15,23,42,0.05)`,
                          border: `1px solid ${g1}25`,
                        }}
                      >
                        <span
                          aria-hidden
                          className="absolute top-6 -left-1.5 w-3 h-3 rotate-45 bg-white"
                          style={{ borderLeft: `1px solid ${g1}25`, borderBottom: `1px solid ${g1}25` }}
                        />
                        <p className="font-fredoka font-semibold text-sm flex items-center gap-2 flex-wrap" style={{ color: '#1F1547' }}>
                          <span
                            className="text-[10px] font-nunito font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                            style={{ background: `${g1}1A`, color: g1 }}
                          >
                            Step {i + 1}
                          </span>
                          {s.title}
                        </p>
                        <p className="text-[11.5px] font-nunito mt-1 leading-snug" style={{ color: '#56506B' }}>
                          {s.description}
                        </p>
                        {s.cta && s.link && (
                          <button
                            type="button"
                            onClick={() => go(s.link)}
                            data-testid={`portal-guide-cta-${i}`}
                            className="mt-2 text-[10.5px] font-nunito font-bold inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-white"
                            style={{
                              background: `linear-gradient(135deg, ${g1}, ${g2})`,
                              boxShadow: `0 8px 16px -6px ${g1}aa`,
                            }}
                          >
                            {s.cta} <LucideIcons.ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {/* Roadmap finish flag */}
                <div className="flex items-center gap-2 mt-2 ml-[26px]" data-testid="portal-guide-finish">
                  <span
                    className="w-10 h-10 rounded-2xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${accent}, ${accent2})`,
                      boxShadow: `0 10px 20px -8px ${accent}aa, inset 0 -4px 10px rgba(0,0,0,0.18), inset 0 3px 8px rgba(255,255,255,0.35)`,
                    }}
                  >
                    <LucideIcons.Flag className="w-5 h-5 text-white" />
                  </span>
                  <span className="text-[11px] font-nunito font-bold uppercase tracking-widest" style={{ color: accent }}>
                    You're all set
                  </span>
                </div>
                <p className="text-[10px] text-center text-slate-400 font-nunito pt-2">
                  Tap any step to jump straight into that feature.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
