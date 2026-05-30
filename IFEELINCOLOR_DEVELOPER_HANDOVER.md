# IFEELINCOLOR — Developer Specification & Handover Document

> **Audience:** Senior full-stack engineers and DevOps owners taking over the codebase for independent self-hosting.
> **Status:** Production-ready · Decoupled from Emergent · Last updated: February 2026
> **License:** Proprietary — IFEELINCOLOR © 2026 (Projexino Solutions Pvt Ltd)

---

## ⚠️ Critical Hosting Reality Check

> **The backend of this application is a Python FastAPI service, not Node.js.**
> Hostinger's "Node.js Application" shared hosting tier **cannot run this backend.** You **must** use a Hostinger **VPS** plan (KVM 1 / KVM 2 / KVM 4) running Ubuntu 22.04+. Section 4 below assumes a VPS; do not deploy to Hostinger's Node.js shared dashboard.
> The frontend is a static React build that *can* be served from anywhere (Hostinger shared, S3, Cloudflare Pages, the same VPS via Nginx). The recommended pattern is "everything on one VPS" — covered in Section 4.

---

## 1. Architectural Overview & Tech Stack Deep Dive

### 1.1 High-Level Architecture

```
                       ┌────────────────────────────────────────┐
                       │            Public DNS                  │
                       │   app.example.com  api.example.com     │
                       └────────────────────┬───────────────────┘
                                            │
                                            ▼
                              ┌──────────────────────────┐
                              │  Nginx (reverse proxy +  │
                              │  SSL termination)        │
                              └──────────────┬───────────┘
                       ┌────────────────────┼────────────────────┐
                       ▼                                          ▼
        ┌────────────────────────────┐         ┌────────────────────────────┐
        │  React 19 SPA (built)      │         │  FastAPI (Uvicorn)         │
        │  served from /var/www/...  │         │  127.0.0.1:8001 (PM2)      │
        │  port 80/443 → static html │         │  /api prefix routed here   │
        └────────────────────────────┘         └─────────────┬──────────────┘
                                                              │
                                          ┌───────────────────┼─────────────────────┐
                                          ▼                   ▼                     ▼
                                   ┌──────────────┐   ┌──────────────┐    ┌──────────────────┐
                                   │  MongoDB     │   │  Gmail SMTP  │    │  External APIs   │
                                   │  (local or   │   │  587 + STARTTLS  │  OpenAI / Stripe │
                                   │   Atlas)     │   │              │    │  Google Places   │
                                   └──────────────┘   └──────────────┘    └──────────────────┘
```

### 1.2 Tech Stack — Component Breakdown

| Layer | Technology | Version | Notes |
|---|---|---|---|
| **Frontend framework** | React (Create React App / `react-scripts`) | `react@19.0.0`, `react-dom@19.0.0` | NOT Vite, NOT Next.js. CRA is craco-overridden. |
| **Frontend bundler** | Webpack 5 (via `react-scripts@5.0.1` + `@craco/craco@7.1.0`) | — | Production output: `frontend/build/` |
| **Frontend routing** | `react-router-dom@7.5.1` | client-side routing only | All non-`/api` paths → `index.html` (catch-all) |
| **Frontend state** | React Context + local `useState` (no Redux/Zustand) | — | `AuthContext`, `AdminAuthContext`, `CheckinContentContext`, `NeuroInclusiveContext` |
| **Frontend styling** | Tailwind CSS 3.4 + Shadcn UI (Radix primitives) | `tailwindcss@3.4.17`, `@radix-ui/*` | Shadcn components live in `frontend/src/components/ui/` |
| **Frontend animation** | Framer Motion | `framer-motion@12.39.0` | |
| **Frontend HTTP** | Axios | `axios@1.8.4` | Always uses `process.env.REACT_APP_BACKEND_URL` + `/api` prefix |
| **Charts / PDF** | Recharts 3.6, jsPDF 4.2, html2canvas | — | Client-side analytics + animated PDF dossier |
| **Backend runtime** | Python 3.11+ | tested on 3.11 / 3.12 | NOT Node.js |
| **Backend framework** | FastAPI + Uvicorn | `fastapi==0.118.0`, `uvicorn==0.34.0` | Async-first |
| **Backend DB driver** | Motor (async MongoDB) | `motor==3.5.1` | All DB ops are `await db.collection.method()` |
| **Backend auth** | JWT (PyJWT) + WebAuthn 2.7.1 | `pyjwt`, `webauthn==2.7.1` | HTTP-only cookies; biometric login optional |
| **Backend LLM** | Vendor SDKs via thin adapter | `openai==1.99.9`, optional `anthropic`, `google-genai` | See `llm_adapter.py` |
| **Backend payments** | Stripe SDK | `stripe==15.1.0` | Native Python SDK, no Emergent wrapper |
| **Backend email** | `smtplib` + `email.mime` (stdlib) | — | Gmail SMTP via App Password — see `email_provider.py` |
| **Backend PDF** | ReportLab | `reportlab==4.5.1` | Server-rendered branded dossier |
| **Database** | MongoDB | 6.x or 7.x | Self-hosted on VPS or MongoDB Atlas |
| **Process manager** | PM2 (via `pm2-runtime` + a Python interpreter wrapper) | — | Keeps Uvicorn alive on reboot |
| **Reverse proxy** | Nginx | 1.18+ | TLS termination, static asset serving, `/api → 127.0.0.1:8001` |
| **TLS** | Let's Encrypt via Certbot | — | Auto-renew via cron / systemd timer |
| **Frontend package manager** | **Yarn (Classic v1)** | required | `npm install` will subtly break dependency resolution — always use yarn |
| **Backend package manager** | `pip` + `requirements.txt` | — | A `venv` is mandatory |

