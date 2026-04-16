# Bitbucket MCP

Use Bitbucket Cloud from Claude, Codex, Cursor, or any Model Context Protocol
client. Ships as a zero-config stdio MCP server with 40+ tools covering pull
requests, pipelines, issues, branches, commits, and file access.

Free. MIT. Donation-supported.

- **Install:** `npm i -g @ashrocket/bitbucket-mcp`
- **Site:** <https://bitbucket-mcp.raiteri.net>
- **Donate:** see site — 100% of donations fund maintenance

## Repository layout

| Path     | What it is                                                        |
|----------|-------------------------------------------------------------------|
| `server/`| The MCP server — published as `@ashrocket/bitbucket-mcp` on npm   |
| `site/`  | Astro 5 landing page — deploys to Cloudflare Pages                |
| `worker/`| Cloudflare Worker + D1 — Stripe webhook, donation total API       |
| `docs/`  | Additional docs (install recipes per client, auth notes)          |

## Quick install for Claude Code

```jsonc
// ~/.claude/mcp.json (or via `claude mcp add`)
{
  "mcpServers": {
    "bitbucket": {
      "command": "npx",
      "args": ["-y", "@ashrocket/bitbucket-mcp"],
      "env": {
        "BITBUCKET_API_TOKEN": "ATATT...",
        "BITBUCKET_WORKSPACE": "your-workspace"
      }
    }
  }
}
```

Full per-client install instructions: see [`docs/install.md`](docs/install.md).

## License

MIT — see [`LICENSE`](LICENSE).
