import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ArrowLeft, ArrowRight, Check, Eye, EyeOff, Shield, Upload, Loader2, MapPin, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { useAuth } from '../contexts/AuthContext';
import { LOGO_URL, BRAND } from '../brand';

import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PatientSignup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateUser } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pinLookup, setPinLookup] = useState(false);
  const [pinError, setPinError] = useState('');
  const [form, setForm] = useState({
    full_name: '', email: location.state?.email || '', password: '', date_of_birth: '', phone: '',
    pincode: '', country: 'IN', city: '', state: '', address: '',
    is_minor: false, guardian_name: '', guardian_relationship: '', guardian_email: '',
    guardian_phone: '', guardian_pincode: '', guardian_city: '', guardian_state: '', guardian_address: '',
    guardian_consent: false, guardian_id_data: '', guardian_signature: '', terms_accepted: false,
  });

  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Pincode autofill — uses Zippopotam (free, no key). Falls back to India PostalPIN for IN.
  const lookupPincode = async (which = 'self') => {
    const pin = (which === 'self' ? form.pincode : form.guardian_pincode || '').trim();
    const country = (which === 'self' ? form.country : 'IN') || 'IN';
    if (!pin) { setPinError('Enter a pincode/zip first'); return; }
    setPinError(''); setPinLookup(true);
    try {
      let city = '', state = '';
      if (country === 'IN') {
        // India-specific (PostalPIN) — supports 6-digit Indian pincodes
        const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = await r.json();
        const po = data?.[0]?.PostOffice?.[0];
        if (po) { city = po.District || po.Block || po.Name; state = po.State; }
      } else {
        const r = await fetch(`https://api.zippopotam.us/${country.toLowerCase()}/${pin}`);
        if (r.ok) {
          const data = await r.json();
          const p0 = data?.places?.[0];
          if (p0) { city = p0['place name']; state = p0['state']; }
        }
      }
      if (!city) { setPinError('Could not find this pincode. Please type the address manually.'); }
      else {
        if (which === 'self') setForm(f => ({ ...f, city, state }));
        else setForm(f => ({ ...f, guardian_city: city, guardian_state: state }));
      }
    } catch {
      setPinError('Lookup unavailable. Please type the address manually.');
    } finally { setPinLookup(false); }
  };

  // Calculate age from DOB
  const calcAge = (dob) => {
    if (!dob) return null;
    const d = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return age;
  };

  const age = calcAge(form.date_of_birth);
  const isMinor = age !== null && age < 18;

  // Auto-update is_minor when DOB changes
  React.useEffect(() => { if (age !== null) u('is_minor', age < 18); }, [age]); // eslint-disable-line

  // Steps: 0=Basic, 1=Guardian(if minor)/Contact(if adult), 2=Password+Terms
  const STEPS = isMinor ? ['Your Info', 'Guardian Details', 'ID & Consent', 'Create Account'] : ['Your Info', 'Contact Details', 'Create Account'];

  const handleFileUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => u(field, reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    try {
      // Compose final address string from city/state/pincode + specific details
      const composeAddress = (specific, city, state, pin, country) => {
        const parts = [specific, city, state, pin, country].filter(Boolean);
        return parts.join(', ');
      };
      const payload = {
        ...form,
        address: composeAddress(form.address, form.city, form.state, form.pincode, form.country),
        guardian_address: composeAddress(form.guardian_address, form.guardian_city, form.guardian_state, form.guardian_pincode, form.country),
      };
      const res = await axios.post(`${API}/auth/register/patient`, payload, { withCredentials: true });
      updateUser(res.data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally { setSubmitting(false); }
  };

  const canNext = () => {
    if (step === 0) return form.full_name && form.email && form.date_of_birth;
    if (isMinor && step === 1) return form.guardian_name && form.guardian_relationship && form.guardian_email && form.guardian_phone;
    if (isMinor && step === 2) return form.guardian_consent;
    if (!isMinor && step === 1) return true;
    return form.password.length >= 6 && form.terms_accepted;
  };

  const lastStep = STEPS.length - 1;

  const slideV = { enter: { opacity: 0, x: 40 }, center: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -40 } };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(180deg, #FFF8E7, #FFE8C8)' }}>
      <div className="w-full max-w-[430px] mx-auto">
        {/* Mobile app frame */}
        <div className="rounded-[2rem] overflow-hidden shadow-2xl" style={{ background: '#FFFFFF', minHeight: '85vh', boxShadow: '0 25px 80px rgba(0,0,0,0.12)' }}>
          {/* Status bar */}
          <div className="px-6 pt-4 pb-2 flex items-center justify-between">
            <button onClick={() => step > 0 ? setStep(step - 1) : navigate('/mobile-home')} data-testid="patient-signup-back"
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'rgba(255,107,157,0.1)' }}>
              <ArrowLeft className="w-4 h-4" style={{ color: '#FF6B9D' }} />
            </button>
            <div className="flex items-center gap-1.5">
              <img src={LOGO_URL} alt="IFEELINCOLOR" className="w-6 h-6 object-contain" />
              <span className="text-xs font-fredoka font-semibold" style={{ background: `linear-gradient(90deg, ${BRAND.green}, ${BRAND.blue}, ${BRAND.pink})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>IFEELINCOLOR</span>
            </div>
            <div className="w-9" />
          </div>

          {/* Progress */}
          <div className="px-6 py-2">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: 'rgba(255,107,157,0.14)', color: '#FF6B9D' }} data-testid="signup-role-badge-patient">
                ◉ Patient sign-up
              </span>
            </div>
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div key={i} className="flex-1 h-1 rounded-full transition-all" style={{ background: i <= step ? '#FF6B9D' : '#F0E0D0' }} />
              ))}
            </div>
            <p className="text-[10px] font-nunito mt-1.5 text-center" style={{ color: '#B89878' }}>{STEPS[step]}</p>
          </div>

          {/* Content */}
          <div className="px-6 py-4 flex-1">
            <AnimatePresence mode="wait">
              <motion.div key={step} variants={slideV} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>

                {/* Step 0: Basic Info */}
                {step === 0 && (
                  <div className="space-y-5">
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-fredoka font-semibold" style={{ color: '#3D2C2C' }}>Tell us about you</h2>
                      <p className="text-xs font-nunito mt-1" style={{ color: '#B89878' }}>We provide whole person, whole life care</p>
                    </div>
                    <div><label className="text-xs font-nunito font-medium mb-1 block" style={{ color: '#5A4234' }}>Full Name *</label>
                      <Input data-testid="patient-reg-name" value={form.full_name} onChange={e => u('full_name', e.target.value)} placeholder="Your full name" className="rounded-xl border-2 py-3 font-nunito" style={{ borderColor: '#F0E0D0' }} /></div>
                    {location.state?.email ? (
                      <div className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
                        style={{ background: '#FFF8F0', border: '1px solid #F0E0D0' }} data-testid="email-prefilled-banner">
                        <div className="min-w-0">
                          <p className="text-[10px] font-nunito font-bold uppercase tracking-wider" style={{ color: '#FF6B9D' }}>Continuing as</p>
                          <p className="text-xs font-nunito truncate" style={{ color: '#3D2C2C' }}>{form.email}</p>
                        </div>
                        <button type="button" data-testid="change-email-link"
                          onClick={() => { u('email', ''); navigate('/mobile-home', { state: { changeEmail: true } }); }}
                          className="text-[10px] font-nunito font-bold underline" style={{ color: '#FF6B9D' }}>
                          Change
                        </button>
                      </div>
                    ) : (
                      <div><label className="text-xs font-nunito font-medium mb-1 block" style={{ color: '#5A4234' }}>Email *</label>
                        <Input data-testid="patient-reg-email" type="email" value={form.email} onChange={e => u('email', e.target.value)} placeholder="your@email.com" className="rounded-xl border-2 py-3 font-nunito" style={{ borderColor: '#F0E0D0' }} /></div>
                    )}
                    <div><label className="text-xs font-nunito font-medium mb-1 block" style={{ color: '#5A4234' }}>Date of Birth *</label>
                      <Input data-testid="patient-reg-dob" type="date" value={form.date_of_birth} onChange={e => u('date_of_birth', e.target.value)} className="rounded-xl border-2 py-3 font-nunito" style={{ borderColor: '#F0E0D0' }} /></div>
                    {age !== null && (
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-xl text-xs font-nunito" style={{ background: isMinor ? '#FFF0F0' : '#F0FFF4', color: isMinor ? '#C53030' : '#2F855A' }}>
                        {isMinor ? `Age: ${age} — Guardian/parent information will be required` : `Age: ${age} — You can register independently`}
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Step 1 (Minor): Guardian Info */}
                {isMinor && step === 1 && (
                  <div className="space-y-4">
                    <div className="text-center mb-4">
                      <Shield className="w-8 h-8 mx-auto mb-2" style={{ color: '#FF6B9D' }} />
                      <h2 className="text-xl font-fredoka font-semibold" style={{ color: '#3D2C2C' }}>Guardian Information</h2>
                      <p className="text-[10px] font-nunito mt-1" style={{ color: '#B89878' }}>Required for patients under 18</p>
                    </div>
                    <Input data-testid="guardian-name" value={form.guardian_name} onChange={e => u('guardian_name', e.target.value)} placeholder="Guardian Full Name *" className="rounded-xl border-2 py-3 font-nunito" style={{ borderColor: '#F0E0D0' }} />
                    <Input data-testid="guardian-relationship" value={form.guardian_relationship} onChange={e => u('guardian_relationship', e.target.value)} placeholder="Relationship (Parent, Legal Guardian) *" className="rounded-xl border-2 py-3 font-nunito" style={{ borderColor: '#F0E0D0' }} />
                    <Input data-testid="guardian-email" type="email" value={form.guardian_email} onChange={e => u('guardian_email', e.target.value)} placeholder="Guardian Email *" className="rounded-xl border-2 py-3 font-nunito" style={{ borderColor: '#F0E0D0' }} />
                    <Input data-testid="guardian-phone" value={form.guardian_phone} onChange={e => u('guardian_phone', e.target.value)} placeholder="Guardian Phone *" className="rounded-xl border-2 py-3 font-nunito" style={{ borderColor: '#F0E0D0' }} />

                    {/* Guardian pincode → city/state */}
                    <div className="relative">
                      <Input data-testid="guardian-pincode" value={form.guardian_pincode}
                        onChange={e => u('guardian_pincode', e.target.value.replace(/\s+/g, ''))}
                        onBlur={() => form.guardian_pincode && lookupPincode('guardian')}
                        placeholder="Pincode / ZIP" className="rounded-xl border-2 py-3 font-nunito pr-10" style={{ borderColor: '#F0E0D0' }} />
                      <button type="button" onClick={() => lookupPincode('guardian')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg"
                        style={{ background: '#FF6B9D22', color: '#FF6B9D' }}>
                        {pinLookup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input data-testid="guardian-city" value={form.guardian_city} onChange={e => u('guardian_city', e.target.value)} placeholder="City"
                        className="rounded-xl border-2 py-3 font-nunito" style={{ borderColor: form.guardian_city ? '#7DD87D' : '#F0E0D0' }} />
                      <Input data-testid="guardian-state" value={form.guardian_state} onChange={e => u('guardian_state', e.target.value)} placeholder="State"
                        className="rounded-xl border-2 py-3 font-nunito" style={{ borderColor: form.guardian_state ? '#7DD87D' : '#F0E0D0' }} />
                    </div>
                    <Textarea data-testid="guardian-address" value={form.guardian_address} onChange={e => u('guardian_address', e.target.value)} placeholder="Specific location: house/flat, street, landmark…" className="rounded-xl border-2 font-nunito min-h-[60px]" style={{ borderColor: '#F0E0D0' }} />
                  </div>
                )}

                {/* Step 2 (Minor): ID + Consent */}
                {isMinor && step === 2 && (
                  <div className="space-y-5">
                    <div className="text-center mb-4">
                      <h2 className="text-xl font-fredoka font-semibold" style={{ color: '#3D2C2C' }}>Verification & Consent</h2>
                    </div>
                    <div className="p-4 rounded-xl border-2 border-dashed" style={{ borderColor: form.guardian_id_data ? '#7DD87D' : '#F0E0D0' }}>
                      <p className="text-xs font-nunito font-medium mb-2" style={{ color: '#5A4234' }}>Government ID Upload</p>
                      <label className="flex items-center justify-center gap-2 py-4 cursor-pointer">
                        <Upload className="w-4 h-4" style={{ color: form.guardian_id_data ? '#7DD87D' : '#B89878' }} />
                        <span className="text-xs font-nunito" style={{ color: '#B89878' }}>{form.guardian_id_data ? 'ID Uploaded' : 'Tap to upload'}</span>
                        <input type="file" accept="image/*,.pdf" onChange={e => handleFileUpload(e, 'guardian_id_data')} className="hidden" />
                      </label>
                    </div>
                    <div className="p-4 rounded-xl border-2 border-dashed" style={{ borderColor: form.guardian_signature ? '#7DD87D' : '#F0E0D0' }}>
                      <p className="text-xs font-nunito font-medium mb-2" style={{ color: '#5A4234' }}>Digital Signature</p>
                      <Input data-testid="guardian-signature" value={form.guardian_signature} onChange={e => u('guardian_signature', e.target.value)} placeholder="Type your full legal name as signature" className="rounded-xl border-0 bg-transparent font-nunito italic text-center" style={{ color: '#3D2C2C' }} />
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: '#FFF8F0' }}>
                      <Checkbox data-testid="guardian-consent-check" checked={form.guardian_consent} onCheckedChange={v => u('guardian_consent', v)} className="mt-0.5" />
                      <p className="text-xs font-nunito leading-relaxed" style={{ color: '#5A4234' }}>
                        I, as the legal guardian, consent to this minor's participation in the IFEELINCOLOR wellness program and authorize the collection and use of their emotional and somatic data for therapeutic purposes.
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 1 (Adult): Contact */}
                {!isMinor && step === 1 && (
                  <div className="space-y-4">
                    <div className="text-center mb-3">
                      <h2 className="text-xl font-fredoka font-semibold" style={{ color: '#3D2C2C' }}>Contact Details</h2>
                      <p className="text-[10px] font-nunito" style={{ color: '#B89878' }}>Optional but helps us support you better</p>
                    </div>

                    {/* Country code + Phone (country selector lives here) */}
                    <div className="flex gap-2">
                      <select data-testid="patient-reg-country" value={form.country} onChange={e => u('country', e.target.value)}
                        className="rounded-xl border-2 py-3 px-2 text-sm font-nunito outline-none" style={{ borderColor: '#F0E0D0', width: 130 }}>
                        <option value="IN">🇮🇳 IN +91</option>
                        <option value="US">🇺🇸 US +1</option>
                        <option value="GB">🇬🇧 GB +44</option>
                        <option value="AU">🇦🇺 AU +61</option>
                        <option value="CA">🇨🇦 CA +1</option>
                        <option value="DE">🇩🇪 DE +49</option>
                      </select>
                      <Input data-testid="patient-reg-phone" value={form.phone} onChange={e => u('phone', e.target.value)}
                        placeholder="Phone Number" className="rounded-xl border-2 py-3 font-nunito flex-1" style={{ borderColor: '#F0E0D0' }} />
                    </div>

                    {/* Pincode (full width) */}
                    <div className="relative">
                      <Input data-testid="patient-reg-pincode" value={form.pincode}
                        onChange={e => u('pincode', e.target.value.replace(/\s+/g, ''))}
                        onBlur={() => form.pincode && lookupPincode('self')}
                        placeholder="Pincode / ZIP" className="rounded-xl border-2 py-3 font-nunito pr-10" style={{ borderColor: '#F0E0D0' }} />
                      <button type="button" data-testid="patient-reg-pincode-lookup"
                        onClick={() => lookupPincode('self')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg"
                        style={{ background: '#FF6B9D22', color: '#FF6B9D' }}>
                        {pinLookup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {pinError && <p className="text-[10px] text-red-500 font-nunito">{pinError}</p>}

                    {/* Autofilled city/state */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-nunito font-bold uppercase tracking-wider mb-1 block" style={{ color: '#B89878' }}>City</label>
                        <Input data-testid="patient-reg-city" value={form.city} onChange={e => u('city', e.target.value)} placeholder="Auto-filled from pincode"
                          className="rounded-xl border-2 py-3 font-nunito" style={{ borderColor: form.city ? '#7DD87D' : '#F0E0D0' }} />
                      </div>
                      <div>
                        <label className="text-[10px] font-nunito font-bold uppercase tracking-wider mb-1 block" style={{ color: '#B89878' }}>State</label>
                        <Input data-testid="patient-reg-state" value={form.state} onChange={e => u('state', e.target.value)} placeholder="Auto-filled"
                          className="rounded-xl border-2 py-3 font-nunito" style={{ borderColor: form.state ? '#7DD87D' : '#F0E0D0' }} />
                      </div>
                    </div>

                    {/* Specific address */}
                    <div>
                      <label className="text-[10px] font-nunito font-bold uppercase tracking-wider mb-1 block flex items-center gap-1" style={{ color: '#B89878' }}>
                        <MapPin className="w-3 h-3" /> Specific Location Details
                      </label>
                      <Textarea data-testid="patient-reg-address" value={form.address} onChange={e => u('address', e.target.value)}
                        placeholder="House/Flat no., Street, Landmark, Locality…"
                        className="rounded-xl border-2 font-nunito min-h-[70px]" style={{ borderColor: '#F0E0D0' }} />
                    </div>
                  </div>
                )}

                {/* Final Step: Password + Terms */}
                {step === lastStep && (
                  <div className="space-y-5">
                    <div className="text-center mb-4">
                      <h2 className="text-xl font-fredoka font-semibold" style={{ color: '#3D2C2C' }}>Almost there!</h2>
                    </div>
                    <div className="relative">
                      <Input data-testid="patient-reg-password" type={showPw ? 'text' : 'password'} value={form.password} onChange={e => u('password', e.target.value)} placeholder="Create a password (min 6 chars)" className="rounded-xl border-2 py-3 font-nunito pr-10" style={{ borderColor: '#F0E0D0' }} />
                      <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#B89878' }}>{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: '#FFF8F0' }}>
                      <Checkbox data-testid="patient-terms-check" checked={form.terms_accepted} onCheckedChange={v => u('terms_accepted', v)} className="mt-0.5" />
                      <p className="text-xs font-nunito leading-relaxed" style={{ color: '#5A4234' }}>
                        I agree to the IFEELINCOLOR Terms of Service and Privacy Policy. I understand that my data will be used to provide whole-person therapeutic guidance and support.
                      </p>
                    </div>
                    {error && <p className="text-xs text-red-500 font-nunito text-center">{error}</p>}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom nav */}
          <div className="px-6 pb-8 pt-4">
            {step === lastStep ? (
              <Button data-testid="patient-signup-submit" onClick={handleSubmit} disabled={!canNext() || submitting}
                className="w-full rounded-xl py-4 text-sm font-nunito font-bold text-white border-0 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #FF6B9D, #FF8E53)' }}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                {submitting ? 'Creating...' : 'Create My Account'}
              </Button>
            ) : (
              <Button data-testid="patient-signup-next" onClick={() => setStep(step + 1)} disabled={!canNext()}
                className="w-full rounded-xl py-4 text-sm font-nunito font-bold text-white border-0 disabled:opacity-50"
                style={{ background: '#FF6B9D' }}>
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            <p className="text-center text-[10px] font-nunito mt-3" style={{ color: '#B89878' }}>
              Already have an account? <button onClick={() => navigate('/patient-portal')} className="underline cursor-pointer" style={{ color: '#FF6B9D' }}>Sign in</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
