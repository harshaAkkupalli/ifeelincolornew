import React from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { LOGO_URL, BRAND } from '../../brand';
import { LayoutDashboard, Users, Stethoscope, Building2, UserCog, CreditCard, BookOpen, DollarSign, LogOut, ClipboardList, Megaphone, Lock, Wallet, AlertOctagon, Mail, Settings, HeartPulse } from 'lucide-react';
import InfoTip from '../ui/InfoTip';
import { FEATURE_TIPS } from '../../lib/featureTips';

const NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', color: BRAND.pink, end: true, key: 'dashboard', tip: FEATURE_TIPS.admin_dashboard },
  { to: '/admin/patients', icon: Users, label: 'Patients', color: '#A78BFA', key: 'patients', tip: FEATURE_TIPS.admin_patients },
  { to: '/admin/clinicians', icon: Stethoscope, label: 'Clinicians', color: BRAND.blue, key: 'clinicians', tip: FEATURE_TIPS.admin_clinicians },
  { to: '/admin/organizations', icon: Building2, label: 'Organizations', color: BRAND.green, key: 'organizations', tip: FEATURE_TIPS.admin_organizations },
  { to: '/admin/assistants', icon: UserCog, label: 'Assistants', color: '#22D3C5', key: 'assistants', tip: FEATURE_TIPS.admin_assistants },
  { to: '/admin/plans', icon: CreditCard, label: 'Subscriptions', color: BRAND.orange, key: 'plans', tip: FEATURE_TIPS.admin_plans },
  { to: '/admin/assessments', icon: ClipboardList, label: 'Assessments', color: '#EC4899', key: 'assessments', tip: FEATURE_TIPS.admin_assessments },
  { to: '/admin/checkin-config', icon: HeartPulse, label: 'Check-in Config', color: '#F472B6', key: 'checkin_config', tip: FEATURE_TIPS.admin_checkin_config },
  { to: '/admin/recommendations', icon: BookOpen, label: 'Recommendations', color: '#60A5FA', key: 'recommendations', tip: FEATURE_TIPS.admin_recommendations },
  { to: '/admin/announcements', icon: Megaphone, label: 'Announcements', color: '#FB923C', key: 'announcements', tip: FEATURE_TIPS.admin_announcements },
  { to: '/admin/permissions', icon: Lock, label: 'Permissions', color: '#8B5CF6', key: 'permissions', tip: FEATURE_TIPS.admin_permissions },
  { to: '/admin/emergency-alerts', icon: AlertOctagon, label: 'Emergency Alerts', color: '#FF3B30', key: 'emergency_alerts', tip: FEATURE_TIPS.admin_emergency_alerts },
  { to: '/admin/email-templates', icon: Mail, label: 'Email Templates', color: '#06B6D4', key: 'email_templates', tip: FEATURE_TIPS.admin_email_templates },
  { to: '/admin/payment-setup', icon: Wallet, label: 'Payment Setup', color: '#22D67E', key: 'payment_setup', tip: FEATURE_TIPS.admin_payment_setup },
  { to: '/admin/earnings', icon: DollarSign, label: 'Earnings', color: BRAND.green, key: 'earnings', tip: FEATURE_TIPS.admin_earnings },
];

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = async () => { await logout(); navigate('/admin/login'); };

  // Filter nav by assistant page permissions
  const isAssistant = admin?.role === 'assistant';
  const allowedKeys = isAssistant ? Object.keys(admin?.page_permissions || {}) : null;
  const visibleNav = isAssistant
    ? NAV.filter(n => (allowedKeys || []).includes(n.key) || n.key === 'dashboard')
    : NAV;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F6F8FC' }}>
      {/* Decorative animated background */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-30">
        <motion.div
          animate={{ y: [0, -20, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-10 right-10 w-64 h-64 rounded-full"
          style={{ background: `radial-gradient(circle, ${BRAND.pink}55, transparent 70%)`, filter: 'blur(20px)' }}
        />
        <motion.div
          animate={{ y: [0, 20, 0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-10 right-1/3 w-60 h-60 rounded-full"
          style={{ background: `radial-gradient(circle, ${BRAND.blue}44, transparent 70%)`, filter: 'blur(20px)' }}
        />
      </div>

      {/* Sidebar */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col relative z-10"
        style={{ background: `linear-gradient(180deg, ${BRAND.dark} 0%, #11203A 100%)` }}
      >
        {/* Logo */}
        <button
          type="button"
          onClick={() => navigate('/admin')}
          data-testid="admin-logo-home"
          className="p-5 flex items-center gap-2.5 border-b w-full text-left hover:bg-white/[0.03] transition"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          aria-label="Go to admin home"
        >
          <motion.img
            src={LOGO_URL}
            alt="IFEELINCOLOR"
            className="w-9 h-9 object-contain"
            animate={{ rotate: [0, 6, -6, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span
            className="text-sm font-fredoka font-semibold"
            style={{
              background: `linear-gradient(90deg, ${BRAND.green}, ${BRAND.blue}, ${BRAND.orange}, ${BRAND.pink})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            IFEELINCOLOR
          </span>
        </button>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto custom-scrollbar">
          {visibleNav.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={`admin-nav-${n.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={({ isActive }) =>
                `group flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-nunito font-semibold transition-all relative ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-white'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? { background: `linear-gradient(135deg, ${n.color}44, ${n.color}22)`, boxShadow: `inset 0 0 0 1px ${n.color}66, 0 8px 22px -8px ${n.color}66` }
                  : {}
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{
                      background: isActive ? n.color : 'rgba(255,255,255,0.04)',
                      boxShadow: isActive ? `0 6px 14px -2px ${n.color}88` : 'none',
                    }}
                  >
                    <n.icon className="w-3.5 h-3.5" style={{ color: isActive ? 'white' : n.color }} />
                  </div>
                  <span className="flex-1">{n.label}</span>
                  {n.tip && (
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <InfoTip text={n.tip} side="right" tone="dark" size={11} color={n.color} testid={`admin-nav-${n.label.toLowerCase().replace(/\s+/g, '-')}-info`} />
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Admin profile */}
        <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <Link to="/admin/settings" data-testid="admin-settings-link"
            className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl hover:bg-white/5 transition cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}
            >
              {admin?.picture ? <img src={admin.picture} alt="" className="w-full h-full object-cover" /> : (admin?.name?.charAt(0) || 'A')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-nunito font-bold text-white truncate">{admin?.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{admin?.role === 'super_admin' ? 'Super Admin' : 'Assistant'}</p>
            </div>
            <Settings className="w-3.5 h-3.5 text-slate-400" />
          </Link>
          <button
            onClick={handleLogout}
            data-testid="admin-logout-btn"
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-nunito font-semibold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto relative z-10">
        <Outlet />
        <p className="text-center text-[10px] font-nunito py-4" style={{ color: '#8F8493' }}>
          Developed by <span className="font-bold" style={{
            background: `linear-gradient(90deg, ${BRAND.pink}, ${BRAND.orange}, ${BRAND.blue})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>Projexino Solutions Pvt Ltd</span>
        </p>
      </main>
    </div>
  );
}
