import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useCheckinContent, getZoneLabelFrom, softenClinicalPhrase } from './CheckinContentContext';
import TTSButton from '../../lib/tts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Resolve admin-authored reflection_template tokens against the live state.
// Supports [sensation], [sensations], [emotion], [color], [body_part] placeholders.
// Tokens are lowercased before interpolation because they're embedded
// mid-sentence — "Tight shoulders" inside a sentence reads as a typo.
function fillTemplate(template, ctx) {
  if (!template) return '';
  const lower = (s) => (s || '').toString().toLowerCase().trim();
  return template
    .replace(/\[sensations?\]/gi, lower(ctx.sensations))
    .replace(/\[emotion\]/gi, lower(ctx.emotion))
    .replace(/\[color\]/gi, lower(ctx.colorName))
    .replace(/\[body[_ ]?part\]/gi, lower(ctx.bodyPart));
}

export default function ReflectionCard({ bodyZone, sensations, emotion, colorName, deeperFeeling, emotionColor, onReflectionGenerated }) {
  const { bodyZones } = useCheckinContent();
  const [loading, setLoading] = useState(true);
  const [reflection, setReflection] = useState('');
  const [need, setNeed] = useState('');

  useEffect(() => {
    const generate = async () => {
      setLoading(true);
      const zoneLabel = getZoneLabelFrom(bodyZones, bodyZone);
      const zones = Array.isArray(bodyZone) ? bodyZone : (bodyZone ? [bodyZone] : []);
      const adminTemplate = zones.map((z) => bodyZones.find((b) => b.id === z)?.reflectionTemplate).filter(Boolean)[0];

      // If admin authored a template, render it locally — instant, deterministic,
      // and guaranteed compliant. AI reflection is still a fallback for richer output.
      if (adminTemplate) {
        const rendered = softenClinicalPhrase(fillTemplate(adminTemplate, {
          sensations: sensations?.join(', ') || '',
          emotion: emotion || '',
          colorName: colorName || '',
          bodyPart: zoneLabel,
        }));
        setReflection(rendered);
        setNeed('gentle attention and care');
        onReflectionGenerated(rendered);
        setLoading(false);
        return;
      }

      try {
        const res = await axios.post(`${API}/ai/reflection`, {
          body_part: zoneLabel,
          sensations: sensations?.join(', ') || '',
          emotion: emotion || '',
          color_name: colorName || '',
          deeper_feeling: deeperFeeling || '',
        }, { withCredentials: true });
        const safe = softenClinicalPhrase(res.data.reflection || '');
        setReflection(safe);
        setNeed(res.data.need || '');
        onReflectionGenerated(safe);
      } catch (err) {
        const fallback = softenClinicalPhrase(
          `The ${sensations?.join(', ')?.toLowerCase() || 'sensation'} in your ${zoneLabel.toLowerCase()} often shows up when you're feeling ${(emotion || '').toLowerCase()}. Your body is sharing something — pause and listen with kindness.`
        );
        setReflection(fallback);
        setNeed('some gentle attention and care');
        onReflectionGenerated(fallback);
      } finally {
        setLoading(false);
      }
    };
    generate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const glow = emotionColor || '#FFD166';

  return (
    <div className="h-full overflow-y-auto flex flex-col items-center justify-start px-3 py-4 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
        <Sparkles className="w-6 h-6 mx-auto mb-2" style={{ color: glow }} />
        <h2 className="text-xl font-fredoka font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
          Your Reflection
        </h2>
        <p className="text-xs font-nunito mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Here is what your body might be telling you
        </p>
      </motion.div>

      {loading ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: glow }} />
          <p className="text-sm font-nunito" style={{ color: 'rgba(255,255,255,0.5)' }}>Creating your reflection...</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="w-full rounded-3xl p-6 relative overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${glow}33`,
            boxShadow: `0 0 40px ${glow}15, inset 0 1px 0 ${glow}22`,
          }}
        >
          {/* Top glow line */}
          <div className="absolute top-0 left-1/4 right-1/4 h-px" style={{ background: `linear-gradient(90deg, transparent, ${glow}, transparent)` }} />

          {/* Reflection text + TTS playback */}
          <div className="flex items-start gap-2">
            <p className="text-base sm:text-lg font-nunito leading-relaxed flex-1" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {reflection.split(/(\[.*?\])/).map((part, i) => {
                if (part.startsWith('[') && part.endsWith(']')) {
                  return <span key={i} style={{ color: glow, fontWeight: 600 }}>{part.slice(1, -1)}</span>;
                }
                return part;
              })}
            </p>
            <TTSButton
              text={reflection.replace(/\[|\]/g, '')}
              testId="reflection-tts"
              ariaLabel="Listen to this reflection"
            />
          </div>

          {/* Color indicator */}
          <div className="flex items-center gap-3 mt-5 pt-4" style={{ borderTop: `1px solid ${glow}15` }}>
            <motion.div
              animate={{ boxShadow: [`0 0 10px ${glow}44`, `0 0 25px ${glow}66`, `0 0 10px ${glow}44`] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-8 h-8 rounded-xl"
              style={{ background: glow }}
            />
            <div>
              <p className="text-xs font-nunito" style={{ color: 'rgba(255,255,255,0.4)' }}>Connected color</p>
              <p className="text-sm font-nunito font-medium" style={{ color: glow }}>{colorName}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
