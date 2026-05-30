# IFEELINCOLOR — Self-Hosting Guide

A complete, copy-pasteable runbook for deploying IFEELINCOLOR on **your own infrastructure** with **zero Emergent platform dependencies**.

## TL;DR

```bash
git clone <your-fork>.git ifeelincolor && cd ifeelincolor
cp .env.example backend/.env       # fill in keys
cp .env.example frontend/.env      # only REACT_APP_* lines needed
cd backend && pip install -r requirements.txt
cd ../frontend && yarn install
# run with the supervisor recipe below OR directly:
cd ../backend && uvicorn server:app --host 0.0.0.0 --port 8001 &
cd ../frontend && yarn build && serve -s build -l 3000
```

---

## 1. What you need before starting

| Service | Purpose | Where to get it |
|---|---|---|
| **MongoDB 6+** | Primary database | `apt install mongodb`, MongoDB Atlas free tier, or DO Managed Mongo |
| **OpenAI API key** | LLM for emails / coach / reflections | https://platform.openai.com/api-keys |
| **Gmail App Password** *(or full OAuth)* | Transactional email | https://myaccount.google.com/apppasswords (needs 2FA) |
| **Stripe account** | Payments | https://dashboard.stripe.com/apikeys |
| **Google Cloud Places API** | Nearby Doctors search | https://console.cloud.google.com/apis (enable "Places API" + "Geocoding API") |
| **A domain** | Public access + WebAuthn | any registrar |
| **Linux VPS** *(or Render / Vercel / Railway)* | Hosting | DigitalOcean, AWS Lightsail, Hetzner, etc. |

You do **NOT** need any Emergent account or `EMERGENT_LLM_KEY`. The legacy fallback is kept in code but never engaged when standard vendor keys are present.

---

## 2. Repo layout

```
/app
├── backend/                # FastAPI + Motor (Mongo)
│   ├── server.py          # main app
│   ├── llm_adapter.py     # ⭐ vendor-neutral LLM (OpenAI / Anthropic / Google)
│   ├── stripe_adapter.py  # ⭐ vendor-neutral Stripe Checkout
│   ├── email_provider.py  # Gmail SMTP (DB-overridable from /admin)
│   └── requirements.txt
├── frontend/               # React 18 + React Router v6 + Tailwind + Shadcn
│   ├── src/
│   ├── package.json
│   └── .env               # only REACT_APP_BACKEND_URL needed
├── .env.example
└── SELF_HOSTING.md         # this file
```

---

## 3. Environment variables

Copy `/app/.env.example` to `/app/backend/.env` and fill the values. The minimal set for a working app is:

```bash
# Required
DATABASE_URL=mongodb://localhost:27017
DB_NAME=ifeelincolor
JWT_SECRET=<openssl rand -hex 64>
APP_BASE_URL=https://app.your-domain.com

# At least ONE LLM provider
OPENAI_API_KEY=sk-...

# Email (App Password or OAuth)
GMAIL_SENDER_EMAIL=hello@your-domain.com
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx

# Payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Nearby Doctors (optional but recommended)
GOOGLE_PLACES_API_KEY=...
```

For the React build, copy ONLY this line into `/app/frontend/.env`:

```bash
REACT_APP_BACKEND_URL=https://api.your-domain.com
```

> **Security note** — every `REACT_APP_*` is baked into the JS bundle, so put **public** values only here. Never put secrets.

---

## 4. Backend setup

```bash
cd /app/backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install --upgrade pip wheel
pip install -r requirements.txt
```

Sanity-check the LLM wiring (no real API call needed):

```bash
python3 -c "from llm_adapter import active_provider; print('LLM provider:', active_provider())"
# → openai
```

Run the dev server:

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Open `http://localhost:8001/api/health` to confirm.

---

## 5. Frontend setup

```bash
cd /app/frontend
yarn install
yarn start                       # dev mode on :3000
# or for prod:
yarn build && npx serve -s build -l 3000
```

The frontend talks to the backend through `REACT_APP_BACKEND_URL` — point it at your public API host **before** building.

---

## 6. Production with Nginx + systemd (DigitalOcean / Hetzner / AWS Lightsail)

### 6.1 Install Mongo
```bash
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

### 6.2 Backend service
Create `/etc/systemd/system/ifeelincolor-backend.service`:
```ini
[Unit]
Description=IFEELINCOLOR FastAPI
After=network-online.target mongod.service

