import { decryptToken, encryptToken, randomId } from './crypto.js';
import {
  consumeOauthState,
  getUserByAtlassianId,
  saveOauthState,
  updateUserTokens,
  upsertUser,
} from './db.js';
import type { Env, UserRow } from './types.js';

const BB_AUTHORIZE = 'https://bitbucket.org/site/oauth2/authorize';
const BB_TOKEN = 'https://bitbucket.org/site/oauth2/access_token';

/** GET /oauth/authorize — bounce to Bitbucket. */
export async function oauthAuthorize(
  request: Request,
  env: Env,
): Promise<Response> {
  const clientId = env.BITBUCKET_OAUTH_CLIENT_ID;
  if (!clientId) return plain(500, 'OAuth client ID not configured.');

  const url = new URL(request.url);
  const returnTo = url.searchParams.get('return_to') ?? undefined;
  const state = randomId();
  await saveOauthState(env, state, returnTo);

  const authorize = new URL(BB_AUTHORIZE);
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('state', state);
  // Bitbucket uses scopes in the consumer registration, not in the URL,
  // but we include them as an explicit hint so users see what they're granting.
  authorize.searchParams.set('scope', env.OAUTH_SCOPES);

  return Response.redirect(authorize.toString(), 302);
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scopes?: string;
  token_type: string;
}

interface BitbucketUser {
  account_id: string;
  username?: string;
  nickname?: string;
  display_name?: string;
}

/** GET /oauth/callback — exchange code for tokens, create/update user. */
export async function oauthCallback(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  if (error) return plain(400, `Bitbucket declined authorization: ${error}`);
  if (!code || !state) return plain(400, 'Missing code or state.');

  const { valid } = await consumeOauthState(env, state);
  if (!valid) return plain(400, 'Invalid or expired OAuth state.');

  const clientId = env.BITBUCKET_OAUTH_CLIENT_ID;
  const clientSecret = env.BITBUCKET_OAUTH_CLIENT_SECRET;
  const masterKey = env.ENCRYPTION_KEY_HEX;
  if (!clientId || !clientSecret || !masterKey) {
    return plain(500, 'Worker is missing OAuth client credentials or encryption key.');
  }

  // Exchange code for tokens
  const tokenRes = await fetch(BB_TOKEN, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
    }).toString(),
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    return plain(502, `Token exchange failed: ${tokenRes.status} ${body}`);
  }
  const tokens = (await tokenRes.json()) as TokenResponse;

  // Identify user
  const userRes = await fetch('https://api.bitbucket.org/2.0/user', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) {
    return plain(502, `Failed to identify user: ${userRes.status}`);
  }
  const bbUser = (await userRes.json()) as BitbucketUser;

  // Decide: new user or update existing?
  const existing = await getUserByAtlassianId(env, bbUser.account_id);
  const now = Math.floor(Date.now() / 1000);
  const userId = existing?.id ?? randomId();

  const refreshEnc = await encryptToken(masterKey, userId, tokens.refresh_token);
  const accessEnc = await encryptToken(masterKey, userId, tokens.access_token);

  const row: UserRow = {
    id: userId,
    atlassian_account_id: bbUser.account_id,
    bitbucket_username: bbUser.username ?? bbUser.nickname ?? null,
    display_name: bbUser.display_name ?? null,
    refresh_token_enc: refreshEnc,
    access_token_enc: accessEnc,
    access_token_expires_at: now + tokens.expires_in,
    default_workspace: existing?.default_workspace ?? null,
    scopes: tokens.scopes ?? env.OAUTH_SCOPES,
    created_at: existing?.created_at ?? now,
    last_used_at: now,
  };
  await upsertUser(env, row);

  return successPage(env, row);
}

