/**
 * Per-portal user guides — content surfaced by the floating
 * <PortalGuide /> bubble on every page.
 *
 * Each role gets its own list of "feature cards". A feature card has:
 *   • icon            — lucide icon name (resolved client-side)
 *   • title           — short feature title
 *   • description     — 2-3 sentences explaining what this feature does and
 *                       what value it gives the user
 *   • gradient        — two hex colors used by the 3D tile (top-left/bottom-right)
 *   • cta             — button label
 *   • link            — deep link to navigate when CTA is tapped
 */

export const PORTAL_GUIDES = {
  patient: {
    title: 'Patient Portal Guide',
    intro:
      "You're at the center of IFEELINCOLOR. Use these tools to track how you feel, get matched with a clinician, follow your personalised care plan, and download a report for any visit.",
    accent: '#A78BFA',
    accent2: '#FF6FB8',
    sections: [
      {
        icon: 'ScanFace',
        title: 'Daily Check-In',
        description:
          'Pick a colour that matches your mood, tap the body where you feel it, and answer 9 quick prompts. Each check-in trains the AI to make better recommendations and shows your progress on the Journey map.',
        gradient: ['#FF6FB8', '#FF9F66'],
        cta: 'Start a check-in',
        link: '/app/checkin',
      },
      {
        icon: 'BookOpen',
        title: 'Personalised Recommendations',
        description:
          'Bite-sized articles, videos, music tracks, and breathing exercises chosen by the AI from your latest check-ins. Save the ones that help; the rest fades out.',
        gradient: ['#A78BFA', '#7C5BFF'],
        cta: 'View recommendations',
        link: '/app/recommendations',
      },
      {
        icon: 'Brain',
        title: 'Assessment Hub',
        description:
          'Three short surveys (Treatment History, Health & Social, Mood Assessment) that take ~3 minutes each. Skipping is fine — answers feed the AI plan and the clinician dashboard so your care stays personal.',
        gradient: ['#22D3C5', '#22D67E'],
        cta: 'Open Assessment Hub',
        link: '/app/assessments',
      },
      {
        icon: 'MapPin',
        title: 'Find a Clinician',
        description:
          'Browse providers within ~50 km of your saved city, search by name, or pick a verified IFEELINCOLOR clinician from the All Clinicians list. Tap a card to view their plans and subscribe.',
        gradient: ['#FF6FB8', '#FF4FBF'],
        cta: 'Discover doctors',
        link: '/app/home?doctorTab=nearby',
      },
      {
        icon: 'Shield',
        title: 'Subscriptions',
        description:
          'Three tracks — Portal plans (unlock advanced features), Clinician plans (1:1 care with a specific provider), Organisation plans (use a workplace/school invite). Switching plans is one tap.',
        gradient: ['#7C5BFF', '#A78BFA'],
        cta: 'Manage subscriptions',
        link: '/app/subscribe',
      },
      {
        icon: 'FileText',
        title: 'Dossier PDF',
        description:
          'Branded, doctor-ready PDF with every check-in, every Q&A answer, AI plans, and recommendations. Generated on the server so it downloads cleanly on phone and APK.',
        gradient: ['#22D67E', '#0EB280'],
        cta: 'Visit the Hub to download',
        link: '/app/assessments',
      },
      {
        icon: 'History',
        title: 'Journey & History',
        description:
          'A timeline of every interaction with the platform: check-ins, plan changes, assessments completed, badges earned. Long-press any node for the original data behind it.',
        gradient: ['#FFD23F', '#FF8C3F'],
        cta: 'Open your journey',
        link: '/app/roadmap',
      },
      {
        icon: 'Building2',
        title: 'My Organisation',
        description:
          'If your school, employer, or insurer subscribed you, this is where invite codes and org-paid sessions live. New invite? Paste the code here.',
        gradient: ['#FB923C', '#22D67E'],
        cta: 'Open My Organisation',
        link: '/app/my-org',
      },
    ],
  },

  clinician: {
    title: 'Clinician Portal Guide',
    intro:
      'Your portal is built for triage in under 30 seconds. Patient data is sorted by recency and severity, the AI coach prepares 5-step care plans, and ratings + earnings stay one tap away.',
    accent: '#2FA37A',
    accent2: '#1F6F54',
    sections: [
      {
        icon: 'Users',
        title: 'My Patients',
        description:
          'Every patient that subscribed to one of your plans, ranked by the most recent severity flag. Cards show last check-in, current mood colour, and a tap-through to their full dossier.',
        gradient: ['#2FA37A', '#1F6F54'],
        cta: 'Open patients',
        link: '/clinician/patients',
      },
      {
        icon: 'Sparkles',
        title: 'AI Treatment Coach',
        description:
          'Drop a patient name and the AI builds a 5-step, evidence-informed plan grounded in their last 30 days of check-ins + assessments. Edit, save, and share to the patient with one click.',
        gradient: ['#22D67E', '#0EB280'],
        cta: 'Open AI Coach',
        link: '/clinician/ai-coach',
      },
      {
        icon: 'FileText',
        title: 'Session Notes',
        description:
          'Voice-to-text or typed SOAP-style notes that auto-link to the patient and the day. Searchable, exportable, audit-trail safe.',
        gradient: ['#118AB2', '#0E7490'],
        cta: 'Open notes',
        link: '/clinician/notes',
      },
      {
        icon: 'Search',
        title: 'Discover Patients',
        description:
          'See masked profiles of patients shopping for a provider in your speciality + city. When they subscribe to you, you receive an instant celebration toast.',
        gradient: ['#FB923C', '#FFD166'],
        cta: 'Open discover',
        link: '/clinician/discover-patients',
      },
      {
        icon: 'TrendingUp',
        title: 'Analytics & Earnings',
        description:
          'Revenue by plan, churn signals, ratings histogram, monthly retainer breakdown. Filter by week / month / quarter, export CSV for your books.',
        gradient: ['#A78BFA', '#7C5BFF'],
        cta: 'Open analytics',
        link: '/clinician/analytics',
      },
      {
        icon: 'Shield',
        title: 'Your Subscription Plans',
        description:
          'See and manage the plans Admin has published for you. Cancel any time — billing stops at the period end and active patients keep access until then.',
        gradient: ['#FF6FB8', '#FF4FBF'],
        cta: 'Open your plans',
        link: '/clinician/subscribe',
      },
    ],
  },

  admin: {
    title: 'Super Admin Portal Guide',
    intro:
      'Operate the entire ecosystem from one place. Manage every patient, clinician, org, plan, assessment template, payment gateway and announcement.',
    accent: '#7C5BFF',
    accent2: '#A78BFA',
    sections: [
      {
        icon: 'Users',
        title: 'Patient Management',
        description:
          'View, edit, ban, or impersonate any patient. Filter by check-in recency, subscription tier, or city. Bulk-resend welcome emails.',
        gradient: ['#FF6FB8', '#FF4FBF'],
        cta: 'Open Patients',
        link: '/admin/patients',
      },
      {
        icon: 'Stethoscope',
        title: 'Clinician Management',
        description:
          'Onboard verified clinicians, set their specialties + payout details, attach them to organisations, and publish per-clinician plans (those plans are what the Patient Subscribe page renders for that doctor).',
        gradient: ['#22D3C5', '#0EA5A0'],
        cta: 'Open Clinicians',
        link: '/admin/clinicians',
      },
      {
        icon: 'Building2',
        title: 'Organisation Management',
        description:
          'Create, suspend, or delete partner organisations. Assign Org_Admin + Org_Manager seats; each org gets its own subdomain login, plan ladder, and a billing dashboard.',
        gradient: ['#FB923C', '#22D67E'],
        cta: 'Open Organisations',
        link: '/admin/organizations',
      },
      {
        icon: 'CreditCard',
        title: 'Subscription Plans',
        description:
          'Build 3 plan audiences — Patient Portal, Patient → Clinician, Patient → Organisation. Set price, features, perks per audience. Edits propagate instantly to the patient subscribe page.',
        gradient: ['#A78BFA', '#7C5BFF'],
        cta: 'Open Plans',
        link: '/admin/plans',
      },
      {
        icon: 'Brain',
        title: 'Assessment Configuration',
        description:
          'Toggle the three assessment categories (Treatment History / Health & Social / Mood Assessment) on or off. Edit individual questions, change options, mark "required". Saved live.',
        gradient: ['#FFD23F', '#FF8C3F'],
        cta: 'Open Assessments',
        link: '/admin/assessments',
      },
      {
        icon: 'Megaphone',
        title: 'Announcements',
        description:
          'Broadcast banners to any role (Patient, Clinician, Org, Everyone). Attach an image, write rich-text, pick a destination page so a tap deep-links the right portal — exactly like a marketing inbox.',
        gradient: ['#FF6FB8', '#A78BFA'],
        cta: 'Open Announcements',
        link: '/admin/announcements',
      },
      {
        icon: 'Lock',
        title: 'Admin Permissions',
        description:
          'Create scoped admin accounts (view-only, billing, content) with granular page × action permissions. Audit log keeps every change.',
        gradient: ['#0F172A', '#334155'],
        cta: 'Open Permissions',
        link: '/admin/permissions',
      },
      {
        icon: 'CreditCard',
        title: 'Payment Gateway Setup',
        description:
          'Drop your Razorpay live keys, test mode toggle, webhook secret. Without this, no real money moves — there is a clear status pill at the top of the page.',
        gradient: ['#06B6D4', '#0E7490'],
        cta: 'Open Payment Setup',
        link: '/admin/payment-setup',
      },
    ],
  },

  organization: {
    title: 'Organisation Portal Guide',
    intro:
      'Run your organisation\'s mental-health network. Add clinicians, invite patients with codes, watch outcomes, and pay one consolidated invoice.',
    accent: '#FB923C',
    accent2: '#22D67E',
    sections: [
      {
        icon: 'Users',
        title: 'Patient Network',
        description:
          'See every patient who joined using your invite code. View consent-respecting outcome trends; reach out via Email-Templates if engagement drops.',
        gradient: ['#FB923C', '#FFD166'],
        cta: 'Open Dashboard',
        link: '/org/dashboard',
      },
      {
        icon: 'Stethoscope',
        title: 'Clinician Roster',
        description:
          'Add or remove the clinicians inside your org. Each clinician they add automatically inherits your org\'s plan audiences, billing terms, and onboarding email.',
        gradient: ['#2FA37A', '#0F766E'],
        cta: 'Manage Clinicians',
        link: '/org/dashboard',
      },
      {
        icon: 'Shield',
        title: 'Org Subscriptions',
        description:
          'Tiered plans for your patient base (Free→Premium). Promote the right tier to your members and watch conversion in real-time.',
        gradient: ['#A78BFA', '#7C5BFF'],
        cta: 'Open Org Plans',
        link: '/org/subscribe',
      },
    ],
  },
};
