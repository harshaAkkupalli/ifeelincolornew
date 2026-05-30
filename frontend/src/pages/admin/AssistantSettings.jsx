import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Camera, Lock, User, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { BRAND } from '../../brand';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

export default function AssistantSettings() {
  const { admin, checkAuth } = useAdminAuth();
  const [name, setName] = useState('');
  const [picture, setPicture] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [toast, setToast] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (admin) {
      setName(admin.name || '');
      setPicture(admin.picture || '');
    }
  }, [admin]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

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
      await ax.put(`${API}/auth/me`, { name, picture });
      showToast('Profile updated');
      checkAuth && checkAuth();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Update failed');
    } finally { setSavingProfile(false); }
  };

  const changePassword = async () => {
    if (!currentPw || !newPw) { showToast('Fill both passwords'); return; }
    if (newPw !== confirmPw) { showToast('Passwords do not match'); return; }
    if (newPw.length < 8) { showToast('New password must be 8+ chars'); return; }
    setSavingPw(true);
    try {
      await ax.put(`${API}/auth/me`, { current_password: currentPw, new_password: newPw });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      showToast('Password updated');
    } catch (e) {
      showToast(e.response?.data?.detail || 'Update failed');
    } finally { setSavingPw(false); }
  };

  const isAssistant = admin?.role === 'assistant';
  const pp = admin?.page_permissions || {};
  const ppCount = Object.keys(pp).length;

  return (
    <div className="p-6 max-w-3xl mx-auto relative">
      {toast && (
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-2xl text-white text-xs font-bold shadow-xl"
          style={{ background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.blue})` }}>
          <Check className="w-3.5 h-3.5 inline mr-1.5" />{toast}
        </motion.div>
      )}

      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.pink }}>My Account</p>
        <h1 className="text-2xl font-semibold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">Update your profile, avatar, and password.</p>
      </div>

      {/* Profile card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-6 mb-6 relative overflow-hidden"
        style={{ background: 'white', boxShadow: '0 20px 40px -20px rgba(26,35,50,0.15)', border: '1px solid #F1F5F9' }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15"
          style={{ background: `radial-gradient(circle, ${BRAND.blue}, transparent 70%)` }} />
        <div className="flex items-start gap-5 relative">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-white font-bold text-3xl overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.green})` }}>
              {picture ? <img src={picture} alt="" className="w-full h-full object-cover" /> : (name?.charAt(0) || 'A')}
            </div>
            <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center cursor-pointer hover:scale-105 transition"
              style={{ border: `2px solid ${BRAND.blue}` }}>
              <Camera className="w-3.5 h-3.5" style={{ color: BRAND.blue }} />
              <input type="file" accept="image/*" onChange={onPickFile} className="hidden" data-testid="settings-avatar-input" />
            </label>
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              {isAssistant ? 'Assistant' : 'Super Admin'} · {admin?.email}
            </p>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="rounded-xl mb-2" data-testid="settings-name-input" />
            {isAssistant && (
              <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-2">
                <Lock className="w-3 h-3" /> You have access to <strong className="text-blue-600">{ppCount} pages</strong>. Contact a Super Admin to change permissions.
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={saveProfile} disabled={savingProfile}
            className="rounded-xl text-xs text-white border-0"
            data-testid="settings-save-profile"
            style={{ background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.green})` }}>
            <User className="w-3.5 h-3.5 mr-1.5" /> {savingProfile ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </motion.div>

      {/* Change password card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-3xl p-6 relative overflow-hidden"
        style={{ background: 'white', boxShadow: '0 20px 40px -20px rgba(26,35,50,0.15)', border: '1px solid #F1F5F9' }}>
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5" style={{ color: BRAND.orange }} />
          <h3 className="font-fredoka font-bold text-lg text-slate-800">Change password</h3>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <Input type={showPw ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Current password" className="rounded-xl pr-10" data-testid="settings-current-pw" />
            <button onClick={() => setShowPw(!showPw)} type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password (8+ chars)" className="rounded-xl" data-testid="settings-new-pw" />
          <Input type={showPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm new password" className="rounded-xl" data-testid="settings-confirm-pw" />
          {newPw && newPw !== confirmPw && (
            <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Passwords do not match</p>
          )}
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={changePassword} disabled={savingPw}
            className="rounded-xl text-xs text-white border-0" data-testid="settings-change-pw"
            style={{ background: `linear-gradient(135deg, ${BRAND.orange}, ${BRAND.pink})` }}>
            <Lock className="w-3.5 h-3.5 mr-1.5" /> {savingPw ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
