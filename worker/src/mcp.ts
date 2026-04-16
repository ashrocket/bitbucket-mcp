/**
 * MCP Streamable HTTP transport — stateless JSON-RPC 2.0 over POST /mcp.
 * We implement the spec directly rather than pulling in the Node-only SDK
 * transport. Scope: tools/list, tools/call, initialize, ping.
 */
import {
  BitbucketApiError,
  BitbucketAuthError,
  BitbucketClient,
  v1Tools,
  type ToolDefinition,
} from '@ashrocket/bitbucket-mcp-core';
import { getUserById, touchUser } from './db.js';
import { getAccessToken } from './oauth.js';
import type { Env } from './types.js';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'bitbucket-mcp', version: '0.1.0' };

const TOOL_BY_NAME = new Map<string, ToolDefinition>(
  v1Tools.map((t) => [t.name, t]),
);

// ─── JSON-RPC types (minimal) ────────────────────────────────────────────
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// JSON-RPC error codes
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

/** POST /mcp (BYO token) or POST /mcp/u/<id> (OAuth). */
export async function mcpHandler(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  if (request.method === 'GET') {
    // Streamable HTTP spec allows GET for server-initiated SSE. We don't
    // have any, so return 405 rather than hang.
    return new Response('', {
      status: 405,
      headers: { Allow: 'POST, DELETE' },
    });
  }
  if (request.method === 'DELETE') {
    // Session termination — we're stateless, ack and move on.
    return new Response(null, { status: 204 });
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Resolve a BitbucketClient based on the path
  let client: BitbucketClient;
  try {
    client = await resolveClient(request, env, url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(msg, {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonRpcErrorResponse(null, PARSE_ERROR, 'Invalid JSON body');
  }

  // MCP supports batch requests (array). Handle both.
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((item) => handleOne(item, client)),
    );
    // Skip notifications (no id → no response expected)
    const filtered = responses.filter((r): r is JsonRpcResponse => r !== null);
    return jsonResponse(filtered);
  }

  const response = await handleOne(body, client);
  if (response === null) return new Response(null, { status: 204 });
  return jsonResponse(response);
}

async function resolveClient(
  request: Request,
  env: Env,
  url: URL,
): Promise<BitbucketClient> {
  const segments = url.pathname.split('/').filter(Boolean);
  // /mcp/u/<id> → OAuth user
  if (segments[0] === 'mcp' && segments[1] === 'u' && segments[2]) {
    const user = await getUserById(env, segments[2]);
    if (!user) throw new Error('Unknown or expired MCP URL. Re-authorize at /oauth/authorize.');
    const accessToken = await getAccessToken(env, user);
    // Fire-and-forget touch (don't block the request)
    touchUser(env, user.id).catch(() => void 0);
    return new BitbucketClient({
      auth: { accessToken },
      ...(user.default_workspace
        ? { defaultWorkspace: user.default_workspace }
        : {}),
    });
  }

  // /mcp (BYO token)
  return bringYourOwnTokenClient(request);
}

function bringYourOwnTokenClient(request: Request): BitbucketClient {
  const authHeader = request.headers.get('Authorization');
  const apiTokenHeader = request.headers.get('X-Bitbucket-Token');
  const userHeader = request.headers.get('X-Bitbucket-Username');
  const workspaceHeader = request.headers.get('X-Bitbucket-Workspace');

  if (apiTokenHeader) {
    return new BitbucketClient({
      auth: {
        apiToken: apiTokenHeader,
        ...(userHeader ? { username: userHeader } : {}),
      },
      ...(workspaceHeader ? { defaultWorkspace: workspaceHeader } : {}),
    });
  }

  if (authHeader?.startsWith('Bearer ')) {
    return new BitbucketClient({
      auth: { accessToken: authHeader.slice(7).trim() },
      ...(workspaceHeader ? { defaultWorkspace: workspaceHeader } : {}),
    });
  }

  if (authHeader?.startsWith('Basic ')) {
    // Parse basic auth: username + (api token | app password).
    const decoded = atob(authHeader.slice(6).trim());
    const idx = decoded.indexOf(':');
    if (idx === -1) throw new Error('Malformed Basic auth header.');
    const username = decoded.slice(0, idx);
    const secret = decoded.slice(idx + 1);
    return new BitbucketClient({
      auth: { username, apiToken: secret },
      ...(workspaceHeader ? { defaultWorkspace: workspaceHeader } : {}),
    });
  }

  throw new Error(
    'No credentials. Use /mcp/u/<your-id> (OAuth) or pass a Bitbucket API ' +
      'token via `X-Bitbucket-Token` header or `Authorization: Bearer <token>`.',
  );
}

async function handleOne(
  req: unknown,
  client: BitbucketClient,
): Promise<JsonRpcResponse | null> {
  if (!isJsonRpcRequest(req)) {
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: INVALID_REQUEST, message: 'Invalid Request' },
    };
  }

  // Notifications (no id) don't get responses
  const isNotification = req.id === undefined || req.id === null;
  const id = req.id ?? null;

  try {
    switch (req.method) {
      case 'initialize': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: SERVER_INFO,
          },
        };
      }
      case 'notifications/initialized':
      case 'notifications/cancelled':
      case 'notifications/progress': {
        return null; // ack notifications with no response
      }
      case 'ping': {
        return { jsonrpc: '2.0', id, result: {} };
      }
      case 'tools/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: v1Tools.map(({ name, description, inputSchema }) => ({
              name,
              description,
              inputSchema,
            })),
          },
        };
      }
      case 'tools/call': {
        return await callTool(id, req.params, client);
      }
      // We don't support these, but some clients probe for them.
      case 'prompts/list': {
        return { jsonrpc: '2.0', id, result: { prompts: [] } };
      }
      case 'resources/list': {
        return { jsonrpc: '2.0', id, result: { resources: [] } };
      }
      case 'resources/templates/list': {
        return { jsonrpc: '2.0', id, result: { resourceTemplates: [] } };
      }
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: METHOD_NOT_FOUND,
            message: `Method not found: ${req.method}`,
          },
        };
    }
  } catch (err) {
    if (isNotification) return null;
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: INTERNAL_ERROR,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

async function callTool(
  id: number | string | null,
  params: unknown,
  client: BitbucketClient,
): Promise<JsonRpcResponse> {
  if (!params || typeof params !== 'object') {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: INVALID_PARAMS, message: 'Missing params' },
    };
  }
  const p = params as { name?: string; arguments?: Record<string, unknown> };
  if (!p.name) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: INVALID_PARAMS, message: 'Missing tool name' },
    };
  }
  const tool = TOOL_BY_NAME.get(p.name);
  if (!tool) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: METHOD_NOT_FOUND, message: `Unknown tool: ${p.name}` },
    };
  }

  try {
    const result = await tool.handler(client, p.arguments ?? {});
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text:
              typeof result === 'string'
                ? result
                : JSON.stringify(result, null, 2),
          },
        ],
      },
    };
  } catch (err) {
    // Business-level error (bad args, Bitbucket returned 4xx) → return as
    // tool-level error (isError: true in result), not JSON-RPC error.
    const message = formatError(err);
    return {
      jsonrpc: '2.0',
      id,
      result: {
        isError: true,
        content: [{ type: 'text', text: message }],
      },
    };
  }
}

function formatError(err: unknown): string {
  if (err instanceof BitbucketApiError) return err.message;
  if (err instanceof BitbucketAuthError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

function isJsonRpcRequest(x: unknown): x is JsonRpcRequest {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.jsonrpc === '2.0' && typeof o.method === 'string';
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function jsonRpcErrorResponse(
  id: number | string | null,
  code: number,
  message: string,
): Response {
  return jsonResponse({
    jsonrpc: '2.0',
    id,
    error: { code, message },
  } satisfies JsonRpcResponse);
}