[Service]
Type=simple
User=ifc
WorkingDirectory=/opt/ifeelincolor/backend
EnvironmentFile=/opt/ifeelincolor/backend/.env
ExecStart=/opt/ifeelincolor/backend/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now ifeelincolor-backend
```

### 6.3 Frontend (static)
```bash
cd /opt/ifeelincolor/frontend
yarn install --frozen-lockfile
yarn build
sudo cp -r build/* /var/www/ifeelincolor/
```

### 6.4 Nginx
`/etc/nginx/sites-available/ifeelincolor`:
```nginx
upstream ifc_api { server 127.0.0.1:8001; }

server {
  listen 443 ssl http2;
  server_name app.your-domain.com;
  ssl_certificate     /etc/letsencrypt/live/app.your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.your-domain.com/privkey.pem;

  # SPA bundle
  root /var/www/ifeelincolor;
  index index.html;
  location / { try_files $uri /index.html; }

  # API → FastAPI
  location /api/ {
    proxy_pass         http://ifc_api;
    proxy_set_header   Host             $host;
    proxy_set_header   X-Real-IP        $remote_addr;
    proxy_set_header   X-Forwarded-For  $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
  }

  client_max_body_size 25m;
}

server { listen 80; server_name app.your-domain.com;
  return 301 https://$host$request_uri; }
```
```bash
sudo ln -s /etc/nginx/sites-available/ifeelincolor /etc/nginx/sites-enabled/
sudo certbot --nginx -d app.your-domain.com
sudo systemctl reload nginx
```

---

## 7. Deploying to managed PaaS

### 7.1 Render
- Create two services from your repo:
  - **Web Service** → root `frontend/`, build `yarn build`, publish dir `build`.
  - **Web Service** → root `backend/`, build `pip install -r requirements.txt`, start `uvicorn server:app --host 0.0.0.0 --port $PORT`.
- Add env vars from `.env.example` on both.
- Use **Render Mongo** OR external Atlas; pass the connection string as `DATABASE_URL`.

### 7.2 Vercel (frontend) + Render/Fly (backend)
- Vercel auto-builds the React app from `frontend/`. Set `REACT_APP_BACKEND_URL` in Vercel env.
- Backend on Render/Fly with the same env vars + Atlas Mongo.

### 7.3 Railway
- Single repo deploy works; add the env vars under "Variables" tab. Railway provides a free Mongo plugin you can wire as `DATABASE_URL`.

---

## 8. Stripe webhook

Register one webhook in your Stripe dashboard pointing to:
```
https://api.your-domain.com/api/webhook/stripe
```
Listen for at least:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

---

## 9. Gmail App Password vs full OAuth

**Default (recommended)** — Gmail App Password. Trivial setup, persists forever, works with any Google Workspace or personal account that has 2FA.

**Optional (advanced)** — Full Gmail OAuth refresh-token flow. Set:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_OAUTH_REDIRECT_URI=https://app.your-domain.com/auth/gmail/callback
```
The current `email_provider.py` uses App Password by default; if you need OAuth, swap the SMTP transport for `google-api-python-client` with `googleapiclient.discovery.build("gmail","v1")`. Implementation is gated behind the env vars above for forward-compatibility.

**Runtime override** — Once deployed, the super-admin can rotate the sender mailbox from `/admin/email-templates → "Sender Mailbox"`. The new credentials persist in `app_settings.email_provider` and override the env-var defaults until cleared. No redeploy needed.

---

## 10. Health & smoke tests

```bash
# 1. Backend up?
curl https://api.your-domain.com/api/health

# 2. LLM wired?
curl -X POST https://api.your-domain.com/api/admin/email-templates/ai-generate \
  -H "Content-Type: application/json" \
  -b admin_cookie.txt \
  -d '{"prompt":"Welcome email","audience":"patient"}'
# → 200 with subject/body

# 3. Email send works?
# Visit /admin/email-templates → expand "Sender Mailbox" → "Verify"

# 4. Stripe checkout works?
curl -X POST https://api.your-domain.com/api/subscribe/checkout \
  -H "Content-Type: application/json" \
  -b patient_cookie.txt \
  -d '{"plan_id":"core_monthly"}'
# → 200 with Stripe URL

# 5. Mongo connected?
mongo --eval "db.adminCommand('ping')" $DATABASE_URL
```

---

## 11. Backups

```bash
# Daily Mongo dump
0 3 * * * mongodump --uri="$DATABASE_URL" --out=/var/backups/ifc/$(date +\%F) && \
          tar czf /var/backups/ifc/$(date +\%F).tgz /var/backups/ifc/$(date +\%F) && \
          rm -rf /var/backups/ifc/$(date +\%F)
```

S3 / DO Spaces: `aws s3 sync /var/backups/ifc s3://your-bucket/ifc-backups/`.

---

## 12. Migrating from an Emergent-managed deploy

1. `mongodump` from your existing Emergent Mongo → restore to your VPS.
2. Drop `EMERGENT_LLM_KEY` from your env, add `OPENAI_API_KEY`.
3. The `emergentintegrations` library is now an OPTIONAL dependency in `requirements.txt` — leave it commented out unless you need the legacy fallback.
4. `npm/yarn build` the frontend with the new `REACT_APP_BACKEND_URL`.
5. Test all 5 endpoints in §10 against the new host.

That's it — no other code paths reference Emergent.

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `No LLM provider configured` | `OPENAI_API_KEY` missing or empty | Set the key, restart backend |
| Email CTAs link to `https://ifeelincolor.com` | `APP_BASE_URL` unset and proxy strips `Host` header | Set `APP_BASE_URL` explicitly |
| WebAuthn "rp.id mismatch" | Backend & frontend hosts don't match | Set `WEBAUTHN_RP_ID=app.your-domain.com` |
| `ImportError: emergentintegrations` | Code path tried legacy fallback | Either set a vendor key OR `pip install emergentintegrations==0.1.0 --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/` |
| Stripe webhook 400 "No signatures found" | Wrong webhook secret | Re-copy from Stripe dashboard |
| Patient list empty for clinician | PHI gate working as designed — no subscribers yet | Have a patient subscribe via Nearby Doctors or assign via admin |

---

## 14. Where to ask questions

- Issues / PRs: your fork's GitHub.
- Architecture & API surface: `/app/memory/SYSTEM_OVERVIEW.md`.
- Open backlog: `/app/memory/PRD.md`.

Welcome to your own infrastructure. 🌈
