import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import {
  LogOut, User, Shield, Stethoscope, MessageCircle, CreditCard, Bell,
  Camera, Check, Lock, Eye, EyeOff, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TEAL_LIGHT = '#2FA37A';
const TEAL = '#1F6F54';

export default function ClinicianSettingsMobile() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile'); // profile | notifications
  const [toast, setToast] = useState('');
  // Profile
  const [name, setName] = useState('');
  const [picture, setPicture] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  // Notification prefs
  const [prefs, setPrefs] = useState({
    new_patient_signup: true,
    emergency_alerts: true,
    patient_message: true,
    weekly_digest: true,
    rec_progress: true,
    revenue_summary: false,
  });

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPicture(user.picture || user.avatar_url || '');
    }
    // Try to load saved prefs
    axios.get(`${API}/me/notification-prefs`, { withCredentials: true })
      .then(r => r.data?.prefs && setPrefs(p => ({ ...p, ...r.data.prefs })))
      .catch(() => {});
  }, [user]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const onPickFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPicture(ev.target.result);
    reader.readAsDataURL(f);
  };

  const saveProfile = async () => {
    if (!name.trim()) { showToast('Name required'); return; }
    setSavingProfile(true);
    try {
      await axios.put(`${API}/me`, { name, picture }, { withCredentials: true });
      updateUser({ ...user, name, picture });
      showToast('Profile updated');
    } catch (e) {
      showToast(e.response?.data?.detail || 'Update failed');
    } finally { setSavingProfile(false); }
  };

  const changePassword = async () => {
    if (!currentPw || !newPw) { showToast('Fill both passwords'); return; }
    if (newPw !== confirmPw) { showToast('Passwords do not match'); return; }
    if (newPw.length < 6) { showToast('Min 6 characters'); return; }
    setSavingPw(true);
    try {
      await axios.post(`${API}/me/change-password`, { current_password: currentPw, new_password: newPw }, { withCredentials: true });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      showToast('Password updated');
    } catch (e) {
      showToast(e.response?.data?.detail || 'Password change failed');
    } finally { setSavingPw(false); }
  };

  const togglePref = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await axios.put(`${API}/me/notification-prefs`, { prefs: next }, { withCredentials: true });
    } catch { /* best-effort */ }
  };

  return (
    <div className="px-5 pt-5 pb-6 relative">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-slate-900 text-xs font-bold shadow-xl"
            style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_LIGHT})` }}>
            <Check className="w-3.5 h-3.5 inline mr-1.5" />{toast}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[11px] font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: TEAL_LIGHT }}>Settings</p>
      <h1 className="font-fredoka font-semibold text-2xl text-slate-900">Your account</h1>

      {/* Tab switcher */}
      <div className="mt-4 rounded-full p-1 flex relative"
        style={{ background: 'rgba(255,255,255,0.78)', border: `1px solid ${TEAL_LIGHT}33`, backdropFilter: 'blur(12px)' }}>
        <motion.div initial={false} animate={{ x: tab === 'profile' ? 0 : '100%' }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          className="absolute top-1 left-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-full"
          style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_LIGHT})` }} />
        <button onClick={() => setTab('profile')} data-testid="settings-tab-profile"
          className="relative z-10 flex-1 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5"
          style={{ color: tab === 'profile' ? '#fff' : 'rgba(10,42,32,0.62)' }}>
          <User className="w-3 h-3" /> Profile
        </button>
        <button onClick={() => setTab('notifications')} data-testid="settings-tab-notifications"
          className="relative z-10 flex-1 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5"
          style={{ color: tab === 'notifications' ? '#fff' : 'rgba(10,42,32,0.62)' }}>
          <Bell className="w-3 h-3" /> Notifications
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'profile' && (
          <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {/* Profile card */}
            <motion.div className="mt-4 rounded-3xl p-5 relative overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.78)', border: `1px solid ${TEAL_LIGHT}33`, backdropFilter: 'blur(14px)' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
                className="absolute -top-10 -right-10 w-32 h-32 rounded-full"
                style={{ background: `conic-gradient(from 0deg, ${TEAL_LIGHT}44, transparent 50%)` }} />
              <div className="flex items-start gap-4 relative">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-slate-900 text-2xl overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${TEAL_LIGHT}, #1F6F54)`, boxShadow: `0 14px 30px -10px ${TEAL_LIGHT}88` }}>
                    {picture ? <img src={picture} alt="" className="w-full h-full object-cover" /> : (name?.charAt(0) || 'D')}
                  </div>
                  <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition"
                    style={{ background: 'white', border: `2px solid ${TEAL_LIGHT}` }}>
                    <Camera className="w-3 h-3" style={{ color: TEAL }} />
                    <input type="file" accept="image/*" onChange={onPickFile} className="hidden" data-testid="settings-avatar-input" />
                  </label>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Clinician · {user?.email}</p>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
                    className="rounded-xl bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-400"
                    data-testid="settings-name-input" />
                </div>
              </div>
              <Button onClick={saveProfile} disabled={savingProfile}
                data-testid="settings-save-profile"
                className="mt-3 w-full rounded-xl text-xs text-slate-900 border-0"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_LIGHT})` }}>
                <User className="w-3.5 h-3.5 mr-1.5" /> {savingProfile ? 'Saving…' : 'Save profile'}
              </Button>
            </motion.div>

            {/* Password */}
            <motion.div className="mt-4 rounded-3xl p-5"
              style={{ background: 'rgba(255,255,255,0.78)', border: `1px solid ${TEAL_LIGHT}33`, backdropFilter: 'blur(14px)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4" style={{ color: '#F99C2C' }} />
                <h3 className="font-fredoka font-bold text-base text-slate-900">Change password</h3>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Input type={showPw ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                    placeholder="Current password"
                    className="rounded-xl bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-400 pr-9"
                    data-testid="settings-current-pw" />
                  <button onClick={() => setShowPw(!showPw)} type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
                  placeholder="New password (6+ chars)"
                  className="rounded-xl bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-400"
                  data-testid="settings-new-pw" />
                <Input type={showPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Confirm new password"
                  className="rounded-xl bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-400"
                  data-testid="settings-confirm-pw" />
                {newPw && newPw !== confirmPw && (
                  <p className="text-xs text-red-300 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Passwords do not match</p>
                )}
              </div>
              <Button onClick={changePassword} disabled={savingPw}
                data-testid="settings-change-pw"
                className="mt-3 w-full rounded-xl text-xs text-slate-900 border-0"
                style={{ background: `linear-gradient(135deg, #F99C2C, ${TEAL_LIGHT})` }}>
                <Lock className="w-3.5 h-3.5 mr-1.5" /> {savingPw ? 'Updating…' : 'Update password'}
              </Button>
            </motion.div>

            {/* Quick links */}
            <div className="mt-4 rounded-3xl p-2"
              style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(255,255,255,0.78)', backdropFilter: 'blur(10px)' }}>
              <button onClick={() => navigate('/clinician/subscribe')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 transition cursor-pointer">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#22D67E22', border: '1px solid #22D67E44' }}>
                  <CreditCard className="w-4 h-4" style={{ color: '#22D67E' }} />
                </div>
                <span className="text-sm font-bold text-slate-900 flex-1 text-left">Subscription & plans</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 transition cursor-pointer">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#1F6F5422', border: '1px solid #1F6F5444' }}>
                  <Shield className="w-4 h-4" style={{ color: '#1F6F54' }} />
                </div>
                <span className="text-sm font-bold text-slate-900 flex-1 text-left">Privacy & data</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 transition cursor-pointer">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FFB08822', border: '1px solid #FFB08844' }}>
                  <MessageCircle className="w-4 h-4" style={{ color: '#FFB088' }} />
                </div>
                <span className="text-sm font-bold text-slate-900 flex-1 text-left">Contact support</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <Button onClick={async () => { await logout(); navigate('/mobile-home?role=clinician'); }}
              data-testid="clinician-settings-logout"
              variant="outline"
              className="mt-4 w-full rounded-2xl h-12 font-nunito font-bold border-2"
              style={{ borderColor: 'rgba(252,165,165,0.4)', color: '#FCA5A5', background: 'rgba(252,165,165,0.08)' }}>
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </Button>
          </motion.div>
        )}

        {tab === 'notifications' && (
          <motion.div key="notifications" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="mt-4 rounded-3xl p-2"
            style={{ background: 'rgba(255,255,255,0.78)', border: `1px solid ${TEAL_LIGHT}33`, backdropFilter: 'blur(14px)' }}>
            {[
              { key: 'new_patient_signup', label: 'New patient signups', desc: 'When a patient subscribes to your care', color: TEAL_LIGHT },
              { key: 'emergency_alerts', label: 'Emergency SOS', desc: 'Patient triggers an SOS', color: '#FF6B6B' },
              { key: 'patient_message', label: 'Patient messages', desc: 'In-app messages from your patients', color: '#1F6F54' },
              { key: 'rec_progress', label: 'Recommendation progress', desc: 'When patients complete or skip', color: '#22D67E' },
              { key: 'weekly_digest', label: 'Weekly digest', desc: 'Mon morning summary of your week', color: '#F99C2C' },
              { key: 'revenue_summary', label: 'Revenue updates', desc: 'When a patient renews their subscription', color: '#22D67E' },
            ].map((n, i) => (
              <button key={n.key} onClick={() => togglePref(n.key)}
                data-testid={`pref-${n.key}`}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 transition"
                style={{ borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.78)' : 'none' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${n.color}22`, border: `1px solid ${n.color}44` }}>
                  <Bell className="w-3.5 h-3.5" style={{ color: n.color }} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold text-slate-900">{n.label}</p>
                  <p className="text-[11px] text-slate-500 truncate">{n.desc}</p>
                </div>
                <div className="w-10 h-6 rounded-full p-0.5 transition relative shrink-0"
                  style={{ background: prefs[n.key] ? TEAL_LIGHT : 'rgba(255,255,255,0.15)' }}>
                  <div className="w-5 h-5 rounded-full bg-white transition" style={{ marginLeft: prefs[n.key] ? '16px' : '0' }} />
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