### 1.3 Exact Project Directory Structure

After cloning the repository the layout is:

```
/app
├── README.md
├── SELF_HOSTING.md                     # short deployment quick-start
├── IFEELINCOLOR_USER_GUIDE.md          # plain-language end-user guide
├── IFEELINCOLOR_DEVELOPER_HANDOVER.md  # ◀ THIS FILE
├── .env.example                        # template — copy into backend/ and frontend/
│
├── backend/                            # FastAPI service
│   ├── server.py                       # Entry point — declares FastAPI app, mounts routers, seeds admin/plans/templates on startup
│   ├── admin_auth.py                   # Admin login (cookie session) + seed_admin()
│   ├── admin_routes.py                 # /api/admin/* — patient/clinician/org CRUD, assignments, plans, etc.
│   ├── admin_routes_ext.py             # /api/admin/* extension routes (org payments, etc.)
│   ├── auth_extended.py                # /api/auth/webauthn/* (biometric), forgot-password
│   ├── checkin_routes.py               # /api/checkin/* and /api/admin/checkin/* — body parts, emotion families, regulation
│   ├── docs_routes.py                  # /api/docs/user-guide — renders the Markdown user guide as styled HTML
│   ├── dossier_pdf.py                  # ReportLab generator for /api/patient/dossier/pdf
│   ├── email_provider.py               # Gmail SMTP send + DB-override config — single entry point for all outbound mail
│   ├── email_templates.py              # /api/admin/email-templates/* — CRUD, AI-generate, preview, send-test
│   ├── llm_adapter.py                  # Vendor-agnostic call_llm() — OpenAI / Anthropic / Google
│   ├── patient_flow.py                 # /api/patient/* — check-ins, assessments, recommendations, dossier
│   ├── stripe_adapter.py               # Thin Stripe SDK wrapper (subscriptions, customers, prices)
│   ├── stripe_routes.py                # /api/subscribe, /api/webhook/stripe
│   ├── requirements.txt                # `pip freeze` snapshot — see Section 5.4 for safe upgrade path
│   ├── tests/                          # pytest suites — `pytest backend/tests`
│   │   ├── test_phase_*.py
│   │   └── test_checkin_config.py
│   └── .env                            # ◀ NOT in git — see Section 2
│
├── frontend/                           # React 19 SPA
│   ├── public/
│   │   ├── index.html
│   │   ├── _redirects                  # static host SPA fallback
│   │   └── favicon, manifest, robots
│   ├── src/
│   │   ├── App.js                      # Root router + global providers
│   │   ├── App.css, index.js, index.css
│   │   ├── brand.js                    # Logo URL, brand colors
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── MobileHome.jsx          # /mobile-home — patient/clinician sign-in toggle
│   │   │   ├── PatientSignup.jsx, ClinicianSignup.jsx, ForgotPassword.jsx
│   │   │   ├── patient/                # 11 pages — Home, Assessment, History, Recs, Subscribe, Notifications, Settings, Profile, Emergency, Roadmap
│   │   │   ├── clinician/              # 10 pages — Home, Patients, AI Coach, Notes, Settings, Subscribe, Recommendations, Analytics, Patient History, Roadmap
│   │   │   └── admin/                  # 21 pages — Dashboard, all CRUD, email templates, settings, etc.
│   │   ├── components/
│   │   │   ├── ui/                     # ◀ Shadcn UI primitives — DO NOT EDIT directly. Compose new components on top.
│   │   │   ├── auth/                   # BiometricLoginButton, DocLink
│   │   │   ├── admin/AdminLayout.jsx, EmailProviderCard.jsx
│   │   │   ├── patient/PatientAppShell.jsx, WelcomeModal.jsx
│   │   │   ├── clinician/ClinicianAppShell.jsx, BrowserPushBootstrap.jsx
│   │   │   ├── checkin/                # 9-step check-in components
│   │   │   ├── history/                # 3D body map + time slider for assessment history
│   │   │   └── brand/                  # Logo, splash, route loader
│   │   ├── contexts/                   # React contexts (Auth, AdminAuth, NeuroInclusive)
│   │   ├── lib/                        # platform.js (WebView detection), tts.jsx, healthDossierPdf.js, featureTips.js
│   │   └── hooks/                      # custom hooks
│   ├── package.json                    # ◀ Yarn — never run npm install
│   ├── yarn.lock                       # ◀ commit this; do not delete
│   ├── craco.config.js                 # build-tool overrides
│   ├── tailwind.config.js, postcss.config.js
│   └── .env                            # ◀ NOT in git — see Section 2
│
└── memory/                             # internal docs (PRD, system overview, test credentials)
    ├── PRD.md
    ├── SYSTEM_OVERVIEW.md
    └── test_credentials.md
```

### 1.4 Request Routing Conventions

| Path | Handler | Notes |
|---|---|---|
| `/api/*` | FastAPI on port 8001 | All backend endpoints — ALWAYS prefixed `/api` |
| `/api/docs/user-guide` | FastAPI HTML response | Public user guide |
| `/api/webhook/stripe` | FastAPI (raw body) | Stripe webhook — must NOT be intercepted by other middleware |
| `*` (everything else) | React static `index.html` | SPA — client-side router takes over |

> **Hard rule:** every backend route MUST start with `/api`. Nginx routes `/api` to `127.0.0.1:8001` and falls back to the static frontend for everything else.

---

