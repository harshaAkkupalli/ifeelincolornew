/**
 * Organization Portal Subscription — Org Admin pays for their org's
 * IFEELINCOLOR access.
 *
 * Flow:
 *   1. Loads admin-approved plans where audience == 'organization_portal'
 *      from GET /api/organization/portal-plans (Admin-only endpoint).
 *   2. Loads current portal subscription (if any) from
 *      GET /api/organization/portal-subscription.
 *   3. On "Subscribe" → useRazorpayCheckout({ kind: 'organization_portal' }).
 *      Backend razorpay verify handler writes to db.organization_subscriptions.
 *
 * Route: /org/subscribe (Admin-only — Managers are bounced to /org/dashboard).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, CreditCard, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRazorpayCheckout } from '../../lib/razorpay';
import { Button } from '../../components/ui/button';
import { Logo } from '../../components/brand/BrandLogo';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ax = axios.create({ withCredentials: true });

export default function OrganizationSubscribe() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyPlanId, setBusyPlanId] = useState(null);
  const { launchCheckout, configured } = useRazorpayCheckout();

  const isAdmin = (user?.role_tier || 'Org_Admin') !== 'Org_Manager';

  useEffect(() => {
    if (!user) { navigate('/org/login'); return; }
    if (user.role !== 'organization') { navigate('/'); return; }
    if (!isAdmin) {
      toast.error('Only Org Admins can manage the portal subscription.');
      navigate('/org/dashboard');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        ax.get(`${API}/organization/portal-plans`),
        ax.get(`${API}/organization/portal-subscription`),
      ]);
      setPlans(p.data.plans || []);
      setCurrentSub(s.data.subscription || null);
    } catch (e) {
      toast.error('Could not load subscription plans.');
    } finally { setLoading(false); }
  };

  const handleSubscribe = (plan) => {
    if (!configured) {
      toast.error('Razorpay is not configured. Ask your Super Admin to add the keys in /admin/payment-setup.');
      return;
    }
    setBusyPlanId(plan.plan_id);
    launchCheckout({
      kind: 'organization_portal',
      plan_id: plan.plan_id,
      prefill: { name: user.name, email: user.email, contact: user.mobile || '' },
      onSuccess: () => {
        toast.success(`Subscription activated — ${plan.name}`);
        setBusyPlanId(null);
        load();
      },
      onFailure: (e) => {
        if (!e?.dismissed) toast.error(e?.message || 'Payment could not be completed.');
        setBusyPlanId(null);
      },
    });
  };

  if (!user || user.role !== 'organization' || !isAdmin) return null;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #FFF8EE 0%, #FFFFFF 100%)' }} data-testid="org-subscribe-page">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between" style={{
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/org/dashboard')} data-testid="back-to-dashboard"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </button>
          <span className="text-slate-200">·</span>
          <Logo size={26} />
        </div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Portal Subscription</div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6 mb-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #10B981 0%, #34D399 50%, #FB923C 100%)',
            boxShadow: '0 24px 50px -18px #10B98166',
          }}
        >
          <CreditCard className="w-7 h-7 text-white mb-2" />
          <h1 className="text-2xl font-fredoka font-bold text-white">Subscribe to IFEELINCOLOR</h1>
          <p className="text-sm text-white/85 mt-1 max-w-xl">
            Power your organization with the full IFEELINCOLOR platform — patient check-ins, 3D somatic maps, clinician AI Coach, and audit-ready reports.
          </p>
          {!configured && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-white/20 text-white">
              <AlertCircle className="w-3 h-3" />
              Razorpay not configured — contact Super Admin
            </div>
          )}
        </motion.div>

        {/* Current subscription */}
        {currentSub && (
          <div className="mb-6 rounded-2xl p-4 flex items-center gap-3"
            style={{ background: '#ECFDF5', border: '1px solid #10B98144' }}
            data-testid="current-subscription-card">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-emerald-800">
                Active subscription · {currentSub.plan_name}
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Valid until {currentSub.end_date?.split('T')[0]} ·
                Paid {currentSub.amount_paid} {currentSub.currency || 'INR'}
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
        )}

        {/* Plans grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl bg-white border border-slate-100 p-6 h-64 animate-pulse" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-3xl bg-white border border-slate-100 p-12 text-center" data-testid="plans-empty">
            <Sparkles className="w-10 h-10 mx-auto text-slate-200 mb-3" />
            <p className="text-sm font-semibold text-slate-700">No organization plans available yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Ask your IFEELINCOLOR account manager to publish an Organization plan, or check back later.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="plans-grid">
            {plans.map(plan => {
              const featured = !!plan.featured;
              const isCurrent = currentSub?.plan_id === plan.plan_id;
              return (
                <motion.div
                  key={plan.plan_id}
                  whileHover={{ y: -4 }}
                  className="rounded-2xl bg-white p-6 flex flex-col relative"
                  style={{
                    border: featured ? '2px solid #10B981' : '1px solid #E2E8F0',
                    boxShadow: featured ? '0 24px 50px -20px #10B98144' : '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                  data-testid={`plan-card-${plan.plan_id}`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-6 text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded-full text-white"
                      style={{ background: '#10B981' }}>
                      Recommended
                    </span>
                  )}
                  <h3 className="text-base font-fredoka font-bold text-slate-800">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{plan.description || 'Full IFEELINCOLOR access for your organization.'}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-fredoka font-bold text-slate-900">
                      {plan.currency_symbol || '₹'}{plan.price_usd ?? plan.price ?? 0}
                    </span>
                    <span className="text-xs text-slate-400">/ {plan.duration_days || 30}d</span>
                  </div>
                  {Array.isArray(plan.features) && plan.features.length > 0 && (
                    <ul className="mt-4 space-y-1.5 text-xs text-slate-600 flex-1">
                      {plan.features.slice(0, 5).map((f, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    onClick={() => handleSubscribe(plan)}
                    disabled={busyPlanId === plan.plan_id || isCurrent || !configured}
                    data-testid={`subscribe-btn-${plan.plan_id}`}
                    className="mt-5 w-full text-white border-0 rounded-xl text-xs h-10"
                    style={{
                      background: isCurrent
                        ? '#94A3B8'
                        : (featured ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #6366F1, #4F46E5)'),
                      opacity: !configured && !isCurrent ? 0.5 : 1,
                    }}
                  >
                    {isCurrent
                      ? 'Current plan'
                      : busyPlanId === plan.plan_id
                        ? 'Opening checkout…'
                        : 'Subscribe'}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Footnote */}
        <div className="mt-8 text-center text-[10px] text-slate-400">
          <ShieldCheck className="w-3 h-3 inline-block mr-1 text-emerald-500" />
          Payments are processed by Razorpay · HIPAA-aligned data handling · GST invoice emailed on success.
        </div>
      </div>
    </div>
  );
}
