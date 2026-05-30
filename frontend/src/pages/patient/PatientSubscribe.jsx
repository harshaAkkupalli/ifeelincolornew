import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Check, Sparkles, ArrowRight, Shield, Stethoscope, Building2,
  Calendar, BadgeCheck, Clock, ExternalLink, Loader2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { BRAND } from '../../brand';
import { useRazorpayCheckout } from '../../lib/razorpay';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TAB_META = {
  portal:       { icon: Shield,      color: '#A78BFA', label: 'Portal',       sub: 'IFEELINCOLOR core platform' },
  clinician:    { icon: Stethoscope, color: '#22D3C5', label: 'Clinician',    sub: 'Care from a real clinician' },
  organization: { icon: Building2,   color: '#FF8C3F', label: 'Organization', sub: 'Wellness organizations' },
};

const fmtDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return d; } };
const daysRemaining = (end) => { if (!end) return null; try { const ms = new Date(end).getTime() - Date.now(); return Math.max(0, Math.ceil(ms / 86400000)); } catch { return null; } };

export default function PatientSubscribe() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('portal');
  const [plans, setPlans] = useState({ portal: [], clinician: [], organization: [] });
  const [activeSub, setActiveSub] = useState(null);
  const [doctorSubs, setDoctorSubs] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const pollRef = useRef(null);
  const { configured: rzpConfigured, launchCheckout } = useRazorpayCheckout();

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2800); };

  const pollCheckoutStatus = async (sessionId, attempts = 0) => {
    // Legacy Stripe polling path — kept inert in case an old Stripe link
    // redirect lands on this page. Razorpay handles verification inline.
    if (attempts > 10) {
      setStatusMsg('Payment status check timed out — please refresh in a moment.');
      return;
    }
    try {
      const wasSuccess = searchParams.get('status') === 'success' ? 1 : 0;
      const r = await axios.get(`${API}/payments/checkout/status/${sessionId}`, {
        params: { confirm: wasSuccess },
        withCredentials: true,
      });
      if (r.data.payment_status === 'paid' && r.data.fulfilled) {
        showToast(`Payment received · ${r.data.plan_name} activated!`);
        setStatusMsg('');
        await load();
        setSearchParams({});
        return;
      }
      if (r.data.status === 'expired' || r.data.status === 'cancelled') {
        setStatusMsg('Payment was not completed. You can try again.');
        return;
      }
      setStatusMsg('Confirming your payment…');
      pollRef.current = setTimeout(() => pollCheckoutStatus(sessionId, attempts + 1), 2000);
    } catch {
      pollRef.current = setTimeout(() => pollCheckoutStatus(sessionId, attempts + 1), 2000);
    }
  };

  useEffect(() => {
    const sid = searchParams.get('session_id');
    const status = searchParams.get('status');
    if (sid) {
      pollCheckoutStatus(sid);
    } else if (status === 'cancelled') {
      setStatusMsg('Payment was cancelled. Try again whenever you\'re ready.');
    }
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [portalR, clinR, orgR, mySubR, myDocR] = await Promise.all([
        axios.get(`${API}/plans?role=patient`).catch(() => ({ data: { plans: [] } })),
        axios.get(`${API}/plans?role=clinician`).catch(() => ({ data: { plans: [] } })),
        axios.get(`${API}/plans?role=organization`).catch(() => ({ data: { plans: [] } })),
        axios.get(`${API}/me/subscription`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/patient/doctors/subscribed`, { withCredentials: true }).catch(() => ({ data: { doctors: [] } })),
      ]);
      setPlans({ portal: portalR.data.plans || [], clinician: clinR.data.plans || [], organization: orgR.data.plans || [] });
      // /me/subscription returns { active, subscription }
      const subData = mySubR.data || {};
      setActiveSub(subData.active ? { active: true, ...(subData.subscription || {}) } : { active: false });
      setDoctorSubs(myDocR.data.doctors || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const list = plans[tab] || [];
  const meta = TAB_META[tab];
  const isPortalActive = !!(activeSub && activeSub.active);

  const subscribeFlow = async (plan) => {
    if (!plan) return;
    const planId = plan.plan_id || plan._id;
    const amount = parseFloat(plan.price_usd ?? plan.price ?? 0);
    const accessDays = plan.is_trial && plan.trial_days ? plan.trial_days : (plan.duration_days || 30);
    setSubmitting(true);
    try {
      // Free / trial plan — no payment needed
      if (amount === 0) {
        await axios.post(`${API}/subscribe/mock`, { plan_id: planId }, { withCredentials: true });
        showToast(`Trial activated · ${accessDays} days free.`);
        await load();
        setSelectedPlan(null);
        setTimeout(() => navigate('/app/assessment'), 1100);
        return;
      }
      if (!rzpConfigured) {
        showToast('Payments are not configured yet. Please contact support.');
        setSubmitting(false);
        return;
      }
      // Paid plan → Razorpay Checkout
      await launchCheckout({
        kind: 'portal',
        plan_id: planId,
        onSuccess: async (data) => {
          showToast(`Payment received · ${data.plan_name || plan.name} activated!`);
          await load();
          setSelectedPlan(null);
          setSubmitting(false);
        },
        onFailure: (err) => {
          if (!err?.dismissed) showToast(err?.message || 'Payment did not complete');
          setSubmitting(false);
        },
      });
    } catch (e) {
      showToast(e?.response?.data?.detail || 'Could not start checkout');
      setSubmitting(false);
    }
  };

  const subscribePortal = async () => {
    const plan = list.find((p) => (p.plan_id || p._id) === selectedPlan);
    return subscribeFlow(plan);
  };

  return (
    <div className="px-5 pt-5 pb-10 relative">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-white text-sm font-bold shadow-xl"
            style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}>
            <Check className="w-3.5 h-3.5 inline mr-1.5" />{toast}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-xs font-nunito font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.pink }}>
        Subscriptions
      </p>
      <h1 className="font-fredoka font-semibold text-3xl" style={{ color: '#2A1A4A' }}>
        Your care, your way.
      </h1>
      <p className="text-sm font-nunito mt-1" style={{ color: '#6B5784' }}>
        Manage your Portal, Clinician, and Organization subscriptions in one place.
      </p>

      {/* Tabs */}
      <div className="mt-5 flex gap-2">
        {Object.entries(TAB_META).map(([k, m]) => {
          const M = m.icon;
          const isActive = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)}
              data-testid={`sub-tab-${k}`}
              className="flex-1 rounded-2xl py-2.5 flex flex-col items-center gap-0.5 transition"
              style={{
                background: isActive ? `linear-gradient(135deg, ${m.color}, ${m.color}cc)` : 'white',
                color: isActive ? 'white' : '#2A1A4A',
                boxShadow: isActive ? `0 12px 24px -8px ${m.color}88` : '0 6px 14px -8px rgba(0,0,0,0.08)',
              }}>
              <M className="w-4 h-4" />
              <span className="text-[11px] font-bold">{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Current subscription banner */}
      {tab === 'portal' && isPortalActive && (
        <ActiveBanner
          title="Portal subscription active"
          color="#A78BFA"
          icon={Shield}
          plan={activeSub.plan_name}
          price={`$${activeSub.amount_paid || activeSub.price_usd || 0}`}
          start={activeSub.start_date}
          end={activeSub.end_date}
        />
      )}

      {tab === 'clinician' && doctorSubs.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#22D3C5' }}>Your active clinicians</p>
          {doctorSubs.map((d) => (
            <ActiveBanner
              key={d.subscription_id || d.doctor_id}
              title={d.name || 'Clinician'}
              subtitle={d.specialty}
              color="#22D3C5"
              icon={Stethoscope}
              plan={d.plan_name || 'Care plan'}
              price={d.amount_paid_usd ? `$${d.amount_paid_usd}` : 'Free'}
              start={d.start_date || d.subscribed_at}
              end={d.end_date}
            />
          ))}
        </div>
      )}

      {/* Plan list */}
      <div className="mt-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${meta.color}22`, color: meta.color }}>
            <meta.icon className="w-4 h-4" />
          </span>
          <div>
            <p className="font-fredoka font-semibold text-base" style={{ color: '#2A1A4A' }}>{meta.label} plans</p>
            <p className="text-[11px] text-slate-500">{meta.sub}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl p-6 text-center text-sm text-slate-500 bg-white" style={{ boxShadow: '0 12px 28px -12px rgba(0,0,0,0.06)' }}>
            No {meta.label.toLowerCase()} plans available right now.
          </div>
        ) : (
          <div className="space-y-3 relative">
            {list.map((p) => {
              const isSel = selectedPlan === (p.plan_id || p._id);
              const isFree = parseFloat(p.price_usd ?? p.price ?? 0) === 0;
              return (
                <motion.div key={p.plan_id || p._id}
                  data-testid={`${tab}-plan-${p.plan_id || p._id}`}
                  className="w-full text-left rounded-3xl p-5 relative overflow-hidden transition-all"
                  style={{
                    background: isSel ? `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` : 'white',
                    boxShadow: isSel ? `0 18px 40px -12px ${meta.color}88` : '0 10px 24px -12px rgba(26,35,50,0.1)',
                    border: isSel ? `2px solid ${meta.color}` : '2px solid transparent',
                    filter: selectedPlan && !isSel ? 'blur(2px) saturate(0.85)' : 'none',
                    opacity: selectedPlan && !isSel ? 0.6 : 1,
                  }}>
                  {isFree && (
                    <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                      style={{ background: '#22D67E', boxShadow: '0 6px 14px -4px rgba(34,214,126,0.55)' }}>
                      Free Trial
                    </span>
                  )}
                  <div className="flex items-baseline gap-2 mb-1">
                    <p className="font-fredoka font-semibold text-xl" style={{ color: isSel ? 'white' : '#2A1A4A' }}>{p.name || p.plan_name || p.tier_name}</p>
                    {(p.is_trial && p.trial_days) ? (
                      <span className="text-xs font-nunito font-bold" style={{ color: isSel ? '#FEF3C7' : '#B45309' }}>· {p.trial_days}-day trial</span>
                    ) : p.duration_days ? (
                      <span className="text-xs font-nunito" style={{ color: isSel ? 'rgba(255,255,255,0.7)' : '#8F84A8' }}>· {p.duration_days} days</span>
                    ) : null}
                  </div>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="font-fredoka font-bold text-3xl" style={{ color: isSel ? 'white' : meta.color }}>
                      {isFree ? 'Free' : `$${p.price_usd ?? p.price ?? 0}`}
                    </span>
                    {!isFree && <span className="text-xs font-nunito" style={{ color: isSel ? 'rgba(255,255,255,0.7)' : '#8F84A8' }}>USD</span>}
                  </div>
                  <p className="text-[12px] font-nunito leading-relaxed" style={{ color: isSel ? 'rgba(255,255,255,0.92)' : '#5C4D7A' }}>
                    {p.purpose || p.description || p.tagline || 'Plan details available after subscription.'}
                  </p>
                  {p.features && Array.isArray(p.features) && p.features.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {p.features.slice(0, 4).map((f, i) => (
                        <li key={i} className="text-[11px] flex items-center gap-1.5" style={{ color: isSel ? 'rgba(255,255,255,0.92)' : '#5C4D7A' }}>
                          <Check className="w-3 h-3" /> {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Per-card Subscribe CTA — action depends on the plan audience.
                      • portal       → open the Confirm modal then call subscribeFlow()
                      • clinician    → jump to Home → Nearby Doctors with this plan_id
                                       pre-selected (patient must pick a clinician first)
                      • organization → jump to org link flow */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    data-testid={`subscribe-plan-btn-${p.plan_id || p._id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const pid = p.plan_id || p._id;
                      if (tab === 'clinician') {
                        // USP — clinician plans need a clinician picked first.
                        navigate(`/app/home?doctorTab=nearby&plan_id=${pid}`);
                        return;
                      }
                      if (tab === 'organization') {
                        navigate(`/app/my-org?plan_id=${pid}`);
                        return;
                      }
                      // Portal → open confirm modal then subscribe
                      setSelectedPlan(pid);
                    }}
                    className="mt-4 w-full rounded-2xl py-2.5 text-xs font-nunito font-bold flex items-center justify-center gap-1.5 transition"
                    style={{
                      background: isSel
                        ? 'rgba(255,255,255,0.95)'
                        : (isFree
                            ? `linear-gradient(135deg, #22D67E, #06A86C)`
                            : `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`),
                      color: isSel ? meta.color : 'white',
                      boxShadow: `0 12px 24px -10px ${isFree && !isSel ? '#22D67E' : meta.color}88`,
                    }}>
                    {isFree ? (
                      <><Sparkles className="w-3.5 h-3.5" /> Start free trial</>
                    ) : tab === 'clinician' ? (
                      <><ArrowRight className="w-3.5 h-3.5" /> Pick a clinician &amp; subscribe</>
                    ) : tab === 'organization' ? (
                      <><Building2 className="w-3.5 h-3.5" /> Use invite code</>
                    ) : (
                      <><Shield className="w-3.5 h-3.5" /> Subscribe · ${p.price_usd ?? p.price ?? 0}</>
                    )}
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Inline Confirm Modal — opens beside/over the selected plan with blur backdrop */}
        <AnimatePresence>
          {selectedPlan && tab === 'portal' && !isPortalActive && (() => {
            const plan = list.find((p) => (p.plan_id || p._id) === selectedPlan);
            if (!plan) return null;
            const amount = parseFloat(plan.price_usd ?? plan.price ?? 0);
            const isFree = amount === 0;
            return (
              <motion.div
                data-testid="plan-confirm-modal"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-5"
                style={{ background: 'rgba(31,17,71,0.45)', backdropFilter: 'blur(8px)' }}
                onClick={() => !submitting && setSelectedPlan(null)}>
                <motion.div
                  initial={{ scale: 0.85, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 40 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-sm rounded-3xl p-5 relative overflow-hidden"
                  style={{
                    background: 'white',
                    boxShadow: `0 40px 80px -20px ${meta.color}99, 0 16px 30px -12px rgba(31,17,71,0.4)`,
                  }}>
                  {/* Floating 3D plan icon */}
                  <motion.div
                    animate={{ y: [0, -6, 0], rotate: [-2, 2, -2] }} transition={{ duration: 4, repeat: Infinity }}
                    className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
                      boxShadow: `0 16px 30px -8px ${meta.color}aa, inset 0 -4px 10px rgba(0,0,0,0.15)`,
                    }}>
                    <meta.icon className="w-7 h-7 text-white" />
                  </motion.div>

                  <p className="text-[10px] font-nunito font-bold uppercase tracking-widest mt-3 text-center" style={{ color: meta.color }}>
                    Confirm your plan
                  </p>
                  <h3 className="font-fredoka font-semibold text-xl mt-1 text-center" style={{ color: '#2A1A4A' }}>
                    {plan.name || plan.plan_name}
                  </h3>
                  <p className="text-[11px] font-nunito text-center mt-1" style={{ color: '#6B5784' }}>
                    {(plan.is_trial && plan.trial_days) ? plan.trial_days : (plan.duration_days || 30)} days · {plan.purpose || meta.sub}
                  </p>

                  <div className="mt-4 rounded-2xl py-3 px-4 text-center"
                    style={{ background: `${meta.color}10`, border: `1px solid ${meta.color}33` }}>
                    {isFree ? (
                      <>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#15803D' }}>Free Trial</p>
                        <p className="font-fredoka font-bold text-2xl mt-0.5" style={{ color: '#15803D' }}>
                          {(plan.is_trial && plan.trial_days) || plan.duration_days || 30}-day trial
                        </p>
                        <p className="text-[11px] mt-1" style={{ color: '#1B6B3A' }}>No payment now · activates instantly</p>
                      </>
                    ) : (
                      <>
                        <p className="font-fredoka font-bold text-3xl" style={{ color: meta.color }}>${amount}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: '#6B5784' }}>
                          One-time · {plan.duration_days || 30} days access
                        </p>
                      </>
                    )}
                  </div>

                  {plan.features && Array.isArray(plan.features) && plan.features.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {plan.features.slice(0, 4).map((f, i) => (
                        <li key={i} className="text-[11px] flex items-center gap-1.5" style={{ color: '#3D2C53' }}>
                          <Check className="w-3 h-3" style={{ color: meta.color }} /> {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  <Button
                    data-testid="confirm-portal-subscribe"
                    onClick={subscribePortal} disabled={submitting}
                    className="mt-4 w-full rounded-2xl py-3 font-nunito font-bold text-white border-0"
                    style={{
                      background: isFree
                        ? `linear-gradient(135deg, #22D67E, #06A86C)`
                        : `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})`,
                      boxShadow: `0 16px 30px -8px ${isFree ? '#22D67E' : BRAND.pink}aa`,
                    }}>
                    {submitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin inline" /> Working…</>)
                     : isFree ? (<>Start Free Trial &amp; Begin Assessments <ArrowRight className="w-4 h-4 ml-1 inline" /></>)
                     : (<><Shield className="w-4 h-4 mr-1.5 inline -mt-0.5" /> Pay ${amount} with Stripe</>)}
                  </Button>
                  <button data-testid="plan-confirm-cancel" onClick={() => setSelectedPlan(null)} disabled={submitting}
                    className="mt-2 w-full text-center text-[11px] font-nunito font-bold" style={{ color: '#8F84A8' }}>
                    Choose a different plan
                  </button>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {tab === 'organization' && (
          <div className="mt-4 rounded-2xl p-3 text-[11px] text-center font-nunito"
            style={{ background: 'rgba(255,140,63,0.12)', color: '#7A4400', border: '1px solid rgba(255,140,63,0.3)' }}>
            <Building2 className="w-3 h-3 inline mr-1" /> Tap a plan to use your invite code.
          </div>
        )}
      </div>

      {statusMsg && (
        <div className="mt-4 rounded-2xl p-3 text-[12px] text-center font-nunito"
          data-testid="checkout-status-banner"
          style={{ background: '#FFF3D1', color: '#7A5400', border: '1px solid #FFD97A' }}>
          <Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" /> {statusMsg}
        </div>
      )}

      <div className="mt-5 rounded-2xl p-3 text-[11px] text-center font-nunito"
        style={{ background: 'rgba(99,102,241,0.10)', color: '#3730A3', border: '1px solid rgba(99,102,241,0.30)' }}>
        <Shield className="w-3.5 h-3.5 inline mr-1" /> Secure payment via Razorpay · admin-published plans only.
      </div>
    </div>
  );
}

function ActiveBanner({ title, subtitle, color, icon: Icon, plan, price, start, end }) {
  const remaining = daysRemaining(end);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-3xl p-4 relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 18px 40px -14px ${color}88` }}>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
          <Icon className="w-5 h-5 text-white" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-fredoka font-bold text-white truncate">{title}</p>
            <BadgeCheck className="w-4 h-4 text-white/90" />
          </div>
          {subtitle && <p className="text-[11px] text-white/85 truncate">{subtitle}</p>}
          <p className="text-[11px] text-white/85 mt-1">
            <strong>{plan}</strong> · {price}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-white/80">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Started {fmtDate(start)}</span>
            {end && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {remaining} days left · ends {fmtDate(end)}</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
