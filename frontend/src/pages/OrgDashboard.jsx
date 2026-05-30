import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Heart, LogOut, User, Users, Building2, ClipboardList, TrendingUp } from 'lucide-react';
import { Logo } from '../components/brand/BrandLogo';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function OrgDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total_patients: 0, total_clinicians: 0, total_checkins: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API}/org/stats`, { withCredentials: true });
        setStats(res.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const statCards = [
    { label: 'Total Patients', value: stats.total_patients, icon: Users, color: '#FFD166', bg: 'rgba(255,209,102,0.15)' },
    { label: 'Total Clinicians', value: stats.total_clinicians, icon: User, color: '#118AB2', bg: 'rgba(17,138,178,0.15)' },
    { label: 'Total Check-ins', value: stats.total_checkins, icon: ClipboardList, color: '#06D6A0', bg: 'rgba(6,214,160,0.15)' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#FDFCDC' }}>
      <header className="sticky top-0 z-50 backdrop-blur-lg border-b" style={{ background: 'rgba(253,252,220,0.9)', borderColor: 'rgba(7,59,76,0.1)' }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={32} textSize="text-lg" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(6,214,160,0.15)' }}>
              <Building2 className="w-4 h-4" style={{ color: '#073B4C' }} />
              <span className="text-sm font-nunito font-medium" style={{ color: '#073B4C' }}>{user?.name}</span>
            </div>
            <Button data-testid="org-logout-button" onClick={handleLogout} variant="ghost" className="rounded-full px-3 py-1.5" style={{ color: '#EF476F' }}>
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl sm:text-4xl font-fredoka font-semibold mb-2" style={{ color: '#073B4C' }}>
            Organization Overview
          </h1>
          <p className="text-base font-nunito mb-8" style={{ color: '#4A6FA5' }}>
            Monitor the wellness ecosystem at a glance
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {statCards.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="p-8 rounded-3xl border"
              style={{ background: '#FFFFFF', borderColor: 'rgba(7,59,76,0.1)', boxShadow: '0 8px 30px rgba(7,59,76,0.08)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: s.bg }}>
                  <s.icon className="w-6 h-6" style={{ color: s.color }} />
                </div>
                <TrendingUp className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <p className="text-4xl font-fredoka font-semibold mb-1" style={{ color: '#073B4C' }}>
                {loading ? '...' : s.value}
              </p>
              <p className="text-sm font-nunito" style={{ color: '#4A6FA5' }}>{s.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="rounded-3xl border p-8" style={{ background: '#FFFFFF', borderColor: 'rgba(7,59,76,0.1)', boxShadow: '0 8px 30px rgba(7,59,76,0.08)' }}>
          <h2 className="text-xl font-fredoka font-semibold mb-4" style={{ color: '#073B4C' }}>System Health</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl" style={{ background: 'rgba(6,214,160,0.1)' }}>
              <p className="text-sm font-nunito font-medium" style={{ color: '#073B4C' }}>API Status</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full" style={{ background: '#06D6A0' }} />
                <span className="text-sm font-nunito" style={{ color: '#06D6A0' }}>Operational</span>
              </div>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: 'rgba(17,138,178,0.1)' }}>
              <p className="text-sm font-nunito font-medium" style={{ color: '#073B4C' }}>AI Suggestions</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full" style={{ background: '#118AB2' }} />
                <span className="text-sm font-nunito" style={{ color: '#118AB2' }}>Active</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
