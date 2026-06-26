import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Heart, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Clinician-only celebration toast — polls `/api/clinician/celebration-feed`
 * every ~25 s. When a NEW patient-subscription event arrives (created_at >
 * last seen marker), a confetti-style toast slides in with the patient's
 * name and a Heart pulse.
 *
 * The marker is persisted in localStorage so refreshing the tab won't
 * replay yesterday's events. First-time mount on a fresh account starts
 * the marker at "now" — so a clinician only celebrates NEW conversions.
 */
const LS_KEY = 'clin:lastCelebSince';

export default function CelebrationToaster() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]); // events still being celebrated
  const sinceRef = useRef(localStorage.getItem(LS_KEY) || new Date().toISOString());

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await axios.get(`${API}/clinician/celebration-feed`, {
          params: { since: sinceRef.current },
          withCredentials: true,
        });
        if (!alive) return;
        const fresh = r.data.events || [];
        if (fresh.length) {
          // Show newest first, dedupe by id
          setQueue((q) => {
            const seen = new Set(q.map((e) => e.id));
            const next = [...q];
            for (const e of fresh) if (!seen.has(e.id)) next.push(e);
            return next.slice(-3); // never more than 3 stacked
          });
          // Bump the marker so we never replay the same event
          const newest = fresh.reduce((max, e) => (e.created_at > max ? e.created_at : max), sinceRef.current);
          sinceRef.current = newest;
          localStorage.setItem(LS_KEY, newest);
        }
      } catch { /* ignore — clinician may be logged out */ }
    };
    tick();
    const id = setInterval(tick, 25000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const dismiss = (id) => setQueue((q) => q.filter((e) => e.id !== id));

  // Auto-dismiss each toast after 7 seconds
  useEffect(() => {
    if (!queue.length) return;
    const timers = queue.map((e) => setTimeout(() => dismiss(e.id), 7000));
    return () => timers.forEach(clearTimeout);
  }, [queue.length]); // eslint-disable-line

  return (
    <div
      className="fixed bottom-24 right-3 z-[70] flex flex-col gap-2 items-end pointer-events-none"
      data-testid="clinician-celebration-stack"
    >
      <AnimatePresence>
        {queue.map((e) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, x: 60, scale: 0.85 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className="pointer-events-auto rounded-2xl pl-3 pr-2 py-2.5 flex items-center gap-3 relative overflow-hidden"
            data-testid={`celebration-toast-${e.id}`}
            style={{
              background: 'linear-gradient(135deg, #1F6F54 0%, #2FA37A 60%, #A5DCC7 100%)',
              boxShadow: '0 18px 36px -10px rgba(31,111,84,0.6), inset 0 1px 0 rgba(255,255,255,0.35)',
              minWidth: 260,
              maxWidth: 320,
            }}
            onClick={() => { dismiss(e.id); navigate('/clinician/discover-patients'); }}
            role="button"
          >
            {/* Confetti dots */}
            {[...Array(8)].map((_, i) => (
              <motion.span
                aria-hidden
                key={i}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 6, height: 6,
                  background: ['#FDE68A', '#F9A8D4', '#A5DCC7', '#FFFFFF'][i % 4],
                  top: '50%', left: '24%',
                }}
                initial={{ opacity: 0, y: 0, x: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: [0, -28 - (i * 4), -20 - (i * 4)],
                  x: [0, (i - 4) * 12, (i - 4) * 16],
                  scale: [0.4, 1.1, 0.8],
                }}
                transition={{ duration: 1.8, repeat: 1, delay: 0.1 + i * 0.05 }}
              />
            ))}
            <motion.div
              animate={{ scale: [1, 1.18, 1], rotate: [0, -8, 8, 0] }}
              transition={{ duration: 1.4, repeat: 2 }}
              className="w-10 h-10 rounded-xl flex items-center justify-center relative shrink-0"
              style={{
                background: 'rgba(255,255,255,0.25)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.4)',
              }}
            >
              {e.patient_photo
                ? <img src={e.patient_photo} alt="" className="w-full h-full object-cover rounded-xl" />
                : <Heart className="w-5 h-5 text-white fill-white/40" />}
              <motion.span
                aria-hidden
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                style={{ background: '#FDE68A', boxShadow: '0 0 8px rgba(253,230,138,0.8)' }}
              >
                <Sparkles className="w-2.5 h-2.5 text-amber-700" />
              </motion.span>
            </motion.div>
            <div className="flex-1 min-w-0 relative text-white">
              <p className="text-[9px] font-nunito font-bold uppercase tracking-[0.18em] opacity-80">
                Patient Subscribed
              </p>
              <p className="text-sm font-fredoka font-bold truncate">
                🎉 {e.patient_name} just joined your care plan!
              </p>
              <p className="text-[10px] font-nunito opacity-85 truncate">{e.plan_name}</p>
            </div>
            <button
              onClick={(ev) => { ev.stopPropagation(); dismiss(e.id); }}
              data-testid={`celebration-dismiss-${e.id}`}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white relative"
              style={{ background: 'rgba(0,0,0,0.18)' }}
              aria-label="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
