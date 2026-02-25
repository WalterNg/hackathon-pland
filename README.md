# hackathon-pland

Next.js project with TypeScript, Tailwind CSS v4, Vercel configuration, and Supabase foundation for auth + data migrations.

## Requirements

- Node.js 20+
- npm 10+

## Install

```bash
npm install
```

If your network is unstable and npm registry frequently resets, retry install until success:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

## Environment

Create your local environment file from the example:

```bash
cp .env.example .env.local
```

Required keys:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

Optional key:

- `SUPABASE_SERVICE_ROLE_KEY` (only for server-only jobs/admin scripts)

## Supabase Setup

This repository now includes:

- Supabase config: [supabase/config.toml](supabase/config.toml)
- SQL migrations: [supabase/migrations](supabase/migrations)

### Migration order

1. `202602170001_auth_profile.sql`
2. `202602170002_portfolio_core.sql`
3. `202602170003_journal.sql`
4. `202602170004_risk_rules.sql`
5. `202602170005_dashboard_snapshots.sql`
6. `202602170006_rls_policies.sql`

### Local Supabase commands

```bash
supabase start
supabase db reset
```

## Auth

Implemented auth routes:

- Login page: `/auth/login`
- OAuth callback: `/auth/callback`
- Logout endpoint: `/auth/logout`

Enable providers in Supabase dashboard:

- Google OAuth
- Email/Password

### Google OAuth redirect configuration

In Google Cloud (OAuth Client), set **Authorized redirect URIs**:

- `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`

In Supabase dashboard > Authentication > URL Configuration:

- **Site URL (local)**: `http://localhost:3000`
- **Site URL (production)**: `https://your-domain.com`
- **Redirect URLs**:
	- `http://localhost:3000/auth/callback`
	- `https://your-domain.com/auth/callback`

In the app, OAuth uses `window.location.origin` to build redirect URLs, so local/prod callback works with the same code path.

## Run in development

```bash
npm run dev
```

Open http://localhost:3000

## Build for production

```bash
npm run build
npm run start
```

## Deployment

- `vercel.json` is included with:
	- HTTPS redirect rule
	- Security headers
	- `trailingSlash: false`
- On Vercel, HTTPS is already enforced by default. The custom redirect in `vercel.json` is kept as requested.