## 2. Local Configuration & Environment Variables

### 2.1 Files

The application reads from **two** `.env` files. Both must exist; neither is committed to git.

```
backend/.env       ← read by FastAPI via python-dotenv + os.environ
frontend/.env      ← read by Create React App at BUILD time (REACT_APP_* only)
```

> **Important quirk of CRA:** `REACT_APP_BACKEND_URL` is **inlined into the JS bundle at `yarn build` time**. Changing it after the build does nothing — you must rebuild.

### 2.2 Backend `.env` — Complete Reference

Copy `/app/.env.example` to `/app/backend/.env` and fill in real values:

```bash
# ─── Core ──────────────────────────────────────────────────────
DATABASE_URL=mongodb://ifc_user:strongpass@127.0.0.1:27017/?authSource=admin
MONGO_URL=mongodb://ifc_user:strongpass@127.0.0.1:27017/?authSource=admin   # legacy alias; keep both
DB_NAME=ifeelincolor

# ─── Security ──────────────────────────────────────────────────
JWT_SECRET=<output of: openssl rand -hex 64>
JWT_EXPIRES_DAYS=14
CORS_ORIGINS=https://app.your-domain.com,https://admin.your-domain.com

# ─── First-run admin seed (one-time, on cold boot) ─────────────
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=ReplaceWith-A-StrongPassword!

# ─── Public URLs (used in email CTAs) ──────────────────────────
APP_BASE_URL=https://app.your-domain.com
ADMIN_BASE_URL=https://app.your-domain.com/admin

# ─── AI / LLM (pick exactly ONE provider) ──────────────────────
OPENAI_API_KEY=sk-proj-...
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_GENAI_API_KEY=...
# AI_DEFAULT_PROVIDER=openai          # optional, auto-detected
# AI_DEFAULT_MODEL=gpt-4o-mini        # optional

# ─── Gmail (App Password method — DEFAULT, simplest) ───────────
GMAIL_SENDER_EMAIL=hello@your-domain.com
GMAIL_SENDER_NAME=IFEELINCOLOR Care Team
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
GMAIL_SMTP_HOST=smtp.gmail.com
GMAIL_SMTP_PORT=587

# ─── Gmail OAuth (OPTIONAL — for tenants requiring full OAuth) ─
# Leave blank for SMTP+App Password (the supported default).
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_REDIRECT_URI=https://app.your-domain.com/auth/gmail/callback

# ─── Stripe ────────────────────────────────────────────────────
STRIPE_API_KEY=sk_live_...                  # legacy name; also accepted as STRIPE_SECRET_KEY
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ─── Google Maps / Places ──────────────────────────────────────
GOOGLE_MAPS_API_KEY=AIza...

# ─── WebAuthn (biometric login) — usually not needed ───────────
# WEBAUTHN_RP_ID=app.your-domain.com
# WEBAUTHN_RP_NAME=IFEELINCOLOR

# ─── Observability (optional) ──────────────────────────────────
# SENTRY_DSN=
LOG_LEVEL=INFO
```

### 2.3 Frontend `.env` — Complete Reference

Copy to `/app/frontend/.env`:

```bash
REACT_APP_BACKEND_URL=https://api.your-domain.com   # NO trailing slash
WDS_SOCKET_PORT=443                                  # only used in `yarn start` dev mode behind a proxy
ENABLE_HEALTH_CHECK=false
# REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...      # only if doing client-side Stripe Elements
```

### 2.4 How to instantiate the variables (without Emergent)

```bash
# 1. Generate a strong JWT secret
openssl rand -hex 64
# → paste into JWT_SECRET=

# 2. Create the file
cd /opt/ifeelincolor/backend
cp /opt/ifeelincolor/.env.example .env
nano .env       # fill in real values

# 3. Restrict permissions (root + service user only)
chown www-data:www-data .env
chmod 600 .env

# 4. Repeat for frontend
cd /opt/ifeelincolor/frontend
nano .env
```

> **Never** commit `.env` to git. The repo's `.gitignore` already excludes it; verify with `git check-ignore -v backend/.env`.

### 2.5 Variable Resolution Order

| Variable | Resolution |
|---|---|
| `MONGO_URL` / `DATABASE_URL` | `MONGO_URL` first, then `DATABASE_URL` (either works) |
| Gmail credentials | DB override (`app_settings.email_provider`) **first**, then env vars (see §3.1) |
| LLM provider | `AI_DEFAULT_PROVIDER` if set, else first key found in this order: `OPENAI_API_KEY` → `ANTHROPIC_API_KEY` → `GOOGLE_GENAI_API_KEY` → `EMERGENT_LLM_KEY` |
| `WEBAUTHN_RP_ID` | env var → `X-Forwarded-Host` → `Referer` → `Origin` → `Host` |

---

## 3. Independent Gmail & Third-Party Integration Guide

### 3.1 How Gmail Is Wired Up (Code Walkthrough)

**Single source of truth:** `/app/backend/email_provider.py`

There are two configuration layers:

1. **Database override** — `app_settings.email_provider` document in MongoDB. Set via the Admin UI at `/admin/email-templates → Email Provider Card`. Lets the super-admin rotate the sending mailbox WITHOUT a redeploy.
2. **Environment variables** — `GMAIL_SENDER_EMAIL`, `GMAIL_APP_PASSWORD`, `GMAIL_SENDER_NAME`, `GMAIL_SMTP_HOST`, `GMAIL_SMTP_PORT` — used as fallback when no DB row exists.

**Public function used everywhere:**

