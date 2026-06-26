/**
 * EmergencyAlarm — full-screen pulsing modal + Web-Audio alarm tone for
 * un-acknowledged SOS dispatches sent to the calling Clinician or Admin.
 *
 * Polls `/api/emergency/active` every 5 s. When a fresh dispatch arrives:
 *   • a sustained two-tone klaxon is generated via Web Audio (no asset)
 *   • a crimson, blocking modal pops with patient name, phone, last mood,
 *     and an "Acknowledge" button that calls
 *     POST /api/emergency/dispatch/{dispatch_id}/ack.
 *
 * Mount once near the top of the Clinician and Admin shells.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { AlertOctagon, Phone, MapPin, Heart, X as XIcon } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const POLL_MS = 5000;

function useAlarmTone(active) {
  const ctxRef = useRef(null);
  const oscRef = useRef(null);
  useEffect(() => {
    if (!active) {
      if (oscRef.current) { try { oscRef.current.stop(); } catch { /* ignore */ } oscRef.current = null; }
      if (ctxRef.current) { try { ctxRef.current.close(); } catch { /* ignore */ } ctxRef.current = null; }
      return undefined;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return undefined;
      const ctx = new AudioCtx();
      ctxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      gain.gain.value = 0.07;
      osc.connect(gain);
      gain.connect(ctx.destination);
      // Two-tone klaxon — alternate 880 / 660 Hz every 380 ms
      let high = true;
      const swap = () => {
        if (!ctxRef.current) return;
        osc.frequency.setValueAtTime(high ? 880 : 660, ctx.currentTime);
        high = !high;
      };
      swap();
      const iv = setInterval(swap, 380);
      osc.start();
      oscRef.current = { osc, iv };
      return () => {
        clearInterval(iv);
        try { osc.stop(); } catch { /* ignore */ }
        try { ctx.close(); } catch { /* ignore */ }
      };
    } catch {
      return undefined;
    }
  }, [active]);
}

export default function EmergencyAlarm() {
  const [active, setActive] = useState([]);
  const [showing, setShowing] = useState(null);
  const seenIds = useRef(new Set());

  const poll = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/emergency/active`, { withCredentials: true });
      const list = r.data?.active || [];
      setActive(list);
      const fresh = list.find((a) => !seenIds.current.has(a.dispatch_id));
      if (fresh && !showing) setShowing(fresh);
      list.forEach((a) => seenIds.current.add(a.dispatch_id));
    } catch { /* silent — endpoint always 200 */ }
  }, [showing]);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => clearInterval(iv);
  }, [poll]);

  useAlarmTone(!!showing);

  const acknowledge = async () => {
    if (!showing) return;
    try {
      await axios.post(`${API}/emergency/dispatch/${showing.dispatch_id}/ack`, {}, { withCredentials: true });
      setActive((prev) => prev.filter((a) => a.dispatch_id !== showing.dispatch_id));
      setShowing(null);
    } catch { /* ignore */ }
  };

  return (
    <AnimatePresence>
      {showing && (
        <motion.div
          data-testid="emergency-alarm-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,8,8,0.86)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="w-full max-w-md rounded-3xl p-6 relative overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #FEE2E2 0%, #ffffff 60%)',
              border: '2px solid #DC2626',
              boxShadow: '0 30px 80px -10px rgba(220,38,38,0.55), inset 0 0 30px rgba(220,38,38,0.18)',
            }}
          >
            {/* Pulsing ring */}
            <motion.div
              aria-hidden
              className="absolute -top-12 -right-12 w-44 h-44 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.55), transparent 70%)' }}
              animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.95, 0.6] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="flex items-start gap-4 relative">
              <motion.div
                animate={{ rotate: [-8, 8, -8] }}
                transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #DC2626, #7F1D1D)',
                  boxShadow: '0 14px 30px -6px rgba(220,38,38,0.7)',
                }}
              >
                <AlertOctagon className="w-8 h-8 text-white" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-700">
                  Patient SOS · {showing.kind?.replace('_', ' ') || 'emergency'}
                </p>
                <h2 className="font-fredoka font-semibold text-xl text-slate-900 mt-0.5 truncate">
                  {showing.patient?.name || 'Patient in crisis'}
                </h2>
                {showing.severity && (
                  <p className="text-xs font-nunito text-red-800 mt-0.5">
                    Severity: <strong>{String(showing.severity).toUpperCase()}</strong>
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {showing.patient?.phone && (
                <a
                  data-testid="emergency-call-btn"
                  href={`tel:${showing.patient.phone}`}
                  className="flex items-center gap-3 p-3 rounded-2xl font-nunito text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)' }}
                >
                  <Phone className="w-4 h-4" />
                  Call {showing.patient.phone}
                </a>
              )}
              {showing.patient?.email && (
                <div className="text-xs font-nunito text-slate-700 px-1">
                  📧 {showing.patient.email}
                </div>
              )}
              {(showing.lat || showing.lng) && (
                <div className="flex items-center gap-1.5 text-xs font-nunito text-slate-600 px-1">
                  <MapPin className="w-3 h-3" />
                  {Number(showing.lat).toFixed(3)}, {Number(showing.lng).toFixed(3)}
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={`https://maps.google.com/?q=${showing.lat},${showing.lng}`}
                    className="text-red-700 font-bold ml-1 underline"
                  >
                    Open map
                  </a>
                </div>
              )}
              {showing.patient?.last_emotion && (
                <div className="flex items-center gap-1.5 text-xs font-nunito text-slate-600 px-1">
                  <Heart className="w-3 h-3 text-pink-500" />
                  Last reported mood: <strong>{showing.patient.last_emotion}</strong>
                  {showing.patient.last_color && ` (${showing.patient.last_color})`}
                </div>
              )}
              {showing.note && (
                <div className="rounded-xl p-3 text-xs italic"
                  style={{ background: 'rgba(254,226,226,0.6)', color: '#7F1D1D', border: '1px solid rgba(220,38,38,0.25)' }}>
                  "{showing.note}"
                </div>
              )}
            </div>

            <button
              data-testid="emergency-ack-btn"
              onClick={acknowledge}
              className="mt-5 w-full rounded-2xl py-3 text-sm font-nunito font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #DC2626, #991B1B)',
                boxShadow: '0 14px 30px -8px rgba(220,38,38,0.55)',
              }}
            >
              Acknowledge &amp; stop alarm
            </button>
            {active.length > 1 && (
              <p className="mt-2 text-center text-[10px] font-nunito text-red-700">
                {active.length - 1} more SOS dispatch{active.length > 2 ? 'es' : ''} waiting.
              </p>
            )}
            <button
              aria-label="Close"
              onClick={() => setShowing(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-white/80 text-slate-500 hover:text-slate-900"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
