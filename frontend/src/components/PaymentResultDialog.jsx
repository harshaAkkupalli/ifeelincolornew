/**
 * PaymentResultDialog — role-aware outcome modal for Razorpay flows.
 *
 * Renders ABOVE any residual Razorpay overlay (z-index = max int) and
 * actively purges leftover `.razorpay-container` / iframes / `body.overflow`
 * so the screen is never left blurred when the user comes back.
 *
 * Per the 2026-06-04 user directive, the dialog speaks in a DIFFERENT
 * voice depending on who is reading it:
 *
 *   role="patient"      ── soft, warm, hopeful. Hand-painted 3D-style
 *                         emoji glyphs (💜 🌸 ✨ 🧡 💔 🌧️). First-person
 *                         "we" / "you" copy; encouraging next-step CTA.
 *   role="clinician"    ── calm, steady, professional. Clinical-friendly
 *                         glyphs (🩺 ✅ 🌿 ⚠️ 🛡️). Direct copy that
 *                         respects the clinician's workflow.
 *   role="organization" ── crisp, business-tone. Glyphs (🏢 📈 ✅ ⚠️).
 *
 * The dialog can also be used for non-payment notifications by passing
 * { title, message } directly — the role-tone only kicks in when title /
 * message are omitted and a `presetKey` is provided.
 *
 * Presets (filled in via role + kind):
 *   - configMissing   ── Razorpay not enabled yet
 *   - success         ── payment received
 *   - dismissed       ── user closed Razorpay before paying
 *   - failure         ── payment failed / network issue
 */
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X as XIcon, ArrowRight } from 'lucide-react';

// Role + kind → copy + visuals.
// We keep the glyphs as Twemoji-style hand-drawn unicode (😢🌸 etc.) and
// render them at large size with a soft circular gradient halo so they
// look 3-D / sticker-like.
const TONES = {
  patient: {
    success: {
      emoji: '🎉',
      halo: '#22D67E',
      titleDefault: "Yay! You're all set, sunshine ✨",
      messageDefault:
        "Your plan is unlocked and your colours are waiting. Let's gently begin — we're so glad you're here.",
      primaryDefault: 'Begin my journey',
    },
    failure: {
      emoji: '💔',
      halo: '#F87171',
      titleDefault: "Oh no — the payment didn't go through 🧡",
      messageDefault:
        "Don't worry, no money was deducted. Take a breath, and whenever you're ready we can try again together.",
      primaryDefault: 'Try once more',
    },
    dismissed: {
      emoji: '🌸',
      halo: '#A78BFA',
      titleDefault: 'No rush — the door is still open 💜',
      messageDefault:
        "You closed the payment window, and that's perfectly okay. Your plan hasn't changed. Come back whenever it feels right.",
      primaryDefault: "I'm ready, let's try again",
    },
    configMissing: {
      emoji: '🌷',
      halo: '#FDBA74',
      titleDefault: 'Payments aren’t ready yet 🌷',
      messageDefault:
        "We're still tucking the payment system into place. Please check back in a moment — or let our team know and we’ll help right away.",
      primaryDefault: null,
    },
    info: {
      emoji: '✨',
      halo: '#A78BFA',
      titleDefault: 'A small heads-up ✨',
      messageDefault: 'Take your time — we’re right here.',
      primaryDefault: null,
    },
  },
  clinician: {
    success: {
      emoji: '✅',
      halo: '#06A86C',
      titleDefault: 'Plan activated — you’re good to go 🩺',
      messageDefault:
        'Your membership is live. The full clinician toolkit — patient roster, AI coach, and analytics — is now unlocked.',
      primaryDefault: 'Open dashboard',
    },
    failure: {
      emoji: '⚠️',
      halo: '#DC2626',
      titleDefault: 'Payment did not complete',
      messageDefault:
        'No funds have been captured. This is usually a transient gateway issue. Please retry once, or use a different card.',
      primaryDefault: 'Retry payment',
    },
    dismissed: {
      emoji: '🛡️',
      halo: '#7C5BFF',
      titleDefault: 'Checkout closed — no charge made',
      messageDefault:
        'You exited the payment window before completing. Your membership status is unchanged. Resume whenever you’re ready.',
      primaryDefault: 'Resume payment',
    },
    configMissing: {
      emoji: '⚙️',
      halo: '#94A3B8',
      titleDefault: 'Payments are not configured',
      messageDefault:
        'The Razorpay gateway hasn’t been enabled by the platform admin yet. Once it is, this membership will activate normally.',
      primaryDefault: null,
    },
    info: {
      emoji: '🌿',
      halo: '#2FA37A',
      titleDefault: 'Heads up',
      messageDefault: 'Please review the message above before continuing.',
      primaryDefault: null,
    },
  },
  organization: {
    success: {
      emoji: '🏢',
      halo: '#16A34A',
      titleDefault: 'Subscription activated for your organization',
      messageDefault:
        'Your organization now has full access. Invite clinicians and patients from the Organization dashboard.',
      primaryDefault: 'Open dashboard',
    },
    failure: {
      emoji: '⚠️',
      halo: '#DC2626',
      titleDefault: 'Payment was not completed',
      messageDefault:
        'No funds have been captured. Please retry, or contact the IFEELINCOLOR billing team if the issue persists.',
      primaryDefault: 'Retry payment',
    },
    dismissed: {
      emoji: '🗂️',
      halo: '#7C5BFF',
      titleDefault: 'Checkout closed',
      messageDefault:
        'You closed the payment window before completing the transaction. Your organization subscription is unchanged.',
      primaryDefault: 'Resume payment',
    },
    configMissing: {
      emoji: '⚙️',
      halo: '#94A3B8',
      titleDefault: 'Payments are not configured',
      messageDefault:
        'Razorpay is not enabled yet. Ask your Super Admin to add the keys at Admin → Payment Setup.',
      primaryDefault: null,
    },
    info: {
      emoji: '📋',
      halo: '#2563EB',
      titleDefault: 'Heads up',
      messageDefault: 'Please review the message above before continuing.',
      primaryDefault: null,
    },
  },
};

