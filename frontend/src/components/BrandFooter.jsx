import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BRAND } from '../brand';

/**
 * Global footer with company credit, IFEELINCOLOR mark, and **Privacy / Terms**
 * deep-links that auto-route to the calling portal's themed legal pages.
 *
 * The portal is detected from the URL:
 *   /app/*       → patient
 *   /clinician/* → clinician
 *   /org/*       → organization
 *   /admin/*     → admin
 *   anything else (auth, landing, etc.) → public
 */
const LEGAL_BY_PORTAL = {
  patient:      { privacy: '/app/privacy',       terms: '/app/terms' },
  clinician:    { privacy: '/clinician/privacy', terms: '/clinician/terms' },
  organization: { privacy: '/org/privacy',       terms: '/org/terms' },
  admin:        { privacy: '/admin/privacy',     terms: '/admin/terms' },
  public:       { privacy: '/legal/privacy',     terms: '/legal/terms' },
};

function detectPortal(pathname) {
  if (pathname.startsWith('/app/')) return 'patient';
  if (pathname.startsWith('/clinician/')) return 'clinician';
  if (pathname.startsWith('/org/')) return 'organization';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'public';
}

export default function BrandFooter({ dark = false, compact = false }) {
  const { pathname } = useLocation();
  const portal = detectPortal(pathname);
  const links = LEGAL_BY_PORTAL[portal] || LEGAL_BY_PORTAL.public;

  const linkColor = dark ? 'rgba(255,255,255,0.78)' : '#475569';

  return (
    <footer
      className={`w-full text-center ${compact ? 'py-3' : 'py-5'} px-4 select-none`}
      style={{
        background: dark ? 'transparent' : 'transparent',
        color: dark ? 'rgba(255,255,255,0.55)' : '#8F8493',
        borderTop: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(26,35,50,0.06)',
      }}
      data-testid="brand-footer"
    >
      <div className="flex items-center justify-center gap-3 mb-1.5">
        <Link
          to={links.privacy}
          data-testid="footer-privacy-link"
          className="text-[10px] font-nunito font-bold hover:underline"
          style={{ color: linkColor }}
        >
          Privacy Policy
        </Link>
        <span className="opacity-30">·</span>
        <Link
          to={links.terms}
          data-testid="footer-terms-link"
          className="text-[10px] font-nunito font-bold hover:underline"
          style={{ color: linkColor }}
        >
          Terms &amp; Conditions
        </Link>
      </div>
      <p className="text-[10px] font-nunito tracking-wide">
        Developed by{' '}
        <span
          className="font-bold"
          style={{
            background: `linear-gradient(90deg, ${BRAND.pink}, ${BRAND.orange}, ${BRAND.blue})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Projexino Solutions Pvt Ltd
        </span>
      </p>
      <p className="text-[9px] font-nunito mt-0.5 opacity-50">
        © {new Date().getFullYear()} IFEELINCOLOR — All rights reserved
      </p>
    </footer>
  );
}
