import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MapPin } from 'lucide-react';
import { useCheckinContent } from './CheckinContentContext';
import { useNeuroInclusive } from '../../contexts/NeuroInclusiveContext';
import { BodyIcon } from './Pictograms';
import TTSButton from '../../lib/tts';

/**
 * SomaticMap — calm, mobile-first body picker.
 *
 * Fits entirely inside the parent flex container WITHOUT scrolling: the body
 * silhouette is sized by HEIGHT (not width) so it always fits inside the
 * available vertical space, and the auxiliary chip grid was removed in favour
 * of small named labels next to each glowing dot. Zone names alternate
 * left/right per a `LABEL_SIDE` map so vertically clustered dots (head, eyes,
 * jaw, throat) never overlap their labels.
 *
 * Props:
 *   - onSelect(ids[])  : called with the new list of selected zone ids.
 *   - selected         : current selected ids (array | string | null).
 */

// Calm but vivid palette — enough contrast to remain visible against
// the indigo backdrop.
const ZONE_COLORS = [
  '#FF6FB5', '#FFB74D', '#5EEAD4', '#A78BFA', '#60A5FA', '#F472B6',
  '#FACC15', '#34D399', '#FB923C', '#C084FC', '#7DD3FC', '#FCA5A5',
];

// Side the floating label sits relative to the dot. Tightly-stacked vertical
// zones alternate left/right so labels never overlap. Edge zones (whole-body,
// arms, skin) push labels INWARD so nothing clips off-screen.
const LABEL_SIDE = {
  head: 'right',
  eyes_face: 'left',
  jaw_mouth: 'right',
  throat: 'left',
  shoulders_neck: 'left',
  chest: 'right',
  back: 'left',
  stomach: 'right',
  whole_body_energy: 'left',  // mid-body — opposite side from Skin
  skin_whole_body: 'left',    // x=75 (right side / arm area) → push label inward
  arms_hands: 'right',        // x=22 → push label inward
  legs_feet: 'right',
};

// Dot diameter — slightly smaller so the labels next to them have room to breathe.
// NOTE: Patients see dots at the EXACT coordinates saved by the admin in
// /admin/checkin-config (Drag-to-Position editor). No client-side nudging is
// applied so admins have full WYSIWYG control.
const DOT_SIZE = 18;

/** Photo-realistic 3D somatic body (user-provided reference, Feb 2026).
 *
 * The body is rendered from `/assets/somatic-body.png` — a low-poly
 * wireframe holographic human in front-facing anatomical stance, cropped
 * tightly so its bbox matches the existing 200×460 ViewBox aspect (0.433).
 * Because the crop is bbox-aligned, the existing zone-dot percentages
 * (head 5%, eyes 11%, chest 28%, stomach 44%, legs 82%, etc.) land on
 * the correct anatomy without any recalibration.
 *
 * The image is decorative (`pointer-events:none`) — taps go through to
 * the dots overlaid on top. We add an ambient outer glow ellipse and a
 * subtle vertical scan-line for a "live hologram" feel that matches the
 * reference aesthetic.
 */
function BodySilhouette() {
  return (
    <div
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Transparent body PNG fills the container exactly (container shares
          the PNG's 218:503 aspect ratio). Admin-saved dot coordinates land
          right on the rendered anatomy. */}
      <img
        src="/assets/somatic-body-hd.png"
        alt=""
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          imageRendering: '-webkit-optimize-contrast',
          filter: 'drop-shadow(0 0 20px rgba(168,139,250,0.45)) drop-shadow(0 0 40px rgba(125,211,252,0.30))',
        }}
      />
    </div>
  );
}

