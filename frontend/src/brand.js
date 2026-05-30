// IFEELINCOLOR Brand Constants
export const LOGO_URL = 'https://customer-assets.emergentagent.com/job_ifeel-backend/artifacts/p3d8qihf_WhatsApp%20Image%202026-05-21%20at%2012.45.51.jpeg';

export const BRAND = {
  green: '#66d351',
  greenLight: '#98ee78',
  blue: '#12a4f0',
  orange: '#f99c2c',
  pink: '#FF5A6A',       // light coral red (patient primary)
  pinkDeep: '#E63468',   // legacy magenta-pink retained for admin accents
  yellow: '#f7d136',
  dark: '#1a2332',
  white: '#ffffff',
};

// Patient portal palette — light red coral + warm peach + cream
export const PATIENT = {
  primary: '#FF5A6A',    // light coral red
  secondary: '#FFB088',  // warm peach
  tertiary: '#FFD9C3',   // soft cream
  accent: '#FFE9DA',     // ivory
  deep: '#C9354A',       // for strong text
};
export const PATIENT_GRADIENT = `linear-gradient(135deg, ${PATIENT.primary}, ${PATIENT.secondary})`;
export const PATIENT_GRADIENT_SOFT = `linear-gradient(135deg, ${PATIENT.primary}22, ${PATIENT.secondary}22)`;

// Clinician portal palette — bronze → gold → cream warm gradient
export const CLINICIAN = {
  bronze: '#8B5A2B',
  bronzeLight: '#B97A3E',
  gold: '#E5B25D',
  goldLight: '#F4D78D',
  cream: '#FBEFD3',
  ivory: '#FFF8E8',
};
export const CLINICIAN_GRADIENT = `linear-gradient(135deg, ${CLINICIAN.bronze} 0%, ${CLINICIAN.gold} 55%, ${CLINICIAN.cream} 100%)`;

export const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND.green}, ${BRAND.blue}, ${BRAND.orange}, ${BRAND.pink})`;
export const BRAND_GRADIENT_SUBTLE = `linear-gradient(135deg, ${BRAND.green}15, ${BRAND.blue}15, ${BRAND.orange}15, ${BRAND.pink}15)`;
