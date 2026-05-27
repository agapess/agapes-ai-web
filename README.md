# AI Website Builder

A self-hosted, multi-user AI website builder. Chat with AI to generate beautiful React + Tailwind websites instantly. Powered by local LLMs (Ollama / LM Studio) or cloud APIs (OpenAI, Claude, OpenRouter).

---

## What's Built

| Feature | Description |
|---|---|
| AI chat builder | Chat-first interface — describe your site, AI builds it live |
| Live preview | Sandpack-powered in-browser React renderer |
| Component library | 8 pre-built templates (Hero, Pricing, Dashboard, etc.) |
| Multi-page projects | Add/switch/delete pages inside the builder |
| Code persistence | Generated code saved to DB per page |
| Export | Download a clean Vite + React + Tailwind ZIP |
| Multi-provider AI | Ollama, LM Studio, OpenAI, Claude, OpenRouter |
| Two-tier providers | Admin shares LLM access; users can add own keys |
| Credit system | Track and charge per AI request |
| Stripe billing | One-time credit packs + monthly subscriptions |
| Admin panel | Manage users, credits, plans, AI providers |
| Rate limiting | Redis-backed per-user limits (5/min, 30/hr) |
| Auth | Email/password + Google OAuth (NextAuth) |
| Docker Compose | Single-command deployment |

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | 20+ | Required for local dev |
| **pnpm** | 9+ | `npm install -g pnpm` |
| **Docker** | 24+ | For production deployment |
| **Docker Compose** | v2+ | Included with Docker Desktop |
| **Ollama** | latest | Optional — for local AI |

---

## Quick Start (Local Dev)

### 1. Install dependencies

```bash
git clone <your-repo-url>
cd ai-website-builder
pnpm install
pnpm --filter @ai-builder/shared build
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set the minimum required values:

```env
# Generate these two secrets:
# node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

NEXTAUTH_SECRET=<generated-secret>
ENCRYPTION_SECRET=<generated-secret>

# Your Ollama machine IP (or http://localhost:11434 if running locally)
OLLAMA_BASE_URL=http://192.168.1.x:11434
DEFAULT_MODEL=llama3.2
```

### 3. Create the database

```bash
cd web
mkdir -p data
pnpm db:migrate
cd ..
```

### 4. Start dev servers

```bash
pnpm dev
```

Opens:
- **Builder app**: http://localhost:4000
- **AI service**: http://localhost:4001

### 5. Create your account

1. Go to http://localhost:4000/register
2. Fill in name, email, and password
3. **The first account is automatically made admin** with 500 starter credits
4. All subsequent accounts get 50 credits and the `user` role

---

## Docker Deployment (Production)

Tested on Ubuntu 22.04 with Docker Compose v2 and Nginx Proxy Manager already running.

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd ai-website-builder
cp .env.example .env
nano .env
```

Fill in all required values:

```env
# ── Ports (change if 4000/4001/6380 conflict with existing services) ─────────
WEB_PORT=4000
AI_PORT=4001
REDIS_PORT=6380

# ── Auth ─────────────────────────────────────────────────────────────────────
NEXTAUTH_URL=https://builder.yourdomain.com
NEXTAUTH_SECRET=<openssl rand -base64 32>

# ── Security ──────────────────────────────────────────────────────────────────
ENCRYPTION_SECRET=<openssl rand -base64 32>

# ── AI — your LAN machine ────────────────────────────────────────────────────
OLLAMA_BASE_URL=http://192.168.1.x:11434
DEFAULT_MODEL=llama3.2

# ── AI service URL as seen FROM THE BROWSER ──────────────────────────────────
# This must point to your AI service's public URL (with its own proxy host)
NEXT_PUBLIC_AI_SERVICE_URL=https://ai.yourdomain.com

# ── Internal AI service URL (web container → ai container) ──────────────────
AI_SERVICE_INTERNAL_URL=http://ai:4001
```

### 2. Build and start

```bash
docker compose up -d --build
```

This starts three containers:
- `web` → Next.js app on port 4000
- `ai` → Express AI service on port 4001
- `redis` → Rate limiting + cache on port 6380

