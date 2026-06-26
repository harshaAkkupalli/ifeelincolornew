import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Camera, Save, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { BRAND } from '../../brand';
import PlacesAutocomplete from '../../components/places/PlacesAutocomplete';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PatientProfile() {
  const { user, updateUser } = useAuth();
  const [prof, setProf] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [picPreview, setPicPreview] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    axios.get(`${API}/patient/profile`, { withCredentials: true }).then(r => {
      setProf(r.data.profile);
      setForm({
        name: r.data.profile?.name || '',
        mobile: r.data.profile?.mobile || '',
        dob: r.data.profile?.dob || '',
        address: r.data.profile?.address || '',
        bio: r.data.profile?.bio || '',
        emergency_contact_name: r.data.profile?.emergency_contact_name || '',
        emergency_contact_phone: r.data.profile?.emergency_contact_phone || '',
      });
      setPicPreview(r.data.profile?.picture || '');
    }).catch(() => {});
  }, []);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPicPreview(ev.target.result);
      setForm({ ...form, picture: ev.target.result });
    };
    reader.readAsDataURL(f);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await axios.put(`${API}/patient/profile`, form, { withCredentials: true });
      setProf(r.data.profile);
      if (updateUser) updateUser(r.data.profile);
      // Broadcast so the Home screen refreshes Nearby Doctors against the new coords.
      const lat = r.data.profile?.lat;
      const lng = r.data.profile?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        window.dispatchEvent(new CustomEvent('patient-location-updated', { detail: { lat, lng } }));
      }
    } finally { setSaving(false); }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setForm((f) => ({ ...f, lat, lng }));
      // Persist immediately so Nearby Doctors updates without waiting for "Save".
      axios.put(`${API}/patient/profile`, { lat, lng }, { withCredentials: true })
        .then((r) => {
          setProf(r.data.profile);
          window.dispatchEvent(new CustomEvent('patient-location-updated', { detail: { lat, lng } }));
        })
        .catch(() => {});
    });
  };

  return (
    <div className="px-5 pt-5 pb-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" data-testid="pic-input" />
        <button onClick={() => fileRef.current?.click()} className="relative inline-block group">
          <div className="w-24 h-24 rounded-3xl mx-auto flex items-center justify-center text-white text-4xl font-fredoka font-bold overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})`, boxShadow: `0 16px 32px -10px ${BRAND.pink}66` }}>
            {picPreview ? <img src={picPreview} alt="" className="w-full h-full object-cover" /> : (user?.name?.charAt(0) || 'P')}
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow"
            style={{ border: `2px solid ${BRAND.pink}` }}>
            <Camera className="w-4 h-4" style={{ color: BRAND.pink }} />
          </div>
        </button>
        <h1 className="font-fredoka font-semibold text-2xl mt-4" style={{ color: '#2A1A4A' }}>{form.name || 'Your name'}</h1>
        <p className="text-xs font-nunito text-slate-500">{prof?.email}</p>
      </motion.div>

      <div className="mt-6 space-y-3 rounded-3xl p-4" style={{ background: 'white', boxShadow: '0 12px 28px -14px rgba(26,35,50,0.1)' }}>
        {[
          { k: 'name', label: 'Full Name', type: 'text' },
          { k: 'mobile', label: 'Mobile', type: 'tel' },
          { k: 'dob', label: 'Date of Birth', type: 'date' },
          { k: 'address', label: 'Address', type: 'text' },
        ].map(f => (
          <div key={f.k}>
            <label className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-1 block" style={{ color: '#8F84A8' }}>
              {f.label}
            </label>
            <input
              data-testid={`profile-${f.k}`}
              type={f.type}
              value={form[f.k] || ''}
              onChange={e => setForm({ ...form, [f.k]: e.target.value })}
              className="w-full rounded-xl p-3 text-sm font-nunito bg-pink-50/40 outline-none"
            />
          </div>
        ))}

        <div>
          <label className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-1 block" style={{ color: '#8F84A8' }}>
            About me
          </label>
          <textarea
            value={form.bio || ''}
            onChange={e => setForm({ ...form, bio: e.target.value })}
            rows={3}
            placeholder="Anything you'd like us to know..."
            className="w-full rounded-xl p-3 text-sm font-nunito bg-pink-50/40 outline-none resize-none"
          />
        </div>

        <Button
          data-testid="detect-location-btn"
          onClick={detectLocation}
          variant="outline"
          className="w-full rounded-xl h-10 font-nunito font-bold text-xs"
          style={{ borderColor: BRAND.pink, color: BRAND.pink }}
        >
          <MapPin className="w-3.5 h-3.5 mr-1.5" />
          {form.lat ? `Location set (${form.lat.toFixed(3)}, ${form.lng.toFixed(3)})` : 'Use my location'}
        </Button>
        <p className="text-[10px] font-nunito mt-1.5 text-center" style={{ color: '#8F84A8' }}>
          Updating your location auto-refreshes Nearby Doctors on Home.
        </p>

        {/* Pinned search city — overrides device GPS for Nearby Doctors */}
        <div className="mt-4 pt-4 border-t border-pink-100">
          <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-2" style={{ color: BRAND.pink }}>
            Pinned search city
          </p>
          <p className="text-[11px] font-nunito mb-2" style={{ color: '#8F84A8' }}>
            Always search providers near this city instead of your phone's GPS. Useful for travellers and remote workers.
          </p>
          <PlacesAutocomplete
            value={prof?.search_city?.name || null}
            accent={BRAND.pink}
            testid="profile-city-picker"
            placeholder="Type a city — e.g. Hyderabad, Mumbai…"
            onPick={async (place) => {
              try {
                const r = await axios.put(`${API}/patient/profile`, { search_city: place }, { withCredentials: true });
                setProf(r.data.profile);
              } catch { /* */ }
            }}
            onClear={async () => {
              try {
                const r = await axios.put(`${API}/patient/profile`, { search_city_clear: true }, { withCredentials: true });
                setProf(r.data.profile);
              } catch { /* */ }
            }}
          />
        </div>
      </div>

      <div className="mt-4 rounded-3xl p-4" style={{ background: 'white', boxShadow: '0 12px 28px -14px rgba(26,35,50,0.1)' }}>
        <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-3" style={{ color: BRAND.pink }}>
          Emergency Contact
        </p>
        <input
          data-testid="emergency-name"
          value={form.emergency_contact_name || ''}
          onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })}
          placeholder="Name"
          className="w-full rounded-xl p-3 text-sm font-nunito bg-pink-50/40 outline-none mb-2"
        />
        <input
          data-testid="emergency-phone"
          value={form.emergency_contact_phone || ''}
          onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })}
          placeholder="Phone"
          className="w-full rounded-xl p-3 text-sm font-nunito bg-pink-50/40 outline-none"
        />
      </div>

      <Button
        data-testid="save-profile-btn"
        onClick={save}
        disabled={saving}
        className="mt-5 w-full rounded-2xl h-12 font-nunito font-bold text-white border-0"
        style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}
      >
        <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}