```python
from email_provider import send_via_gmail

ok, status, error = await send_via_gmail(
    to_email="user@example.com",
    to_name="Luna Star",
    subject="Welcome to IFEELINCOLOR",
    html_body="<html>…</html>",
    plain_fallback="",  # auto-derived from html if blank
)
# status ∈ {"sent", "failed", "mock_sent"}
```

**Six dispatch points** in the codebase that call `send_via_gmail`:

| Trigger | File | Function |
|---|---|---|
| Admin manual send | `email_templates.py` | `POST /api/admin/email/send` |
| Welcome email on user create | `admin_routes.py` | `POST /api/admin/users` |
| Assistant invite | `admin_routes.py` | `POST /api/admin/assistants` |
| Password reset link | `auth_extended.py` | `POST /api/auth/forgot-password` |
| Subscription renewal reminder | `admin_routes.py` | `POST /api/admin/subscriptions/{id}/send-renewal` |
| Org payment request | `admin_routes_ext.py` | (org-side payment endpoints) |

> **All outbound mail flows through `email_provider.send_via_gmail`.** Do not call `smtplib` directly anywhere else — you will bypass the DB override + audit logging.

### 3.2 Two Gmail Configuration Methods

#### **Method A — Gmail App Password (RECOMMENDED, fully implemented, in production)**

Simplest, no OAuth dance, works under the existing code today.

##### Step 1 — Enable 2FA on the Google account that will send mail
1. Go to https://myaccount.google.com/security
2. Under **"How you sign in to Google"**, enable **2-Step Verification** (required to generate App Passwords).

##### Step 2 — Generate an App Password
1. Visit https://myaccount.google.com/apppasswords (only visible after 2FA is on).
2. Select **"Mail"** as the app and **"Other (Custom)"** for the device, name it `IFEELINCOLOR Production`, click **Generate**.
3. Copy the 16-character password (formatted like `abcd efgh ijkl mnop`). Spaces are OK; the code strips them.

##### Step 3 — Insert into `backend/.env`
```bash
GMAIL_SENDER_EMAIL=hello@your-domain.com   # the Gmail / Workspace address
GMAIL_SENDER_NAME=IFEELINCOLOR Care Team
GMAIL_APP_PASSWORD=abcdefghijklmnop
GMAIL_SMTP_HOST=smtp.gmail.com
GMAIL_SMTP_PORT=587
```

##### Step 4 — Restart and verify
```bash
sudo systemctl restart ifeelincolor-backend     # or pm2 restart ifc-backend
```

Then in the Admin Panel: `/admin/email-templates → Email Provider Card → Send Test → enter your inbox → check it arrives within 10 seconds.`

##### Production gotchas
- Workspace tenants: ensure SMTP relay isn't disabled by your admin policy.
- Free Gmail accounts: hard-capped at **500 recipients/day**. For higher volume, switch to Google Workspace, AWS SES, SendGrid, or Postmark and set `GMAIL_SMTP_HOST` / port accordingly — the code only assumes STARTTLS-compatible SMTP, not Gmail-specific behavior.

#### **Method B — Gmail OAuth 2.0 (env-var slots reserved; refresh-token send path NOT yet implemented)**

The `.env.example` reserves slots for `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_REDIRECT_URI` so future developers can wire OAuth without renaming variables, but **the current `email_provider.py` only reads the App Password fields.** If your security policy mandates OAuth, follow these steps to prepare the credentials, then add the OAuth send branch in `email_provider._send_sync` (≈30 lines using the `google-auth` + `google-auth-oauthlib` libraries — see end of section).

##### Step 1 — Create a Google Cloud project
1. https://console.cloud.google.com/ → top bar → **"New Project"** → name it `IFEELINCOLOR-Email`.

##### Step 2 — Enable the Gmail API
1. **APIs & Services → Library** → search "Gmail API" → **Enable**.

##### Step 3 — Configure the OAuth consent screen
1. **APIs & Services → OAuth consent screen** → User Type **External** (or **Internal** for Workspace) → fill in:
   - App name: `IFEELINCOLOR`
   - User support email: your address
   - Developer contact: your address
2. **Scopes** → click **"Add or Remove Scopes"** → tick **`https://www.googleapis.com/auth/gmail.send`** (only the send scope — never request more than you need).
3. **Test users** → add the Gmail address that will send mail (only required while the app is in **Testing** status; once **Published**, this is unnecessary).

##### Step 4 — Create OAuth Client ID credentials
1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Authorized redirect URIs: add `https://app.your-domain.com/auth/gmail/callback` (must match `GMAIL_REDIRECT_URI` exactly).
4. Click **Create**. Copy the **Client ID** and **Client Secret**.

##### Step 5 — Obtain a refresh token (one-time, manual)
This is a one-shot flow you do locally to get a long-lived `refresh_token`:

```bash
pip install google-auth-oauthlib
python3 -c '
from google_auth_oauthlib.flow import InstalledAppFlow
flow = InstalledAppFlow.from_client_config(
    {"web": {
        "client_id": "PASTE_CLIENT_ID",
        "client_secret": "PASTE_CLIENT_SECRET",
        "redirect_uris": ["http://localhost:8765/"],
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }},
    scopes=["https://www.googleapis.com/auth/gmail.send"],
)
creds = flow.run_local_server(port=8765, prompt="consent", access_type="offline")
print("REFRESH_TOKEN:", creds.refresh_token)
'
```

Open the URL it prints, sign in with the **mailbox** account, grant consent, and the script prints the refresh token.

