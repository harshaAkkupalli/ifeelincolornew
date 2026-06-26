import React, { useState, useEffect } from 'react';
import { DollarSign, Download, TrendingUp, CreditCard, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';
const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

export default function EarningsPage() {
  const [data, setData] = useState(null);
  useEffect(() => { ax.get(`${API}/earnings`).then(r => setData(r.data)).catch(() => {}); }, []);

  const exportCSV = () => ax.get(`${API}/earnings/export/csv`, { responseType: 'blob' }).then(r => { const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = 'earnings.csv'; a.click(); });

  const downloadChartCSV = (chartData, filename) => {
    if (!chartData?.length) return;
    const headers = Object.keys(chartData[0]);
    const csv = [headers.join(','), ...chartData.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
  const cards = data ? [
    { label: 'Total Earnings', value: `$${data.total_earnings?.toFixed(2) || '0.00'}`, icon: DollarSign, color: '#22C55E' },
    { label: 'Total Transactions', value: data.total_transactions || 0, icon: CreditCard, color: '#3B82F6' },
    { label: 'Pending Transactions', value: data.pending_transactions || 0, icon: Clock, color: '#F59E0B' },
  ] : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-semibold text-slate-800">Earnings</h1><p className="text-sm text-slate-500">Revenue and transaction overview</p></div>
        <Button onClick={exportCSV} variant="outline" className="text-xs rounded-lg"><Download className="w-3.5 h-3.5 mr-1" /> Export All CSV</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {cards.map((c, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${c.color}15` }}>
                <c.icon className="w-5 h-5" style={{ color: c.color }} />
              </div>
              <TrendingUp className="w-4 h-4 text-slate-300" />
            </div>
            <p className="text-2xl font-semibold text-slate-800">{c.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Earnings Chart */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Monthly Earnings</h3>
            <Button variant="ghost" size="sm" onClick={() => downloadChartCSV(data?.monthly_earnings, 'monthly_earnings.csv')} className="text-xs text-slate-400"><Download className="w-3 h-3 mr-1" /> CSV</Button>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data?.monthly_earnings || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} formatter={v => [`$${v}`, 'Revenue']} />
              <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Earnings by Type */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Revenue by Type</h3>
            <Button variant="ghost" size="sm" onClick={() => downloadChartCSV(data?.earnings_by_type, 'earnings_by_type.csv')} className="text-xs text-slate-400"><Download className="w-3 h-3 mr-1" /> CSV</Button>
          </div>
          {data?.earnings_by_type?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.earnings_by_type} dataKey="amount" nameKey="type" cx="50%" cy="50%" outerRadius={85} label={({ type, amount }) => `${type}: $${amount}`} labelLine={false}>
                  {data.earnings_by_type.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={v => [`$${v}`, 'Revenue']} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-60 text-sm text-slate-400">No earnings data yet</div>}
        </div>
      </div>
    </div>
  );
}
