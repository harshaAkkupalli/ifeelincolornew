import React from 'react';
import { BRAND } from '../brand';

/**
 * Global footer with company credit & branding.
 * Used inside MobileShell, AdminLayout, and as a stand-alone component on web pages.
 */
export default function BrandFooter({ dark = false, compact = false }) {
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