##### Step 6 — Insert into `backend/.env`
```bash
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GMAIL_REFRESH_TOKEN=1//...
GMAIL_REDIRECT_URI=https://app.your-domain.com/auth/gmail/callback
```

##### Step 7 — Implement the OAuth send branch (developer task)
Add this to `email_provider._send_sync` to use OAuth when present (sketch):

```python
import os, base64
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GAuthRequest
from googleapiclient.discovery import build

def _send_via_oauth(msg) -> Tuple[bool, Optional[str]]:
    creds = Credentials(
        token=None,
        refresh_token=os.environ["GMAIL_REFRESH_TOKEN"],
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["https://www.googleapis.com/auth/gmail.send"],
    )
    creds.refresh(GAuthRequest())
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return True, None
```

Wire it as the first branch when `os.environ.get("GMAIL_REFRESH_TOKEN")` is truthy; fall back to the existing SMTP branch otherwise. Add `google-api-python-client` and `google-auth` to `requirements.txt`.

### 3.3 LLM Integration — Where the Code Lives

**File:** `/app/backend/llm_adapter.py` (≈190 lines).
**Public API:** `await call_llm(system_prompt, user_text, model=None, provider=None) -> str`

| Provider | Required env var | Default model | SDK |
|---|---|---|---|
| OpenAI (default) | `OPENAI_API_KEY` | `gpt-4o-mini` | `openai` (`AsyncOpenAI`) |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5` | `anthropic` (`AsyncAnthropic`) |
| Google Gemini | `GOOGLE_GENAI_API_KEY` | `gemini-2.0-flash` | `google-genai` |
| Emergent (legacy) | `EMERGENT_LLM_KEY` | `gpt-4o-mini` | `emergentintegrations` (only if all above are absent) |

**Where LLM calls happen** (search the codebase for `call_llm` or `llm_adapter`):

| Feature | File | Purpose |
|---|---|---|
| Patient AI Wellness Plan | `patient_flow.py` | Generates `summary` / `next_steps` / `encouragement` after each assessment |
| Clinician AI Coach | `admin_routes_ext.py` (or sibling) | Generates 5-step treatment plan |
| Email Template AI Generate | `email_templates.py` | Drafts branded HTML email from prompt |

To swap providers at runtime: edit `backend/.env`, restart the backend (`pm2 restart ifc-backend`). No code changes.

### 3.4 Stripe Integration

**File:** `/app/backend/stripe_adapter.py` (helper) and `/app/backend/stripe_routes.py` (routes).

- Init: `stripe.api_key = os.environ["STRIPE_SECRET_KEY"]` happens at module import.
- Create checkout: `POST /api/subscribe` — body `{plan_id, role}` → returns `{checkout_url}`.
- Webhook: `POST /api/webhook/stripe` — verifies signature with `STRIPE_WEBHOOK_SECRET`, updates `subscriptions` collection.

**Register the webhook** in your Stripe dashboard:
- URL: `https://api.your-domain.com/api/webhook/stripe`
- Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.

### 3.5 Google Places (Nearby Doctors)

**File:** `/app/backend/server.py` → endpoint `GET /api/doctors/nearby?lat=&lng=`.
**Env var:** `GOOGLE_MAPS_API_KEY` (must have **Places API** enabled).
**Restriction:** in production, restrict the key by HTTP referrer to `*.your-domain.com` to prevent quota theft.

---

## 4. Hostinger Deployment & Production Hosting Blueprint

> **Plan required:** Hostinger **VPS** (not shared, not Node.js shared). Recommended minimum: **KVM 2** — 2 vCPU, 8 GB RAM, 100 GB NVMe. **OS:** Ubuntu 22.04 LTS.

### 4.1 One-Time VPS Setup