/** Return a fresh access token for a user, refreshing if within 60s of expiry. */
export async function getAccessToken(
  env: Env,
  user: UserRow,
): Promise<string> {
  const masterKey = env.ENCRYPTION_KEY_HEX;
  if (!masterKey) throw new Error('Encryption key not configured.');

  const now = Math.floor(Date.now() / 1000);
  if (user.access_token_expires_at - now > 60) {
    return decryptToken(masterKey, user.id, user.access_token_enc);
  }

  // Refresh
  const clientId = env.BITBUCKET_OAUTH_CLIENT_ID;
  const clientSecret = env.BITBUCKET_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('OAuth client credentials not configured.');
  }
  const refreshToken = await decryptToken(
    masterKey,
    user.id,
    user.refresh_token_enc,
  );
  const res = await fetch(BB_TOKEN, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Refresh failed: ${res.status} ${body}`);
  }
  const tokens = (await res.json()) as TokenResponse;
  const newRefresh = await encryptToken(masterKey, user.id, tokens.refresh_token);
  const newAccess = await encryptToken(masterKey, user.id, tokens.access_token);
  await updateUserTokens(
    env,
    user.id,
    newRefresh,
    newAccess,
    now + tokens.expires_in,
  );
  return tokens.access_token;
}

function plain(status: number, text: string): Response {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function successPage(env: Env, user: UserRow): Response {
  const mcpUrl = `${env.PUBLIC_SITE_URL}/mcp/u/${user.id}`;
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connected · Bitbucket MCP</title>
<style>
  :root { color-scheme: light dark; --bg:#fbf7f0; --ink:#1d1915; --muted:#5c564e;
    --accent:#c96f4a; --accent-ink:#8b4a2b; --soft:#fdeadf; --rule:#e8e1d4;
    --card:#fff; --code-bg:#1d1915; --code-ink:#f5ecd9; }
  @media (prefers-color-scheme: dark) { :root { --bg:#181512; --ink:#f5ecd9; --muted:#c1b7a4;
    --accent:#e28a66; --accent-ink:#fdc8ab; --soft:#3a2419; --rule:#3a322a; --card:#2a241e;
    --code-bg:#0e0c0a; }}
  body { margin:0; background:var(--bg); color:var(--ink);
    font:16px/1.55 -apple-system,BlinkMacSystemFont,system-ui,sans-serif; }
  .shell { max-width:640px; margin:0 auto; padding:3rem 1.25rem; }
  h1 { font-size:2rem; margin:0 0 0.6rem; letter-spacing:-0.01em; }
  .kicker { font-size:0.75rem; text-transform:uppercase; letter-spacing:0.12em;
    color:var(--accent-ink); margin-bottom:0.5rem; }
  .lede { color:var(--muted); margin:0.5rem 0 1.5rem; }
  .card { background:var(--card); border:1px solid var(--rule); border-radius:12px;
    padding:1.1rem 1.25rem; margin:1rem 0; }
  pre { background:var(--code-bg); color:var(--code-ink); padding:1rem; border-radius:8px;
    overflow-x:auto; font:0.85rem ui-monospace,Menlo,monospace; }
  button { cursor:pointer; background:var(--accent); color:#fff; border:none;
    border-radius:999px; padding:0.6rem 1.1rem; font-size:0.95rem; font-weight:600; }
  .url { font:0.9rem ui-monospace,Menlo,monospace; word-break:break-all; display:block;
    padding:0.7rem; background:var(--soft); color:var(--accent-ink); border-radius:8px;
    margin:0.5rem 0; }
  a { color:var(--accent-ink); }
</style></head><body>
<div class="shell">
<div class="kicker">Connected</div>
<h1>Bitbucket linked — welcome${user.display_name ? `, ${escapeHtml(user.display_name)}` : ''}.</h1>
<p class="lede">Your personal MCP URL is below. Paste it into your MCP client.
It only works for you — don't share it.</p>

<div class="card">
  <strong>Your MCP URL</strong>
  <code class="url" id="mcp-url">${escapeHtml(mcpUrl)}</code>
  <button onclick="navigator.clipboard.writeText(document.getElementById('mcp-url').textContent)">Copy</button>
</div>

<div class="card">
  <strong>Claude Code</strong>
  <pre>claude mcp add bitbucket --transport http ${escapeHtml(mcpUrl)}</pre>
</div>

<div class="card">
  <strong>Claude.ai Connectors</strong>
  <p style="margin:0.3rem 0 0">Settings → Connectors → Add connector → paste the URL above.</p>
</div>

<div class="card">
  <strong>Codex / Cursor / other MCP clients</strong>
  <pre>{
  "mcpServers": {
    "bitbucket": {
      "transport": { "type": "http", "url": "${escapeHtml(mcpUrl)}" }
    }
  }
}</pre>
</div>

<p style="color:var(--muted);font-size:0.9rem;margin-top:2rem">
  Lost this page? You can re-authorize anytime — the same URL will be regenerated
  for your account. <a href="${escapeHtml(env.PUBLIC_SITE_URL)}">Back to site</a>.
</p>
</div></body></html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
