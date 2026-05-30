import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Check, Crown, Sparkles, Loader2, Shield } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRazorpayCheckout } from '../../lib/razorpay';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TEAL_LIGHT = '#2FA37A';
const TEAL = '#1F6F54';

export default function ClinicianSubscribe() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeSub, setActiveSub] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const { configured: rzpConfigured, launchCheckout } = useRazorpayCheckout();

  const load = async () => {
    const r = await axios.get(`${API}/plans?role=clinician`, { withCredentials: true });
    setPlans(r.data.plans || []);
    if (r.data.plans?.length) setSelected(r.data.plans[1]?.plan_id || r.data.plans[0]?.plan_id);
    try {
      const s = await axios.get(`${API}/me/subscription`, { withCredentials: true });
      setActiveSub(s.data.subscription);
    } catch { /* none */ }
  };
  useEffect(() => { load(); }, []);

  // Stripe return polling
  useEffect(() => {
    const sid = searchParams.get('session_id');
    const status = searchParams.get('status');
    if (status === 'cancelled') {
      setStatusMsg('Payment was cancelled.'); setTimeout(() => setStatusMsg(''), 3500); return undefined;
    }
    if (!sid) return undefined;
    let attempts = 0;
    const tick = async () => {
      try {
        const r = await axios.get(`${API}/payments/checkout/status/${sid}`, {
          params: { confirm: status === 'success' ? 1 : 0 },
          withCredentials: true,
        });
        if (r.data.payment_status === 'paid' && r.data.fulfilled) {
          setStatusMsg(`Payment received · ${r.data.plan_name} activated.`);
          await load();
          setTimeout(() => setStatusMsg(''), 4000);
          setSearchParams({});
          return;
        }
        if (r.data.status === 'expired' || r.data.status === 'cancelled') {
          setStatusMsg('Payment was not completed.'); setTimeout(() => setStatusMsg(''), 3500); return;
        }
        if (attempts++ < 10) setTimeout(tick, 2000);
      } catch { if (attempts++ < 10) setTimeout(tick, 2000); }
    };
    setStatusMsg('Confirming your payment…');
    tick();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscribe = async () => {
    if (!selected) return;
    const plan = plans.find(p => p.plan_id === selected);
    const amount = parseFloat(plan?.price_usd ?? plan?.price ?? 0);
    setLoading(true);
    try {
      // Free / trial plan — mock activation
      if (amount === 0) {
        await axios.post(`${API}/subscribe/mock`, { plan_id: selected }, { withCredentials: true });
        setStatusMsg(`Trial activated · ${plan?.trial_days || plan?.duration_days || 30} days free.`);
        await load();
        setTimeout(() => { setStatusMsg(''); navigate('/clinician/home'); }, 1200);
        setLoading(false);
        return;
      }
      if (!rzpConfigured) {
        setStatusMsg('Payments are not configured yet. Please contact support.');
        setTimeout(() => setStatusMsg(''), 4000);
        setLoading(false);
        return;
      }
      await launchCheckout({
        kind: 'clinician_plan',
        plan_id: selected,
        onSuccess: async (data) => {
          setStatusMsg(`Payment received · ${data.plan_name} activated.`);
          await load();
          setTimeout(() => { setStatusMsg(''); navigate('/clinician/home'); }, 1500);
          setLoading(false);
        },
        onFailure: (err) => {
          if (!err?.dismissed) {
            setStatusMsg(err?.message || 'Payment did not complete');
            setTimeout(() => setStatusMsg(''), 4000);
          }
          setLoading(false);
        },
      });
    } catch {
      setLoading(false);
    }
  };

  const isGated = searchParams.get('gate') === '1';

  return (
    <div className="px-4 pt-5 pb-6">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Membership</h1>
      <p className="text-sm text-slate-500 mt-1">Pick a plan published by your admin. Free trials are activated instantly.</p>

      {isGated && !activeSub && (
        <div data-testid="clin-gate-banner" className="mt-4 rounded-lg p-3 text-xs flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800">
          <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
          <span>You'll need an active membership to access the full clinician dashboard. Pick a plan below to continue.</span>
        </div>
      )}

      {statusMsg && (
        <div data-testid="clin-checkout-status"
          className="mt-3 rounded-lg p-3 text-xs flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {statusMsg}
        </div>
      )}

      {activeSub && (
        <div className="mt-4 rounded-lg p-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200">
          <Check className="w-4 h-4 text-emerald-600" />
          <p className="text-xs text-emerald-800">
            Active: <strong>{activeSub.plan_name}</strong>{activeSub.end_date && <> · until {new Date(activeSub.end_date).toLocaleDateString()}</>}
          </p>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {plans.length === 0 && (
          <div className="rounded-xl p-8 text-center text-sm text-slate-400 bg-white border border-dashed border-slate-200">
            No clinician plans yet — your admin needs to publish at least one plan.
          </div>
        )}
        {plans.map((p, i) => {
          const sel = selected === p.plan_id;
          const popular = i === 1;
          const isTrial = p.is_trial && p.trial_days;
          const free = parseFloat(p.price_usd ?? p.price ?? 0) === 0;
          return (
            <button key={p.plan_id}
              onClick={() => setSelected(p.plan_id)}
              data-testid={`clinician-plan-${p.plan_id}`}
              className={`w-full text-left rounded-xl p-5 relative transition bg-white border ${sel ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'}`}
              style={{ boxShadow: sel ? '0 4px 12px rgba(31,111,84,0.12)' : '0 1px 2px rgba(16,24,40,0.06)' }}>
              {popular && (
                <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <Crown className="w-2.5 h-2.5 inline mr-1" /> Popular
                </span>
              )}
              <div className="flex items-baseline gap-2">
                <h3 className="text-base font-semibold text-slate-900">{p.name}</h3>
                {isTrial ? (
                  <span className="text-[10px] font-semibold text-emerald-700">· {p.trial_days}-day trial</span>
                ) : (
                  <span className="text-[10px] text-slate-500">· {p.duration_days} days</span>
                )}
              </div>
              <p className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                {free ? <span className="text-emerald-600">Free</span> : <>${p.price_usd}</>}
                {!free && <span className="text-xs font-normal text-slate-500 ml-1">one-time</span>}
              </p>
              {p.purpose && (
                <p className="text-xs text-slate-500 mt-2 line-clamp-3">{p.purpose}</p>
              )}
              {sel && (
                <div className="absolute bottom-3 right-3 w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {plans.length > 0 && (() => {
        const sp = plans.find((p) => p.plan_id === selected);
        const isFreeOrTrial = (parseFloat(sp?.price_usd ?? sp?.price ?? 0) === 0);
        return (
          <button onClick={subscribe} disabled={loading || !selected}
            data-testid="clinician-subscribe-btn"
            className="mt-5 w-full rounded-lg py-2.5 px-4 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isFreeOrTrial ? <><Sparkles className="w-4 h-4" /> Start free trial</> : <><Shield className="w-4 h-4" /> Pay with Razorpay</>}
          </button>
        );
      })()}

      <p className="text-[11px] text-slate-400 text-center mt-3">
        <Shield className="w-3 h-3 inline mr-1" /> Secure payment via Razorpay · admin-published plans only.
      </p>
    </div>
  );
}
