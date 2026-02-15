# hackathon-pland

Next.js project with TypeScript, Tailwind CSS v4, and Vercel configuration.

## Requirements

- Node.js 20+
- npm 10+

## Install

```bash
npm install
```

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