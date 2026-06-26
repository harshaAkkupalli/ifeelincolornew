import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import axios from 'axios';
import { Stethoscope, User, Building2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const roles = [
  {
    id: 'patient',
    label: 'Patient',
    desc: 'Track your feelings with colors and guided check-ins',
    icon: User,
    color: '#FFD166',
    bg: 'rgba(255,209,102,0.15)',
    img: 'https://static.prod-images.emergentagent.com/jobs/446bdc09-563b-4ee2-bee4-5620eecbfea3/images/a6a4b1c10635944b262610b2d62060ac3633d5f78c4face5462ad4b0d3e62956.png'
  },
  {
    id: 'clinician',
    label: 'Clinician',
    desc: 'Monitor and support your patients emotional journeys',
    icon: Stethoscope,
    color: '#118AB2',
    bg: 'rgba(17,138,178,0.15)',
    img: 'https://static.prod-images.emergentagent.com/jobs/446bdc09-563b-4ee2-bee4-5620eecbfea3/images/e28e1ecd2839b2d2b6474aebff4ebd0227f440cf78d16eb27a7d64692444a0af.png'
  },
  {
    id: 'organization',
    label: 'Organization',
    desc: 'Oversee care teams and track overall wellness metrics',
    icon: Building2,
    color: '#06D6A0',
    bg: 'rgba(6,214,160,0.15)',
    img: null
  }
];

export default function RoleSelection() {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await axios.put(`${API}/auth/profile`, { role: selected }, { withCredentials: true });
      updateUser(res.data);
      navigate('/dashboard');
    } catch (err) {
      console.error('Role update failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#FDFCDC' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-fredoka font-semibold mb-3" style={{ color: '#073B4C' }}>
            Welcome! Who are you?
          </h1>
          <p className="text-base sm:text-lg font-nunito" style={{ color: '#4A6FA5' }}>
            Choose your role to get started
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {roles.map((role) => (
            <motion.button
              key={role.id}
              data-testid={`role-select-${role.id}`}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelected(role.id)}
              className={`p-6 rounded-3xl border-2 transition-all text-left cursor-pointer ${
                selected === role.id ? 'shadow-xl' : ''
              }`}
              style={{
                background: selected === role.id ? role.bg : '#FFFFFF',
                borderColor: selected === role.id ? role.color : 'rgba(7,59,76,0.1)',
                boxShadow: selected === role.id ? `0 8px 30px ${role.color}33` : '0 8px 30px rgba(7,59,76,0.08)'
              }}
            >
              {role.img ? (
                <img src={role.img} alt={role.label} className="w-16 h-16 rounded-2xl mb-4 object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: role.bg }}>
                  <role.icon className="w-8 h-8" style={{ color: role.color }} />
                </div>
              )}
              <h3 className="text-xl font-fredoka font-semibold mb-1" style={{ color: '#073B4C' }}>{role.label}</h3>
              <p className="text-sm font-nunito" style={{ color: '#4A6FA5' }}>{role.desc}</p>
            </motion.button>
          ))}
        </div>

        <div className="text-center">
          <Button
            data-testid="confirm-role-button"
            onClick={handleConfirm}
            disabled={!selected || saving}
            className="rounded-full px-10 py-4 text-lg font-nunito font-bold text-white border-0 shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
            style={{ background: selected ? roles.find(r => r.id === selected)?.color : '#4A6FA5' }}
          >
            {saving ? 'Setting up...' : 'Continue'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