Check logs: `docker compose logs -f web`

### 3. Configure Nginx Proxy Manager

Add **two** proxy hosts in NPM:

#### Proxy Host 1 — Builder App

| Field | Value |
|---|---|
| Domain | `builder.yourdomain.com` |
| Forward Hostname | `localhost` |
| Forward Port | `4000` (your WEB_PORT) |
| SSL | Let's Encrypt, Force HTTPS |

#### Proxy Host 2 — AI Service

| Field | Value |
|---|---|
| Domain | `ai.yourdomain.com` |
| Forward Hostname | `localhost` |
| Forward Port | `4001` (your AI_PORT) |
| SSL | Let's Encrypt, Force HTTPS |

> **Critical for AI streaming to work:**
> In NPM → Advanced tab for the AI proxy host, paste:
> ```nginx
> proxy_read_timeout 300s;
> proxy_send_timeout 300s;
> proxy_buffering off;
> proxy_cache off;
> ```
> Without `proxy_buffering off`, the SSE stream will not reach the browser.

### 4. First access

Visit `https://builder.yourdomain.com/register` — the first registered account becomes admin.

---

## Configuring AI Providers

### Option A: Ollama (Recommended — Free, Local)

**On your AI machine:**

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.2

# Allow connections from other machines
# Create /etc/systemd/system/ollama.service.d/override.conf:
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"

systemctl daemon-reload && systemctl restart ollama
```

**In your `.env`:**
```env
OLLAMA_BASE_URL=http://192.168.1.x:11434
DEFAULT_MODEL=llama3.2
```

**Recommended models:**

| Use case | Model |
|---|---|
| Fast chat | `llama3.2` (3B), `phi3` |
| Balanced | `mistral`, `llama3.1:8b` |
| Best quality | `llama3.1:70b`, `qwen2.5:72b` |
| Code-focused | `deepseek-coder-v2`, `codellama` |

### Option B: LM Studio

1. Open LM Studio → **Local Server** tab → Start server
2. Default port is 1234
3. In `.env`: `LMSTUDIO_BASE_URL=http://192.168.1.x:1234`

### Option C: Cloud APIs (OpenAI, Claude, etc.)

Users add their own API keys at `/settings/providers`.

Admins add platform-level shared keys at `/admin/providers` — users on eligible plans use these without entering their own keys.

---

## Admin Guide

### First Login

Register at `/register`. First account = admin automatically.

If you accidentally created a non-admin account first, fix it in the database:

```bash
# From your server
docker exec -it <web-container-name> sh
cd /app
node -e "
const Database = require('better-sqlite3');
const db = new Database('/data/db.sqlite');
db.prepare(\"UPDATE users SET role='admin' WHERE email=?\").run('your@email.com');
console.log('Done');
"
```

### Admin Panel

| URL | Purpose |
|---|---|
| `/admin/providers` | Add/remove AI providers, set plan access |
| `/admin/users` | List users, adjust credits, change plans/roles |

### Setting Up a Platform AI Provider

1. Go to `/admin/providers` → **+ Add Provider**
2. Fill in:
   - **Provider**: `ollama`
   - **Display Name**: `Ollama Local`
   - **Base URL**: `http://192.168.1.x:11434`
   - **Model**: `llama3.2`
   - **Credit cost per request**: `0` (local = free)
   - **Allowed plans**: select all
3. Check **Set as platform default** ✓
4. Save

Now all users can chat with AI without needing their own API keys.

### Manually Adding Credits

`/admin/users` → find user → **Adjust Credits** → enter amount + optional reason → **Apply**

---

## Stripe Billing Setup (Optional)

Stripe is optional. If `STRIPE_SECRET_KEY` is not set, the billing UI shows an info message and all credit operations are admin-only.

### Setup Steps

