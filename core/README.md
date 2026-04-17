# @ashrocket/bitbucket-mcp-core

Shared Bitbucket API client and MCP tool definitions. Consumed by both
[`server/`](../server/) (stdio) and [`worker/`](../worker/) (hosted on
Cloudflare Workers).

This package is workspace-internal — you don't install it directly.
If you want Bitbucket-in-Claude, use:

- **[`@ashrocket/bitbucket-mcp`](../server/)** — local stdio server
- **<https://bitbucket-mcp.raiteri.net>** — hosted version (no install)

## Contents

- `BitbucketClient` — fetch-based client. Auth: API token, access token (Bearer), or legacy app password.
- `allTools` — 53 tool definitions across 7 modules.
- `v1Tools` — 20-tool subset for the hosted v1 surface.
- Typed errors: `BitbucketApiError`, `BitbucketAuthError`.

## Runtime compatibility

Pure TypeScript + `fetch` + Web Crypto + `TextEncoder/Decoder`. Runs
unchanged in:

- Node 18+
- Cloudflare Workers
- Deno / Bun (untested but should work)
