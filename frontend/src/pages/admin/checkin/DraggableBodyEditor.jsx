/**
 * Admin-only draggable body-zone editor.
 *
 * Lets editors grab any of the 12 dots and drop them anywhere on the body
 * image. On drop, the new x/y% are persisted via PATCH
 * /api/admin/checkin/body-parts/{id} and the same DB row is read by the
 * patient flow → positions reflect instantly across the app.
 *
 * Drag math uses the body-IMG bounding rect (not the parent container) so
 * the dot follows the actual anatomy regardless of container letterboxing.
 */
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { GripHorizontal, RotateCcw, Save } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ax = axios.create({ withCredentials: true });

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function DraggableBodyEditor({ items, onSaved, onSelectZone }) {
  const imgRef = useRef(null);
  const wrapRef = useRef(null);
  // Local positions {[body_part_id]: {x, y}} so we can drag without flicker.
  const [positions, setPositions] = useState({});
  const [dragging, setDragging] = useState(null); // body_part_id
  const [dirty, setDirty] = useState(new Set());
  const [saving, setSaving] = useState(false);

  // Sync local positions from props whenever items change (e.g. after Save).
  useEffect(() => {
    const next = {};
    items.forEach((bp) => {
      next[bp.body_part_id] = {
        x: Number(bp.position_x) || 50,
        y: Number(bp.position_y) || 50,
      };
    });
    setPositions(next);
    setDirty(new Set());
  }, [items]);

  // ─── pointer handlers ───────────────────────────────────────────────
  const onPointerDown = (e, bp) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(bp.body_part_id);
    // Capture pointer so we keep getting move events outside the dot.
    e.target.setPointerCapture?.(e.pointerId);
    onSelectZone?.(bp);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
    setPositions((p) => ({ ...p, [dragging]: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } }));
    setDirty((d) => new Set(d).add(dragging));
  };

  const onPointerUp = () => {
    if (dragging) setDragging(null);
  };

  // ─── persist ────────────────────────────────────────────────────────
  const saveAll = async () => {
    if (dirty.size === 0) return;
    setSaving(true);
    try {
      const tasks = [];
      for (const id of dirty) {
        const bp = items.find((b) => b.body_part_id === id);
        if (!bp) continue;
        const pos = positions[id];
        // The PATCH endpoint requires the full BodyPartIn payload —
        // we re-send the existing fields with only x/y changed.
        const payload = {
          name: bp.name,
          slug: bp.slug,
          position_x: Math.round(pos.x),
          position_y: Math.round(pos.y),
          sensations: bp.sensations || [],
          question_text: bp.question_text || '',
          reflection_template: bp.reflection_template || '',
          sensation_emotion_map: bp.sensation_emotion_map || {},
          default_emotion_key: bp.default_emotion_key || 'bad',
          questions: bp.questions || [],
          order: bp.order ?? 0,
          active: bp.active !== false,
        };
        tasks.push(ax.patch(`${API}/admin/checkin/body-parts/${id}`, payload));
      }
      await Promise.all(tasks);
      toast.success(`Saved ${dirty.size} dot position${dirty.size > 1 ? 's' : ''}`);
      setDirty(new Set());
      onSaved?.();
    } catch (e) {
      toast.error('Could not save positions. Try again?');
    } finally { setSaving(false); }
  };

  const resetAll = () => {
    const next = {};
    items.forEach((bp) => { next[bp.body_part_id] = { x: bp.position_x, y: bp.position_y }; });
    setPositions(next);
    setDirty(new Set());
  };

  // ─── render ─────────────────────────────────────────────────────────
  return (
    <div
      ref={wrapRef}
      className="rounded-3xl p-4 mb-6"
      style={{
        background: 'radial-gradient(ellipse at 50% 28%, #1A1448 0%, #0A0830 55%, #050018 100%)',
      }}
      data-testid="drag-body-editor"
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: '#7FE3FF' }}>
            Drag-to-position editor
          </p>
          <h3 className="font-fredoka text-white text-base font-semibold flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 text-cyan-300" />
            Drag any dot onto the right body part
          </h3>
          <p className="text-[11px] text-cyan-100/70 mt-0.5">
            Click a dot to edit that zone · drag to reposition · Save to apply.
            Patients see these positions instantly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="drag-body-reset"
            onClick={resetAll}
            disabled={dirty.size === 0}
            className="text-[11px] font-bold rounded-full px-3 py-1.5 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <RotateCcw className="w-3 h-3 inline mr-1" /> Reset
          </button>
          <button
            data-testid="drag-body-save"
            onClick={saveAll}
            disabled={dirty.size === 0 || saving}
            className="text-[11px] font-bold rounded-full px-3 py-1.5 text-white disabled:opacity-50"
            style={{
              background: dirty.size > 0
                ? 'linear-gradient(135deg, #10B981, #34D399)'
                : 'rgba(255,255,255,0.06)',
              boxShadow: dirty.size > 0 ? '0 6px 16px -6px rgba(16,185,129,0.55)' : 'none',
            }}
          >
            <Save className="w-3 h-3 inline mr-1" />
            {saving ? 'Saving…' : dirty.size > 0 ? `Save ${dirty.size} change${dirty.size > 1 ? 's' : ''}` : 'Saved'}
          </button>
        </div>
      </div>

      <div
        className="relative mx-auto"
        style={{
          width: 'min(100%, 360px)',
          aspectRatio: '668 / 1536',
          touchAction: 'none',
          userSelect: 'none',
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <img
          ref={imgRef}
          src="/assets/somatic-body-hd.png"
          alt="Body map (admin drag editor)"
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            imageRendering: '-webkit-optimize-contrast',
            filter: 'drop-shadow(0 0 18px rgba(168,139,250,0.45)) drop-shadow(0 0 38px rgba(125,211,252,0.30))',
            pointerEvents: 'none',
          }}
        />

        {items.map((bp) => {
          const pos = positions[bp.body_part_id] || { x: bp.position_x, y: bp.position_y };
          const isDragging = dragging === bp.body_part_id;
          const isDirty = dirty.has(bp.body_part_id);
          // Per-zone vivid color (matches patient SomaticMap palette ordering).
          const ZONE_COLORS = [
            '#FF6FB5', '#FFB74D', '#5EEAD4', '#A78BFA', '#60A5FA', '#F472B6',
            '#FACC15', '#34D399', '#FB923C', '#C084FC', '#7DD3FC', '#FCA5A5',
          ];
          const orderIdx = items.findIndex((b) => b.body_part_id === bp.body_part_id);
          const color = isDirty
            ? '#10B981'                    // emerald while unsaved
            : isDragging
              ? '#7FE3FF'                  // cyan while dragging
              : ZONE_COLORS[orderIdx % ZONE_COLORS.length];
          const size = isDragging ? 24 : 20;
          return (
            <div
              key={bp.body_part_id}
              data-testid={`drag-dot-${bp.slug}`}
              onPointerDown={(e) => onPointerDown(e, bp)}
              className="absolute"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                zIndex: isDragging ? 30 : 20,
              }}
            >
              {/* Glowing dot — identical look to patient SomaticMap, including the pulsing ring */}
              <span
                className="rounded-full inline-flex items-center justify-center relative"
                style={{
                  width: size,
                  height: size,
                  background: isDragging || isDirty
                    ? `radial-gradient(circle at 30% 30%, #FFFFFF, ${color} 65%)`
                    : 'rgba(255,255,255,0.95)',
                  border: `2px solid ${color}`,
                  boxShadow: isDragging
                    ? `0 0 0 6px ${color}55, 0 0 22px ${color}cc, 0 2px 10px rgba(0,0,0,0.4)`
                    : `0 0 0 3px ${color}33, 0 0 14px ${color}aa, 0 2px 8px rgba(0,0,0,0.35)`,
                  transition: 'background 180ms ease, box-shadow 180ms ease',
                }}
              >
                {/* Continuous pulsing ring — keeps glowing even AFTER save */}
                {!isDragging && (
                  <motion.span
                    aria-hidden
                    className="absolute rounded-full pointer-events-none"
                    style={{ width: size, height: size, border: `2px solid ${color}` }}
                    animate={{ scale: [1, 1.7, 1], opacity: [0.55, 0, 0.55] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                <span className="text-[8px] font-bold text-slate-900 select-none relative">
                  {bp.name.split(/[\s/]/)[0].slice(0, 2).toUpperCase()}
                </span>
              </span>
              {/* Hover label */}
              <div
                className="absolute left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 text-[9px] font-bold rounded whitespace-nowrap"
                style={{
                  top: '100%',
                  color: '#0F172A',
                  background: isDirty ? '#A7F3D0' : 'rgba(255,255,255,0.92)',
                  pointerEvents: 'none',
                }}
              >
                {bp.name}
                {isDirty && <span className="ml-1 text-emerald-700">●</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live coordinates table for editors who prefer the numbers */}
      <div className="mt-4 px-2 grid grid-cols-2 md:grid-cols-3 gap-1.5 text-[10px] font-mono">
        {items.map((bp) => {
          const pos = positions[bp.body_part_id] || { x: bp.position_x, y: bp.position_y };
          const isDirty = dirty.has(bp.body_part_id);
          return (
            <div
              key={bp.body_part_id}
              className="flex items-center justify-between rounded px-1.5 py-0.5"
              style={{ background: isDirty ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)', color: isDirty ? '#A7F3D0' : '#94A3B8' }}
            >
              <span className="truncate">{bp.name}</span>
              <span>{Math.round(pos.x)}, {Math.round(pos.y)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