#### Step 4.1.1 — Buy and access the VPS
1. Hostinger → **VPS Hosting** → choose **KVM 2** or higher.
2. During setup pick **Ubuntu 22.04 LTS (no panel)** — do NOT install hPanel (not needed; we'll do everything via SSH).
3. Once provisioned, get the IP address from the Hostinger hPanel → VPS Overview.
4. SSH in:
   ```bash
   ssh root@your-vps-ip
   ```

#### Step 4.1.2 — Create a non-root deploy user
```bash
adduser deploy            # set a strong password
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
exit
ssh deploy@your-vps-ip
```

#### Step 4.1.3 — Install system dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential nginx ufw fail2ban \
                    python3.11 python3.11-venv python3-pip \
                    gnupg ca-certificates lsb-release
```

#### Step 4.1.4 — Install Node 20 + Yarn (for the frontend build)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn pm2
```

#### Step 4.1.5 — Install MongoDB 7
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

Create a Mongo admin user:
```bash
mongosh
> use admin
> db.createUser({ user: "ifc_user", pwd: "STRONG_PASSWORD",
                  roles: [{ role: "readWrite", db: "ifeelincolor" },
                          { role: "dbAdmin", db: "ifeelincolor" }] })
> exit
```
Enable auth in `/etc/mongod.conf`:
```yaml
security:
  authorization: enabled
```
`sudo systemctl restart mongod`

#### Step 4.1.6 — Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"        # 80 + 443
sudo ufw enable
```

### 4.2 Deploy the Application

#### Step 4.2.1 — Clone the code
```bash
sudo mkdir -p /opt/ifeelincolor && sudo chown deploy:deploy /opt/ifeelincolor
cd /opt
git clone https://your-git-host/ifeelincolor.git ifeelincolor
# OR upload your code via scp / rsync if no git remote
cd /opt/ifeelincolor
```

#### Step 4.2.2 — Configure environment files
```bash
cp .env.example backend/.env
cp .env.example frontend/.env
nano backend/.env       # paste real production values from Section 2
nano frontend/.env      # set REACT_APP_BACKEND_URL=https://api.your-domain.com
chmod 600 backend/.env frontend/.env
```

#### Step 4.2.3 — Install backend dependencies (Python venv)
```bash
cd /opt/ifeelincolor/backend
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip wheel
pip install -r requirements.txt
deactivate
```

#### Step 4.2.4 — Build the frontend
```bash
cd /opt/ifeelincolor/frontend
yarn install --frozen-lockfile
yarn build
# → produces /opt/ifeelincolor/frontend/build/
```

#### Step 4.2.5 — Start the backend with PM2
Create `/opt/ifeelincolor/ecosystem.config.js`:
```js
module.exports = {
  apps: [{
    name: "ifc-backend",
    cwd: "/opt/ifeelincolor/backend",
    script: "/opt/ifeelincolor/backend/venv/bin/uvicorn",
    args: "server:app --host 127.0.0.1 --port 8001 --workers 2 --proxy-headers --forwarded-allow-ips='*'",
    interpreter: "none",
    autorestart: true,
    max_memory_restart: "800M",
    env: { PYTHONUNBUFFERED: "1" },
    error_file: "/var/log/ifc/backend.err.log",
    out_file: "/var/log/ifc/backend.out.log",
    time: true,
  }],
};
```

```bash
sudo mkdir -p /var/log/ifc && sudo chown deploy:deploy /var/log/ifc
cd /opt/ifeelincolor
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u deploy --hp /home/deploy
# Run the command pm2 prints — it registers PM2 as a systemd service.
```

Verify:
```bash
curl -i http://127.0.0.1:8001/api/
# → 200 OK { "message": "IFEELINCOLOR API v1" }
pm2 status
```

#### Step 4.2.6 — Configure Nginx
Replace `/etc/nginx/sites-available/ifeelincolor`:
```nginx
# ── HTTP → HTTPS redirect (cert-bot will populate :443 below) ──
server {
    listen 80;
    listen [::]:80;
    server_name app.your-domain.com api.your-domain.com;
    return 301 https://$host$request_uri;
}

# ── Unified site: serves frontend + proxies /api → 8001 ──
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.your-domain.com;

    # SSL — Certbot will manage these
    # ssl_certificate /etc/letsencrypt/live/app.your-domain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/app.your-domain.com/privkey.pem;

    client_max_body_size 25M;

    # Static React build
    root /opt/ifeelincolor/frontend/build;
    index index.html;

    # Cache hashed asset bundles aggressively
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # Stripe webhook needs raw body — same proxy config works because we
    # don't strip headers; just don't add gzip.
    location = /api/webhook/stripe {
        proxy_pass http://127.0.0.1:8001/api/webhook/stripe;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
        proxy_buffering off;
    }

    # SPA fallback — every non-API path serves the React index.html
    location / {
        try_files $uri /index.html;
    }
}
```

Activate:
```bash
sudo ln -s /etc/nginx/sites-available/ifeelincolor /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

#### Step 4.2.7 — Point DNS at the VPS
At your domain registrar (Hostinger DNS, Cloudflare, Namecheap…), create:

| Record | Name | Value | TTL |
|---|---|---|---|
| A | `app` | `<VPS IP>` | 300 |
| A | `api` | `<VPS IP>` | 300 |

Wait 5–60 min for propagation. Verify with `dig +short app.your-domain.com`.

#### Step 4.2.8 — Issue Let's Encrypt SSL
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.your-domain.com -d api.your-domain.com \
            --redirect --agree-tos -m admin@your-domain.com --non-interactive
# Auto-renewal already installed via systemd timer:
systemctl list-timers | grep certbot
```

#### Step 4.2.9 — Smoke test the production deployment
```bash
curl -i https://app.your-domain.com/                # → 200 + index.html
curl -i https://app.your-domain.com/api/            # → 200 { "message": "IFEELINCOLOR API v1" }
curl -i https://app.your-domain.com/api/docs/user-guide   # → 200 + HTML user guide
```
Open `https://app.your-domain.com/admin/login` in a browser → sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from §2.2.

### 4.3 Deploying Code Updates

```bash
ssh deploy@your-vps-ip
cd /opt/ifeelincolor
git pull origin main

# Backend changes?
cd backend && source venv/bin/activate
pip install -r requirements.txt
deactivate
pm2 restart ifc-backend

# Frontend changes?
cd /opt/ifeelincolor/frontend
yarn install --frozen-lockfile
yarn build
sudo systemctl reload nginx       # picks up the new build/ folder
```

> **Zero-downtime tip:** PM2 supports `pm2 reload ifc-backend` (graceful) instead of `restart`. Use it for production hot-swaps.

### 4.4 Backups

#### Mongo daily backup
Add to deploy user's crontab (`crontab -e`):
```bash
0 3 * * * mongodump --uri="mongodb://ifc_user:STRONG_PASSWORD@127.0.0.1:27017/?authSource=admin" --db=ifeelincolor --out=/var/backups/mongo/$(date +\%F) >> /var/log/ifc/backup.log 2>&1
0 4 * * 0 find /var/backups/mongo -type d -mtime +30 -exec rm -rf {} +
```

Off-site: rclone the `/var/backups/mongo` folder nightly to S3 / Backblaze.

---

## 5. Maintenance, Modification & "How to Edit" Guide

### 5.1 Run the App Locally in Development Mode

