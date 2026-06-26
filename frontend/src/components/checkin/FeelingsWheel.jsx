import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCheckinContent } from './CheckinContentContext';
import { ChevronLeft } from 'lucide-react';

export default function FeelingsWheel({ suggestedEmotion, onSelect, selectedLevel1, selectedLevel2, selectedLevel3 }) {
  const { emotionFamilies: EMOTION_FAMILIES, feelingsWheel: FEELINGS_WHEEL } = useCheckinContent();
  const [level, setLevel] = useState(selectedLevel1 ? (selectedLevel3 ? 3 : selectedLevel2 ? 2 : 1) : 0);
  const [l1, setL1] = useState(selectedLevel1 || null);
  const [l2, setL2] = useState(selectedLevel2 || null);
  const [l3, setL3] = useState(selectedLevel3 || null);

  const emotions = Object.entries(EMOTION_FAMILIES);
  const wheelData = FEELINGS_WHEEL;

  const handleL1 = (key) => { setL1(key); setL2(null); setL3(null); setLevel(1); onSelect(key, null, null); };
  const handleL2 = (key) => { setL2(key); setL3(null); setLevel(2); onSelect(l1, key, null); };
  const handleL3 = (val) => { setL3(val); setLevel(3); onSelect(l1, l2, val); };
  const goBack = () => {
    if (level === 2) { setL2(null); setL3(null); setLevel(1); onSelect(l1, null, null); }
    else if (level === 1) { setL1(null); setLevel(0); onSelect(null, null, null); }
    else if (level === 3) { setL3(null); setLevel(2); onSelect(l1, l2, null); }
  };

  const activeColor = l1 ? EMOTION_FAMILIES[l1]?.color : '#FFD166';

  const l2Options = useMemo(() => {
    if (!l1 || !wheelData[l1]) return [];
    return Object.keys(wheelData[l1]);
  }, [l1]); // eslint-disable-line react-hooks/exhaustive-deps

  const l3Options = useMemo(() => {
    if (!l1 || !l2 || !wheelData[l1]?.[l2]) return [];
    return wheelData[l1][l2];
  }, [l1, l2]);

  return (
    <div className="h-full overflow-y-auto flex flex-col items-center justify-start px-3 py-3 max-w-lg mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6 w-full">
        <div className="flex items-center justify-center gap-3 mb-2">
          {level > 0 && (
            <motion.button initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} onClick={goBack}
              data-testid="wheel-back-button"
              className="p-2 rounded-full cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <ChevronLeft className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
            </motion.button>
          )}
          <h2 className="text-xl font-fredoka font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {level === 0 && 'How do you feel?'}
            {level === 1 && `${EMOTION_FAMILIES[l1]?.label} — What kind?`}
            {level === 2 && `${l2?.charAt(0).toUpperCase() + l2?.slice(1)} — Go deeper`}
            {level === 3 && 'Feeling locked in'}
          </h2>
        </div>
        <p className="text-xs font-nunito" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {level === 0 && 'Select the main color that resonates with you'}
          {level === 1 && 'Choose the specific feeling'}
          {level === 2 && 'Select the deepest layer'}
          {level === 3 && 'Your feeling has been captured'}
        </p>
      </motion.div>

      {/* Wheel visualization */}
      <div className="relative w-full" style={{ minHeight: 340 }}>
        <AnimatePresence mode="wait">
          {/* Level 0: Main emotions in a circle */}
          {level === 0 && (
            <motion.div key="l0" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="relative w-full flex items-center justify-center" style={{ height: 340 }}>
              {/* Center glow */}
              <div className="absolute w-20 h-20 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />
              {emotions.map(([key, data], i) => {
                const angle = (i / emotions.length) * 360 - 90;
                const rad = (angle * Math.PI) / 180;
                const radius = 120;
                const x = Math.cos(rad) * radius;
                const y = Math.sin(rad) * radius;
                const isSuggested = key === suggestedEmotion;
                return (
                  <motion.button
                    key={key}
                    data-testid={`wheel-l1-${key}`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1, x, y }}
                    transition={{ delay: i * 0.06, type: 'spring', stiffness: 200, damping: 18 }}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleL1(key)}
                    className="absolute flex flex-col items-center gap-1.5 cursor-pointer"
                  >
                    <motion.div
                      animate={isSuggested ? { boxShadow: [`0 0 10px ${data.color}44`, `0 0 25px ${data.color}66`, `0 0 10px ${data.color}44`] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{
                        background: `${data.color}22`,
                        border: `2px solid ${isSuggested ? data.color : `${data.color}55`}`,
                        boxShadow: isSuggested ? `0 0 20px ${data.color}44` : 'none'
                      }}
                    >
                      <div className="w-7 h-7 rounded-full" style={{ background: data.color }} />
                    </motion.div>
                    <span className="text-[11px] font-nunito font-medium" style={{ color: isSuggested ? data.color : 'rgba(255,255,255,0.5)' }}>
                      {data.label}
                    </span>
                    {isSuggested && (
                      <span className="text-[8px] font-nunito px-1.5 py-0.5 rounded-full" style={{ background: `${data.color}22`, color: data.color }}>
                        suggested
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          )}

          {/* Level 1: Specific emotions */}
          {level === 1 && (
            <motion.div key="l1" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="relative w-full flex items-center justify-center" style={{ height: 340 }}>
              <div className="absolute w-14 h-14 rounded-full" style={{ background: activeColor, opacity: 0.15, filter: 'blur(20px)' }} />
              {l2Options.map((key, i) => {
                const angle = (i / l2Options.length) * 360 - 90;
                const rad = (angle * Math.PI) / 180;
                const radius = 110;
                const x = Math.cos(rad) * radius;
                const y = Math.sin(rad) * radius;
                return (
                  <motion.button
                    key={key}
                    data-testid={`wheel-l2-${key}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x, y }}
                    transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 22 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleL2(key)}
                    className="absolute px-4 py-2.5 rounded-2xl text-sm font-nunito font-medium cursor-pointer"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${activeColor}44`,
                      color: 'rgba(255,255,255,0.8)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </motion.button>
                );
              })}
            </motion.div>
          )}

          {/* Level 2: Deeper feelings */}
          {level === 2 && (
            <motion.div key="l2" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-wrap justify-center gap-3" style={{ paddingTop: 40 }}>
              {l3Options.map((val, i) => (
                <motion.button
                  key={val}
                  data-testid={`wheel-l3-${val.toLowerCase().replace(/\s/g, '-')}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ scale: 1.08, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleL3(val)}
                  className="px-5 py-3 rounded-2xl text-sm font-nunito font-medium cursor-pointer"
                  style={{
                    background: `${activeColor}11`,
                    border: `1px solid ${activeColor}44`,
                    color: activeColor,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {val}
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* Level 3: Locked */}
          {level === 3 && (
            <motion.div key="l3" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center justify-center text-center gap-4" style={{ paddingTop: 60 }}>
              <motion.div
                animate={{ boxShadow: [`0 0 30px ${activeColor}33`, `0 0 50px ${activeColor}55`, `0 0 30px ${activeColor}33`] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="w-24 h-24 rounded-3xl flex items-center justify-center"
                style={{ background: `${activeColor}22`, border: `2px solid ${activeColor}66` }}
              >
                <div className="w-12 h-12 rounded-xl" style={{ background: activeColor }} />
              </motion.div>
              <div>
                <p className="text-2xl font-fredoka font-semibold" style={{ color: activeColor }}>{l3}</p>
                <p className="text-sm font-nunito mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {l2?.charAt(0).toUpperCase() + l2?.slice(1)} &middot; {EMOTION_FAMILIES[l1]?.label}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
