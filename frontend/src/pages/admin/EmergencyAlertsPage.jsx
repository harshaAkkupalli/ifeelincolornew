import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { AlertOctagon, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { BRAND } from '../../brand';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ax = axios.create({ withCredentials: true });

const SEV_COLORS = { critical: '#FF3B30', high: '#FF8C3F', moderate: '#FFD23F', low: '#22D67E' };

export default function EmergencyAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await ax.get(`${API}/emergency/alerts`);
      setAlerts(r.data.alerts || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mb-1 text-red-500">Critical</p>
          <h1 className="font-fredoka font-semibold text-2xl" style={{ color: BRAND.dark }}>Emergency Alerts</h1>
          <p className="text-sm text-slate-500 mt-1">Patient-triggered emergencies. Simulated dispatch only.</p>
        </div>
        <Button onClick={load} variant="outline" size="sm" className="rounded-full" data-testid="reload-alerts">
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-3xl p-12 text-center text-sm text-slate-400"
          style={{ background: 'white', boxShadow: '0 12px 28px -16px rgba(26,35,50,0.08)' }}>
          <AlertOctagon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          No emergencies yet — that's a good thing.
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a, i) => {
            const col = SEV_COLORS[a.severity] || '#FF3B30';
            return (
              <motion.div
                key={a.alert_id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl p-4 relative flex items-start gap-4"
                style={{ background: 'white', boxShadow: `0 12px 28px -16px ${col}66`, border: `1px solid ${col}22` }}
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: col, boxShadow: `0 8px 18px -4px ${col}88` }}>
                  <AlertOctagon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-fredoka font-semibold text-sm" style={{ color: BRAND.dark }}>
                      {a.user_name || a.user_email}
                    </p>
                    <span className="text-[10px] font-nunito font-bold px-2 py-0.5 rounded-full"
                      style={{ background: col + '22', color: col }}>
                      {(a.severity || 'critical').toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-auto">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    <MapPin className="inline w-3 h-3 mr-0.5" /> {a.lat?.toFixed(3)}, {a.lng?.toFixed(3)} ·
                    {' '}dispatched to {a.dispatched_to_doctors?.length || 0} doctor(s) + police
                  </p>
                  {a.note && <p className="mt-1 text-xs text-slate-600">{a.note}</p>}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
