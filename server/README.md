# @ashrocket/bitbucket-mcp

Local stdio MCP server for Bitbucket Cloud. Pairs with any MCP client (Claude
Desktop, Claude Code, Codex, Cursor).

Prefer the [hosted version](https://bitbucket-mcp.raiteri.net) unless you have
specific reasons to run locally (privacy, corporate outbound policy, offline
dev).

## Install

```sh
npm i -g @ashrocket/bitbucket-mcp
```

Or use `npx -y @ashrocket/bitbucket-mcp` on demand — no global install needed.

## Auth — pick one

```sh
# Recommended: Atlassian API token
export BITBUCKET_API_TOKEN=ATATT...
# Optional — defaults to x-bitbucket-api-token-auth (special username that works for both git and API)
export BITBUCKET_USERNAME=your.email@example.com

# OR: Workspace / Repository / Project access token (Bearer)
export BITBUCKET_ACCESS_TOKEN=...

# OR: Legacy app password (deprecated Sep 2025; still works)
export BITBUCKET_USERNAME=your-username
export BITBUCKET_APP_PASSWORD=...

# Optional default workspace (so tool calls can omit it)
export BITBUCKET_WORKSPACE=your-workspace
```

## Wire into Claude Code

```sh
claude mcp add bitbucket \
  -e BITBUCKET_API_TOKEN=ATATT... \
  -e BITBUCKET_WORKSPACE=your-workspace \
  -- npx -y @ashrocket/bitbucket-mcp
```

## Wire into Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```jsonc
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

## Tools

Full 53-tool set — the hosted worker ships a 20-tool v1 subset, but local
gives you everything including issues, branch/tag lifecycle, and workspace
admin. See [`core/src/tools/`](../core/src/tools/) for the complete list.

## Dev

```sh
npm run dev -w server        # tsx watch
npm run build -w server      # tsc → dist/
```
