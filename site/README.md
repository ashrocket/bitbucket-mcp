# site/

Marketing site for Bitbucket MCP. Static Astro 5 build, deploys to Cloudflare
Pages.

## Dev

```sh
npm run dev -w site          # http://localhost:4321
```

## Build

```sh
npm run build -w site
# → site/dist/
```

## Deploy to Cloudflare Pages

From the **labs Cloudflare account** (separate blast radius):

```sh
# First time — connect repo to Pages
wrangler pages project create bitbucket-mcp --production-branch main

# Ongoing — push to main, Pages builds automatically if you wired Git integration.
# Or manual deploy:
wrangler pages deploy site/dist --project-name bitbucket-mcp
```

### Pages build config (dashboard)

| Field | Value |
|---|---|
| Build command | `cd site && npm install && npm run build` (or use root `npm ci && npm run build -w site`) |
| Build output directory | `site/dist` |
| Root directory | `/` |
| Node version | `20` |
| Environment variables | `PUBLIC_WORKER_URL`, `PUBLIC_DONATION_URL`, `PUBLIC_GITHUB_REPO` |

### Custom domain

Point `bitbucket-mcp.raiteri.net` at the Pages project. Proxy on. Automatic
HTTPS via Cloudflare.

## Env vars

All prefixed with `PUBLIC_` so Vite inlines them at build time:

- `PUBLIC_WORKER_URL` — API worker base (e.g. `https://bitbucket-mcp-api.bitbucket-mcp.workers.dev`)
- `PUBLIC_DONATION_URL` — Stripe Payment Link
- `PUBLIC_GITHUB_REPO` — source repo URL

Defaults are set in `src/lib/config.ts` — the site renders without any env
vars for preview purposes.
