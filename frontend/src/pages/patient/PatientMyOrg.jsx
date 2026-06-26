/**
 * Patient page: "My Organization" — visible only to patients with an active
 * Patient → Organization subscription. Lists every clinician inside that org
 * with the green "Included" badge and a single-click "Add for free" action.
 *
 * Route: /app/my-org
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Building2, Check, ArrowLeft, Plus, Stethoscope, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ax = axios.create({ withCredentials: true });

export default function PatientMyOrg() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ org: null, clinicians: [], already_linked: [] });
  const [busyId, setBusyId] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r = await ax.get(`${API}/organization/my-org-clinicians`);
      setData(r.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const addClinician = async (c) => {
    setBusyId(c.doctor_id);
    try {
      await ax.post(`${API}/patient/doctors/subscribe-via-org`, { doctor_id: c.doctor_id });
      toast.success(`Linked with ${c.name} — included via ${data.org.name}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not link clinician');
    } finally { setBusyId(null); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading…</div>;
  }

  if (!data.org) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" data-testid="no-org-state">
        <Building2 className="w-12 h-12 text-slate-200 mb-3" />
        <h1 className="text-lg font-fredoka font-bold text-slate-700">No active organization subscription</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          Subscribe to an organization to unlock free access to its clinician network.
        </p>
        <Button onClick={() => navigate('/app/subscribe')} className="mt-4 rounded-xl text-white border-0"
          style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}>
          Browse organizations
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(180deg, #FFF8EE 0%, #FFFFFF 100%)' }} data-testid="patient-my-org">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-wider font-bold text-orange-500">Included with your subscription</p>
          <h1 className="text-lg font-fredoka font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-500" /> {data.org.name}
          </h1>
        </div>
      </div>

      {/* Banner */}
      <div className="mx-5 mb-5 rounded-2xl p-4 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, #FB923C 0%, #22D67E 100%)', boxShadow: '0 12px 24px -8px #FB923Caa' }}>
        <Sparkles className="w-5 h-5 text-white shrink-0" />
        <p className="text-xs text-white font-nunito">
          Pick any clinician below — they're <strong>included for free</strong> with your {data.org.name} subscription.
        </p>
      </div>

      {/* Clinician list */}
      <div className="px-5 space-y-3" data-testid="org-clinician-list">
        {data.clinicians.length === 0 ? (
          <div className="rounded-2xl p-8 text-center text-sm text-slate-400 bg-white border border-slate-100">
            <Stethoscope className="w-8 h-8 mx-auto text-slate-200 mb-2" />
            <p>{data.org.name} hasn't added any clinicians yet.</p>
          </div>
        ) : (
          data.clinicians.map((c, i) => {
            const isLinked = c.already_linked;
            return (
              <motion.div key={c.doctor_id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-slate-100"
                data-testid={`org-clin-card-${c.doctor_id}`}
              >
                <div className="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-bold text-base shrink-0"
                  style={{ background: c.avatar_color }}>
                  {c.name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'C'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-fredoka font-semibold text-sm text-slate-800 truncate">{c.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{c.specialty}</p>
                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                    style={{ background: '#22D67E22', color: '#0d9488' }}>
                    <Check className="w-2.5 h-2.5" /> Included with {data.org.name}
                  </div>
                </div>
                {isLinked ? (
                  <span className="text-[10px] font-bold text-green-600 px-3 py-1.5 rounded-full bg-green-50">
                    ✓ Linked
                  </span>
                ) : (
                  <Button onClick={() => addClinician(c)} disabled={busyId === c.doctor_id} size="sm"
                    data-testid={`add-org-clin-${c.doctor_id}`}
                    className="text-white border-0 rounded-full h-8 text-[11px]"
                    style={{ background: 'linear-gradient(135deg, #22D67E, #0d9488)' }}>
                    <Plus className="w-3 h-3 mr-1" />
                    {busyId === c.doctor_id ? 'Linking…' : 'Add for free'}
                  </Button>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
