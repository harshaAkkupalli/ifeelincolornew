import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '../brand/BrandLogo';
import { Bell, Menu } from 'lucide-react';

/**
 * MobileShell — A native-app-like wrapper for the Patient & Clinician
 * portals on phones. Provides:
 *  - Sticky top header with logo & action icons
 *  - Bottom tab navigation (5 slots)
 *  - Safe-area padding for iOS notch & Android nav
 *  - Vibrant brand theming
 */
export default function MobileShell({
  children,
  tabs = [],
  accent = '#FF4FBF',
  bgGradient = 'linear-gradient(180deg, #FFF7FB 0%, #FFEFE0 100%)',
  onMenu,
  onNotifications,
  title,
}) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{
        background: bgGradient,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      data-testid="mobile-shell"
    >
      {/* Top App Bar */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 backdrop-blur-xl"
        style={{ background: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}
      >
        <button
          data-testid="mobile-menu-btn"
          onClick={onMenu}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 transition"
        >
          <Menu className="w-5 h-5" style={{ color: accent }} />
        </button>
        {title ? (
          <h1 className="font-fredoka font-semibold text-base" style={{ color: '#1A2332' }}>
            {title}
          </h1>
        ) : (
          <Logo size={28} textSize="text-sm" />
        )}
        <button
          data-testid="mobile-bell-btn"
          onClick={onNotifications}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 transition relative"
        >
          <Bell className="w-5 h-5" style={{ color: accent }} />
          <span
            className="absolute top-2 right-2 w-2 h-2 rounded-full"
            style={{ background: accent }}
          />
        </button>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>

      {/* Bottom Tab Bar */}
      {tabs.length > 0 && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(18px)',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.06)',
          }}
        >
          <ul className="flex items-center justify-around max-w-md mx-auto">
            {tabs.map((t) => {
              const isActive =
                t.match instanceof Function
                  ? t.match(location.pathname)
                  : location.pathname === t.to;
              return (
                <li key={t.to} className="flex-1">
                  <button
                    data-testid={`mobile-tab-${t.label.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => (t.onClick ? t.onClick() : navigate(t.to))}
                    className="w-full flex flex-col items-center gap-0.5 py-1.5 relative"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="mobile-tab-active"
                        className="absolute -top-2 w-10 h-1 rounded-full"
                        style={{ background: accent }}
                      />
                    )}
                    <motion.div
                      animate={{ y: isActive ? -2 : 0, scale: isActive ? 1.15 : 1 }}
                      transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                      className="w-10 h-10 rounded-2xl flex items-center justify-center"
                      style={{
                        background: isActive ? accent : 'transparent',
                        color: isActive ? '#fff' : '#6B7380',
                        boxShadow: isActive ? `0 8px 22px ${accent}55` : 'none',
                      }}
                    >
                      <t.icon className="w-5 h-5" />
                    </motion.div>
                    <span
                      className="text-[10px] font-nunito font-semibold mt-0.5"
                      style={{ color: isActive ? accent : '#6B7380' }}
                    >
                      {t.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