```bash
# Terminal 1 — Backend with hot reload
cd /opt/ifeelincolor/backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
# Code changes auto-restart Uvicorn

# Terminal 2 — Frontend with hot reload
cd /opt/ifeelincolor/frontend
yarn install
yarn start
# → http://localhost:3000  (proxies /api to localhost:8001 via REACT_APP_BACKEND_URL)
```

> **For local dev, set `REACT_APP_BACKEND_URL=http://localhost:8001` in `frontend/.env.development`** (CRA picks up `.env.development` when you run `yarn start`).

### 5.2 Build & Deploy Cheat Sheet

| Action | Command |
|---|---|
| Backend deps install | `cd backend && pip install -r requirements.txt` |
| Backend deps freeze | `pip freeze > requirements.txt` (do this **after every** `pip install`) |
| Backend dev run | `uvicorn server:app --reload` |
| Backend lint | `ruff check backend/` |
| Backend tests | `cd backend && pytest tests/ -v` |
| Frontend deps install | `cd frontend && yarn install --frozen-lockfile` |
| Frontend dev run | `yarn start` |
| Frontend production build | `yarn build` → `frontend/build/` |
| Frontend lint | `yarn eslint src/` |
| Production reload (PM2) | `pm2 reload ifc-backend` |
| Production restart (PM2) | `pm2 restart ifc-backend` |
| View backend logs | `pm2 logs ifc-backend --lines 200` |
| View Nginx error log | `sudo tail -f /var/log/nginx/error.log` |
| Reload Nginx | `sudo systemctl reload nginx` |

### 5.3 How to Add a New Backend Endpoint

1. Pick the right router file (`patient_flow.py`, `admin_routes.py`, `stripe_routes.py`, `email_templates.py`, `checkin_routes.py`, etc.) — endpoints already grouped by feature.
2. Add the route — note the prefix is auto-applied by the router:
   ```python
   @patient_flow_router.get("/patient/recommendations")     # prefix /api applied at app level
   async def list_recs(req: Request, user=Depends(get_current_user)):
       docs = await db.recommendations.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
       return {"items": docs}
   ```
