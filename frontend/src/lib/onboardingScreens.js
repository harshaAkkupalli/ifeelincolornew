/**
 * Onboarding screens shown before the Patient / Clinician sign-in & sign-up
 * pages load.  Each role gets 4 screens; the carousel auto-scrolls every
 * 2 seconds and pauses while the user touches & holds.
 *
 * Each entry has:
 *  - image       : transparent 3D infographic illustration (woman)
 *  - title       : one-line USP headline
 *  - subtitle    : 1-2 sentence explanation
 *  - accent      : primary brand colour for this screen
 *  - accent2     : secondary brand colour
 */

export const PATIENT_ONBOARDING = [
  {
    image: '/assets/onboarding/patient-1.png',
    screenshot: '/assets/onboarding/screens/patient-1.png',
    title: 'Track how you feel — in colour',
    subtitle:
      'A 9-step Daily Check-In takes under 2 minutes. Pick a colour, tap where you feel it on your body, and watch the AI build a wellness story tailored to you.',
    accent: '#FF6FB8',
    accent2: '#FF9F66',
  },
  {
    image: '/assets/onboarding/patient-2.png',
    screenshot: '/assets/onboarding/screens/patient-2.png',
    title: 'Personalised AI recommendations',
    subtitle:
      'Music, breathing exercises, and bite-sized therapy lessons hand-picked by the AI every day — based on the colours, body cues, and questions you answered.',
    accent: '#A78BFA',
    accent2: '#7C5BFF',
  },
  {
    image: '/assets/onboarding/patient-3.png',
    screenshot: '/assets/onboarding/screens/patient-3.png',
    title: 'Find your right clinician',
    subtitle:
      'Browse verified IFEELINCOLOR clinicians, see real providers within 50 km of you, and subscribe in one tap. Switch any time, no awkward conversations.',
    accent: '#22D3C5',
    accent2: '#22D67E',
  },
  {
    image: '/assets/onboarding/patient-4.png',
    screenshot: '/assets/onboarding/screens/patient-4.png',
    title: 'Celebrate every milestone',
    subtitle:
      'Earn badges as you check in, finish assessments, and stick with your plan. Download a beautifully designed IFEELINCOLOR PDF dossier any time for your doctor.',
    accent: '#FFD23F',
    accent2: '#FF8C3F',
  },
];

export const CLINICIAN_ONBOARDING = [
  {
    image: '/assets/onboarding/clinician-1.png',
    screenshot: '/assets/onboarding/screens/clinician-1.png',
    title: 'Patient dashboard at a glance',
    subtitle:
      'Every subscribed patient sorted by recency + severity. Tap a card to read their last 30 days of mood, body cues, and complete assessment answers.',
    accent: '#2FA37A',
    accent2: '#1F6F54',
  },
  {
    image: '/assets/onboarding/clinician-2.png',
    screenshot: '/assets/onboarding/screens/clinician-2.png',
    title: 'AI Treatment Coach in seconds',
    subtitle:
      'Drop a patient name — the AI writes an evidence-informed 5-step care plan grounded in their data. Edit, save, share to the patient in one click.',
    accent: '#22D67E',
    accent2: '#0EB280',
  },
  {
    image: '/assets/onboarding/clinician-3.png',
    screenshot: '/assets/onboarding/screens/clinician-3.png',
    title: 'Patients are waiting for you',
    subtitle:
      'See masked profiles of patients shopping for a clinician in your speciality & city. When they subscribe, you get an instant celebration toast.',
    accent: '#22D3C5',
    accent2: '#0E7490',
  },
  {
    image: '/assets/onboarding/clinician-4.png',
    screenshot: '/assets/onboarding/screens/clinician-4.png',
    title: 'Grow your practice — analytics + ratings',
    subtitle:
      'Live revenue charts, ratings histogram, churn signals and monthly retainer breakdown. Export anything to CSV for your books.',
    accent: '#FFD23F',
    accent2: '#FB923C',
  },
];
