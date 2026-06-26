import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, Stethoscope, CreditCard, DollarSign, TrendingUp, Activity, Download,
  Building2, ClipboardList, ArrowUpRight,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import axios from 'axios';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { BRAND } from '../../brand';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

// Floating 3D orb
function FloatOrb({ size, color, top, left, right, bottom, delay = 0 }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size, top, left, right, bottom,
        background: `radial-gradient(circle at 30% 30%, ${color}ff 0%, ${color}aa 40%, ${color}33 70%, transparent 100%)`,
        filter: 'blur(2px)',
      }}
      animate={{ y: [0, -22, 0], scale: [1, 1.08, 1] }}
      transition={{ duration: 6 + Math.random() * 3, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [clinicianOv, setClinicianOv] = useState([]);
  const [patients, setPatients] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    ax.get(`${API}/dashboard/stats`).then(r => setStats(r.data)).catch(() => {});
    ax.get(`${API}/dashboard/subscription-trends`).then(r => setTrends(r.data)).catch(() => {});
    ax.get(`${API}/dashboard/clinician-overview`).then(r => setClinicianOv(r.data)).catch(() => {});
    ax.get(`${API}/patients?limit=10`).then(r => setPatients(r.data.patients || [])).catch(() => {});
  }, []);

  const cards = stats ? [
    { label: 'Portal Patients', value: stats.portal_patients, icon: Users, color: BRAND.pink, gradient: `linear-gradient(135deg, ${BRAND.pink}, #ff7eb5)`, route: '/admin/patients' },
    { label: 'Total Patients', value: stats.total_patients, icon: Users, color: '#A78BFA', gradient: 'linear-gradient(135deg, #A78BFA, #C084FC)', route: '/admin/patients' },
    { label: 'Portal Clinicians', value: stats.portal_clinicians, icon: Stethoscope, color: BRAND.blue, gradient: `linear-gradient(135deg, ${BRAND.blue}, #38bdf8)`, route: '/admin/clinicians' },
    { label: 'Active Clinicians', value: stats.total_clinicians, icon: Activity, color: BRAND.green, gradient: `linear-gradient(135deg, ${BRAND.green}, #a3e635)`, route: '/admin/clinicians' },
    { label: 'Subscriptions', value: stats.total_subscriptions, icon: CreditCard, color: BRAND.orange, gradient: `linear-gradient(135deg, ${BRAND.orange}, #fb923c)`, route: '/admin/plans' },
    { label: 'Patient Subs', value: stats.patient_subscriptions, icon: CreditCard, color: '#EC4899', gradient: 'linear-gradient(135deg, #EC4899, #F472B6)', route: '/admin/plans' },
    { label: 'Earnings', value: `$${stats.total_earnings}`, icon: DollarSign, color: '#22D67E', gradient: 'linear-gradient(135deg, #22D67E, #34D399)', route: '/admin/earnings' },
    { label: 'Organizations', value: stats.total_organizations ?? '—', icon: Building2, color: BRAND.yellow, gradient: `linear-gradient(135deg, ${BRAND.yellow}, #fcd34d)`, route: '/admin/organizations' },
  ] : [];

  const PIE_COLORS = [BRAND.blue, BRAND.green, BRAND.orange];

  const downloadCSV = (data, filename) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  };

  return (
    <div className="relative min-h-screen p-6 max-w-7xl mx-auto overflow-hidden" style={{ color: '#1A2332' }}>
      {/* Floating background orbs */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <FloatOrb size={220} color={BRAND.pink} top="-5%" right="-5%" />
        <FloatOrb size={180} color={BRAND.blue} top="40%" left="-6%" delay={1.2} />
        <FloatOrb size={160} color={BRAND.green} bottom="10%" right="10%" delay={2} />
        <FloatOrb size={140} color={BRAND.orange} top="30%" right="30%" delay={0.8} />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex items-center justify-between mb-8"
      >
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
            style={{ background: 'white', boxShadow: '0 8px 22px rgba(26,35,50,0.06)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BRAND.green }} />
            <span className="text-[10px] font-nunito font-bold uppercase tracking-widest" style={{ color: BRAND.dark }}>
              Live overview
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-fredoka font-semibold leading-tight" style={{ color: BRAND.dark }}>
            Welcome back,{' '}
            <span style={{
              background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange}, ${BRAND.yellow})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Admin
            </span>
          </h1>
          <p className="text-sm font-nunito mt-1" style={{ color: '#6B7380' }}>Your IFEELINCOLOR ecosystem at a glance</p>
        </div>
      </motion.div>

      {/* Stat Cards — 3D animated */}
      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30, rotateX: -10 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
            whileHover={{ y: -6, rotateX: 4, rotateY: -4, scale: 1.02 }}
            onClick={() => navigate(c.route)}
            data-testid={`dash-card-${i}`}
            style={{ transformStyle: 'preserve-3d', perspective: 800 }}
            className="cursor-pointer relative"
          >
            <div
              className="relative rounded-3xl p-5 overflow-hidden h-full"
              style={{
                background: 'white',
                border: '1px solid rgba(255,255,255,0.6)',
                boxShadow: `0 14px 38px -10px ${c.color}55`,
              }}
            >
              {/* Soft corner accent */}
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-30"
                style={{ background: `radial-gradient(circle, ${c.color}, transparent 70%)` }} />
              <div className="relative flex items-start justify-between mb-4">
                <motion.div
                  whileHover={{ rotate: -8, scale: 1.08 }}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{ background: c.gradient, boxShadow: `0 10px 22px -4px ${c.color}88` }}
                >
                  <c.icon className="w-5 h-5 text-white" />
                </motion.div>
                <ArrowUpRight className="w-4 h-4" style={{ color: c.color, opacity: 0.5 }} />
              </div>
              <p className="font-fredoka font-semibold text-3xl mb-0.5" style={{ color: BRAND.dark }}>{c.value}</p>
              <p className="text-xs font-nunito" style={{ color: '#6B7380' }}>{c.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* Subscription Trends (area) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2 rounded-3xl p-5 relative"
          style={{ background: 'white', boxShadow: '0 14px 38px -10px rgba(26,35,50,0.12)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.blue }}>Growth</p>
              <h3 className="font-fredoka font-semibold text-lg" style={{ color: BRAND.dark }}>Subscription Trends</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => downloadCSV(trends, 'subscription_trends.csv')} className="text-xs text-slate-400 rounded-full">
              <Download className="w-3.5 h-3.5 mr-1" /> CSV
            </Button>
          </div>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="subArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND.pink} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={BRAND.pink} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="subscriptions" stroke={BRAND.pink} strokeWidth={2.5} fill="url(#subArea)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[240px] text-sm text-slate-400 font-nunito">No subscription data yet</div>
          )}
        </motion.div>

        {/* Clinician Donut */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="rounded-3xl p-5 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${BRAND.dark}, #1F2A44)`,
            color: 'white',
            boxShadow: '0 14px 38px -10px rgba(26,35,50,0.4)',
          }}
        >
          <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full opacity-40"
            style={{ background: `radial-gradient(circle, ${BRAND.blue}, transparent 70%)` }} />
          <p className="relative text-[10px] font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.yellow }}>Status</p>
          <h3 className="relative font-fredoka font-semibold text-lg mb-3">Clinicians</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={clinicianOv}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={72}
                paddingAngle={4}
                stroke="none"
              >
                {clinicianOv.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="relative mt-2 space-y-1.5">
            {clinicianOv.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs font-nunito">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="opacity-80">{c.name}</span>
                </div>
                <span className="font-bold">{c.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Patient Details Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="relative rounded-3xl overflow-hidden"
        style={{ background: 'white', boxShadow: '0 14px 38px -10px rgba(26,35,50,0.1)' }}
      >
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#F1F5F9' }}>
          <div>
            <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.green }}>Recent</p>
            <h3 className="font-fredoka font-semibold text-lg" style={{ color: BRAND.dark }}>Patient Details</h3>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => ax.get(`${API}/patients/export/csv`, { responseType: 'blob' }).then(r => {
                const url = URL.createObjectURL(r.data); const a = document.createElement('a'); a.href = url; a.download = 'patients.csv'; a.click();
              })}
              className="text-xs text-slate-500 rounded-full"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Export
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/admin/patients')}
              className="text-xs rounded-full text-white border-0"
              style={{ background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.green})` }}
            >
              View All
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-slate-500" style={{ background: '#FAFBFC' }}>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Mobile</th>
                <th className="px-5 py-3 font-medium">Subscription</th>
                <th className="px-5 py-3 font-medium">Check-ins</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map(p => (
                <tr key={p.user_id} className="border-t hover:bg-slate-50/50 text-xs text-slate-700" style={{ borderColor: '#F1F5F9' }}>
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3">{p.email}</td>
                  <td className="px-5 py-3">{p.mobile || '-'}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.subscription ? '' : 'bg-slate-100 text-slate-400'}`}
                      style={p.subscription ? { background: `${BRAND.green}1a`, color: BRAND.green } : {}}
                    >
                      {p.subscription ? 'Active' : 'None'}
                    </span>
                  </td>
                  <td className="px-5 py-3">{p.checkin_count || 0}</td>
                  <td className="px-5 py-3">{p.created_at?.split('T')[0] || '-'}</td>
                  <td className="px-5 py-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/admin/patients')} className="text-xs" style={{ color: BRAND.blue }}>Edit</Button>
                  </td>
                </tr>
              ))}
              {patients.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400 font-nunito">No patients yet</td></tr>}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