3. **Mongo rules** — always project out `_id` (it's a `BSON ObjectId` and breaks JSON serialization), use `datetime.now(timezone.utc)`, and never reuse a dict you passed to `insert_one` / `update_one` because Motor mutates it.
4. Add a pytest in `/app/backend/tests/test_<feature>.py`.
5. Lint: `ruff check backend/`.
6. Reload: `pm2 reload ifc-backend`.

### 5.4 How to Add a New React Page

1. Create `frontend/src/pages/<role>/MyNewPage.jsx` with `export default function MyNewPage() { … }`.
2. Lazy-import in `App.js`:
   ```js
   const MyNewPage = lazy(() => import('./pages/patient/MyNewPage'));
   ```
3. Register a route inside the appropriate shell (e.g., `<PatientAppShell>`'s `<Routes>` block).
4. Add `data-testid="my-new-page"` on the root container — required for automated tests.
5. If the feature is interactive, add a tooltip via the existing `<InfoTip>` component (see `frontend/src/components/ui/InfoTip.jsx`).
6. Build & deploy: `yarn build && sudo systemctl reload nginx`.

### 5.5 Database Schema — Safe Modification Checklist

**MongoDB is schemaless**, but the app code still expects specific shapes. To safely evolve a collection:

1. **Document the change** — add it to `/app/memory/PRD.md` and bump the section.
2. **Make new fields optional**, never required. Use `doc.get("new_field", default)` in Python so old documents still load.
3. **Run a migration before deploying code that needs the field.** Migrations live nowhere by default; use `mongosh`:
   ```js
   use ifeelincolor
   db.users.updateMany({ new_field: { $exists: false } },
                       { $set: { new_field: "default_value" } })
   ```
4. **Add an index** for any field you start querying on:
   ```js
   db.patient_checkins.createIndex({ user_id: 1, created_at: -1 })
   ```
5. **Never** `db.collection.drop()` in production. Rename the collection (`db.foo.renameCollection("foo_archived_2026_05")`) instead.
6. **Test rollback** — your new code should still work if a doc is missing the new field (graceful degradation).

#### Critical collections (do not break)

| Collection | Used By | Key Fields |
|---|---|---|
| `users` | auth, all role flows | `user_id`, `email`, `password_hash`, `role`, `name` |
| `admin_users` | `/admin/*` | `email`, `password_hash`, `role` (`super_admin`/`assistant`), `page_permissions` |
| `patient_checkins` | 9-step check-in | `user_id`, `created_at`, `body_data`, `user_selected_color`, `intensity` |
| `patient_assessment_responses` | Assessment hub | `user_id`, `category_id`, `submitted_at`, `answers`, `severity`, `ai_plan` |
| `patient_activity` | Recommendations feed | `user_id`, `type`, `from_admin`, `auto_assigned`, `ref_id`, `created_at` |
| `patient_subscriptions` | Patient-clinician HIPAA wall | `patient_user_id`, `clinician_user_id`, `plan_id`, `start_date`, `end_date` |
| `subscriptions` | Stripe | `customer_id`, `status`, `plan_id`, `current_period_end` |
| `app_settings` | Email provider override | `_id: "email_provider"` document with SMTP creds |
| `assessment_templates` | Admin-driven check-in & assessment | `category_id`, `body_parts[]`, `emotion_families[]`, `questions[]` |
| `checkin_body_parts` | 9-step body map | `slug`, `x`, `y`, `sensations`, `questions`, `sensation_emotion_map` |
| `recommendations` | Master library | `recommendation_id`, `title`, `content_type`, `severity_filter`, `target_color` |
| `webauthn_credentials` | Biometric login | `user_id`, `credential_id`, `public_key`, `sign_count` |
| `sent_emails` | Email audit log | `to`, `subject`, `template_id`, `status`, `error`, `created_at` |

### 5.6 Troubleshooting Production

| Symptom | Diagnostic | Fix |
|---|---|---|
| 502 Bad Gateway | `pm2 status` shows `errored` | `pm2 logs ifc-backend --err`; usually a missing env var or a Mongo connection refused |
| Frontend loads but `/api/*` returns HTML | Nginx route order wrong | Ensure `/api/` block comes **before** the catch-all `location /` in the Nginx config |
| Stripe webhook 400 | Body modified by middleware / nginx gzip | Add `proxy_buffering off;` to the `/api/webhook/stripe` location (already in §4.2.6) |
| Biometric login fails with `rp.id` mismatch | `WEBAUTHN_RP_ID` set wrong, or proxy strips `X-Forwarded-Host` | Either set `WEBAUTHN_RP_ID=app.your-domain.com` explicitly in env, or ensure Nginx forwards `X-Forwarded-Host` (covered in the config) |
| Email "mock_sent" status forever | `GMAIL_APP_PASSWORD` empty in env AND no DB row | Set env var or save creds via Admin → Email Provider Card |
| WebView APK PDF download blocked | Known limitation of `webtonative` Android wrappers | Use the **Standard PDF** (server-rendered) option, not the **Animated PDF** (client jsPDF) |
| Out of memory under load | KVM 2 may be tight at scale | Bump PM2 `--workers 2` → `4`, or upgrade to KVM 4 (16 GB) |

### 5.7 Removing the Last Emergent Dependency (If Desired)

The codebase still has a fallback path through `emergentintegrations` for tenants migrating from Emergent. To remove it entirely:

1. In `backend/.env`, ensure `OPENAI_API_KEY` (or another vendor key) is set. Do **not** set `EMERGENT_LLM_KEY`.
2. Edit `backend/requirements.txt` and remove any `emergent*` lines.
3. Edit `backend/llm_adapter.py` and delete the `_emergent_chat` function + its branch in `call_llm`.
4. `pip uninstall -y emergentintegrations` inside the venv.
5. `pm2 reload ifc-backend`.

The application will function identically — the LLM adapter resolves to the OpenAI/Anthropic/Google branch automatically.

---

## Appendix A — Quick-Start (TL;DR)

```bash
# On a fresh Ubuntu 22.04 VPS:
ssh root@vps && adduser deploy && usermod -aG sudo deploy && su - deploy

sudo apt update && sudo apt install -y git nginx python3.11-venv nodejs npm \
                                       certbot python3-certbot-nginx
sudo npm i -g yarn pm2

# Mongo install (see §4.1.5), then:
git clone <repo> /opt/ifeelincolor && cd /opt/ifeelincolor
cp .env.example backend/.env  && nano backend/.env
cp .env.example frontend/.env && nano frontend/.env

cd backend && python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt && deactivate

cd ../frontend && yarn install --frozen-lockfile && yarn build

cd .. && pm2 start ecosystem.config.js && pm2 save
sudo cp deploy/nginx.conf /etc/nginx/sites-available/ifeelincolor
sudo ln -s /etc/nginx/sites-available/ifeelincolor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d app.your-domain.com -d api.your-domain.com
```

---

## Appendix B — File Map for Common Edits

| Want to change… | Edit this file |
|---|---|
| The 9-step daily check-in flow | `frontend/src/components/checkin/CheckInFlow.jsx` (+ children in same folder) |
| The body map zones / coords | `backend/checkin_routes.py` (`DEFAULT_BODY_PARTS`) + `frontend/src/components/checkin/SomaticMap.jsx` |
| The PDF dossier layout | `backend/dossier_pdf.py` (server) + `frontend/src/lib/healthDossierPdf.js` (animated client-side) |
| AI Wellness Plan prompt | `backend/patient_flow.py` (search "system" / "call_llm") |
| Clinician AI Coach prompt | `backend/admin_routes_ext.py` (search `clinician-coach`) |
| Email template defaults | `backend/email_templates.py` → `seed_email_templates()` |
| Admin sidebar nav order | `frontend/src/components/admin/AdminLayout.jsx` (`NAV` array) |
| Patient bottom nav tabs | `frontend/src/components/patient/PatientAppShell.jsx` (`TABS` array) |
| Tooltip wording | `frontend/src/lib/featureTips.js` |
| Brand colors / logo | `frontend/src/brand.js` |
| Tailwind theme | `frontend/tailwind.config.js` |

---

## Appendix C — Default Credentials (Change Immediately on First Boot)

| Role | Email | Password | How seeded |
|---|---|---|---|
| Super Admin | from `ADMIN_EMAIL` env | from `ADMIN_PASSWORD` env | `admin_auth.seed_admin()` on cold boot |
| Demo Patient (dev only) | `luna@demo.ifeelincolor.com` | `Patient@123` | `/api/auth/demo-login/seed` |
| Demo Clinician (dev only) | `sarah@demo.ifeelincolor.com` | `Clinician@123` | `/api/auth/demo-login/seed` |

Demo accounts are only created when the `demo-login` endpoint is hit. Disable them in production by removing the `auth/demo-login*` routes from `server.py` (or wrapping them in `if os.environ.get("ENV") != "production"`).

---

*End of document. Hand-off complete. The app is yours — build boldly.*

— Principal Software Architect, IFEELINCOLOR
February 2026
