import { mcpHandler } from './mcp.js';
import { oauthAuthorize, oauthCallback } from './oauth.js';
import { apiRecent, apiTotal, stripeWebhook } from './stripe.js';
import type { Env } from './types.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Mcp-Session-Id, X-Bitbucket-Token, X-Bitbucket-Username, X-Bitbucket-Workspace',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
} as const;

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...CORS_HEADERS,
          'Access-Control-Allow-Origin': request.headers.get('Origin') ?? '*',
        },
      });
    }

    try {
      const res = await dispatch(request, env, ctx, url);
      // Attach CORS to successful responses if the origin is reasonable.
      const origin = request.headers.get('Origin');
      if (origin && !res.headers.has('Access-Control-Allow-Origin')) {
        const newHeaders = new Headers(res.headers);
        newHeaders.set('Access-Control-Allow-Origin', origin);
        return new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers: newHeaders,
        });
      }
      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(`Internal error: ${message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  },
};

async function dispatch(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  url: URL,
): Promise<Response> {
  // MCP routes
  if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
    return mcpHandler(request, env, url);
  }

  // OAuth
  if (url.pathname === '/oauth/authorize') return oauthAuthorize(request, env);
  if (url.pathname === '/oauth/callback') return oauthCallback(request, env);

  // Donations
  if (url.pathname === '/api/stripe-webhook') return stripeWebhook(request, env);
  if (url.pathname === '/api/total') return apiTotal(request, env);
  if (url.pathname === '/api/recent') return apiRecent(request, env);

  // Health / landing
  if (url.pathname === '/healthz' || url.pathname === '/health') {
    return new Response('ok\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (url.pathname === '/' || url.pathname === '') {
    // Root redirects to the marketing site (same domain once DNS is wired)
    if (env.PUBLIC_SITE_URL && env.PUBLIC_SITE_URL !== request.url) {
      return Response.redirect(env.PUBLIC_SITE_URL, 302);
    }
    return new Response(landingHtml(env), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return new Response('Not found', { status: 404 });
}

function landingHtml(env: Env): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<title>bitbucket-mcp API</title></head><body style="font:16px/1.5 system-ui; max-width:640px; margin:3rem auto; padding:0 1rem">
<h1>bitbucket-mcp API</h1>
<p>Worker endpoints:</p>
<ul>
  <li><code>POST /mcp</code> — MCP Streamable HTTP (BYO token via headers)</li>
  <li><code>POST /mcp/u/&lt;user-id&gt;</code> — MCP for OAuth users</li>
  <li><code>GET  /oauth/authorize</code> — start Bitbucket OAuth flow</li>
  <li><code>GET  /oauth/callback</code> — OAuth return</li>
  <li><code>POST /api/stripe-webhook</code> — Stripe webhook receiver</li>
  <li><code>GET  /api/total</code> — running donation total</li>
  <li><code>GET  /api/recent</code> — recent donations</li>
  <li><code>GET  /healthz</code> — health check</li>
</ul>
<p>Front-end: <a href="${env.PUBLIC_SITE_URL}">${env.PUBLIC_SITE_URL}</a></p>
</body></html>`;
}
