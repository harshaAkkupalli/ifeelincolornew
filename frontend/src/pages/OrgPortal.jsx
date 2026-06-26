import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Heart, ArrowRight, Shield, Users, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function OrgPortal() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const res = await axios.get(`${API}/org/${slug}`);
        setOrg(res.data);
      } catch { setError(true); }
      finally { setLoading(false); }
    };
    fetchOrg();
  }, [slug]);

  const handleLogin = () => {
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F172A' }}>
      <div className="w-10 h-10 rounded-full animate-pulse bg-blue-500" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#0F172A' }}>
      <Building2 className="w-12 h-12 text-slate-600" />
      <h1 className="text-xl font-semibold text-white">Organization Not Found</h1>
      <p className="text-sm text-slate-400">The organization "{slug}" does not exist.</p>
      <Button onClick={() => navigate('/')} className="rounded-lg text-xs bg-blue-600 text-white border-0 mt-2">Go to Homepage</Button>
    </div>
  );

  // Generate brand color from org name
  const nameHash = org.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = nameHash % 360;
  const brandColor = `hsl(${hue}, 65%, 55%)`;
  const brandLight = `hsl(${hue}, 65%, 95%)`;
  const brandDark = `hsl(${hue}, 65%, 25%)`;

  return (
    <div className="min-h-screen" style={{ background: brandLight }}>
      {/* Branded gradient bar */}
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${brandColor}, ${brandDark})` }} />

      <div className="max-w-5xl mx-auto px-6">
        {/* Nav */}
        <nav className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-lg" style={{ background: brandColor }}>
              {org.name.charAt(0)}
            </div>
            <div>
              <span className="text-lg font-fredoka font-semibold" style={{ color: brandDark }}>{org.name}</span>
              <span className="text-[10px] block tracking-widest uppercase" style={{ color: brandColor }}>Powered by IFEELINCOLOR</span>
            </div>
          </div>
          <Button data-testid="org-portal-login" onClick={handleLogin} className="rounded-full px-6 text-xs font-bold text-white border-0" style={{ background: brandColor }}>
            Sign In
          </Button>
        </nav>

        {/* Hero */}
        <div className="py-16 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-white text-3xl font-bold" style={{ background: brandColor, boxShadow: `0 12px 40px ${brandColor}44` }}>
              {org.name.charAt(0)}
            </div>
            <h1 className="text-4xl sm:text-5xl font-fredoka font-semibold mb-4" style={{ color: brandDark }}>
              Welcome to {org.name}
            </h1>
            <p className="text-base font-nunito leading-relaxed max-w-2xl mx-auto mb-8" style={{ color: `hsl(${hue}, 30%, 45%)` }}>
              We provide whole person, whole life, wholistic red carpet services. Our organization partners with families, caregivers, and professionals to build care plans centered on your needs, values, and beliefs.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={handleLogin} className="rounded-full px-8 py-3 text-sm font-bold text-white border-0 shadow-lg" style={{ background: brandColor }}>
                Get Started <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button onClick={() => navigate('/patient-portal')} variant="outline" className="rounded-full px-8 py-3 text-sm font-bold" style={{ borderColor: brandColor, color: brandColor }}>
                Patient Portal
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Features */}
        <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-16" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          {[
            { icon: Heart, title: 'Color-Based Wellness', desc: 'Access our somatic check-in system mapping body sensations to emotions through an interactive color framework.' },
            { icon: Shield, title: 'Specialized Care', desc: 'We treat developmental disabilities, intellectual disabilities, and mental illnesses with specialization in Autism and ADHD.' },
            { icon: Users, title: 'Connected Community', desc: 'Bringing together patients, clinicians, and care teams in a unified ecosystem for better therapeutic outcomes.' },
          ].map((f, i) => (
            <motion.div key={i} whileHover={{ y: -4 }} className="p-7 rounded-3xl" style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${brandColor}15` }}>
                <f.icon className="w-6 h-6" style={{ color: brandColor }} />
              </div>
              <h3 className="text-lg font-fredoka font-semibold mb-2" style={{ color: brandDark }}>{f.title}</h3>
              <p className="text-sm font-nunito leading-relaxed" style={{ color: `hsl(${hue}, 20%, 50%)` }}>{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Contact info */}
        <div className="pb-16 text-center">
          <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full" style={{ background: 'rgba(255,255,255,0.6)' }}>
            {org.email && <span className="text-xs font-nunito" style={{ color: `hsl(${hue}, 30%, 40%)` }}>{org.email}</span>}
            <span className="text-[10px]" style={{ color: `hsl(${hue}, 20%, 70%)` }}>|</span>
            <span className="text-xs font-nunito" style={{ color: `hsl(${hue}, 30%, 40%)` }}>Joined {org.created_at?.split('T')[0]}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
