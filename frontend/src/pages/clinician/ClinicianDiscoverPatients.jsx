import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, MapPin, Sparkles, X, Mail, Phone, User } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Match the new emerald clinician palette
const PINE = '#1F6F54';
const EMERALD = '#2FA37A';
const MINT = '#A5DCC7';

/**
 * Discoverable Patients — every patient in the system is shown with
 * masked details (name, profile photo, city). Tapping a locked patient
 * opens a 3D "subscribe to unlock" popup explaining the patient has to
 * subscribe to this clinician's plans to make their full profile visible.
 */
export default function ClinicianDiscoverPatients() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [stats, setStats] = useState({ count: 0, unlocked_count: 0 });

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/clinician/discover-patients`, { withCredentials: true });
        setList(r.data.patients || []);
        setStats({ count: r.data.count || 0, unlocked_count: r.data.unlocked_count || 0 });
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="px-4 pt-4 pb-10" data-testid="clinician-discover-patients">
      <p className="text-[10px] font-nunito font-bold uppercase tracking-[0.2em]" style={{ color: EMERALD }}>
        Discover
      </p>
      <h1 className="text-2xl font-fredoka font-bold mt-1" style={{ color: '#0A2A20' }}>
        Patients on IFEELINCOLOR
      </h1>
      <p className="text-xs font-nunito mt-1" style={{ color: 'rgba(10,42,32,0.6)' }}>
        Names &amp; contact details unlock automatically once a patient subscribes to your care or is
        assigned to you. Other patients stay <strong>anonymised</strong> — HIPAA-compliant minimum-necessary access.
      </p>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Stat icon={User} label="Total Patients" value={stats.count} />
        <Stat icon={Sparkles} label="Unlocked" value={stats.unlocked_count} tone="emerald" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mt-5">
          {list.map((p) => (
            <motion.button
              key={p.patient_id}
              data-testid={`disc-patient-${p.patient_id}`}
              whileHover={{ y: -3, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActive(p)}
              className="rounded-2xl p-3 text-left relative overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(14px)',
                border: p.is_unlocked ? `2px solid ${EMERALD}88` : `1px solid ${PINE}22`,
                boxShadow: `0 12px 24px -10px ${PINE}55`,
              }}
            >
              <motion.div
                aria-hidden
                className="absolute -top-6 -right-6 w-16 h-16 rounded-full pointer-events-none opacity-30"
                animate={{ scale: [1, 1.18, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ background: `radial-gradient(circle, ${MINT}, transparent 70%)` }}
              />
              <div className="relative flex flex-col items-center">
                <div className="relative">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${PINE}, ${EMERALD})`,
                      boxShadow: `0 12px 22px -10px ${PINE}66`,
                      filter: p.is_unlocked ? 'none' : 'saturate(0.5) brightness(0.95)',
                    }}
                  >
                    {p.profile_photo
                      ? <img src={p.profile_photo} alt="" className="w-full h-full object-cover"
                          style={{ filter: p.is_unlocked ? 'none' : 'blur(4px)' }} />
                      : (p.name || 'P').charAt(0)}
                  </div>
                  {!p.is_unlocked && (
                    <span
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${PINE}, ${EMERALD})`,
                        boxShadow: `0 4px 10px ${PINE}88`,
                      }}
                    >
                      <Lock className="w-3 h-3 text-white" />
                    </span>
                  )}
                </div>
                <p className="font-fredoka font-semibold text-xs mt-2 text-center truncate w-full" style={{ color: '#0A2A20' }}>
                  {p.name}
                </p>
                <p className="text-[10px] font-nunito text-center flex items-center gap-1" style={{ color: 'rgba(10,42,32,0.55)' }}>
                  <MapPin className="w-2.5 h-2.5" /> {p.city}
                </p>
                {!p.is_unlocked && (
                  <p className="text-[9px] font-nunito font-bold uppercase tracking-widest mt-1"
                    style={{ color: '#9CA3AF' }}
                    data-testid="disc-anonymised-badge">
                    Anonymised
                  </p>
                )}
              </div>
              <div className="mt-2.5">
                <span
                  className="block w-full text-center text-[10px] font-nunito font-bold py-1.5 rounded-lg"
                  style={p.is_unlocked
                    ? { background: `${EMERALD}22`, color: PINE }
                    : { background: `${PINE}11`, color: PINE }}
                >
                  {p.is_unlocked ? '✓ Unlocked' : 'Locked · view'}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* 3D masked-patient popup */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-sm"
            onClick={() => setActive(null)}
            data-testid="disc-patient-modal"
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.95, rotateX: -10 }}
              animate={{ y: 0, opacity: 1, scale: 1, rotateX: 0 }}
              exit={{ y: 40, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              style={{ transformStyle: 'preserve-3d' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl overflow-hidden relative"
            >
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(180deg, rgba(255,255,255,0.96), ${MINT}33)`,
                  boxShadow: `0 40px 80px -20px ${PINE}99, inset 0 1px 0 rgba(255,255,255,0.8)`,
                }}
              />
              <div className="relative p-6">
                <button
                  onClick={() => setActive(null)}
                  data-testid="disc-modal-close"
                  className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${PINE}11`, color: PINE }}
                >
                  <X className="w-4 h-4" />
                </button>
                <motion.div
                  animate={{ rotateY: [0, 360] }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  style={{ transformStyle: 'preserve-3d' }}
                  className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center"
                >
                  <div
                    className="absolute w-20 h-20 rounded-3xl flex items-center justify-center text-white text-2xl font-bold overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${PINE}, ${EMERALD}, ${MINT})`,
                      boxShadow: `0 18px 32px -10px ${PINE}88, inset 0 4px 10px rgba(255,255,255,0.45)`,
                    }}
                  >
                    {active.profile_photo
                      ? <img src={active.profile_photo} alt="" className="w-full h-full object-cover"
                          style={{ filter: active.is_unlocked ? 'none' : 'blur(6px)' }} />
                      : (active.name || 'P').charAt(0)}
                  </div>
                </motion.div>
                <h2 className="text-xl font-fredoka font-bold mt-4 text-center" style={{ color: '#0A2A20' }}>
                  {active.name}
                </h2>
                <p className="text-xs font-nunito text-center mt-1 flex items-center justify-center gap-1" style={{ color: 'rgba(10,42,32,0.6)' }}>
                  <MapPin className="w-3 h-3" /> {active.city}
                </p>

                {active.is_unlocked ? (
                  <div className="mt-4 space-y-1.5 text-left">
                    {active.email && <Field icon={Mail} label="Email" value={active.email} />}
                    {active.phone && <Field icon={Phone} label="Phone" value={active.phone} />}
                    {active.age && <Field icon={User} label="Age" value={active.age} />}
                    {active.primary_concerns && (
                      <Field icon={Sparkles} label="Primary concerns" value={active.primary_concerns} />
                    )}
                  </div>
                ) : (
                  <>
                    <div className="mt-4 space-y-1.5 text-left">
                      {['Email', 'Phone', 'Age', 'Primary concerns'].map(f => (
                        <div key={f} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                          style={{ background: `${PINE}0E`, border: `1px dashed ${PINE}55` }}>
                          <Lock className="w-3 h-3" style={{ color: PINE }} />
                          <span className="text-[11px] font-nunito font-bold" style={{ color: PINE }}>{f}:</span>
                          <span className="text-[11px] font-nunito tracking-widest" style={{ color: 'rgba(10,42,32,0.4)' }}>••••••••••</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] font-nunito mt-3 text-center" style={{ color: 'rgba(10,42,32,0.6)' }}>
                      To comply with HIPAA&apos;s minimum-necessary principle, this patient&apos;s name, photo,
                      city and contact details remain hidden until they subscribe to one of your care
                      plans or are explicitly assigned to you.
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone = 'pine' }) {
  const C = tone === 'emerald' ? EMERALD : PINE;
  return (
    <div className="rounded-2xl p-3" style={{
      background: 'rgba(255,255,255,0.78)',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${C}22`,
    }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white mb-1.5"
        style={{ background: `linear-gradient(135deg, ${C}, ${C}cc)` }}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xl font-fredoka font-bold" style={{ color: '#0A2A20' }}>{value}</p>
      <p className="text-[10px] font-nunito" style={{ color: 'rgba(10,42,32,0.6)' }}>{label}</p>
    </div>
  );
}

function Field({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg"
      style={{ background: '#F8FCFA', border: `1px solid ${PINE}1F` }}>
      <Icon className="w-3.5 h-3.5 mt-0.5" style={{ color: PINE }} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: PINE }}>{label}</p>
        <p className="text-xs font-nunito" style={{ color: '#0A2A20' }}>{value}</p>
      </div>
    </div>
  );
}
