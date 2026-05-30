import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Megaphone, AlertOctagon, Activity, Bell, Stethoscope, BookOpen, ChevronRight } from 'lucide-react';
import { BRAND } from '../../brand';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ICON_MAP = {
  megaphone: Megaphone,
  alert: AlertOctagon,
  activity: Activity,
  doctor_subscribed: Stethoscope,
  recommendation_saved: BookOpen,
};

export default function PatientNotifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/notifications`, { withCredentials: true })
      .then(r => { setItems(r.data.notifications || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Tap → navigate to the URL the backend provided (e.g.
  // `/app/recommendations?open=rec_xyz` opens the rec detail directly).
  const handleTap = (n) => {
    if (n?.url) navigate(n.url);
  };

  return (
    <div className="px-5 pt-5 pb-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.pink }}>
          Stay in the loop
        </p>
        <h1 className="font-fredoka font-semibold text-3xl" style={{ color: '#1F1147' }}>
          Notifications
        </h1>
        <p className="text-sm font-nunito mt-1" style={{ color: '#5C4A85' }}>
          Announcements, activity, and care updates from your team.
        </p>
      </motion.div>

      <div className="mt-6 space-y-2">
        {loading && (
          <div className="rounded-2xl p-6 text-center text-sm text-slate-400 font-nunito"
            style={{ background: 'white' }}>
            Loading...
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="rounded-2xl p-8 text-center text-sm text-slate-400 font-nunito"
            style={{ background: 'rgba(255,255,255,0.7)', border: '1px dashed rgba(31,17,71,0.1)' }}>
            <Bell className="w-6 h-6 mx-auto mb-2 text-slate-300" />
            You're all caught up.
          </div>
        )}
        {items.map((n, i) => {
          const Icon = ICON_MAP[n.icon] || ICON_MAP[n.type] || Bell;
          return (
            <motion.button
              type="button"
              key={n.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleTap(n)}
              className="w-full text-left rounded-2xl p-4 flex items-start gap-3 transition active:opacity-90 cursor-pointer"
              style={{
                background: 'white',
                boxShadow: `0 10px 22px -12px ${n.color}66`,
                border: n.read ? '1px solid transparent' : `1px solid ${n.color}33`,
              }}
              data-testid={`notif-${n.id}`}
            >
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: `${n.color}1a` }}>
                <Icon className="w-4 h-4" style={{ color: n.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-fredoka font-semibold text-sm" style={{ color: '#1F1147' }}>{n.title}</p>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {(n.created_at || '').slice(0, 10)}
                  </span>
                </div>
                {n.body && <p className="text-xs font-nunito mt-0.5" style={{ color: '#5C4A85' }}>{n.body}</p>}
                {!n.read && (
                  <span className="inline-block mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: n.color }} />
                )}
              </div>
              {n.url && (
                <ChevronRight className="w-4 h-4 mt-1 shrink-0" style={{ color: `${n.color}99` }} />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
