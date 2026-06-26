// Shared deep-link map for the Admin announcement form.
//
// When the admin creates an announcement, they pick a target audience first
// (patient / clinician / organization / all). The "Open page on tap"
// dropdown then shows only the pages reachable inside that portal — clicking
// the announcement card later deep-links the user there.
//
// Keep paths in sync with the React Router routes registered in
// `App.js` / portal shells. Adding a new page? Add it here too.

export const ANNOUNCEMENT_TARGETS = {
  patient: [
    { label: '— None (no redirect)', value: '' },
    { label: 'Home',                    value: '/app/home' },
    { label: 'All Clinicians',          value: '/app/home?doctorTab=all' },
    { label: 'Nearby Doctors',          value: '/app/home?doctorTab=nearby' },
    { label: 'My Subscribed Doctors',   value: '/app/home?doctorTab=subscribed' },
    { label: 'Daily Check-In',          value: '/app/checkin' },
    { label: 'Assessment Hub',          value: '/app/assessments' },
    { label: 'Journey / Roadmap',       value: '/app/roadmap' },
    { label: 'Recommendations',         value: '/app/recommendations' },
    { label: 'History',                 value: '/app/history' },
    { label: 'My Organization',         value: '/app/my-org' },
    { label: 'Subscribe — Portal',      value: '/app/subscribe?tab=portal' },
    { label: 'Subscribe — Clinician',   value: '/app/subscribe?tab=clinician' },
    { label: 'Subscribe — Organization',value: '/app/subscribe?tab=organization' },
    { label: 'Profile / Settings',      value: '/app/profile' },
  ],
  clinician: [
    { label: '— None (no redirect)',    value: '' },
    { label: 'Home',                    value: '/clinician/home' },
    { label: 'Patients',                value: '/clinician/patients' },
    { label: 'AI Treatment Coach',      value: '/clinician/ai-coach' },
    { label: 'Notes',                   value: '/clinician/notes' },
    { label: 'Settings',                value: '/clinician/settings' },
    { label: 'Subscribe',               value: '/clinician/subscribe' },
    { label: 'Recommendations',         value: '/clinician/recommendations' },
    { label: 'Discover Patients',       value: '/clinician/discover-patients' },
    { label: 'Analytics',               value: '/clinician/analytics' },
    { label: 'Notifications',           value: '/clinician/notifications' },
  ],
  organization: [
    { label: '— None (no redirect)',    value: '' },
    { label: 'Org Dashboard',           value: '/org/dashboard' },
    { label: 'Org Subscribe',           value: '/org/subscribe' },
  ],
  all: [
    { label: '— None (no redirect)',    value: '' },
    { label: 'Landing Page',            value: '/' },
    { label: 'Patient Login',           value: '/patient/login' },
    { label: 'Clinician Login',         value: '/clinician/login' },
    { label: 'Organization Login',      value: '/org/login' },
  ],
};
