import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Loader2, Users, Activity, BookOpen, TrendingUp } from 'lucide-react';
import { CLIN } from '../../clinicianBrand';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SEVERITY_COLORS = {
  low: '#86EFAC',
  moderate: '#F4D58D',
  high: '#FCA5A5',
  critical: '#FF3B30',
};

const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

export default function ClinicianAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/clinician/analytics`, { params: { days }, withCredentials: true })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="px-5 pt-5 pb-10 relative z-10" data-testid="clinician-analytics-page">
      <p className="text-[11px] font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: CLIN.accent }}>
        Insights · Last {days} days
      </p>
      <h1 className="font-fredoka font-semibold text-2xl text-slate-900">Caseload Analytics</h1>

      {/* Range pills */}
      <div className="flex gap-2 mt-3 mb-4">
        {RANGES.map((r) => (
          <button
            key={r.label}
            data-testid={`range-${r.label}`}
            onClick={() => setDays(r.days)}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold transition"
            style={{
              background: days === r.days ? `linear-gradient(135deg, ${CLIN.accent}, ${CLIN.lilac})` : 'rgba(255,255,255,0.78)',
              color: days === r.days ? '#0A2A20' : 'rgba(10,42,32,0.62)',
              border: `1px solid ${CLIN.accent}33`,
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="rounded-3xl p-10 flex flex-col items-center gap-3" style={{ background: 'rgba(255,255,255,0.78)' }}>
          <Loader2 className="w-6 h-6 animate-spin text-slate-900" />
          <p className="text-xs text-slate-500">Crunching numbers…</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatTile icon={<Users className="w-4 h-4" />} label="Patients" value={data.patient_count} color={CLIN.accent} />
            <StatTile icon={<Activity className="w-4 h-4" />} label="Check-ins" value={data.total_checkins} color={CLIN.lilac} />
            <StatTile icon={<BookOpen className="w-4 h-4" />} label="Recs given" value={data.recommendations_given} color={CLIN.gold} />
            <StatTile icon={<TrendingUp className="w-4 h-4" />} label="Daily avg" value={(data.total_checkins / Math.max(1, days)).toFixed(1)} color={CLIN.highlight} />
          </div>

          {/* Check-in frequency */}
          <Section title="Check-in frequency" subtitle="Daily volume across your patients">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data.checkin_frequency}>
                <defs>
                  <linearGradient id="ci" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CLIN.accent} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={CLIN.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,111,84,0.08)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(10,42,32,0.62)', fontSize: 10 }}
                  tickFormatter={(d) => d.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'rgba(10,42,32,0.62)', fontSize: 10 }} allowDecimals={false} width={20} />
                <Tooltip contentStyle={{ background: '#1C2541', border: `1px solid ${CLIN.accent}44`, borderRadius: 12, fontSize: 11, color: '#fff' }} />
                <Area type="monotone" dataKey="count" stroke={CLIN.accent} strokeWidth={2} fill="url(#ci)" />
              </AreaChart>
            </ResponsiveContainer>
          </Section>

          {/* Severity distribution */}
          <Section title="Severity distribution" subtitle="Latest assessment per patient">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={data.severity_distribution}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {data.severity_distribution.map((entry) => (
                    <Cell key={entry.label} fill={SEVERITY_COLORS[entry.label] || CLIN.lilac} />
                  ))}
                </Pie>
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: '#fff' }}
                  formatter={(v) => <span style={{ color: 'rgba(255,255,255,0.75)', textTransform: 'capitalize' }}>{v}</span>}
                />
                <Tooltip contentStyle={{ background: '#1C2541', border: `1px solid ${CLIN.accent}44`, borderRadius: 12, fontSize: 11, color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </Section>

          {/* Emotion frequency */}
          <Section title="Top emotions" subtitle="Most frequent across patient check-ins">
            <ResponsiveContainer width="100%" height={Math.max(160, data.emotion_frequency.length * 28)}>
              <BarChart data={data.emotion_frequency} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.78)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'rgba(10,42,32,0.62)', fontSize: 10 }} allowDecimals={false} />
                <YAxis dataKey="emotion" type="category" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} width={88} />
                <Tooltip contentStyle={{ background: '#1C2541', border: `1px solid ${CLIN.accent}44`, borderRadius: 12, fontSize: 11, color: '#fff' }} />
                <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                  {data.emotion_frequency.map((_, i) => (
                    <Cell key={i} fill={[CLIN.accent, CLIN.lilac, CLIN.gold, '#FF8A95', CLIN.highlight, '#86EFAC', '#7FE3FF', '#1F6F54'][i % 8]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {data.emotion_frequency.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-8">No check-in emotions logged yet.</p>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function StatTile({ icon, label, value, color }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl p-4 backdrop-blur-xl"
      style={{
        background: 'rgba(255,255,255,0.78)',
        border: `1px solid ${color}33`,
        boxShadow: `0 10px 24px -12px ${color}44`,
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${color}22`, color }}>
          {icon}
        </span>
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'rgba(10,42,32,0.62)' }}>{label}</p>
      </div>
      <p className="font-fredoka text-2xl text-slate-900" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
    </motion.div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div
      className="rounded-3xl p-4 mb-4 backdrop-blur-xl"
      style={{
        background: 'rgba(255,255,255,0.78)',
        border: `1px solid ${CLIN.border}`,
        boxShadow: '0 20px 40px -20px rgba(0,0,0,0.5)',
      }}
    >
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="text-[11px] text-slate-500 mb-3">{subtitle}</p>
      {children}
    </div>
  );
}
