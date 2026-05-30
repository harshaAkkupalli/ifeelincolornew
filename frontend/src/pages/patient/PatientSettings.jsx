import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Bell, Camera, LogOut, Shield, MessageCircle, ChevronRight, Brain } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { BRAND } from '../../brand';
import { useNeuroInclusive } from '../../contexts/NeuroInclusiveContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function Row({ icon: Icon, color, label, value, onClick, danger }) {
  return (
    <button
      data-testid={`settings-${label.toLowerCase().replace(/\s+/g, '-')}`}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-pink-50/40 transition rounded-xl"
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}1a`, color }}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="flex-1 text-left text-sm font-nunito font-semibold" style={{ color: danger ? '#DC2626' : '#2A1A4A' }}>
        {label}
      </span>
      {value && <span className="text-xs font-nunito text-slate-400">{value}</span>}
      <ChevronRight className="w-4 h-4 text-slate-300" />
    </button>
  );
}

export default function PatientSettings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [prof, setProf] = useState(null);
  const { isLowStimulusMode, toggle: toggleLowStim } = useNeuroInclusive();

  useEffect(() => {
    axios.get(`${API}/patient/profile`, { withCredentials: true }).then(r => setProf(r.data.profile)).catch(() => {});
  }, []);

  const toggleNotif = async () => {
    const next = !prof?.notifications_enabled;
    await axios.put(`${API}/patient/profile`, { notifications_enabled: next }, { withCredentials: true });
    setProf({ ...prof, notifications_enabled: next });
  };

  return (
    <div className="px-5 pt-5 pb-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.pink }}>
          Settings
        </p>
        <h1 className="font-fredoka font-semibold text-3xl" style={{ color: '#2A1A4A' }}>
          Make it yours.
        </h1>
      </motion.div>

      {/* Notification toggle card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="mt-6 rounded-3xl p-4"
        style={{ background: 'white', boxShadow: '0 12px 28px -14px rgba(26,35,50,0.1)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})`, boxShadow: `0 10px 22px -6px ${BRAND.pink}66` }}>
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-fredoka font-semibold" style={{ color: '#2A1A4A' }}>Notifications</p>
            <p className="text-[11px] font-nunito text-slate-500">Reminders & check-in nudges</p>
          </div>
          <button
            data-testid="notif-toggle"
            onClick={toggleNotif}
            className="w-12 h-7 rounded-full p-0.5 transition-colors"
            style={{ background: prof?.notifications_enabled ? BRAND.green : '#E5E7EB' }}
          >
            <motion.div
              animate={{ x: prof?.notifications_enabled ? 20 : 0 }}
              className="w-6 h-6 rounded-full bg-white shadow"
            />
          </button>
        </div>
      </motion.div>

      {/* Neuro-Inclusive (Low Stimulus) Mode toggle */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}
        className="mt-4 rounded-3xl p-4"
        style={{ background: 'white', boxShadow: '0 12px 28px -14px rgba(26,35,50,0.1)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #8FA6C6, #92B8B0)', boxShadow: '0 10px 22px -6px #8FA6C666' }}>
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-fredoka font-semibold" style={{ color: '#2A1A4A' }}>Calm Mode</p>
            <p className="text-[11px] font-nunito text-slate-500">
              Matte pastels, linear feelings wheel, breathing orb, and text-to-speech for every prompt
            </p>
          </div>
          <button
            data-testid="low-stim-toggle"
            onClick={toggleLowStim}
            aria-pressed={isLowStimulusMode}
            className="w-12 h-7 rounded-full p-0.5 transition-colors shrink-0"
            style={{ background: isLowStimulusMode ? '#8FA6C6' : '#E5E7EB' }}
          >
            <motion.div
              animate={{ x: isLowStimulusMode ? 20 : 0 }}
              className="w-6 h-6 rounded-full bg-white shadow"
            />
          </button>
        </div>
      </motion.div>

      {/* Menu list */}
      <div className="mt-5 rounded-3xl p-2" style={{ background: 'white', boxShadow: '0 12px 28px -16px rgba(26,35,50,0.08)' }}>
        <Row icon={Camera} color={BRAND.pink} label="Edit Profile" onClick={() => navigate('/app/profile')} />
        <Row icon={Shield} color="#A78BFA" label="Privacy & Data" onClick={() => {}} />
        <Row icon={MessageCircle} color={BRAND.orange} label="Contact Support" onClick={() => {}} />
      </div>

      <Button
        data-testid="settings-logout"
        onClick={async () => { await logout(); navigate('/mobile-home?role=patient'); }}
        variant="outline"
        className="mt-5 w-full rounded-2xl h-12 font-nunito font-bold border-2"
        style={{ borderColor: '#FEE2E2', color: '#DC2626', background: 'rgba(254,226,226,0.4)' }}
      >
        <LogOut className="w-4 h-4 mr-2" /> Sign Out
      </Button>
    </div>
  );
}
