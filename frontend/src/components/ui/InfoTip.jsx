import React from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui/tooltip';

/**
 * InfoTip — a tiny accessible "i" badge that reveals a brief feature description on hover/focus.
 *
 * Usage:
 *   <InfoTip text="Tap to start your daily 9-step body check-in." />
 *   <InfoTip text="..." variant="corner" tone="dark" />
 *   <InfoTip text="..." variant="inline" />
 *   <InfoTip text="..." asChild>{customTrigger}</InfoTip>
 *
 * Variants:
 *   - inline (default): renders inline next to text labels
 *   - corner: absolute-positioned, intended for the top-right of a tile/card (parent must be relative)
 *
 * Tones:
 *   - light (default): subtle dark-on-light pill — works on white/glass surfaces
 *   - dark: bright-on-dark pill — for dark backgrounds (clinician shell, admin sidebar)
 *   - accent: filled with the parent accent — pass `color` to override
 */
export default function InfoTip({
  text,
  variant = 'inline',
  tone = 'light',
  color,
  side = 'top',
  size = 14,
  className = '',
  testid,
  children,
  asChild = false,
}) {
  if (!text) return null;

  const baseStyle = {
    width: size + 8,
    height: size + 8,
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'help',
    transition: 'transform 180ms ease, background 180ms ease, box-shadow 180ms ease',
    flexShrink: 0,
  };

  let toneStyle = {};
  if (color) {
    toneStyle = {
      background: `${color}22`,
      color,
      border: `1px solid ${color}55`,
    };
  } else if (tone === 'dark') {
    toneStyle = {
      background: 'rgba(255,255,255,0.10)',
      color: 'rgba(255,255,255,0.85)',
      border: '1px solid rgba(255,255,255,0.22)',
    };
  } else {
    toneStyle = {
      background: 'rgba(80, 30, 120, 0.08)',
      color: '#6b3aa3',
      border: '1px solid rgba(80, 30, 120, 0.16)',
    };
  }

  const cornerStyle = variant === 'corner' ? {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 5,
  } : {};

  const tip = (
    <TooltipContent
      side={side}
      sideOffset={6}
      className="max-w-[260px] bg-slate-900 text-white text-[11px] leading-snug font-nunito font-medium px-3 py-2 rounded-xl shadow-2xl border border-white/10"
      data-testid={testid ? `${testid}-content` : undefined}
    >
      {text}
    </TooltipContent>
  );

  if (asChild && children) {
    return (
      <Tooltip delayDuration={120}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        {tip}
      </Tooltip>
    );
  }

  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Feature info"
          data-testid={testid || 'info-tip'}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          className={`info-tip-trigger hover:scale-110 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-purple-400 ${className}`}
          style={{ ...baseStyle, ...toneStyle, ...cornerStyle }}
        >
          <Info style={{ width: size, height: size }} strokeWidth={2.5} />
        </button>
      </TooltipTrigger>
      {tip}
    </Tooltip>
  );
}