// `kind` is the visual variant ("success" | "error" | "info") — derived from
// `presetKey` when not provided so callers can pass either one.
function deriveKind(presetKey, kind) {
  if (kind) return kind;
  if (presetKey === 'success') return 'success';
  if (presetKey === 'failure' || presetKey === 'configMissing') return 'error';
  return 'info';
}

/** Best-effort cleanup of any Razorpay nodes left in the DOM. */
function purgeRazorpayDom() {
  try {
    document.querySelectorAll(
      '.razorpay-container, .razorpay-backdrop, .razorpay-checkout-frame, #razorpay-checkout-frame, iframe[src*="razorpay"]'
    ).forEach((n) => n.remove());
    if (document.body && document.body.style.overflow === 'hidden') {
      document.body.style.overflow = '';
    }
  } catch { /* ignore */ }
}

export default function PaymentResultDialog({
  open,
  role = 'patient',          // "patient" | "clinician" | "organization"
  presetKey,                 // "success" | "failure" | "dismissed" | "configMissing" | "info"
  kind,                      // visual ring colour override (success | error | info)
  title,                     // overrides presetKey title
  message,                   // overrides presetKey message
  onClose,
  onPrimary,
  primaryLabel,
}) {
  const tone = (TONES[role] || TONES.patient)[presetKey || 'info'] || TONES.patient.info;
  const visualKind = deriveKind(presetKey, kind);

  // Stable colour mapping for the icon halo (always coloured per tone preset,
  // but we ensure success is greenish and failure is reddish even if a custom
  // tone preset overrides it).
  const haloColor = visualKind === 'success'
    ? (tone.halo || '#06A86C')
    : visualKind === 'error'
      ? (tone.halo || '#DC2626')
      : (tone.halo || '#7C5BFF');

  // Purge any leftover Razorpay overlay nodes whenever this dialog opens.
  useEffect(() => {
    if (open) {
      purgeRazorpayDom();
      const t1 = setTimeout(purgeRazorpayDom, 250);
      const t2 = setTimeout(purgeRazorpayDom, 700);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    return undefined;
  }, [open]);

  const displayTitle = title || tone.titleDefault;
  const displayMessage = message || tone.messageDefault;
  const displayPrimary = primaryLabel || tone.primaryDefault;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="payment-result-overlay"
          data-role={role}
          data-preset={presetKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 2147483647,
            background: 'rgba(15,16,40,0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.86, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 12 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-6 relative"
            style={{
              boxShadow: '0 30px 80px -10px rgba(15,16,40,0.4), 0 0 0 1px rgba(0,0,0,0.04)',
            }}
            data-testid={`payment-result-${visualKind}`}
          >
            <button
              aria-label="Close"
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100"
            >
              <XIcon className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              {/* 3-D-feeling emoji puck — radial halo + drop shadow */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: [0, -6, 6, 0] }}
                transition={{
                  scale: { delay: 0.06, type: 'spring', stiffness: 260, damping: 18 },
                  rotate: { delay: 0.3, duration: 0.6, ease: 'easeOut' },
                }}
                className="w-20 h-20 rounded-full flex items-center justify-center mb-3 relative"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${haloColor}33 0%, ${haloColor}11 55%, transparent 75%)`,
                }}
              >
                <span
                  className="text-[44px] leading-none select-none"
                  style={{
                    filter: `drop-shadow(0 8px 12px ${haloColor}55) drop-shadow(0 2px 0 rgba(0,0,0,0.06))`,
                  }}
                  aria-hidden
                >
                  {tone.emoji || '✨'}
                </span>
                {visualKind === 'success' && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-full"
                    style={{ boxShadow: `0 0 0 4px ${haloColor}33` }}
                    animate={{ scale: [1, 1.18, 1], opacity: [0.8, 0.2, 0.8] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </motion.div>

              <h2
                className="font-fredoka font-bold text-xl text-slate-900"
                style={{ letterSpacing: role === 'clinician' ? '-0.01em' : '0' }}
              >
                {displayTitle}
              </h2>
              {displayMessage && (
                <p className="mt-2 text-sm font-nunito text-slate-600 leading-relaxed">
                  {displayMessage}
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {(onPrimary && displayPrimary) && (
                <button
                  data-testid="payment-result-primary"
                  onClick={onPrimary}
                  className="w-full rounded-2xl py-3 text-sm font-nunito font-bold text-white flex items-center justify-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${haloColor}, ${haloColor}cc)`,
                    boxShadow: `0 14px 30px -10px ${haloColor}99`,
                  }}
                >
                  {displayPrimary} <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                data-testid="payment-result-close"
                onClick={onClose}
                className="w-full rounded-2xl py-2.5 text-sm font-nunito font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
