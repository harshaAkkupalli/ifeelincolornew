import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Bell, ClipboardCheck, AlertOctagon, FileText, ChevronRight, Inbox } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TYPE_META = {
  checkin: { icon: ClipboardCheck, color: '#1F6F54', label: 'Check-in' },
  assessment: { icon: FileText, color: '#0EA5E9', label: 'Assessment' },
  emergency: { icon: AlertOctagon, color: '#EF4444', label: 'Emergency' },
};

function relTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ClinicianNotifications() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/clinician/notifications-feed`, { withCredentials: true });
      setFeed(r.data.feed || []);
    } catch { setFeed([]); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-5 pt-5 pb-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Bell className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Notifications</h1>
            <p className="text-xs text-slate-500">Live updates from your subscribed patients</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-2">
        {loading && (
          <p className="text-xs text-slate-400 text-center py-12">Loading…</p>
        )}
        {!loading && feed.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center" data-testid="clin-notif-empty">
            <Inbox className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">All caught up</p>
            <p className="text-xs text-slate-500 mt-1">You'll see check-ins, assessments, and SOS alerts here as they happen.</p>
          </div>
        )}
        {feed.map((n) => {
          const meta = TYPE_META[n.type] || { icon: Bell, color: '#64748B', label: 'Update' };
          const Icon = meta.icon;
          return (
            <button key={n.id}
              data-testid={`clin-notif-${n.id}`}
              onClick={() => n.url && navigate(n.url)}
              className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-200 hover:shadow-sm transition flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}33` }}>
                <Icon className="w-4 h-4" style={{ color: meta.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                    style={{ background: `${meta.color}14`, color: meta.color }}>{meta.label}</span>
                  <span className="text-[10px] text-slate-400">{relTime(n.created_at)}</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 truncate">{n.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 mt-3 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
