import React from 'react';
import { motion } from 'framer-motion';

/**
 * <AppStoreCTAs />
 * ----------------
 * Pair of 3D-animated download badges (App Store + Google Play) that route
 * to the live IFEELINCOLOR mobile-app listings. Used on every public-facing
 * home/landing surface (MobileHome, OrganizationLogin, AdminLogin, etc.).
 *
 * Props
 *   align        : 'center' (default) | 'start' | 'end'
 *   theme        : 'light' (default) — works on light backgrounds
 *                  'dark'  — inverts surfaces for dark backgrounds
 *   compact      : true → smaller variant (used inside dense glass cards)
 *   showHeading  : true (default) — render the "Get the mobile app" caption
 */
const PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.ifeelin_color.ifeelin_color';
const APPSTORE_URL =
  'https://apps.apple.com/ca/app/ifeelincolor/id6742043093';

export default function AppStoreCTAs({
  align = 'center',
  theme = 'light',
  compact = false,
  showHeading = true,
}) {
  const isDark = theme === 'dark';
  const justify =
    align === 'start' ? 'justify-start' : align === 'end' ? 'justify-end' : 'justify-center';

  return (
    <div
      className={`w-full flex flex-col items-${align === 'end' ? 'end' : align === 'start' ? 'start' : 'center'} gap-2`}
      data-testid="app-store-ctas"
    >
      {showHeading && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-[10px] font-nunito font-bold uppercase tracking-[0.22em]"
          style={{ color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.55)' }}
        >
          Get the mobile app
        </motion.p>
      )}
      <div className={`flex flex-wrap items-center gap-3 ${justify}`}>
        <StoreBadge
          href={APPSTORE_URL}
          testid="cta-app-store"
          label="Download on the"
          store="App Store"
          isDark={isDark}
          compact={compact}
          Icon={AppleGlyph}
        />
        <StoreBadge
          href={PLAY_URL}
          testid="cta-google-play"
          label="Get it on"
          store="Google Play"
          isDark={isDark}
          compact={compact}
          Icon={PlayGlyph}
        />
      </div>
    </div>
  );
}

function StoreBadge({ href, testid, label, store, isDark, compact, Icon }) {
  const surface = isDark
    ? 'linear-gradient(180deg, #1F2937 0%, #0F172A 100%)'
    : 'linear-gradient(180deg, #111827 0%, #000000 100%)';
  const w = compact ? 150 : 180;
  const h = compact ? 48 : 58;

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testid}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, rotateX: 6, rotateY: -6, scale: 1.04 }}
      whileTap={{ scale: 0.96, rotateX: 0, rotateY: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      style={{
        width: w,
        height: h,
        background: surface,
        borderRadius: 12,
        // 3D depth: outer ambient shadow + inner light + bottom edge for lift
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.12) inset, 0 -2px 0 rgba(0,0,0,0.5) inset, 0 10px 20px -8px rgba(0,0,0,0.45), 0 18px 30px -16px rgba(0,0,0,0.55)',
        transformStyle: 'preserve-3d',
        perspective: 800,
        textDecoration: 'none',
        color: '#FFFFFF',
      }}
      className="relative inline-flex items-center gap-2.5 px-3 select-none overflow-hidden"
    >
      {/* Subtle moving highlight strip (3D sheen) */}
      <motion.span
        aria-hidden
        className="absolute inset-y-0 -left-12 w-12 pointer-events-none"
        style={{
          background:
            'linear-gradient(120deg, transparent, rgba(255,255,255,0.18), transparent)',
          mixBlendMode: 'screen',
        }}
        animate={{ x: [0, w + 60] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.2 }}
      />

      {/* Glyph with floating animation */}
      <motion.span
        animate={{ y: [0, -1.5, 0], rotate: [0, 2, 0, -2, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="relative z-10"
      >
        <Icon size={compact ? 22 : 26} />
      </motion.span>

      <span className="relative z-10 flex flex-col leading-tight">
        <span
          className="font-nunito font-medium"
          style={{ fontSize: compact ? 9 : 10, opacity: 0.85, letterSpacing: 0.3 }}
        >
          {label}
        </span>
        <span
          className="font-fredoka font-semibold"
          style={{ fontSize: compact ? 14 : 16, letterSpacing: -0.2 }}
        >
          {store}
        </span>
      </span>
    </motion.a>
  );
}

// Inline branded glyphs — keeps the component zero-dependency.
function AppleGlyph({ size = 26 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.45 2.22-1.18 3.02-.78.87-2.04 1.55-3.05 1.46-.13-1.1.41-2.27 1.13-3.03.79-.86 2.16-1.5 3.1-1.45zM20.5 17.4c-.55 1.27-.82 1.83-1.53 2.96-.99 1.57-2.39 3.52-4.12 3.54-1.54.01-1.94-1.01-4.02-1-2.08.01-2.52 1.02-4.06 1-1.74-.02-3.06-1.78-4.05-3.35-2.77-4.4-3.06-9.56-1.35-12.3 1.22-1.96 3.14-3.11 4.95-3.11 1.84 0 3 .99 4.51 1 1.47.01 2.36-.99 4.48-.99 1.62 0 3.34.88 4.57 2.41-4.02 2.2-3.36 7.94.62 9.84z"/>
    </svg>
  );
}

function PlayGlyph({ size = 26 }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden>
      <linearGradient id="ifc-play-a" x1="-101" y1="445" x2="183" y2="161" gradientTransform="matrix(1 0 0 -1 0 514)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#00C3FF"/><stop offset=".26" stopColor="#00B0E5"/><stop offset="1" stopColor="#0078D7"/>
      </linearGradient>
      <path fill="url(#ifc-play-a)" d="M64 470V42c0-15 9-23 19-23 5 0 11 2 17 6l276 159-91 91L64 470z"/>
      <linearGradient id="ifc-play-b" x1="386" y1="256" x2="121" y2="256" gradientTransform="matrix(1 0 0 -1 0 514)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#FFCE00"/><stop offset="1" stopColor="#FFEA00"/>
      </linearGradient>
      <path fill="url(#ifc-play-b)" d="M376 184l59 34c19 11 19 28 0 39l-59 34-91-91 91-16z"/>
      <linearGradient id="ifc-play-c" x1="270" y1="271" x2="-23" y2="566" gradientTransform="matrix(1 0 0 -1 0 514)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#FF3A44"/><stop offset="1" stopColor="#C31162"/>
      </linearGradient>
      <path fill="url(#ifc-play-c)" d="M64 470l285-285 27 27-264 264c-19 11-37 13-48-6z"/>
      <linearGradient id="ifc-play-d" x1="113" y1="159" x2="234" y2="38" gradientTransform="matrix(1 0 0 -1 0 514)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#32A071"/><stop offset=".07" stopColor="#2DA771"/><stop offset=".48" stopColor="#15CF74"/><stop offset=".8" stopColor="#06E775"/><stop offset="1" stopColor="#00F076"/>
      </linearGradient>
      <path fill="url(#ifc-play-d)" d="M349 185L64 42c-11-19 7-21 22-13l292 161-29-5z"/>
    </svg>
  );
}
