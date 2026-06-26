import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import CheckInFlow from '../components/checkin/CheckInFlow';
import CheckInHistory from '../components/CheckInHistory';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Heart, ClipboardList, LogOut, User, Sparkles, ArrowRight } from 'lucide-react';
import { Logo } from '../components/brand/BrandLogo';

export default function PatientDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('checkin');
  const [showCheckin, setShowCheckin] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/mobile-home?role=patient');
  };

  return (
    <div className="min-h-screen" style={{ background: '#FDFCDC' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg border-b" style={{ background: 'rgba(253,252,220,0.9)', borderColor: 'rgba(7,59,76,0.1)' }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={32} textSize="text-lg" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,209,102,0.2)' }}>
              <User className="w-4 h-4" style={{ color: '#073B4C' }} />
              <span className="text-sm font-nunito font-medium" style={{ color: '#073B4C' }}>{user?.name}</span>
            </div>
            <Button
              data-testid="logout-button"
              onClick={handleLogout}
              variant="ghost"
              className="rounded-full px-3 py-1.5 text-sm font-nunito"
              style={{ color: '#EF476F' }}
            >
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl sm:text-4xl font-fredoka font-semibold mb-2" style={{ color: '#073B4C' }}>
            Hi {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-base font-nunito mb-8" style={{ color: '#4A6FA5' }}>
            How are you feeling today? Let's explore your emotions with colors.
          </p>
        </motion.div>

        {/* Biometric Setup Banner */}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="rounded-full p-1 mb-8" style={{ background: 'rgba(7,59,76,0.06)' }}>
            <TabsTrigger
              data-testid="tab-checkin"
              value="checkin"
              className="rounded-full px-6 py-2 font-nunito font-medium data-[state=active]:text-white data-[state=active]:shadow-md"
              style={activeTab === 'checkin' ? { background: '#EF476F', color: 'white' } : { color: '#073B4C' }}
            >
              <Heart className="w-4 h-4 mr-2" /> Check-In
            </TabsTrigger>
            <TabsTrigger
              data-testid="tab-history"
              value="history"
              className="rounded-full px-6 py-2 font-nunito font-medium data-[state=active]:text-white data-[state=active]:shadow-md"
              style={activeTab === 'history' ? { background: '#118AB2', color: 'white' } : { color: '#073B4C' }}
            >
              <ClipboardList className="w-4 h-4 mr-2" /> My History
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="sync">
            <TabsContent value="checkin" key="checkin">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {/* Premium CTA card */}
                <div
                  className="rounded-3xl p-8 sm:p-10 relative overflow-hidden cursor-pointer group"
                  style={{ background: 'linear-gradient(135deg, #0D0D11 0%, #1a1a2e 100%)', border: '1px solid rgba(255,255,255,0.06)' }}
                  onClick={() => setShowCheckin(true)}
                  data-testid="start-checkin-button"
                >
                  {/* Decorative gradient orbs */}
                  <div className="absolute top-0 right-0 w-48 h-48 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,209,102,0.08) 0%, transparent 70%)', transform: 'translate(20%, -30%)' }} />
                  <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full" style={{ background: 'radial-gradient(circle, rgba(239,71,111,0.06) 0%, transparent 70%)', transform: 'translate(-20%, 30%)' }} />
                  <div className="absolute top-1/2 left-1/2 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(17,138,178,0.05) 0%, transparent 70%)', transform: 'translate(-50%, -50%)' }} />

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5" style={{ color: '#FFD166' }} />
                      <span className="text-xs font-nunito uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Guided Experience
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-fredoka font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.95)' }}>
                      Start Your Color Check-In
                    </h2>
                    <p className="text-sm font-nunito leading-relaxed mb-6 max-w-md" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Explore what your body is telling you through an interactive somatic map, feelings wheel, and guided regulation activities.
                    </p>

                    {/* Step preview */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {['Body Map', 'Sensations', 'Feelings Wheel', 'Reflection', 'Regulation', 'Summary'].map((s, i) => (
                        <span key={s} className="text-[10px] font-nunito px-3 py-1 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}>
                          {i + 1}. {s}
                        </span>
                      ))}
                    </div>

                    <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-nunito font-bold text-sm transition-transform group-hover:scale-105"
                      style={{ background: 'linear-gradient(135deg, #EF476F, #FFD166)', color: '#0D0D11' }}>
                      Begin <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Floating color dots */}
                  <div className="absolute bottom-6 right-8 flex gap-2">
                    {['#FFD166', '#118AB2', '#06D6A0', '#EF476F', '#B56576', '#F4845F', '#8D99AE'].map((c, i) => (
                      <motion.div
                        key={c}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-4 h-4 rounded-full"
                        style={{ background: c, opacity: 0.5 }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            </TabsContent>
            <TabsContent value="history" key="history">
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <CheckInHistory />
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </main>

      {/* Full-screen Check-in Flow overlay */}
      <AnimatePresence>
        {showCheckin && <CheckInFlow onClose={() => setShowCheckin(false)} />}
      </AnimatePresence>
    </div>
  );
}
