import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import { AlertOctagon, Phone, MapPin, Shield, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { BRAND } from '../../brand';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PatientEmergency() {
  const navigate = useNavigate();
  const [dispatched, setDispatched] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const trigger = async () => {
    setLoading(true);
    setError('');
    const triggerWith = (lat, lng) => {
      axios.post(`${API}/patient/emergency`, { severity: 'critical', lat, lng }, { withCredentials: true })
        .then(r => setDispatched(r.data))
        .catch(e => setError(e.response?.data?.detail || 'Could not dispatch. Please call 911 directly.'))
        .finally(() => setLoading(false));
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => triggerWith(pos.coords.latitude, pos.coords.longitude),
        () => triggerWith(40.7128, -74.0060),
        { timeout: 4000 },
      );
    } else triggerWith(40.7128, -74.0060);
  };

  if (dispatched) {
    return (
      <div className="px-5 pt-8 pb-6 text-center">
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
          className="w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(135deg, #22D67E, #34D399)', boxShadow: '0 16px 40px rgba(34,214,126,0.6)' }}
        >
          <Shield className="w-12 h-12 text-white" />
        </motion.div>
        <h1 className="font-fredoka font-semibold text-2xl mb-2" style={{ color: '#2A1A4A' }}>Help is on the way</h1>
        <p className="text-sm font-nunito mb-6 max-w-xs mx-auto" style={{ color: '#6B5784' }}>
          {dispatched.message}
        </p>

        <div className="rounded-3xl p-4 mb-4 text-left" style={{ background: 'white', boxShadow: '0 16px 38px -16px rgba(26,35,50,0.15)' }}>
          <p className="text-[11px] font-nunito font-bold uppercase tracking-widest mb-3" style={{ color: BRAND.pink }}>
            Notified
          </p>
          {dispatched.dispatched?.doctors?.map((d, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: '#F4EEF7' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${BRAND.pink}1a`, color: BRAND.pink }}>
                <Phone className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-fredoka font-semibold text-sm" style={{ color: '#2A1A4A' }}>{d.name}</p>
                <p className="text-[11px] font-nunito text-slate-500">{d.specialty} · {d.phone}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#FEE2E2', color: '#DC2626' }}>
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-fredoka font-semibold text-sm" style={{ color: '#2A1A4A' }}>{dispatched.dispatched?.police?.name}</p>
              <p className="text-[11px] font-nunito text-slate-500">
                <MapPin className="inline w-3 h-3 mr-0.5" /> {dispatched.dispatched?.police?.address}
              </p>
            </div>
          </div>
        </div>

        <Button
          data-testid="emergency-home-btn"
          onClick={() => navigate('/app/home')}
          className="w-full rounded-2xl h-12 font-nunito font-bold text-white border-0"
          style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}
        >
          Back to safety
        </Button>
        <p className="mt-4 text-[10px] font-nunito" style={{ color: '#A599B8' }}>
          This is a simulated dispatch. For real emergencies, dial 911 immediately.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-5 pb-6">
      <button onClick={() => navigate(-1)} className="p-2 -ml-2 mb-3" data-testid="back-btn">
        <ArrowLeft className="w-5 h-5 text-slate-400" />
      </button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-fredoka font-semibold text-3xl" style={{ color: '#2A1A4A' }}>
          Need help right now?
        </h1>
        <p className="text-sm font-nunito mt-1" style={{ color: '#6B5784' }}>
          Tap the button below. We'll alert your care team and the nearest support immediately.
        </p>
      </motion.div>

      <div className="mt-12 flex flex-col items-center">
        <motion.button
          data-testid="emergency-trigger-btn"
          whileTap={{ scale: 0.92 }}
          onClick={trigger}
          disabled={loading}
          className="relative w-56 h-56 rounded-full flex flex-col items-center justify-center text-white"
          style={{
            background: 'radial-gradient(circle at 30% 30%, #FF6B6B, #DC2626)',
            boxShadow: '0 24px 60px -10px rgba(220,38,38,0.7), inset 0 -10px 30px rgba(0,0,0,0.2)',
          }}
        >
          {/* Pulsing rings */}
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full"
              style={{ border: '3px solid rgba(220,38,38,0.5)' }}
              animate={{ scale: [1, 1.6, 1.6], opacity: [0.7, 0, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
            />
          ))}
          <AlertOctagon className="w-16 h-16 mb-2" />
          <span className="font-fredoka font-bold text-2xl">
            {loading ? 'Dispatching...' : 'EMERGENCY'}
          </span>
          <span className="text-[11px] font-nunito mt-1 opacity-90">Tap to alert care team</span>
        </motion.button>

        {error && <p className="mt-4 text-sm font-nunito text-red-500">{error}</p>}

        <p className="mt-8 text-center text-[11px] font-nunito max-w-xs" style={{ color: '#A599B8' }}>
          You'll be connected to your two nearest doctors and a local support contact. Stay where you are.
        </p>
      </div>
    </div>
  );
}
