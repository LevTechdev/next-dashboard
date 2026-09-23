# Production Deployment Guide: Vercel & Cloud Architecture

This guide covers deploying the **Unified SaaS Dashboard** to **Vercel** (or any Node.js cloud container runtime such as Railway or Docker), configuring production secrets, setting up live payment webhooks, and routing custom domains.

---

## 1. Vercel Project Configuration

The project already includes [`vercel.json`](file:///d:/Project/next-dashboard/vercel.json):
```json
{
  "framework": "nextjs",
  "buildCommand": "npx prisma generate && npx next build",
  "regions": ["sin1"]
}
```
* **Build Command**: Automatically generates the Prisma client and executes the Next.js production build.
* **Region**: Pinned to Singapore (`sin1`) for low latency in the APAC / Southeast Asia region. Can be set to `iad1` (US East) or `fra1` (Frankfurt) as required.

---

## 2. Production Environment Variables Checklist

Set the following environment variables in your **Vercel Project Dashboard** under **Settings > Environment Variables**:

### 📦 Database & Tenancy (PostgreSQL / Supabase)
| Variable | Description | Example / Format |
| :--- | :--- | :--- |
| `DATABASE_URL` | Pooled connection string (Transaction pooler) | `postgres://postgres.[ref]:[pass]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Direct unpooled connection (for Prisma migrations) | `postgres://postgres:[pass]@db.[ref].supabase.co:5432/postgres` |

### 🔐 Authentication & Session Security
| Variable | Description | Example / Format |
| :--- | :--- | :--- |
| `NEXTAUTH_SECRET` | 32+ char random secret for session encryption | Run `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Canonical production domain URL | `https://your-domain.com` |
| `JWT_SECRET` | Secret key used for signing JWT API tokens | Run `openssl rand -hex 32` |

### 💳 Stripe Payments & Subscriptions
| Variable | Description | Example / Format |
| :--- | :--- | :--- |
| `STRIPE_SECRET_KEY` | Live Stripe secret key | `sk_live_51...` |
| `STRIPE_WEBHOOK_SECRET` | Live endpoint signing secret from Stripe Dashboard | `whsec_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Live Stripe publishable key | `pk_live_51...` |
| `STRIPE_PRO_PRICE_ID` | Monthly Pro plan price ID | `price_1N...` |
| `STRIPE_ENTERPRISE_PRICE_ID` | Monthly Enterprise plan price ID | `price_1N...` |

### 🏦 Midtrans Payments & Iris Disbursements (Indonesia / APAC)
| Variable | Description | Example / Format |
| :--- | :--- | :--- |
| `MIDTRANS_SERVER_KEY` | Live Server Key from Midtrans Dashboard | `Mid-server-...` |
| `MIDTRANS_CLIENT_KEY` | Live Client Key from Midtrans Dashboard | `Mid-client-...` |
| `MIDTRANS_IS_PRODUCTION` | Production environment flag | `true` |
| `MIDTRANS_MERCHANT_ID` | Your verified Merchant ID | `G12345678` |

### 🤖 AI Provider & Telemetry Copilot
| Variable | Description | Example / Format |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google AI Studio / Vertex API key | `AIzaSy...` |
| `GEMINI_MODEL` | Stable model alias (defaults to flash) | `gemini-flash-latest` |
| `OPENAI_API_KEY` | Fallback OpenAI API key (optional) | `sk-...` |

### ✉️ Email Notifications (Resend)
| Variable | Description | Example / Format |
| :--- | :--- | :--- |
| `RESEND_API_KEY` | API Key from Resend.com | `re_...` |
| `EMAIL_FROM` | Sender address verified in Resend | `billing@your-domain.com` |

---

## 3. Webhook Configuration

### A. Stripe Webhook
1. Go to **Stripe Dashboard > Developers > Webhooks > Add Endpoint**.
2. **Endpoint URL**: `https://your-domain.com/api/billing/webhook`
3. **Events to Listen for**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the **Signing Secret** (`whsec_...`) into the `STRIPE_WEBHOOK_SECRET` environment variable in Vercel.

### B. Midtrans Webhook
1. Go to **Midtrans MAP Dashboard > Settings > Configuration**.
2. **Payment Notification URL**: `https://your-domain.com/api/billing/midtrans/webhook`
3. Set **Payment Completion URL**: `https://your-domain.com/en/checkout/success`

---

## 4. Custom Domain & DNS Records

In Vercel **Settings > Domains**, add your custom domain (e.g. `dashboard.example.com` or `example.com`):

### DNS Configuration Table
| Type | Name | Value / Target | Notes |
| :--- | :--- | :--- | :--- |
| **A Record** | `@` (Apex) | `76.76.21.21` | Points root domain to Vercel Global Edge |
| **CNAME** | `www` (or subdomain) | `cname.vercel-dns.com.` | Directs subdomain to Vercel SSL termination |

*SSL certificates are provisioned and renewed automatically via Let's Encrypt.*

---

## 5. Deployment Commands

### Database migrations (BEFORE every schema-changing deploy)

The production `DATABASE_URL` points at Supabase's **transaction pooler**
(`pooler.supabase.com:6543`), which stalls `prisma migrate deploy` — a build
that tries to migrate hangs until Vercel kills it (observed 2026-09-22: 46
minutes, then Error). The build therefore runs `prisma generate && next build`
only, and migrations are applied **out-of-band** before deploying:

1. Every migration in `prisma/migrations/` newer than the last applied one
   (query `select migration_name from _prisma_migrations order by finished_at`)
   is pure additive DDL — verify with `grep -iE "DROP |TRUNCATE |DELETE FROM"`
   returning nothing.
2. Apply each pending `migration.sql` through the Supabase Management API
   (`POST /v1/projects/{ref}/database/query` with an access token) or the
   Supabase SQL editor, in filename order.
3. Register each in `_prisma_migrations` (name + timestamps) so future
   `prisma migrate` runs consider them applied.
4. Deploy. The new code boots against tables that already exist.

### Option A: Via GitHub (Recommended)
Pushing to `main` automatically triggers Vercel CI/CD:
```bash
git add .
git commit -m "feat: complete v1.0 architecture with 3d hero, custom widgets, and payouts"
git push origin main
```

### Option B: Via Vercel CLI
```bash
# Login to Vercel
npx vercel login

# Deploy preview build
npx vercel

# Deploy directly to production
npx vercel --prod
```

---

## 6. Post-Deployment Verification
Once deployed, run these health checks:
1. **Public Marketing Page**: Open `https://your-domain.com/en` and verify the 3D day/night hero and Back-to-Top button.
2. **Database Smoke Test**: Perform a test user registration at `https://your-domain.com/en/register`.
3. **Session & 2FA Test**: Enable TOTP in Settings and log in via two-factor authentication.
4. **Billing Webhook Test**: Send a Stripe CLI test event:
   ```bash
   stripe trigger checkout.session.completed
   ```
5. **AI Copilot Check**: Open the AI Copilot on the dashboard and trigger a revenue forecast query.
