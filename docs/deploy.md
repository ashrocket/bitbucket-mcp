# Deploy runbook

End-to-end deploy of the hosted Bitbucket MCP. Assumes you have:
- A separate Cloudflare account for the labs environment
- A Bitbucket account to register an OAuth consumer
- A Stripe account for donations
- The `bitbucket-mcp.raiteri.net` subdomain delegated to the labs CF account
- `wrangler`, `gh`, and `node 20+` installed

## 1. Domain & accounts

```sh
# (Labs Cloudflare account) ─── create zone for bitbucket-mcp.raiteri.net
# You can either:
#   (a) delegate the subdomain from the apex (set NS records on raiteri.net's registrar), OR
#   (b) use a workers.dev subdomain until you're ready to wire the custom domain.

# Verify you're logged into the labs account, not your main one
wrangler whoami
```

## 2. Bitbucket OAuth consumer

At <https://bitbucket.org/account/settings/app-authorizations/>:

1. Click **Create consumer**
2. **Name:** `Bitbucket MCP (hosted)`
3. **Callback URL:** `https://bitbucket-mcp.raiteri.net/oauth/callback`
4. **This is a private consumer:** unchecked
5. **Permissions:**
   - Account: Read
   - Repositories: Read, Write
   - Pull requests: Read, Write
   - Pipelines: Read, Write
6. Save → copy **Key** (client_id) and **Secret**

## 3. Stripe

At <https://dashboard.stripe.com/register>:

1. Sign up (Individual is fine — no LLC needed)
2. Verify identity per Stripe flow
3. **Products** → Create product "Bitbucket MCP Donation"
4. Add **Payment Link** with:
   - "Customer chooses price" enabled
   - Preset amounts: $5, $20, $50, $150
   - Metadata: `project=bitbucket-mcp`
   - Optional custom field: `message` (text) for donor messages
5. Copy the Payment Link URL → this is `PUBLIC_DONATION_URL` in the site build

Webhook:
6. **Developers** → **Webhooks** → **Add endpoint**
7. URL: `https://bitbucket-mcp.raiteri.net/api/stripe-webhook`
8. Events: `checkout.session.completed`, `charge.succeeded`
9. Copy the signing secret (`whsec_...`)

## 4. Worker deploy

```sh
cd worker

# Create D1 database — note the `database_id` in the output
wrangler d1 create bitbucket-mcp-prod
# → paste database_id into wrangler.toml

# Apply schema to production
wrangler d1 execute bitbucket-mcp-prod --remote --file=schema.sql

# Set secrets (one at a time, you'll be prompted for the value)
openssl rand -hex 32 | wrangler secret put ENCRYPTION_KEY_HEX
wrangler secret put BITBUCKET_OAUTH_CLIENT_ID
wrangler secret put BITBUCKET_OAUTH_CLIENT_SECRET
wrangler secret put STRIPE_WEBHOOK_SECRET

# Deploy
wrangler deploy
```

First deploy URL will be `bitbucket-mcp-api.<your-subdomain>.workers.dev`.
Test it:

```sh
curl https://bitbucket-mcp-api.<your-subdomain>.workers.dev/healthz
# → ok
```

## 5. Wire the custom domain

Two options.

### Option A: single domain, worker serves everything

Add to `worker/wrangler.toml`:

```toml
[[routes]]
pattern = "bitbucket-mcp.raiteri.net/*"
custom_domain = true
```

Re-deploy. The worker handles `/mcp*`, `/oauth/*`, `/api/*` and redirects `/`
to the site.

Drawback: the marketing site has to be served from elsewhere (e.g.
`www.bitbucket-mcp.raiteri.net` or `site.bitbucket-mcp.raiteri.net`).

### Option B: split by path (recommended)

Use Cloudflare Pages for the marketing site and a specific route for the
worker API:

```toml
# worker/wrangler.toml
[[routes]]
pattern = "bitbucket-mcp.raiteri.net/mcp*"
zone_name = "raiteri.net"

[[routes]]
pattern = "bitbucket-mcp.raiteri.net/oauth/*"
zone_name = "raiteri.net"

[[routes]]
pattern = "bitbucket-mcp.raiteri.net/api/*"
zone_name = "raiteri.net"

[[routes]]
pattern = "bitbucket-mcp.raiteri.net/healthz"
zone_name = "raiteri.net"
```

Then Pages handles `/` and everything else.

## 6. Site deploy

```sh
cd site

# First time — create Pages project
wrangler pages project create bitbucket-mcp --production-branch main

# Deploy
npm run build
wrangler pages deploy dist --project-name bitbucket-mcp

# Or wire Git integration in the Pages dashboard:
#   Build command: npm ci && npm run build -w site
#   Build output: site/dist
#   Root directory: /
#   Environment variables:
#     PUBLIC_WORKER_URL=https://bitbucket-mcp.raiteri.net  (or the workers.dev URL)
#     PUBLIC_DONATION_URL=https://donate.stripe.com/...
```

Point `bitbucket-mcp.raiteri.net` at the Pages project.

## 7. Smoke tests

```sh
# Site up?
curl -I https://bitbucket-mcp.raiteri.net
# → 200

# Worker API up?
curl https://bitbucket-mcp.raiteri.net/healthz
# → ok

# MCP tools/list responds? (BYO token required)
curl -s -X POST https://bitbucket-mcp.raiteri.net/mcp \
  -H 'X-Bitbucket-Token: ATATT...' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools | length'
# → 20

# Donation total endpoint?
curl https://bitbucket-mcp.raiteri.net/api/total
# → {"project":"bitbucket-mcp","total_cents":0,"total_usd":"0.00","count":0}

# OAuth flow?
open https://bitbucket-mcp.raiteri.net/oauth/authorize
# → should bounce to bitbucket.org/site/oauth2/authorize?client_id=...
```

## 8. npm publish (stdio server)

Once OAuth and everything works end to end, publish the local package so
users have both paths.

```sh
cd server
npm whoami   # confirm you're authed
npm publish --access public
```

## Ongoing ops

- **Monitoring:** Cloudflare Workers Analytics dashboard — watch for 5xx rate and p95
- **Free tier limits:** 100k requests/day on Workers, 5M/100k reads/writes on D1. Returns 429 when hit, not a bill.
- **D1 backups:** `wrangler d1 backup create bitbucket-mcp-prod` (preserves donation ledger)
- **Rotating `ENCRYPTION_KEY_HEX`:** painful — invalidates all stored refresh tokens (users re-authorize). Only do if compromised.