/** A glowing tappable dot with its zone name floating next to it. */
function ZoneDot({ zone, color, isSel, onToggle }) {
  const side = LABEL_SIDE[zone.id] || (zone.x < 50 ? 'left' : 'right');
  // Label is rendered inside the same button so the entire row is tappable.
  return (
    <button
      type="button"
      onClick={onToggle}
      data-testid={`zone-dot-${zone.id}`}
      aria-label={zone.label}
      aria-pressed={isSel}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center focus:outline-none"
      style={{
        // Wrap a 0-height anchor so the dot + label center on (left, top).
        height: DOT_SIZE,
        // The button itself is the dot; the label is an absolute sibling.
        zIndex: isSel ? 30 : 20,
        touchAction: 'manipulation',
      }}
    >
      {/* The dot circle */}
      <span
        className="rounded-full inline-flex items-center justify-center"
        style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          background: isSel
            ? `radial-gradient(circle at 30% 30%, #FFFFFF, ${color} 65%)`
            : 'rgba(255,255,255,0.95)',
          border: `2px solid ${isSel ? color : color}`,
          boxShadow: isSel
            ? `0 0 0 4px ${color}33, 0 0 16px ${color}cc, 0 2px 8px rgba(0,0,0,0.35)`
            : `0 0 0 3px ${color}33, 0 2px 8px rgba(0,0,0,0.35)`,
          transition: 'background 180ms ease, box-shadow 180ms ease',
        }}
      >
        {!isSel && (
          <motion.span
            aria-hidden
            className="absolute rounded-full"
            style={{ width: DOT_SIZE, height: DOT_SIZE, border: `2px solid ${color}`, pointerEvents: 'none' }}
            animate={{ scale: [1, 1.7, 1], opacity: [0.55, 0, 0.55] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </span>

      {/* Floating zone-name pill (left or right of the dot). */}
      <span
        className="font-nunito font-bold whitespace-nowrap px-1.5 py-0.5 rounded"
        style={{
          position: 'absolute',
          [side === 'left' ? 'right' : 'left']: DOT_SIZE + 4,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 10,
          lineHeight: 1.1,
          color: isSel ? '#FFFFFF' : '#E2F4FF',
          background: isSel ? `${color}cc` : 'rgba(11,18,51,0.78)',
          border: `1px solid ${isSel ? color : 'rgba(127,227,255,0.35)'}`,
          textShadow: '0 1px 2px rgba(0,0,0,0.55)',
          pointerEvents: 'none',
        }}
      >
        {zone.label}
      </span>
    </button>
  );
}

export default function SomaticMap({ onSelect, selected }) {
  const { bodyZones: BODY_ZONES } = useCheckinContent();
  const { isLowStimulusMode } = useNeuroInclusive();
  const selectedSet = useMemo(
    () => new Set(Array.isArray(selected) ? selected : selected ? [selected] : []),
    [selected],
  );

  const colorOf = (zoneId) => {
    const idx = BODY_ZONES.findIndex((z) => z.id === zoneId);
    return ZONE_COLORS[idx % ZONE_COLORS.length];
  };

  const toggle = (zoneId) => {
    const next = new Set(selectedSet);
    if (next.has(zoneId)) next.delete(zoneId);
    else next.add(zoneId);
    onSelect(Array.from(next));
  };

  const selCount = selectedSet.size;

  // ── Low-Stimulus mode renders a calm pictogram grid INSTEAD of the
  // anatomical silhouette + dot map. Same `onSelect(ids[])` contract so
  // downstream payload collection is unchanged.
  if (isLowStimulusMode) {
    const headerText = 'Where do you feel it in your body? Tap a pictogram. You can pick more than one.';
    return (
      <div
        className="flex flex-col w-full h-full min-h-0"
        style={{ background: '#0D0D11' }}
        data-testid="somatic-map"
      >
        <div className="px-5 pt-3 pb-2 text-center shrink-0">
          <div className="flex items-center justify-center gap-2">
            <h2 className="font-fredoka font-semibold text-sm sm:text-base" style={{ color: '#ECECF1' }}>
              Where do you feel it?
            </h2>
            <TTSButton text={headerText} testId="somatic-tts" />
          </div>
          <p className="text-[11px] font-nunito mt-1" style={{ color: '#B8B8C8' }}>
            Tap a pictogram. You can pick more than one.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
          <div
            role="group"
            aria-label="Body zones"
            className="grid grid-cols-3 gap-2.5 max-w-md mx-auto"
            data-testid="somatic-pictograms"
          >
            {BODY_ZONES.map((zone) => {
              const sel = selectedSet.has(zone.id);
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => toggle(zone.id)}
                  aria-pressed={sel}
                  data-selected={sel ? 'true' : 'false'}
                  data-testid={`pictogram-${zone.id}`}
                  className="ni-target flex flex-col items-center justify-center gap-1.5 py-3"
                  style={{ color: sel ? '#A8BFA0' : '#ECECF1' }}
                >
                  <BodyIcon token={zone.id.replace(/_(face|mouth|neck|hands|feet|body)$/, '')} size={32} />
                  <span className="text-[11px] font-fredoka leading-tight text-center px-1">
                    {zone.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 flex justify-center pb-3">
          <div
            data-testid="somatic-counter"
            className="px-3 py-1 rounded-full text-[10px] font-nunito font-bold inline-flex items-center gap-1.5"
            style={{
              background: selCount > 0 ? 'rgba(168,191,160,0.16)' : 'rgba(143,166,198,0.10)',
              border: `1px solid ${selCount > 0 ? 'rgba(168,191,160,0.45)' : 'rgba(143,166,198,0.35)'}`,
              color: selCount > 0 ? '#A8BFA0' : '#8FA6C6',
            }}
          >
            {selCount > 0 ? `${selCount} selected` : 'No selection yet'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col w-full h-full min-h-0"
      style={{
        background:
          'radial-gradient(ellipse at 50% 28%, #1A1448 0%, #0A0830 55%, #050018 100%)',
      }}
      data-testid="somatic-map"
    >
      {/* Heading — compact so the body has maximum vertical room. */}
      <div className="px-5 pt-3 pb-1 text-center shrink-0">
        <h2 className="font-fredoka font-semibold text-sm sm:text-base text-white tracking-tight">
          Where do you feel it in your body?
        </h2>
        <p className="text-[10px] font-nunito text-cyan-100/70 mt-0.5 leading-tight">
          Tap a glowing point to mark a spot. You can pick more than one.
        </p>
      </div>

      {/* Counter — compact pill. */}
      <div className="shrink-0 flex justify-center my-1">
        <div
          className="px-3 py-1 rounded-full text-[10px] font-nunito font-bold inline-flex items-center gap-1.5"
          style={{
            background: selCount > 0 ? 'rgba(126,231,180,0.16)' : 'rgba(127,227,255,0.10)',
            border: `1px solid ${selCount > 0 ? 'rgba(126,231,180,0.45)' : 'rgba(127,227,255,0.35)'}`,
            color: selCount > 0 ? '#A6F0D0' : '#7FE3FF',
          }}
          data-testid="somatic-counter"
        >
          {selCount > 0 ? (
            <><Sparkles className="w-3 h-3" /> {selCount} area{selCount > 1 ? 's' : ''} selected</>
          ) : (
            <><MapPin className="w-3 h-3" /> Tap a glowing point</>
          )}
        </div>
      </div>

      {/* Body — fills available vertical space, height-bound so it never overflows. */}
      <div className="flex-1 min-h-0 w-full flex justify-center items-center px-2">
        <div
          className="relative"
          style={{
            // Body is sized by HEIGHT (= 100% of the flex parent) so it always
            // fits within the viewport — no scroll needed regardless of phone
            // height. Width follows the natural 668:1536 aspect ratio of the
            // somatic-body-hd.png so admin-saved dot coordinates land exactly
            // on the rendered anatomy (matches DraggableBodyEditor).
            height: '100%',
            aspectRatio: '668 / 1536',
            maxHeight: '100%',
            maxWidth: '92vw',
          }}
          data-testid="somatic-body"
        >
          <BodySilhouette />
          {BODY_ZONES.map((zone) => {
            const isSel = selectedSet.has(zone.id);
            return (
              <div
                key={zone.id}
                className="absolute"
                style={{
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: 0,
                  height: 0,
                  zIndex: 20,
                }}
              >
                <ZoneDot
                  zone={zone}
                  color={colorOf(zone.id)}
                  isSel={isSel}
                  onToggle={() => toggle(zone.id)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected chip strip — quick visual confirmation. Compact, single row. */}
      <AnimatePresence>
        {selCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="shrink-0 px-4 pt-2 pb-1 flex flex-wrap justify-center gap-1.5"
          >
            {Array.from(selectedSet).map((zid) => {
              const zone = BODY_ZONES.find((z) => z.id === zid);
              const c = colorOf(zid);
              return (
                <span
                  key={zid}
                  data-testid={`selected-pill-${zid}`}
                  className="text-[10px] font-nunito font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${c}26`, color: c, border: `1px solid ${c}80` }}
                >
                  {zone?.label}
                </span>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