1. **Create a Stripe account** at [stripe.com](https://stripe.com)

2. **Create products** in the Stripe Dashboard:

   | Product | Type | Amount |
   |---|---|---|
   | Starter Pack | One-time payment | $5 |
   | Pro Pack | One-time payment | $20 |
   | Power Pack | One-time payment | $40 |
   | Pro Plan | Recurring monthly | $12/month |
   | Enterprise Plan | Recurring monthly | $49/month |

3. **Copy Price IDs** from each product and add to `.env`:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

STRIPE_PRICE_STARTER=price_xxx      # Starter Pack
STRIPE_PRICE_PRO_PACK=price_xxx     # Pro Pack
STRIPE_PRICE_POWER_PACK=price_xxx   # Power Pack
STRIPE_PRICE_PRO_SUB=price_xxx      # Pro Plan monthly
STRIPE_PRICE_ENTERPRISE_SUB=price_xxx  # Enterprise monthly
```

4. **Set up webhook** in Stripe Dashboard → Webhooks:
   - Endpoint URL: `https://builder.yourdomain.com/api/webhooks/stripe`
   - Events to listen for:
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`

5. **Rebuild** after updating `.env`:
   ```bash
   docker compose up -d --build web
   ```

---

## Rate Limiting

Default: **5 AI requests per minute**, **30 per hour** per user.

Customize in `.env`:
```env
RATE_LIMIT_PER_MINUTE=10
RATE_LIMIT_PER_HOUR=60
```

Rate limiting uses Redis (already in Docker Compose). If Redis is unreachable, the limiter **fails open** — all requests pass through. There are no interruptions if Redis goes down.

---

## Using the Builder

### Basic Flow

1. **Log in** → you're on the Dashboard
2. **Create a project** — type a name, press Enter or click "New Project"
3. **Chat with AI** — describe what you want in the left panel:
   - *"Create a landing page for a SaaS startup with hero, features, and pricing"*
   - *"Make the hero section dark with a purple gradient"*
   - *"Add a contact form at the bottom"*
4. **Watch the preview** update in real-time in the centre panel
5. **Use templates** — right panel → Components tab → click to insert
6. **Add pages** — right panel → Pages tab → type name → `+`
7. **Export** — click `↓ Export` in the header to download a ZIP

### AI Tips

The AI generates React + Tailwind components. For best results:
- Be specific: *"pricing section with 3 tiers: Free, Pro at $29, Enterprise at $99"*
- Reference the current state: *"keep the navbar but change the hero to use a video background"*
- Ask for iterations: *"make it more minimal, remove the animations"*

### What the Export Contains

```
your-project-name-export.zip
├── package.json        (Vite + React + Tailwind)
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── README.md
└── src/
    ├── main.jsx
    ├── index.css
    ├── App.jsx          (home page)
    └── AboutPage.jsx    (additional pages, if any)
```

**To run locally:**
```bash
unzip your-project-export.zip
cd your-project-name
npm install
npm run dev
```

**To deploy:**
```bash
npm run build
# Upload dist/ to Vercel, Netlify, Cloudflare Pages, or any static host
```

---

## Upgrading

```bash
git pull
pnpm install
pnpm --filter @ai-builder/shared build
cd web && pnpm db:migrate && cd ..
docker compose up -d --build
```

---

## Troubleshooting

### "No AI provider configured"

Add a platform provider in `/admin/providers`. Make sure it's set as **Active** and **Default**.

### AI messages stream but preview never updates

The AI needs to generate a code block. Try a more explicit prompt:
> *"Generate a complete React landing page with tailwind. Show the full component code."*

Check the AI service logs: `docker compose logs ai`

### SSE streaming stops or hangs behind Nginx

Add to your NPM Advanced config for the AI proxy:
```nginx
proxy_buffering off;
proxy_read_timeout 300s;
```

### Login page redirects to itself

The database may need migrating:
```bash
docker exec -it <web-container> sh -c "cd /app && node -e \"require('./web/src/lib/migrate')\""
```
Or from local dev: `cd web && pnpm db:migrate`

### Export button does nothing / downloads empty ZIP

The page content hasn't been saved yet — generate something with AI first, or insert a component from the library.

### Port conflicts

Change ports in `.env`:
```env
WEB_PORT=4100
AI_PORT=4101
REDIS_PORT=6381
```
Then `docker compose up -d --build`.

### Credits not deducting (local LLMs)

This is correct — Ollama and LM Studio have `creditCostPerRequest: 0` by default since they run on your hardware. To charge credits for local LLMs, edit the provider in `/admin/providers`.

### Database is corrupted

```bash
# Backup first
docker cp <web-container>:/data/db.sqlite ./db-backup.sqlite

# Reset (destroys all data)
docker compose down
docker volume rm ai-website-builder_web_data
docker compose up -d
```

---

## Architecture

```
Browser
  │
  ▼ HTTPS
Nginx Proxy Manager  ←── SSL termination, domain routing
  │
  ├── builder.yourdomain.com ──► web container :4000
  │     Next.js 14 App
  │     - Auth (NextAuth)
  │     - Project/Page CRUD
  │     - Billing (Stripe)
  │     - Admin panel
  │     - SSE proxy to AI service
  │
  └── ai.yourdomain.com ──────► ai container :4001
        Express AI Service
        - Provider abstraction
        - LLM orchestration
        - Code extraction/validation
        - SSE streaming

Shared:
  redis container :6380    ←── Rate limiting
  SQLite /data/db.sqlite   ←── All app data

External:
  Ollama :11434 (your LAN) ←── Local LLM inference
  Stripe (cloud)           ←── Payment processing
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `WEB_PORT` | No | `4000` | Web app port |
| `AI_PORT` | No | `4001` | AI service port |
| `REDIS_PORT` | No | `6380` | Redis port |
| `NEXTAUTH_URL` | **Yes** | — | Full URL of the web app |
| `NEXTAUTH_SECRET` | **Yes** | — | Random 32-byte secret |
| `NEXTAUTH_URL` | **Yes** | — | Full URL of the app |
| `ENCRYPTION_SECRET` | **Yes** | — | AES-256 key for API keys |
| `DATABASE_URL` | No | `file:./data/db.sqlite` | SQLite file path |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama endpoint |
| `LMSTUDIO_BASE_URL` | No | `http://localhost:1234` | LM Studio endpoint |
| `DEFAULT_MODEL` | No | `llama3.2` | Default model name |
| `DEFAULT_PROVIDER` | No | `ollama` | `ollama` or `lmstudio` |
| `AI_SERVICE_INTERNAL_URL` | No | `http://localhost:4001` | Internal AI URL (docker: `http://ai:4001`) |
| `NEXT_PUBLIC_AI_SERVICE_URL` | No | `http://localhost:4001` | AI URL as seen by browser |
| `REDIS_URL` | No | — | Redis connection URL |
| `RATE_LIMIT_PER_MINUTE` | No | `5` | AI requests per minute per user |
| `RATE_LIMIT_PER_HOUR` | No | `30` | AI requests per hour per user |
| `STRIPE_SECRET_KEY` | No | — | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | No | — | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | — | Stripe public key |
| `STRIPE_PRICE_STARTER` | No | — | Stripe price ID: 100 credits |
| `STRIPE_PRICE_PRO_PACK` | No | — | Stripe price ID: 500 credits |
| `STRIPE_PRICE_POWER_PACK` | No | — | Stripe price ID: 1200 credits |
| `STRIPE_PRICE_PRO_SUB` | No | — | Stripe price ID: Pro plan |
| `STRIPE_PRICE_ENTERPRISE_SUB` | No | — | Stripe price ID: Enterprise plan |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth client secret |

---

## Tech Stack

**Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand, Sandpack, Framer Motion

**Backend:** Express (AI service), Next.js API routes, Drizzle ORM, SQLite (Postgres-ready)

**Auth:** NextAuth.js v4 — credentials + Google OAuth

**Billing:** Stripe — one-time and recurring payments

**AI:** Custom adapter layer — Ollama, LM Studio, OpenAI, Claude, OpenRouter

**Infra:** Docker Compose, pnpm workspaces, Redis

---

## License

MIT — use freely, modify, self-host, sell.
