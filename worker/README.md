# worker/

Cloudflare Worker implementing the hosted Bitbucket MCP. Uses D1 for user
sessions and donation ledger.

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/mcp` | MCP Streamable HTTP (BYO token via headers) |
| POST, DELETE | `/mcp/u/<user-id>` | MCP for OAuth-authenticated users |
| GET | `/oauth/authorize` | Start Bitbucket OAuth flow |
| GET | `/oauth/callback` | Exchange code, store encrypted tokens, show MCP URL |
| POST | `/api/stripe-webhook` | Stripe webhook (HMAC-verified) |
| GET | `/api/total` | Running donation total (cached 60s) |
| GET | `/api/recent` | Recent donations (public transparency) |
| GET | `/healthz` | Health check |

## First deploy

Recommended: put this on a **separate Cloudflare account** (e.g. `ashrocket-labs`)
so traffic spikes or bugs don't affect other projects.

```sh
# 1. Auth as labs account
wrangler login

# 2. Create D1 database — note the returned database_id
wrangler d1 create bitbucket-mcp-prod
# → paste database_id into wrangler.toml

# 3. Apply schema
wrangler d1 execute bitbucket-mcp-prod --remote --file=schema.sql

# 4. Set secrets
openssl rand -hex 32 | wrangler secret put ENCRYPTION_KEY_HEX
wrangler secret put BITBUCKET_OAUTH_CLIENT_ID         # from bitbucket.org
wrangler secret put BITBUCKET_OAUTH_CLIENT_SECRET     # from bitbucket.org
wrangler secret put STRIPE_WEBHOOK_SECRET             # whsec_... from Stripe

# 5. Deploy
wrangler deploy
```

## Bitbucket OAuth consumer setup

At <https://bitbucket.org/account/settings/app-authorizations/>:

1. Click **Create consumer**
2. **Name:** Bitbucket MCP (or similar)
3. **Callback URL:** `https://bitbucket-mcp.raiteri.net/oauth/callback`
   (or your worker's dev URL during testing)
4. **This is a private consumer:** unchecked (public, since end users outside
   your workspace will authorize)
5. **Permissions:**
   - Account: Read
   - Repositories: Read, Write
   - Pull requests: Read, Write
   - Pipelines: Read, Write
6. Save → copy the **Key** (client_id) and **Secret** (client_secret)
7. Store in worker secrets: `BITBUCKET_OAUTH_CLIENT_ID`, `BITBUCKET_OAUTH_CLIENT_SECRET`

## Stripe webhook setup

1. Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://bitbucket-mcp.raiteri.net/api/stripe-webhook`
3. Events: `checkout.session.completed`, `charge.succeeded`
4. Copy the signing secret (`whsec_...`) → `wrangler secret put STRIPE_WEBHOOK_SECRET`

## Security notes

- Refresh tokens encrypted at rest (AES-GCM, per-user HKDF subkey)
- OAuth state tokens expire 10 min after creation, single-use
- Stripe signatures verified with constant-time HMAC comparison, 5-min timestamp tolerance
- No PII logged — only `user_id`, which is a random UUID (not derived from user data)

## Dev

```sh
npm run dev -w worker        # wrangler dev (local miniflare with local D1)
npm run typecheck -w worker
npm run build -w worker      # wrangler deploy --dry-run
```

## Free tier posture

The Workers free plan caps at 100k requests/day, then returns 429 rather
than billing. D1 free tier: 5M reads/day, 100k writes/day. If the project
takes off and hits limits, we see 429s and upgrade with intent — not a
surprise bill.
