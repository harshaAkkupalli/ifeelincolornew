import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader2, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuth } from '../contexts/AuthContext';
import { LOGO_URL } from '../brand';
import OnboardingCarousel from '../components/OnboardingCarousel';
import SplashIntro from '../components/SplashIntro';
import { CLINICIAN_ONBOARDING } from '../lib/onboardingScreens';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LICENSE_TYPES = ['MD', 'DO', 'PhD', 'PsyD', 'LCSW', 'LMFT', 'LPC', 'NP', 'PA', 'RN', 'OT', 'SLP', 'BCBA', 'Other'];
const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const SPECIALIZATIONS = ['Autism Spectrum Disorder', 'ADHD', 'Behavioral Health', 'Child Psychology', 'Developmental Disabilities', 'Emotional Disturbances', 'Family Therapy', 'Neurofeedback', 'Occupational Therapy', 'Speech-Language Pathology', 'Psychiatry', 'General Practice', 'Other'];

export default function ClinicianSignup() {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.localStorage.getItem('ifc_onboard_seen_clinician');
  });
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.localStorage.getItem('ifc_onboard_seen_clinician');
  });
  const finishOnboarding = () => {
    try { window.localStorage.setItem('ifc_onboard_seen_clinician', '1'); } catch { /* ignore */ }
    setShowOnboarding(false);
  };
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '',
    npi_number: '', license_type: '', license_number: '',
    state_of_practice: '', dea_number: '', specialization: '',
    practice_name: '', terms_accepted: false,
  });
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const STEPS = ['Personal Info', 'Credentials', 'Practice Details', 'Create Account'];

  const canNext = () => {
    if (step === 0) return form.full_name && form.email && form.phone;
    if (step === 1) return form.npi_number && form.license_type && form.license_number && form.state_of_practice;
    if (step === 2) return form.specialization && form.practice_name;
    return form.password.length >= 6 && form.terms_accepted;
  };

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    try {
      const res = await axios.post(`${API}/auth/register/clinician`, form, { withCredentials: true });
      updateUser(res.data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally { setSubmitting(false); }
  };

  const slideV = { enter: { opacity: 0, x: 40 }, center: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -40 } };

  return (
    <>
    {showSplash && <SplashIntro onFinish={() => setShowSplash(false)} duration={1800} />}
    {!showSplash && showOnboarding && (
      <OnboardingCarousel
        screens={CLINICIAN_ONBOARDING}
        intervalMs={6000}
        onFinish={finishOnboarding}
        testidPrefix="onboarding-clinician-signup"
      />
    )}
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F0F5FA' }}>
      <div className="w-full max-w-[430px] mx-auto">
        <div className="rounded-[2rem] overflow-hidden shadow-2xl" style={{ background: '#FFFFFF', minHeight: '85vh', boxShadow: '0 25px 80px rgba(15,41,66,0.15)' }}>
          {/* Header */}
          <div className="px-6 pt-4 pb-2 flex items-center justify-between">
            <button onClick={() => step > 0 ? setStep(step - 1) : navigate('/mobile-home')} data-testid="clinician-signup-back"
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'rgba(17,138,178,0.08)' }}>
              <ArrowLeft className="w-4 h-4" style={{ color: '#118AB2' }} />
            </button>
            <div className="flex items-center gap-1.5">
              <img src={LOGO_URL} alt="" className="w-6 h-6 object-contain" />
              <span className="text-xs font-semibold" style={{ color: '#0F2942' }}>Clinician Portal</span>
            </div>
            <div className="w-9" />
          </div>

          {/* Progress */}
          <div className="px-6 py-2">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: 'rgba(34,211,197,0.14)', color: '#0E7490' }} data-testid="signup-role-badge-clinician">
                ◉ Clinician sign-up
              </span>
            </div>
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => <div key={i} className="flex-1 h-1 rounded-full" style={{ background: i <= step ? '#118AB2' : '#E8EFF5' }} />)}
            </div>
            <p className="text-[10px] mt-1.5 text-center" style={{ color: '#6B8CAE' }}>{STEPS[step]}</p>
          </div>

          {/* Content */}
          <div className="px-6 py-4 flex-1">
            <AnimatePresence mode="wait">
              <motion.div key={step} variants={slideV} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>

                {step === 0 && (
                  <div className="space-y-4">
                    <div className="text-center mb-5">
                      <h2 className="text-xl font-semibold" style={{ color: '#0F2942' }}>Personal Information</h2>
                      <p className="text-[10px] mt-1" style={{ color: '#6B8CAE' }}>Join our network of specialized care providers</p>
                    </div>
                    <div><label className="text-[11px] font-medium mb-1 block" style={{ color: '#0F2942' }}>Full Name *</label>
                      <Input data-testid="clin-reg-name" value={form.full_name} onChange={e => u('full_name', e.target.value)} placeholder="Dr. Jane Smith" className="rounded-xl border-2 py-3" style={{ borderColor: '#E8EFF5' }} /></div>
                    <div><label className="text-[11px] font-medium mb-1 block" style={{ color: '#0F2942' }}>Professional Email *</label>
                      <Input data-testid="clin-reg-email" type="email" value={form.email} onChange={e => u('email', e.target.value)} placeholder="jane.smith@practice.com" className="rounded-xl border-2 py-3" style={{ borderColor: '#E8EFF5' }} /></div>
                    <div><label className="text-[11px] font-medium mb-1 block" style={{ color: '#0F2942' }}>Phone Number *</label>
                      <Input data-testid="clin-reg-phone" value={form.phone} onChange={e => u('phone', e.target.value)} placeholder="(555) 123-4567" className="rounded-xl border-2 py-3" style={{ borderColor: '#E8EFF5' }} /></div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-4">
                    <div className="text-center mb-5">
                      <FileText className="w-7 h-7 mx-auto mb-2" style={{ color: '#118AB2' }} />
                      <h2 className="text-xl font-semibold" style={{ color: '#0F2942' }}>Professional Credentials</h2>
                    </div>
                    <div><label className="text-[11px] font-medium mb-1 block" style={{ color: '#0F2942' }}>NPI Number *</label>
                      <Input data-testid="clin-reg-npi" value={form.npi_number} onChange={e => u('npi_number', e.target.value)} placeholder="10-digit NPI" className="rounded-xl border-2 py-3" style={{ borderColor: '#E8EFF5' }} /></div>
                    <div><label className="text-[11px] font-medium mb-1 block" style={{ color: '#0F2942' }}>License Type *</label>
                      <Select value={form.license_type} onValueChange={v => u('license_type', v)}>
                        <SelectTrigger data-testid="clin-reg-license-type" className="rounded-xl border-2 py-3" style={{ borderColor: '#E8EFF5' }}><SelectValue placeholder="Select license type" /></SelectTrigger>
                        <SelectContent>{LICENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select></div>
                    <div><label className="text-[11px] font-medium mb-1 block" style={{ color: '#0F2942' }}>License Number *</label>
                      <Input data-testid="clin-reg-license-num" value={form.license_number} onChange={e => u('license_number', e.target.value)} placeholder="License number" className="rounded-xl border-2 py-3" style={{ borderColor: '#E8EFF5' }} /></div>
                    <div><label className="text-[11px] font-medium mb-1 block" style={{ color: '#0F2942' }}>State of Practice *</label>
                      <Select value={form.state_of_practice} onValueChange={v => u('state_of_practice', v)}>
                        <SelectTrigger data-testid="clin-reg-state" className="rounded-xl border-2 py-3" style={{ borderColor: '#E8EFF5' }}><SelectValue placeholder="Select state" /></SelectTrigger>
                        <SelectContent>{STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select></div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div className="text-center mb-5">
                      <ShieldCheck className="w-7 h-7 mx-auto mb-2" style={{ color: '#118AB2' }} />
                      <h2 className="text-xl font-semibold" style={{ color: '#0F2942' }}>Practice Details</h2>
                    </div>
                    <div><label className="text-[11px] font-medium mb-1 block" style={{ color: '#0F2942' }}>DEA Number</label>
                      <Input data-testid="clin-reg-dea" value={form.dea_number} onChange={e => u('dea_number', e.target.value)} placeholder="Optional" className="rounded-xl border-2 py-3" style={{ borderColor: '#E8EFF5' }} /></div>
                    <div><label className="text-[11px] font-medium mb-1 block" style={{ color: '#0F2942' }}>Specialization *</label>
                      <Select value={form.specialization} onValueChange={v => u('specialization', v)}>
                        <SelectTrigger data-testid="clin-reg-spec" className="rounded-xl border-2 py-3" style={{ borderColor: '#E8EFF5' }}><SelectValue placeholder="Select specialization" /></SelectTrigger>
                        <SelectContent>{SPECIALIZATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select></div>
                    <div><label className="text-[11px] font-medium mb-1 block" style={{ color: '#0F2942' }}>Practice Name *</label>
                      <Input data-testid="clin-reg-practice" value={form.practice_name} onChange={e => u('practice_name', e.target.value)} placeholder="Your practice or organization" className="rounded-xl border-2 py-3" style={{ borderColor: '#E8EFF5' }} /></div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    <div className="text-center mb-4">
                      <h2 className="text-xl font-semibold" style={{ color: '#0F2942' }}>Secure Your Account</h2>
                    </div>
                    <div className="relative">
                      <Input data-testid="clin-reg-password" type={showPw ? 'text' : 'password'} value={form.password} onChange={e => u('password', e.target.value)} placeholder="Create password (min 6 chars)" className="rounded-xl border-2 py-3 pr-10" style={{ borderColor: '#E8EFF5' }} />
                      <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#6B8CAE' }}>{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: '#F0F7FB' }}>
                      <Checkbox data-testid="clin-terms-check" checked={form.terms_accepted} onCheckedChange={v => u('terms_accepted', v)} className="mt-0.5" />
                      <p className="text-xs leading-relaxed" style={{ color: '#0F2942' }}>
                        I confirm that all professional credentials provided are accurate and current. I agree to the IFEELINCOLOR Clinician Terms of Service, HIPAA compliance requirements, and data handling policies.
                      </p>
                    </div>
                    {error && <p className="text-xs text-red-500 text-center">{error}</p>}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom */}
          <div className="px-6 pb-8 pt-4">
            {step === 3 ? (
              <Button data-testid="clinician-signup-submit" onClick={handleSubmit} disabled={!canNext() || submitting}
                className="w-full rounded-xl py-4 text-sm font-semibold text-white border-0 disabled:opacity-50" style={{ background: '#118AB2' }}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                {submitting ? 'Creating...' : 'Create Clinician Account'}
              </Button>
            ) : (
              <Button data-testid="clinician-signup-next" onClick={() => setStep(step + 1)} disabled={!canNext()}
                className="w-full rounded-xl py-4 text-sm font-semibold text-white border-0 disabled:opacity-50" style={{ background: '#118AB2' }}>
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            <p className="text-center text-[10px] mt-3" style={{ color: '#6B8CAE' }}>
              Already registered? <button onClick={() => navigate('/clinician-portal')} className="underline cursor-pointer" style={{ color: '#118AB2' }}>Sign in</button>
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
