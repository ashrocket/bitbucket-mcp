# Bitbucket MCP

Use Bitbucket Cloud from Claude, Codex, Cursor, or any Model Context
Protocol client. Zero-config, free, MIT-licensed, donation-supported.

> **What this is:** the Bitbucket-shaped hole in Atlassian's official MCP
> connector (which covers Jira and Confluence but not Bitbucket).
> 20 daily-use tools in the hosted version, 53 total in the local package.

- **Site:** <https://bitbucket-mcp.raiteri.net>
- **Install guide:** [`docs/install.md`](docs/install.md)
- **Deploy runbook:** [`docs/deploy.md`](docs/deploy.md)
- **License:** [MIT](LICENSE)

## Quick start

**Hosted (one-click OAuth):**

1. Go to <https://bitbucket-mcp.raiteri.net>
2. Click **Connect Bitbucket**
3. Paste your personal MCP URL into Claude.ai Connectors, Claude Code, or any MCP client

**Local (npm):**

```sh
npm i -g @ashrocket/bitbucket-mcp
export BITBUCKET_API_TOKEN=ATATT...
claude mcp add bitbucket -- npx -y @ashrocket/bitbucket-mcp
```

## What's in the box

| Category | Tool count (v1 hosted) | Tool count (local) |
|---|---|---|
| Workspaces / projects | — | 5 |
| Repositories & files | 3 | 10 |
| Pull requests (read) | 6 | 7 |
| Pull requests (write) | 4 | 10 |
| Pipelines | 4 | 7 |
| Issues | — | 6 |
| Commits | 2 | 4 |
| Branches / tags | — | 4 |
| **Total** | **20** | **53** |

Full list: [`docs/install.md#available-tools`](docs/install.md#available-tools-v1-hosted).

## Repository layout

```
bitbucket-mcp/
├── core/           Shared tool logic + Bitbucket API client (pure fetch)
├── server/         Stdio MCP — publishes as @ashrocket/bitbucket-mcp
├── worker/         Cloudflare Worker — hosted MCP, OAuth, Stripe webhook
├── site/           Astro 5 marketing site — Cloudflare Pages
└── docs/           install, deploy, build journey
```

Each package has its own README.

## Architecture

```
                 ┌───────────────────────────────────────────┐
                 │  bitbucket-mcp.raiteri.net (CF labs acct) │
                 │                                           │
       User ────▶│  Pages (site/)  +  Worker (worker/)       │
                 │                         │                 │
                 │              OAuth &    ▼                 │
                 │              D1 binding                   │
                 │                 (users,                   │
                 │                  donations,               │
                 │                  oauth_states)            │
                 └─────────────────────┬─────────────────────┘
                                       │
                                       ▼
                           api.bitbucket.org/2.0
                           (per-user OAuth token)

       — OR — local path —

       Claude Code ──stdio──▶  @ashrocket/bitbucket-mcp
                              (same core/ tool code)
                                       │
                                       ▼
                           api.bitbucket.org/2.0
                           (user's own API token)
```

## Security

- Refresh tokens encrypted at rest in D1 (AES-GCM, per-user HKDF subkey)
- OAuth state tokens expire 10 min after issuance, single-use
- Stripe webhooks HMAC-verified with constant-time comparison
- No tracking, no telemetry, no analytics — what donations pay for

## Contribute

- File bugs or request tools: [Issues](https://github.com/ashrocket/bitbucket-mcp/issues)
- PRs welcome, especially for v1.1 tools we deferred (issues, branch/tag lifecycle, workspace admin)
- Donors get priority on feature requests

## Not affiliated with Atlassian

This is an independent project. Bitbucket® is a trademark of Atlassian
Pty Ltd. We're thankful Bitbucket exists and that it has a clean
public API.
