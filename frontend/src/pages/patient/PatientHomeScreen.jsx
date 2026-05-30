import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { Megaphone, MapPin, Heart, Sparkles, AlertOctagon, Star, ChevronRight, Plus, X, Check, Lock as LockIcon, BookOpen, ScanFace, Loader2, History, Building2, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/button';
import CheckInFlow from '../../components/checkin/CheckInFlow';
import InfoTip from '../../components/ui/InfoTip';
import { FEATURE_TIPS } from '../../lib/featureTips';
import { useRazorpayCheckout } from '../../lib/razorpay';
import PlacesAutocomplete from '../../components/places/PlacesAutocomplete';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// NEW: Vibrant kid-friendly palette — more saturation, more depth
const C = {
  rose: '#FF3D8A',
  coral: '#FF7AB0',
  tangerine: '#FF8C3F',
  amber: '#FFB627',
  lemon: '#FFE45C',
  mint: '#00D9A3',
  teal: '#22D3C5',
  sky: '#3DAEFF',
  violet: '#9D5BFF',
  bubblegum: '#FF6FB8',
  ink: '#1F1147',
  cream: '#FFF8F0',
};

function Bubble3D({ size, color, top, left, right, bottom, delay = 0 }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size, top, left, right, bottom,
        background: `radial-gradient(circle at 28% 28%, #fff 0%, ${color}ff 35%, ${color}bb 60%, ${color}33 100%)`,
        boxShadow: `0 18px 50px -10px ${color}88, inset 0 -8px 18px ${color}44`,
        opacity: 0.85,
      }}
      animate={{ y: [0, -22, 0], rotate: [0, 8, 0], scale: [1, 1.06, 1] }}
      transition={{ duration: 6 + Math.random() * 4, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

// Doctor subscription modal
function SubscribeModal({ doctor, onClose, onSuccess }) {
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [coverage, setCoverage] = useState(null);   // { covered:true, org_name } when org-included
  const [linking, setLinking] = useState(false);
  const { configured: rzpConfigured, launchCheckout } = useRazorpayCheckout();

  useEffect(() => {
    // 1. Check if the patient already gets this clinician free via their org subscription
    axios.get(`${API}/patient/clinician-coverage`, { params: { clinician_id: doctor.doctor_id }, withCredentials: true })
      .then(r => setCoverage(r.data))
      .catch(() => setCoverage({ covered: false }));
    // 2. Load this clinician's specific plans (falls back to global default on backend)
    axios.get(`${API}/plans/patient-clinician`, { params: { clinician_id: doctor.doctor_id } })
      .then(r => {
        setPlans(r.data.plans || []);
        if (r.data.plans?.length) setSelected(r.data.plans[0].plan_id);
      });
  }, [doctor.doctor_id]);

  const linkViaOrg = async () => {
    setLinking(true);
    try {
      await axios.post(`${API}/patient/doctors/subscribe-via-org`, { doctor_id: doctor.doctor_id }, { withCredentials: true });
      onSuccess?.();
    } catch (e) { console.error(e); }
    finally { setLinking(false); }
  };

  const confirm = async () => {
    if (!selected) return;
    if (!rzpConfigured) {
      alert('Payments are not configured yet. Please contact support.');
      return;
    }
    setLoading(true);
    try {
      await launchCheckout({
        kind: 'patient_doctor',
        plan_id: selected,
        doctor_id: doctor.doctor_id,
        onSuccess: () => {
          setLoading(false);
          onSuccess?.();
        },
        onFailure: (err) => {
          setLoading(false);
          if (!err?.dismissed) alert(err?.message || 'Payment did not complete');
        },
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-4 pb-4"
      style={{ background: 'rgba(31,17,71,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-[2rem] p-6 relative"
        style={{
          background: 'white',
          boxShadow: '0 30px 80px -20px rgba(31,17,71,0.4)',
        }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center" data-testid="close-sub-modal">
          <X className="w-4 h-4 text-slate-500" />
        </button>

        <div className="text-center mb-5">
          <div className="w-16 h-16 mx-auto rounded-3xl flex items-center justify-center text-white text-2xl font-fredoka font-bold mb-3"
            style={{ background: doctor.avatar_color || C.rose, boxShadow: `0 14px 30px -6px ${doctor.avatar_color || C.rose}88` }}>
            {(doctor.name || 'D').charAt(0)}
          </div>
          <h3 className="font-fredoka font-semibold text-xl" style={{ color: C.ink }}>Subscribe to {doctor.name}</h3>
          <p className="text-[11px] font-nunito mt-1" style={{ color: '#7B6A9C' }}>{doctor.specialty}</p>
          {coverage?.covered && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-nunito font-bold"
              style={{ background: '#22D67E22', color: '#0d9488', border: '1px solid #22D67E55' }}
              data-testid="org-included-badge">
              <Check className="w-3 h-3" /> Included with {coverage.org_name}
            </div>
          )}
        </div>

        {coverage?.covered ? (
          /* Org-included free flow — skip Stripe entirely */
          <div className="space-y-3">
            <div className="rounded-2xl p-4 text-center" style={{ background: '#22D67E12', border: '1px solid #22D67E33' }}>
              <Sparkles className="w-6 h-6 mx-auto mb-2" style={{ color: '#0d9488' }} />
              <p className="text-sm font-fredoka font-semibold" style={{ color: C.ink }}>You're already covered!</p>
              <p className="text-[11px] font-nunito mt-1" style={{ color: '#475569' }}>
                Your <strong>{coverage.org_name}</strong> subscription includes free access to {doctor.name}.
              </p>
            </div>
            <Button
              data-testid="confirm-doctor-via-org"
              onClick={linkViaOrg}
              disabled={linking}
              className="w-full rounded-2xl h-12 font-nunito font-bold text-white border-0"
              style={{ background: 'linear-gradient(135deg, #22D67E, #0d9488)' }}
            >
              {linking ? 'Linking…' : `Confirm & connect with ${doctor.name.split(' ')[0]}`}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4 max-h-72 overflow-y-auto" data-testid="doctor-plans-list">
              {plans.length === 0 ? (
                <div className="rounded-2xl p-4 text-center text-xs font-nunito" style={{ background: '#FFF1E6', color: '#9785B5' }}>
                  This clinician hasn't published plans yet. Please check back soon.
                </div>
              ) : plans.map(p => {
                const isSel = selected === p.plan_id;
                return (
                  <button
                    key={p.plan_id}
                    data-testid={`doc-plan-${p.plan_id}`}
                    onClick={() => setSelected(p.plan_id)}
                    className="w-full text-left rounded-2xl p-4 transition-all"
                    style={{
                      background: isSel ? `linear-gradient(135deg, ${C.rose}, ${C.tangerine})` : '#F8F5FC',
                      color: isSel ? 'white' : C.ink,
                      boxShadow: isSel ? `0 14px 28px -10px ${C.rose}88` : 'none',
                    }}
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <p className="font-fredoka font-semibold text-base">{p.name}</p>
                      <p className="font-fredoka font-bold text-xl">${p.price}<span className="text-xs font-normal opacity-70">/{(p.is_trial && p.trial_days) ? `${p.trial_days}d trial` : `${p.duration_days}d`}</span></p>
                    </div>
                    <p className="text-[11px] font-nunito" style={{ opacity: isSel ? 0.9 : 0.7 }}>{p.description}</p>
                    {p.features?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.features.slice(0, 3).map((f, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ background: isSel ? 'rgba(255,255,255,0.18)' : '#EEE9F7' }}>
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                    {isSel && <Check className="w-4 h-4 inline mt-2 text-white" />}
                  </button>
                );
              })}
            </div>

            <Button
              data-testid="confirm-doctor-sub"
              onClick={confirm}
              disabled={!selected || loading}
              className="w-full rounded-2xl h-12 font-nunito font-bold text-white border-0"
              style={{ background: `linear-gradient(135deg, ${C.rose}, ${C.tangerine})` }}
            >
              {loading ? 'Subscribing...' : 'Confirm & Subscribe'}
            </Button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function DoctorCard({ d, isSubbed, onSubscribe }) {
  const isAssociated = d.associated_with_ifeelincolor !== false; // real clinicians true; google false
  const mapsUrl = d.place_id
    ? `https://www.google.com/maps/place/?q=place_id:${d.place_id}`
    : (d.lat != null && d.lng != null
        ? `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}(${encodeURIComponent(d.name || 'Provider')})`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((d.name || '') + ' ' + (d.address || ''))}`);
  const openMaps = (e) => {
    if (e?.stopPropagation) e.stopPropagation();
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };
  return (
    <motion.div
      whileHover={{ y: -4, rotateY: 4, rotateX: -2 }}
      style={{ transformStyle: 'preserve-3d', perspective: 700, cursor: 'pointer' }}
      className="flex items-center gap-3 rounded-2xl p-3 relative overflow-hidden"
      data-testid={`doctor-card-${d.doctor_id}`}
      onClick={openMaps}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') openMaps(e); }}
    >
      <div className="absolute inset-0 rounded-2xl"
        style={{ background: 'white', boxShadow: '0 14px 32px -14px rgba(31,17,71,0.18)' }} />
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20"
        style={{ background: `radial-gradient(circle, ${d.avatar_color || C.sky}, transparent 70%)` }} />
      <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-base shrink-0"
        style={{
          background: `linear-gradient(135deg, ${d.avatar_color || C.sky}, ${d.avatar_color || C.sky}cc)`,
          boxShadow: `0 8px 18px -4px ${d.avatar_color || C.sky}88`,
        }}>
        {(d.name || 'D').charAt(0)}
      </div>
      <div className="relative flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-fredoka font-semibold text-sm truncate" style={{ color: C.ink }}>{d.name}</p>
          {isAssociated ? (
            <span className="text-[8px] font-nunito font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: `${C.teal}1f`, color: C.teal, border: `1px solid ${C.teal}44` }}
              data-testid="badge-ifc-associated">IFC</span>
          ) : (
            <span className="text-[8px] font-nunito font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: '#94A3B81f', color: '#64748B', border: '1px solid #94A3B844' }}
              data-testid="badge-external-provider"
              title="This provider is not associated with IFEELINCOLOR">External</span>
          )}
          {d.org_name && (
            <span className="text-[8px] font-nunito font-bold px-1.5 py-0.5 rounded-full shrink-0 inline-flex items-center gap-1"
              style={{ background: '#FB923C1f', color: '#c2410c', border: '1px solid #FB923C44' }}
              data-testid={`badge-org-${d.doctor_id}`}
              title={`Part of ${d.org_name}`}>
              <Building2 className="w-2.5 h-2.5" /> {d.org_name}
            </span>
          )}
        </div>
        {d.clinic_name && d.clinic_name !== d.name && (
          <p className="text-[10px] font-nunito truncate" style={{ color: '#9388B5' }}>{d.clinic_name}</p>
        )}
        <p className="text-[11px] font-nunito truncate" style={{ color: '#7B6A9C' }}>{d.specialty}</p>
        {d.address && (
          <p className="text-[10px] font-nunito truncate" style={{ color: '#9388B5' }} title={d.address}>{d.address}</p>
        )}
        <div className="flex items-center gap-2 text-[10px] mt-0.5">
          {d.rating != null && (
            <>
              <Star className="w-3 h-3 fill-current" style={{ color: C.amber }} />
              <span className="font-bold" style={{ color: C.ink }}>{d.rating}</span>
              <span className="text-slate-400">·</span>
            </>
          )}
          <span style={{ color: '#7B6A9C' }}>{d.distance_km ?? '—'} km</span>
          {d.open_now === true && <span className="text-emerald-500 font-bold">· Open now</span>}
        </div>
      </div>
      {isAssociated ? (
        <button
          data-testid={`subscribe-doctor-${d.doctor_id}`}
          onClick={(e) => { e.stopPropagation(); if (!isSubbed) onSubscribe(d); }}
          disabled={isSubbed}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 disabled:opacity-60"
          style={{
            background: isSubbed
              ? `linear-gradient(135deg, ${C.mint}, ${C.teal})`
              : `linear-gradient(135deg, ${C.rose}, ${C.tangerine})`,
            boxShadow: isSubbed ? `0 8px 18px -4px ${C.mint}77` : `0 8px 18px -4px ${C.rose}77`,
          }}
          title={isSubbed ? 'Already subscribed' : 'Subscribe to this clinician'}
        >
          {isSubbed ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      ) : (
        <button
          data-testid={`open-maps-${d.doctor_id}`}
          onClick={openMaps}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{
            background: 'linear-gradient(135deg, #64748B, #94A3B8)',
            boxShadow: '0 8px 18px -4px #94A3B877',
          }}
          title="Open in Google Maps · Not associated with IFEELINCOLOR"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}

export default function PatientHomeScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [nearby, setNearby] = useState([]);
  const [nearbyMeta, setNearbyMeta] = useState({ lat: null, lng: null, radius_km: 50, real_count: 0, google_count: 0 });
  const [searchCity, setSearchCity] = useState(null);  // {name, place_id, lat, lng}
  const [editingCity, setEditingCity] = useState(false);
  const nearbyRefRef = React.useRef(null);
  const [subscribed, setSubscribed] = useState([]);
  const [sub, setSub] = useState(null);
  const [doctorTab, setDoctorTab] = useState('nearby'); // nearby | subscribed
  const [modalDoctor, setModalDoctor] = useState(null);
  const [showCheckin, setShowCheckin] = useState(false);
  const [progress, setProgress] = useState({});
  const [showWelcome, setShowWelcome] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const refreshSubscribed = async () => {
    const r = await axios.get(`${API}/patient/doctors/subscribed`, { withCredentials: true });
    setSubscribed(r.data.doctors || []);
  };

  useEffect(() => {
    axios.get(`${API}/announcements/active`).then(r => setAnnouncements(r.data.announcements || [])).catch(() => {});
    axios.get(`${API}/me/subscription`, { withCredentials: true }).then(r => setSub(r.data)).catch(() => {});
    axios.get(`${API}/patient/progress`, { withCredentials: true }).then(r => setProgress(r.data.progress || {})).catch(() => {});
    refreshSubscribed();
    const fetchNearby = async (lat, lng, radius_km = 50) => {
      try {
        const r = await axios.get(`${API}/doctors/nearby`, { params: { lat, lng, radius_km } });
        const docs = r.data.doctors || [];
        setNearby(docs);
        setNearbyMeta({ lat, lng, radius_km, real_count: r.data.real_count, google_count: r.data.google_count });
        // If the initial 50km radius returns nothing, auto-expand to 250km so
        // patients in less-densely-covered areas still see some providers.
        if (docs.length === 0 && radius_km < 250) {
          fetchNearby(lat, lng, 250);
        }
      } catch { /* */ }
    };
    nearbyRefRef.current = fetchNearby;

    // Priority: pinned search_city > device GPS > saved profile address > NYC default.
    // The patient can override the GPS by pinning a city in Profile OR via the
    // inline chip on the home screen ("Searching near: …"). This is critical
    // for travellers, WFH patients and anyone whose phone's GPS doesn't match
    // where they actually want care.
    const loadInitial = async () => {
      try {
        const r = await axios.get(`${API}/patient/profile`, { withCredentials: true });
        const p = r.data?.profile || {};
        const sc = p.search_city;
        if (sc && typeof sc.lat === 'number' && typeof sc.lng === 'number') {
          setSearchCity(sc);
          fetchNearby(sc.lat, sc.lng);
          return;
        }
      } catch { /* fall through */ }
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => fetchNearby(pos.coords.latitude, pos.coords.longitude),
          async () => {
            // Geolocation denied/failed → try saved profile address coords
            try {
              const r = await axios.get(`${API}/patient/profile`, { withCredentials: true });
              const p = r.data?.profile || {};
              if (typeof p.lat === 'number' && typeof p.lng === 'number' && (p.lat !== 0 || p.lng !== 0)) {
                fetchNearby(p.lat, p.lng);
                return;
              }
            } catch { /* */ }
            fetchNearby(40.7128, -74.0060);
          },
          { timeout: 5000 },
        );
      } else fetchNearby(40.7128, -74.0060);
    };
    loadInitial();

    const onLocationUpdated = (e) => {
      const { lat, lng } = e.detail || {};
      if (typeof lat === 'number' && typeof lng === 'number') fetchNearby(lat, lng);
    };
    window.addEventListener('patient-location-updated', onLocationUpdated);
    return () => window.removeEventListener('patient-location-updated', onLocationUpdated);
  }, []);

  // Welcome popup logic:
  //   - Returning patient (all 3 categories completed) → show "Regular Check-in"
  //     popup with a big 3D animated button that mounts CheckInFlow directly.
  //   - First-time patient → show the 3-category onboarding popup.
  //   - Already dismissed this session → don't reshow.
  // Show the welcome popup at most ONCE per calendar day per device (instead
  // of once per session) so refreshes / coming back later today don't keep
  // disturbing the patient.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (localStorage.getItem('welcome_popup_last_shown') === today) return undefined;
    if (Object.keys(progress).length === 0) return undefined; // still loading
    const t = setTimeout(() => setShowWelcome(true), 600);
    return () => clearTimeout(t);
  }, [progress]);

  // True when the patient has finished onboarding (all 3 cats) → show
  // the Regular Check-in popup variant instead of the 3-category one.
  const isReturningPatient = (
    Object.keys(progress).length >= 3
    && Object.values(progress).every((p) => p?.completed)
  );

  const dismissWelcome = () => {
    if (typeof window !== 'undefined') {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('welcome_popup_last_shown', today);
    }
    setShowWelcome(false);
  };

  // Browser back button → close the popup instead of leaving the page.
  useEffect(() => {
    if (!showWelcome) return undefined;
    try { window.history.pushState({ ifcModal: 'welcome-popup' }, ''); } catch { /* ignore */ }
    const onPop = () => dismissWelcome();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWelcome]);

  // Stripe Checkout return — poll status to confirm doctor subscription
  useEffect(() => {
    const sid = searchParams.get('session_id');
    const status = searchParams.get('status');
    // Deep-link from Subscriptions page: ?doctorTab=nearby&plan_id=...
    // Open the doctors section and (optionally) bias the user toward picking
    // a clinician so the chosen plan can be applied during subscribe.
    const deepTab = searchParams.get('doctorTab');
    if (deepTab === 'nearby' || deepTab === 'subscribed') {
      setDoctorTab(deepTab);
      // Scroll to the doctors section so the user immediately sees the list
      setTimeout(() => {
        const el = document.querySelector('[data-testid="patient-doctors-section"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
      const next = new URLSearchParams(searchParams);
      next.delete('doctorTab');
      // Keep plan_id in the URL so the SubscribeModal can pre-select it once a doctor is tapped
      setSearchParams(next, { replace: true });
    }
    // Auto-open the Daily Check-in overlay when /app/home?checkin=1 (used by the History page's "Go to Daily Check-In" CTA).
    if (searchParams.get('checkin') === '1') {
      setShowCheckin(true);
      const next = new URLSearchParams(searchParams);
      next.delete('checkin');
      setSearchParams(next, { replace: true });
    }
    if (!sid && status !== 'cancelled') return undefined;
    if (status === 'cancelled') {
      setPaymentMsg('Payment was cancelled.');
      const t = setTimeout(() => setPaymentMsg(''), 3000);
      return () => clearTimeout(t);
    }
    let attempts = 0;
    const tick = async () => {
      try {
        const r = await axios.get(`${API}/payments/checkout/status/${sid}`, {
          params: { confirm: status === 'success' ? 1 : 0 },
          withCredentials: true,
        });
        if (r.data.payment_status === 'paid' && r.data.fulfilled) {
          setPaymentMsg(`Payment received · ${r.data.plan_name} activated.`);
          await refreshSubscribed();
          axios.get(`${API}/me/subscription`, { withCredentials: true }).then(rr => setSub(rr.data)).catch(() => {});
          setTimeout(() => setPaymentMsg(''), 4000);
          setSearchParams({});
          return;
        }
        if (r.data.status === 'expired' || r.data.status === 'cancelled') {
          setPaymentMsg('Payment was not completed.');
          setTimeout(() => setPaymentMsg(''), 3500);
          return;
        }
        if (attempts++ < 10) setTimeout(tick, 2000);
      } catch { if (attempts++ < 10) setTimeout(tick, 2000); }
    };
    setPaymentMsg('Confirming your payment with Stripe…');
    tick();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSubbed = (id) => subscribed.some(s => s.doctor_id === id);
  const first = user?.name?.split(' ')[0] || 'friend';

  return (
    <div className="px-5 pt-5 pb-6 relative" style={{
      background: `linear-gradient(180deg, #F3EEFF 0%, #EFF7FF 35%, #E6FBF5 70%, #FFF6E5 100%)`,
      minHeight: '100%',
    }}>
      {/* 3D bubbles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <Bubble3D size={130} color={C.bubblegum} top="2%" left="-8%" />
        <Bubble3D size={80} color={C.amber} top="22%" right="-6%" delay={1.2} />
        <Bubble3D size={70} color={C.mint} top="55%" left="80%" delay={0.6} />
        <Bubble3D size={90} color={C.violet} bottom="20%" left="-6%" delay={1.8} />
      </div>

      {/* Stripe payment status banner */}
      {paymentMsg && (
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          data-testid="payment-status-banner"
          className="relative mb-3 rounded-2xl p-3 text-sm font-nunito font-bold flex items-center gap-2"
          style={{
            background: paymentMsg.includes('received') ? 'linear-gradient(135deg, #22D67E, #06D6A0)' :
                        paymentMsg.includes('cancelled') || paymentMsg.includes('not completed') ? 'linear-gradient(135deg, #FF6B6B, #FF3B30)' :
                        'linear-gradient(135deg, #FFD23F, #FF8C3F)',
            color: 'white',
            boxShadow: '0 14px 28px -10px rgba(0,0,0,0.18)',
          }}>
          {paymentMsg.includes('Confirming') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span>{paymentMsg}</span>
        </motion.div>
      )}

      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative">
        <p className="text-xs font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: C.rose }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long' })}
        </p>
        <h1 className="font-fredoka font-semibold text-3xl leading-tight" style={{ color: C.ink }}>
          Hi {first}, you've got this <span className="inline-block animate-pulse">💗</span>
        </h1>
        <p className="text-sm font-nunito mt-1" style={{ color: '#5C4A85' }}>
          Small steps make big changes. Let's keep going.
        </p>
      </motion.div>

      {/* Subscription pill — 3D */}
      <motion.button
        data-testid="home-sub-pill"
        whileTap={{ scale: 0.97 }}
        whileHover={{ y: -2 }}
        onClick={() => navigate('/app/subscribe')}
        className="relative mt-5 w-full text-left rounded-2xl p-4 flex items-center gap-3 overflow-hidden"
        style={{
          background: sub?.active
            ? `linear-gradient(135deg, ${C.mint}, ${C.teal})`
            : `linear-gradient(135deg, ${C.rose}, ${C.tangerine}, ${C.amber})`,
          boxShadow: '0 18px 38px -10px rgba(31,17,71,0.25), inset 0 -4px 10px rgba(0,0,0,0.08)',
        }}
      >
        <motion.div
          animate={{ rotate: 360 }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-12 -right-12 w-40 h-40 rounded-full"
          style={{ background: 'conic-gradient(from 0deg, rgba(255,255,255,0.45), transparent 60%)' }}
        />
        <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center bg-white/25 backdrop-blur shrink-0">
          {sub?.active ? <Sparkles className="w-5 h-5 text-white" /> : <Heart className="w-5 h-5 text-white" />}
        </div>
        <div className="relative flex-1 min-w-0">
          <p className="text-white font-fredoka font-semibold text-base">
            {sub?.active ? sub.subscription?.plan_name : 'Unlock your full journey'}
          </p>
          <p className="text-white/85 text-xs font-nunito">
            {sub?.active
              ? `Active until ${(sub.subscription?.end_date || '').slice(0, 10)}`
              : 'Subscribe to start your assessments'}
          </p>
        </div>
        <ChevronRight className="relative w-5 h-5 text-white shrink-0" />
      </motion.button>

      {/* Quick links */}
      <div className="mt-4 grid grid-cols-4 gap-2 relative">
        {[
          { icon: ScanFace, label: 'Check-In', color: C.bubblegum, onClick: () => setShowCheckin(true), testid: 'quick-daily-checkin', tip: FEATURE_TIPS.patient_quick_checkin },
          { icon: BookOpen, label: 'Recs', color: C.violet, onClick: () => navigate('/app/recommendations'), testid: 'quick-recommendations', tip: FEATURE_TIPS.patient_quick_recs },
          { icon: Sparkles, label: 'Assess', color: C.rose, onClick: () => navigate('/app/assessment'), testid: 'quick-assessment', tip: FEATURE_TIPS.patient_quick_assess },
          { icon: History, label: 'History', color: C.teal || '#22D3C5', onClick: () => navigate('/app/history'), testid: 'quick-history', tip: FEATURE_TIPS.patient_quick_history },
        ].map((q, i) => (
          <motion.button
            key={i}
            data-testid={q.testid}
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -3 }}
            onClick={q.onClick}
            className="rounded-2xl p-2.5 text-center relative"
            style={{
              background: 'white',
              boxShadow: `0 10px 22px -10px ${q.color}66`,
            }}
          >
            <InfoTip text={q.tip} variant="corner" color={q.color} size={11} testid={`${q.testid}-info`} />
            <div className="w-9 h-9 mx-auto rounded-xl flex items-center justify-center mb-1"
              style={{ background: `${q.color}1a` }}>
              <q.icon className="w-4.5 h-4.5" style={{ color: q.color, width: 18, height: 18 }} />
            </div>
            <p className="text-[9px] font-fredoka font-semibold" style={{ color: C.ink }}>{q.label}</p>
          </motion.button>
        ))}
      </div>

      {/* Announcements */}
      <section className="mt-6 relative">
        <p className="text-xs font-nunito font-bold uppercase tracking-widest mb-2" style={{ color: '#9785B5' }}>
          Announcements
        </p>
        {announcements.length === 0 ? (
          <div className="rounded-2xl p-4 text-center text-xs font-nunito"
            style={{ background: 'rgba(255,255,255,0.7)', color: '#9785B5', border: '1px dashed rgba(255,61,138,0.2)' }}>
            <Megaphone className="w-4 h-4 mx-auto mb-1" style={{ color: C.rose }} />
            No announcements yet. We'll let you know.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
            {announcements.map((a, i) => (
              <motion.div
                key={a.announcement_id || i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="snap-start shrink-0 w-72 rounded-2xl p-4"
                style={{
                  background: `linear-gradient(135deg, ${C.violet}, ${C.bubblegum})`,
                  boxShadow: `0 14px 30px -10px ${C.violet}66`,
                }}
              >
                <Megaphone className="w-4 h-4 text-white/80 mb-2" />
                <p className="font-fredoka font-semibold text-base text-white mb-1">{a.title}</p>
                <p className="text-xs font-nunito text-white/85 line-clamp-3">{a.message || a.body}</p>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Doctors with horizontal tabs */}
      <section className="mt-6 relative" data-testid="patient-doctors-section">
        {/* Pinned city chip / inline picker — Priority #1 in fetchNearby() */}
        <div className="mb-3" data-testid="searching-near-chip">
          {!editingCity ? (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 rounded-full pl-3 pr-1 py-1.5 text-xs"
                style={{ background: `${C.violet}1A`, border: `1px solid ${C.violet}55`, color: C.ink }}>
                <MapPin className="w-3.5 h-3.5" style={{ color: C.violet }} />
                <span className="font-nunito font-semibold truncate max-w-[200px]">
                  Searching near: <span style={{ color: C.violet }}>{searchCity?.name || 'your current location'}</span>
                </span>
                <button type="button" onClick={() => setEditingCity(true)}
                  data-testid="searching-near-change"
                  className="text-[10px] font-bold underline px-2 py-1 rounded-full"
                  style={{ color: C.violet }}>
                  change
                </button>
                {searchCity && (
                  <button type="button"
                    onClick={async () => {
                      await axios.put(`${API}/patient/profile`, { search_city_clear: true }, { withCredentials: true });
                      setSearchCity(null);
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          pos => nearbyRefRef.current?.(pos.coords.latitude, pos.coords.longitude),
                          () => nearbyRefRef.current?.(40.7128, -74.0060),
                          { timeout: 5000 },
                        );
                      }
                    }}
                    data-testid="searching-near-clear"
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ color: C.violet }}
                    aria-label="clear pinned city">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <PlacesAutocomplete
              value={null}
              placeholder="Type a city — e.g. Hyderabad, Mumbai, NYC…"
              accent={C.violet}
              testid="home-city-picker"
              onPick={async (place) => {
                try {
                  await axios.put(`${API}/patient/profile`, { search_city: place }, { withCredentials: true });
                  setSearchCity(place);
                  setEditingCity(false);
                  nearbyRefRef.current?.(place.lat, place.lng);
                } catch { /* */ }
              }}
              onClear={() => setEditingCity(false)}
            />
          )}
        </div>

        <div className="flex items-center gap-2 mb-3">
          {[
            { key: 'nearby', label: 'Nearby Doctors', count: nearby.length },
            { key: 'subscribed', label: 'My Subscribed', count: subscribed.length },
          ].map(t => {
            const active = doctorTab === t.key;
            return (
              <button
                key={t.key}
                data-testid={`doc-tab-${t.key}`}
                onClick={() => setDoctorTab(t.key)}
                className="flex-1 rounded-2xl px-3 py-2.5 font-nunito font-bold text-xs transition-all relative"
                style={{
                  background: active ? `linear-gradient(135deg, ${C.rose}, ${C.tangerine})` : 'rgba(255,255,255,0.7)',
                  color: active ? 'white' : C.ink,
                  boxShadow: active ? `0 12px 24px -8px ${C.rose}66` : 'none',
                }}
              >
                {t.label}
                <span className="ml-1.5 text-[10px] opacity-80">({t.count})</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={doctorTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-2.5"
          >
            {doctorTab === 'nearby' && (
              nearby.length === 0 ? (
                <div className="rounded-2xl p-6 text-center text-xs font-nunito text-slate-500"
                  style={{ background: 'rgba(255,255,255,0.7)' }} data-testid="nearby-empty">
                  <MapPin className="w-5 h-5 mx-auto mb-2 text-slate-400" />
                  <p className="mb-3">No real providers found within {nearbyMeta.radius_km || 50}&nbsp;km of you yet.</p>
                  {nearbyMeta.radius_km < 500 && (
                    <button
                      data-testid="nearby-expand-radius"
                      onClick={() => {
                        if (nearbyMeta.lat != null && nearbyMeta.lng != null && nearbyRefRef.current) {
                          const next = Math.min(500, (nearbyMeta.radius_km || 50) * 2);
                          nearbyRefRef.current(nearbyMeta.lat, nearbyMeta.lng, next);
                        }
                      }}
                      className="rounded-full px-4 py-2 text-xs font-nunito font-bold text-white inline-flex items-center gap-1.5"
                      style={{ background: `linear-gradient(135deg, ${C.coral}, ${C.tangerine})`, boxShadow: `0 8px 18px -6px ${C.coral}88` }}
                    >
                      <MapPin className="w-3 h-3" /> Try wider search ({Math.min(500, (nearbyMeta.radius_km || 50) * 2)} km)
                    </button>
                  )}
                  <p className="text-[10px] text-slate-400 mt-3">Tip: set your location in Profile so we can find providers closer to you.</p>
                </div>
              ) : (
                <>
                  {/* Legend explaining the IFC / External badges */}
                  <div className="rounded-xl px-3 py-2 mb-1 text-[10px] font-nunito flex items-center gap-3 flex-wrap"
                    style={{ background: 'rgba(255,255,255,0.65)', border: '1px dashed rgba(123,106,156,0.25)' }}
                    data-testid="nearby-legend">
                    <span className="flex items-center gap-1" style={{ color: C.teal }}>
                      <span className="px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${C.teal}1f`, border: `1px solid ${C.teal}44` }}>IFC</span>
                      Associated with IFEELINCOLOR
                    </span>
                    <span className="flex items-center gap-1" style={{ color: '#64748B' }}>
                      <span className="px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#94A3B81f', border: '1px solid #94A3B844' }}>External</span>
                      Real provider from Google Maps · not associated with IFEELINCOLOR
                    </span>
                  </div>
                  {nearby.map(d => (
                    <DoctorCard key={d.doctor_id} d={d} isSubbed={isSubbed(d.doctor_id)} onSubscribe={setModalDoctor} />
                  ))}
                </>
              )
            )}
            {doctorTab === 'subscribed' && (
              subscribed.length === 0 ? (
                <div className="rounded-2xl p-6 text-center text-xs font-nunito"
                  style={{ background: 'rgba(255,255,255,0.7)', color: '#9785B5', border: '1px dashed rgba(34,211,197,0.3)' }}>
                  <LockIcon className="w-4 h-4 mx-auto mb-1" style={{ color: C.teal }} />
                  Subscribe to a doctor to start your care team.
                </div>
              ) : (
                subscribed.map(d => (
                  <div key={d.doctor_id} className="rounded-2xl p-3 flex items-center gap-3"
                    style={{ background: 'white', boxShadow: `0 10px 22px -10px ${d.avatar_color || C.sky}55` }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold"
                      style={{ background: d.avatar_color || C.sky }}>
                      {(d.name || 'D').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-fredoka font-semibold text-sm truncate" style={{ color: C.ink }}>{d.name}</p>
                      <p className="text-[11px] font-nunito truncate" style={{ color: '#7B6A9C' }}>{d.specialty}</p>
                      {d.plan_name && (
                        <span className="inline-block mt-0.5 text-[9px] font-nunito font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${C.mint}1a`, color: C.mint }}>
                          {d.plan_name} · ${d.amount_paid_usd}
                        </span>
                      )}
                    </div>
                    <Check className="w-5 h-5" style={{ color: C.mint }} />
                  </div>
                ))
              )
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* Emergency CTA removed from Home — accessible via top-right Emergency button in header and after assessment completion */}

      <AnimatePresence>
        {modalDoctor && (
          <SubscribeModal
            doctor={modalDoctor}
            onClose={() => setModalDoctor(null)}
            onSuccess={async () => { await refreshSubscribed(); setModalDoctor(null); setDoctorTab('subscribed'); }}
          />
        )}
      </AnimatePresence>

      {/* 9-Step Daily Check-In overlay */}
      <AnimatePresence>
        {showCheckin && (
          <motion.div
            data-testid="checkin-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto"
            style={{ background: 'linear-gradient(180deg, #0D0D11 0%, #1A1A24 100%)' }}
          >
            <CheckInFlow onClose={() => setShowCheckin(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Welcome Popup — guide user to start their 3-category assessment */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            data-testid="welcome-popup"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-5"
            style={{ background: 'rgba(31,17,71,0.55)', backdropFilter: 'blur(8px)' }}
            onClick={dismissWelcome}>
            <motion.div
              initial={{ scale: 0.85, y: 60, rotateX: -20 }} animate={{ scale: 1, y: 0, rotateX: 0 }} exit={{ scale: 0.9, y: 30 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl relative overflow-hidden"
              style={{
                background: `linear-gradient(140deg, ${C.cream} 0%, #FFF 60%, #F3EEFF 100%)`,
                boxShadow: '0 40px 80px -20px rgba(31,17,71,0.45), 0 16px 30px -12px rgba(255,61,138,0.35)',
                transformStyle: 'preserve-3d',
              }}>
              {/* Floating 3D orbs */}
              <motion.div animate={{ y: [0, -10, 0], rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity }}
                className="absolute -top-6 -right-6 w-24 h-24 rounded-full"
                style={{ background: `radial-gradient(circle at 30% 30%, ${C.coral} 0%, ${C.rose} 60%, transparent 80%)`, filter: 'blur(2px)' }} />
              <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity }}
                className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full"
                style={{ background: `radial-gradient(circle at 70% 30%, ${C.teal} 0%, ${C.sky} 60%, transparent 80%)`, filter: 'blur(3px)' }} />
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full pointer-events-none opacity-20"
                style={{ background: `conic-gradient(from 0deg, ${C.rose}, ${C.amber}, ${C.mint}, ${C.violet}, ${C.rose})` }} />

              {/* Close X */}
              <button data-testid="welcome-close" onClick={dismissWelcome}
                className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center z-10"
                style={{ background: 'rgba(31,17,71,0.08)', color: C.ink }}>
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Content */}
              <div className="relative px-6 pt-8 pb-6 text-center">
                {isReturningPatient ? (
                  /* ── Returning-patient variant: big 3D Regular Check-in button ── */
                  <>
                    <motion.div
                      animate={{ y: [0, -6, 0], rotate: [-3, 3, -3] }} transition={{ duration: 4, repeat: Infinity }}
                      className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center relative"
                      style={{
                        background: `linear-gradient(135deg, ${C.violet}, ${C.bubblegum}, ${C.rose})`,
                        boxShadow: `0 20px 36px -10px ${C.bubblegum}88, inset 0 -6px 12px rgba(0,0,0,0.18), inset 0 4px 10px rgba(255,255,255,0.45)`,
                        transform: 'perspective(400px) rotateX(8deg)',
                      }}>
                      <Sparkles className="w-10 h-10 text-white drop-shadow" />
                    </motion.div>
                    <p className="mt-4 text-[10px] font-nunito font-bold uppercase tracking-widest" style={{ color: C.bubblegum }}>
                      Welcome back, {first}
                    </p>
                    <h2 className="font-fredoka font-semibold text-2xl mt-1" style={{ color: C.ink }}>
                      Ready for your Regular Check-in?
                    </h2>
                    <p className="text-sm font-nunito mt-2" style={{ color: '#6B5784' }}>
                      It takes ~2 minutes. Tap the orb to head straight into the 3D Body Map.
                    </p>

                    <motion.button
                      data-testid="welcome-start-regular-checkin"
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                      onClick={() => { dismissWelcome(); setShowCheckin(true); }}
                      className="mt-6 mx-auto inline-flex items-center justify-center w-36 h-36 rounded-full text-white font-fredoka font-bold relative"
                      style={{
                        background: `radial-gradient(circle at 30% 25%, #ffffff44, transparent 55%), conic-gradient(from 220deg, ${C.rose}, ${C.bubblegum}, ${C.violet}, ${C.teal}, ${C.rose})`,
                        boxShadow: `0 26px 60px -16px ${C.bubblegum}aa, 0 0 0 6px rgba(255,255,255,0.55) inset`,
                        transformStyle: 'preserve-3d',
                      }}>
                      <span className="absolute inset-3 rounded-full pointer-events-none"
                        style={{ background: 'radial-gradient(circle at 38% 28%, rgba(255,255,255,0.9), rgba(255,255,255,0) 55%)' }} />
                      <span className="relative flex flex-col items-center leading-tight">
                        <Sparkles className="w-7 h-7 mb-1" />
                        <span className="text-base">Regular</span>
                        <span className="text-base -mt-1">Check-in</span>
                      </span>
                    </motion.button>

                    <button data-testid="welcome-later" onClick={dismissWelcome}
                      className="mt-5 text-[11px] font-nunito font-bold" style={{ color: '#8F84A8' }}>
                      Maybe later
                    </button>
                  </>
                ) : (
                  /* ── First-time variant: 3-category onboarding ── */
                  <>
                    {/* 3D Hero badge */}
                    <motion.div
                      animate={{ y: [0, -6, 0], rotate: [-3, 3, -3] }} transition={{ duration: 4, repeat: Infinity }}
                      className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center relative"
                      style={{
                        background: `linear-gradient(135deg, ${C.rose}, ${C.tangerine}, ${C.amber})`,
                        boxShadow: `0 20px 36px -10px ${C.rose}88, inset 0 -6px 12px rgba(0,0,0,0.18), inset 0 4px 10px rgba(255,255,255,0.45)`,
                        transform: 'perspective(400px) rotateX(8deg)',
                      }}>
                      <Sparkles className="w-10 h-10 text-white drop-shadow" />
                    </motion.div>

                    <p className="mt-4 text-[10px] font-nunito font-bold uppercase tracking-widest" style={{ color: C.rose }}>
                      Welcome, {first}!
                    </p>
                    <h2 className="font-fredoka font-semibold text-2xl mt-1" style={{ color: C.ink }}>
                      Your wellness journey begins.
                    </h2>
                    <p className="text-sm font-nunito mt-2" style={{ color: '#6B5784' }}>
                      Complete a quick <strong>3-category assessment</strong> so we can personalise your care:
                    </p>

                    {/* 3 mini step bubbles */}
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        { label: 'Treatment History', color: C.coral, icon: '①' },
                        { label: 'Health & Social', color: C.teal, icon: '②' },
                        { label: 'Assessment', color: C.violet, icon: '③' },
                      ].map((s, i) => (
                        <motion.div key={s.label}
                          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.1 }}
                          className="rounded-2xl px-2 py-2.5 text-center"
                          style={{ background: 'white', boxShadow: `0 10px 20px -10px ${s.color}66`, border: `1px solid ${s.color}22` }}>
                          <div className="w-7 h-7 mx-auto rounded-xl mb-1 flex items-center justify-center text-white font-bold text-xs"
                            style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}aa)`, boxShadow: `0 6px 12px -4px ${s.color}88` }}>
                            {s.icon}
                          </div>
                          <p className="text-[10px] font-fredoka font-semibold leading-tight" style={{ color: C.ink }}>{s.label}</p>
                        </motion.div>
                      ))}
                    </div>

                    {/* CTA */}
                    <motion.button
                      data-testid="welcome-start-assessment"
                      whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                      onClick={() => { dismissWelcome(); navigate('/app/assessment'); }}
                      className="mt-5 w-full rounded-2xl py-3.5 text-sm font-nunito font-bold text-white relative overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${C.rose}, ${C.tangerine})`,
                        boxShadow: `0 18px 36px -10px ${C.rose}aa, inset 0 -4px 10px rgba(0,0,0,0.15)`,
                      }}>
                      <Sparkles className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                      Start 3-Category Assessment
                    </motion.button>

                    <button data-testid="welcome-later" onClick={dismissWelcome}
                      className="mt-2.5 text-[11px] font-nunito font-bold" style={{ color: '#8F84A8' }}>
                      Maybe later
                    </button>
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
