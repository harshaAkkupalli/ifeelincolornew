/**
 * LegalPage — single component that renders either the Privacy Policy or
 * the Terms & Conditions, themed for the calling portal (patient /
 * clinician / organization / admin / public).
 *
 * Why a single component?
 * • The CONTENT is the same legal text regardless of who is reading it.
 * • The PRESENTATION (header accent, back button target, fonts) varies
 *   per portal — passing one prop keeps the code DRY and the legal copy
 *   in a single place that's easy to audit.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, FileText, Mail } from 'lucide-react';

const THEMES = {
  patient:      { accent: '#7C5BFF', accent2: '#FF4FBF', back: '/app/profile',     label: 'Patient portal' },
  clinician:    { accent: '#2FA37A', accent2: '#1F6F54', back: '/clinician/home',  label: 'Clinician portal' },
  organization: { accent: '#FB923C', accent2: '#FBBF24', back: '/org/dashboard',   label: 'Organization portal' },
  admin:        { accent: '#2563EB', accent2: '#7C3AED', back: '/admin',           label: 'Admin' },
  public:       { accent: '#7C5BFF', accent2: '#22D3C5', back: '/',                label: 'Home' },
};

const PRIVACY_SECTIONS = [
  {
    title: '1. Who we are',
    body:
      'IFEELINCOLOR ("we", "us", "our") operates the IFEELINCOLOR digital ' +
      'health platform — a web and mobile experience that helps patients ' +
      'track emotional wellbeing in colour, complete clinical assessments, ' +
      'and connect with licensed clinicians and partner organizations. ' +
      'This Privacy Policy explains what personal and health information ' +
      'we collect, how we use it, and the choices you have.',
  },
  {
    title: '2. Information we collect',
    body:
      'When you use IFEELINCOLOR we may collect: (a) account details — ' +
      'name, email, password (hashed), role and (optionally) phone; ' +
      '(b) clinical inputs — daily check-ins (colour, emotion, intensity, ' +
      'body sensation), free-text reflections, assessment responses ' +
      '(WHO-5, PHQ-9, GAD-7 and similar standardised tools); ' +
      '(c) clinician–patient activity — recommendations sent, follow-up ' +
      'messages, scheduled assessments and ratings; (d) technical data — ' +
      'device type, IP address, browser/OS and pages viewed (used only ' +
      'to keep the service secure and reliable).',
  },
  {
    title: '3. How we use your information',
    body:
      'We use your information to: (i) provide the IFEELINCOLOR service and ' +
      'show your historical check-ins, assessments and recommendations; ' +
      '(ii) deliver AI-assisted recommendations, drafted follow-up ' +
      'messages and clinician-coaching summaries (your data is sent to a ' +
      'trusted LLM provider as encrypted in-flight payloads and is NOT ' +
      'used to train external models); (iii) process payments via our ' +
      'payment partner (Razorpay) — we never store your full card details ' +
      'on our servers; (iv) keep the service secure, prevent abuse and ' +
      'comply with our legal obligations.',
  },
  {
    title: '4. Sharing with clinicians and organizations',
    body:
      'A clinician can only see your identifiable information after you ' +
      'subscribe to one of their care plans OR your partner organization ' +
      'explicitly assigns you to them. All other clinicians see an ' +
      'anonymised handle (e.g. "Patient #A1B2"), no name, no contact ' +
      'details and no city — this honours HIPAA\'s minimum-necessary ' +
      'principle. Partner organizations see only the patients and ' +
      'clinicians they are paired with.',
  },
  {
    title: '5. Emergency / SOS',
    body:
      'If you press the in-app Emergency button, your name, phone, last ' +
      'reported mood and approximate location are dispatched to (a) every ' +
      'clinician you subscribe to, (b) every clinician within 50 km of ' +
      'you (if location is enabled), and (c) the platform admin team. ' +
      'This is necessary to deliver life-safety help and is the ONLY ' +
      'scenario where we may share data without your explicit prior ' +
      'consent — and even here we share only what is needed to help.',
  },
  {
    title: '6. Storage, security & retention',
    body:
      'Your data is stored on MongoDB Atlas in encrypted-at-rest clusters. ' +
      'Passwords are hashed with bcrypt; sessions use signed tokens. We ' +
      'retain account data while your account is active; after deletion ' +
      'we keep an anonymised audit trail for up to 7 years to satisfy ' +
      'regulatory obligations. You can request earlier deletion of ' +
      'identifiable data by writing to privacy@ifeelincolor.com.',
  },
  {
    title: '7. Your rights',
    body:
      'You have the right to: access a copy of your data, correct ' +
      'inaccuracies, download your full health-dossier PDF at any time ' +
      'from the History page, withdraw a clinician\'s access at any ' +
      'time (Unsubscribe), and delete your account. Patients in the EU ' +
      'have additional rights under GDPR; patients in the US receive ' +
      'HIPAA-compatible protections when interacting with a HIPAA ' +
      'covered entity through this platform.',
  },
  {
    title: '8. Cookies & analytics',
    body:
      'We use first-party cookies strictly to keep you signed in. ' +
      'We do NOT sell your data and we do NOT run ad-tracking pixels. ' +
      'Basic anonymised page-view analytics may be used to keep the ' +
      'experience reliable.',
  },
  {
    title: '9. Children',
    body:
      'IFEELINCOLOR is intended for adults aged 18+. If a clinician or ' +
      'organization uses the platform with a minor, that clinician/org ' +
      'is responsible for obtaining parental/guardian consent in their ' +
      'jurisdiction.',
  },
  {
    title: '10. Changes & contact',
    body:
      'We may update this policy from time to time. Material changes ' +
      'will be announced inside the app at least 14 days in advance. ' +
      'For privacy questions or to exercise your rights, contact ' +
      'privacy@ifeelincolor.com.',
  },
];

const TERMS_SECTIONS = [
  {
    title: '1. Acceptance of these terms',
    body:
      'By creating an account or otherwise using IFEELINCOLOR you agree ' +
      'to these Terms & Conditions. If you do not agree, please do not ' +
      'use the service.',
  },
  {
    title: '2. The service',
    body:
      'IFEELINCOLOR is a digital wellbeing platform. It is NOT a ' +
      'substitute for emergency services, professional diagnosis, or ' +
      'in-person care. If you are in crisis, call your local emergency ' +
      'number immediately.',
  },
  {
    title: '3. Accounts & eligibility',
    body:
      'You must be 18 years or older to create an account. You agree to ' +
      'provide accurate information, to keep your password confidential, ' +
      'and to notify us at security@ifeelincolor.com of any unauthorised ' +
      'access. We may suspend or terminate accounts that violate these ' +
      'terms or applicable law.',
  },
  {
    title: '4. Subscriptions & payments',
    body:
      'Some features require a paid plan (Patient, Clinician or ' +
      'Organization). Payments are processed by Razorpay — by checking ' +
      'out you also agree to Razorpay\'s terms. Plans renew on the cycle ' +
      'shown at checkout; you can cancel any time before the next ' +
      'renewal from your portal\'s Subscriptions page. Refunds are ' +
      'handled per the rules shown at checkout or by writing to ' +
      'billing@ifeelincolor.com.',
  },
  {
    title: '5. Clinician responsibilities',
    body:
      'Clinicians on IFEELINCOLOR represent that they hold a valid ' +
      'license in their jurisdiction and will only treat patients ' +
      'they are permitted to treat. Clinicians agree to use ' +
      'identifiable patient information only for legitimate care ' +
      'purposes and to keep their account credentials secure.',
  },
  {
    title: '6. Organization responsibilities',
    body:
      'Organizations (clinics, hospitals, employers) represent that ' +
      'they have collected the consents required by their jurisdiction ' +
      'before inviting patients onto the platform, and that they will ' +
      'use IFEELINCOLOR in accordance with applicable healthcare and ' +
      'privacy laws.',
  },
  {
    title: '7. Acceptable use',
    body:
      'You agree NOT to: (i) misuse the SOS / Emergency button; ' +
      '(ii) attempt to access another user\'s data; (iii) reverse ' +
      'engineer or scrape the service; (iv) upload content that is ' +
      'illegal, harassing, hateful, or that infringes a third party\'s ' +
      'rights.',
  },
  {
    title: '8. AI-generated content',
    body:
      'IFEELINCOLOR may use AI models to draft recommendations and ' +
      'follow-up messages. AI output is a starting point — clinicians ' +
      'are responsible for reviewing and editing it before sending. ' +
      'Patients should treat AI suggestions as informational, not ' +
      'medical advice.',
  },
  {
    title: '9. Intellectual property',
    body:
      'The IFEELINCOLOR brand, design, code and content are owned by ' +
      'IFEELINCOLOR and its licensors. You retain ownership of the ' +
      'content you upload; you grant IFEELINCOLOR a limited licence to ' +
      'process it solely to provide the service to you.',
  },
  {
    title: '10. Disclaimers & liability',
    body:
      'IFEELINCOLOR is provided "as is". To the maximum extent allowed ' +
      'by law, IFEELINCOLOR is not liable for indirect, incidental, ' +
      'or consequential damages, and our aggregate liability will not ' +
      'exceed the amount you paid us in the 12 months before the claim.',
  },
  {
    title: '11. Termination',
    body:
      'You can delete your account at any time from your portal. We ' +
      'may suspend or terminate access for breach of these terms or ' +
      'to comply with the law. Sections 4 (Payments), 9 (IP), 10 ' +
      '(Liability) survive termination.',
  },
  {
    title: '12. Governing law & contact',
    body:
      'These terms are governed by the laws of the jurisdiction in ' +
      'which IFEELINCOLOR is incorporated, without regard to conflict ' +
      'rules. For questions write to support@ifeelincolor.com.',
  },
];

function LegalPage({ kind, role = 'public' }) {
  const t = THEMES[role] || THEMES.public;
  const navigate = useNavigate();
  const isPrivacy = kind === 'privacy';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  const HeroIcon = isPrivacy ? Shield : FileText;

  return (
    <div className="min-h-screen w-full"
      style={{ background: `linear-gradient(180deg, ${t.accent}0F 0%, #ffffff 50%, ${t.accent2}0E 100%)` }}
      data-testid={`legal-${kind}-${role}`}>
      <div className="max-w-3xl mx-auto px-5 pt-5 pb-12">
        <button
          data-testid="legal-back"
          onClick={() => {
            // Prefer history-back if there is one; otherwise jump to the portal home.
            if (window.history.length > 1) navigate(-1);
            else navigate(t.back);
          }}
          className="flex items-center gap-1.5 text-xs font-nunito font-bold text-slate-500 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to {t.label}
        </button>

        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6 md:p-8 mb-6 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`,
            boxShadow: `0 24px 60px -16px ${t.accent}80`,
          }}
        >
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center bg-white/22 backdrop-blur-sm shrink-0">
              <HeroIcon className="w-8 h-8 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-white/80">IFEELINCOLOR · Legal</p>
              <h1 className="font-fredoka font-bold text-2xl md:text-3xl text-white leading-tight">
                {isPrivacy ? 'Privacy Policy' : 'Terms & Conditions'}
              </h1>
              <p className="text-xs md:text-sm font-nunito text-white/85 mt-1">
                Last updated · {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Quick links between the two pages */}
        <div className="flex items-center gap-2 mb-5">
          <button
            data-testid="legal-tab-privacy"
            onClick={() => navigate(`/${role === 'public' ? 'legal/privacy' : `${role}/privacy`}`.replace('//', '/'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-nunito font-bold transition"
            style={{
              background: isPrivacy ? `linear-gradient(135deg, ${t.accent}, ${t.accent2})` : 'rgba(255,255,255,0.75)',
              color: isPrivacy ? '#fff' : t.accent,
              border: `1px solid ${t.accent}33`,
              boxShadow: isPrivacy ? `0 10px 20px -10px ${t.accent}99` : 'none',
            }}
          >
            <Shield className="w-3 h-3" /> Privacy
          </button>
          <button
            data-testid="legal-tab-terms"
            onClick={() => navigate(`/${role === 'public' ? 'legal/terms' : `${role}/terms`}`.replace('//', '/'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-nunito font-bold transition"
            style={{
              background: !isPrivacy ? `linear-gradient(135deg, ${t.accent}, ${t.accent2})` : 'rgba(255,255,255,0.75)',
              color: !isPrivacy ? '#fff' : t.accent,
              border: `1px solid ${t.accent}33`,
              boxShadow: !isPrivacy ? `0 10px 20px -10px ${t.accent}99` : 'none',
            }}
          >
            <FileText className="w-3 h-3" /> Terms
          </button>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {sections.map((s, i) => (
            <motion.section
              key={s.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 + i * 0.025 }}
              className="rounded-2xl bg-white p-4 md:p-5"
              style={{
                boxShadow: '0 8px 22px -16px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.04)',
              }}
            >
              <h2 className="font-fredoka font-bold text-base md:text-lg text-slate-900 mb-1.5">
                {s.title}
              </h2>
              <p className="text-sm font-nunito text-slate-600 leading-relaxed">
                {s.body}
              </p>
            </motion.section>
          ))}
        </div>

        {/* Footer / contact */}
        <div className="mt-7 rounded-2xl p-4 md:p-5 flex items-center gap-3"
          style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${t.accent}22` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})` }}>
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-nunito font-bold uppercase tracking-widest" style={{ color: t.accent }}>
              Questions?
            </p>
            <p className="text-sm font-nunito text-slate-700">
              <a className="font-bold underline" href="mailto:privacy@ifeelincolor.com">privacy@ifeelincolor.com</a>
              {' · '}
              <a className="font-bold underline" href="mailto:support@ifeelincolor.com">support@ifeelincolor.com</a>
            </p>
          </div>
          <Lock className="w-5 h-5 text-slate-300 hidden md:block" />
        </div>
      </div>
    </div>
  );
}

// Named exports per portal so each route stays explicit + grep-able.
export const PrivacyPolicyPatient      = () => <LegalPage kind="privacy" role="patient"      />;
export const PrivacyPolicyClinician    = () => <LegalPage kind="privacy" role="clinician"    />;
export const PrivacyPolicyOrganization = () => <LegalPage kind="privacy" role="organization" />;
export const PrivacyPolicyAdmin        = () => <LegalPage kind="privacy" role="admin"        />;
export const PrivacyPolicyPublic       = () => <LegalPage kind="privacy" role="public"       />;
export const TermsPatient              = () => <LegalPage kind="terms"   role="patient"      />;
export const TermsClinician            = () => <LegalPage kind="terms"   role="clinician"    />;
export const TermsOrganization         = () => <LegalPage kind="terms"   role="organization" />;
export const TermsAdmin                = () => <LegalPage kind="terms"   role="admin"        />;
export const TermsPublic               = () => <LegalPage kind="terms"   role="public"       />;

export default LegalPage;
