# Install Bitbucket MCP

Two flavors, same tools.

## TL;DR

- **Hosted (recommended for most users):** click Connect at https://bitbucket-mcp.raiteri.net → paste the returned URL into your MCP client. Done.
- **Local (privacy-max):** `npm i -g @ashrocket/bitbucket-mcp` + set env vars.

---

## Hosted: one-click OAuth

1. Go to <https://bitbucket-mcp.raiteri.net>
2. Click **Connect Bitbucket**
3. Approve scopes (`account`, `repository`, `pullrequest:write`, `pipeline:write`) on bitbucket.org
4. You'll get a personal MCP URL like
   `https://bitbucket-mcp.raiteri.net/mcp/u/<opaque-id>`
5. Wire it into your MCP client (snippets below)

### Claude Code

```sh
claude mcp add bitbucket --transport http \
  https://bitbucket-mcp.raiteri.net/mcp/u/<your-id>
```

### Claude.ai Connectors

Settings → Connectors → Add connector → paste your URL.

### Cursor / Codex / generic MCP clients

```jsonc
{
  "mcpServers": {
    "bitbucket": {
      "transport": {
        "type": "http",
        "url": "https://bitbucket-mcp.raiteri.net/mcp/u/<your-id>"
      }
    }
  }
}
```

**Your MCP URL is a secret.** Anyone with it can hit Bitbucket as you,
scoped to the OAuth permissions you approved. If it leaks, re-authorize —
a new URL is issued and the old one stops working.

---

## Hosted: BYO token (no OAuth, no state on our side)

If you'd rather not authorize an OAuth consumer, pass an
[Atlassian API token](https://id.atlassian.com/manage-profile/security/api-tokens)
via request header. Stateless — we never store it.

```jsonc
{
  "mcpServers": {
    "bitbucket": {
      "transport": {
        "type": "http",
        "url": "https://bitbucket-mcp.raiteri.net/mcp",
        "headers": {
          "X-Bitbucket-Token": "ATATT...",
          "X-Bitbucket-Workspace": "your-workspace"
        }
      }
    }
  }
}
```

Alternatively, `Authorization: Bearer <workspace-access-token>` works for
Bitbucket workspace/repo access tokens.

---

## Local: stdio server

```sh
npm i -g @ashrocket/bitbucket-mcp

# Or on-demand via npx (no global install)
npx -y @ashrocket/bitbucket-mcp
```

### Auth (pick one)

```sh
# Recommended — Atlassian API token
export BITBUCKET_API_TOKEN=ATATT...

# OR — workspace/repo/project access token (Bearer)
export BITBUCKET_ACCESS_TOKEN=...

# OR — legacy app password (deprecated Sep 2025)
export BITBUCKET_USERNAME=your-username
export BITBUCKET_APP_PASSWORD=...

# Optional default workspace
export BITBUCKET_WORKSPACE=your-workspace
```

### Claude Code

```sh
claude mcp add bitbucket \
  -e BITBUCKET_API_TOKEN=ATATT... \
  -e BITBUCKET_WORKSPACE=your-workspace \
  -- npx -y @ashrocket/bitbucket-mcp
```

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### Cursor / Codex

```jsonc
{
  "mcpServers": {
    "bitbucket": {
      "command": "npx",
      "args": ["-y", "@ashrocket/bitbucket-mcp"],
      "env": {
        "BITBUCKET_API_TOKEN": "ATATT..."
      }
    }
  }
}
```

---

## Choosing: hosted vs. local

| Dimension | Hosted | Local |
|---|---|---|
| Setup | 30 seconds | ~2 minutes (npm install + env vars) |
| Updates | Always latest | `npm update -g` |
| Tool count | 20 (daily-use subset) | 53 (full surface) |
| Credential storage | Encrypted refresh token in our D1 | Your shell env |
| Network hops | You → our worker → Bitbucket | You → Bitbucket |
| Works offline | No | Yes (for any cached state) |
| Corporate outbound policy | May be blocked | Generally fine |
| Best for | Individual devs, quick start | Teams, strict privacy, offline |

---

## Available tools (v1 hosted)

| Category | Tools |
|---|---|
| Auth | `bitbucket_current_user` |
| Repos | `bitbucket_list_repositories`, `bitbucket_list_branches`, `bitbucket_get_file` |
| PR — read | `bitbucket_list_pull_requests`, `bitbucket_get_pull_request`, `bitbucket_get_pr_diff`, `bitbucket_get_pr_diffstat`, `bitbucket_list_pr_comments`, `bitbucket_list_pr_activity` |
| PR — write | `bitbucket_create_pull_request`, `bitbucket_add_pr_comment`, `bitbucket_approve_pull_request`, `bitbucket_merge_pull_request` |
| Pipelines | `bitbucket_list_pipelines`, `bitbucket_get_pipeline`, `bitbucket_get_pipeline_step_log`, `bitbucket_trigger_pipeline` |
| Commits | `bitbucket_list_commits`, `bitbucket_get_commit_diff` |

The local stdio package has 33 more (issues, workspace admin, branch/tag
create+delete, decline/unapprove/request_changes, pipeline step detail,
commit diffstat, repo permissions, and more).

## Troubleshooting

**"No credentials" or 401 on every call** — for hosted BYO mode, ensure
the `X-Bitbucket-Token` header is reaching the worker. Some MCP clients
require explicit header config; check their docs.

**"Workspace is required"** — either set `BITBUCKET_WORKSPACE` (local) /
`X-Bitbucket-Workspace` header (BYO hosted), or pass `workspace` as a tool
argument.

**429 rate-limited** — Bitbucket's rate limit, not ours. The error message
includes the reset time if the server returned it.

**"Unknown or expired MCP URL"** — re-authorize at
<https://bitbucket-mcp.raiteri.net> to get a new URL. Old URLs don't
continue to work after re-auth.
