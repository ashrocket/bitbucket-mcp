import {
  BitbucketApiError,
  BitbucketAuthError,
  type BitbucketAuth,
  type BitbucketConfig,
  type BitbucketErrorBody,
  type Paginated,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.bitbucket.org/2.0';
const DEFAULT_TIMEOUT_MS = 30_000;
const PACKAGE_VERSION = '0.1.0';
const DEFAULT_UA = `@ashrocket/bitbucket-mcp/${PACKAGE_VERSION}`;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** When true, returns the raw response body as text (for diffs, logs). */
  raw?: boolean;
  /** Override timeout for this call. */
  timeoutMs?: number;
  /** Custom Accept header (e.g. `text/plain` for logs). */
  accept?: string;
}

/** Minimal env shape — works with process.env and Worker env bindings alike. */
export interface EnvLike {
  BITBUCKET_ACCESS_TOKEN?: string | undefined;
  BITBUCKET_API_TOKEN?: string | undefined;
  BITBUCKET_APP_PASSWORD?: string | undefined;
  BITBUCKET_USERNAME?: string | undefined;
  BITBUCKET_WORKSPACE?: string | undefined;
}

export class BitbucketClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  readonly defaultWorkspace: string | undefined;

  constructor(config: BitbucketConfig) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.userAgent = config.userAgent ?? DEFAULT_UA;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultWorkspace = config.defaultWorkspace;
    this.authHeader = buildAuthHeader(config.auth);
  }

  /** Build a client from an env-like object (process.env or Worker env). */
  static fromEnv(env: EnvLike): BitbucketClient {
    const auth: BitbucketAuth = {
      accessToken: trim(env.BITBUCKET_ACCESS_TOKEN),
      apiToken: trim(env.BITBUCKET_API_TOKEN),
      appPassword: trim(env.BITBUCKET_APP_PASSWORD),
      username: trim(env.BITBUCKET_USERNAME),
    };
    return new BitbucketClient({
      auth,
      defaultWorkspace: trim(env.BITBUCKET_WORKSPACE),
    });
  }

  resolveWorkspace(explicit?: string): string {
    const ws = explicit?.trim() || this.defaultWorkspace;
    if (!ws) {
      throw new Error(
        'Workspace is required. Pass `workspace` to the tool call or set BITBUCKET_WORKSPACE.',
      );
    }
    return ws;
  }

  async request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
    const method = opts.method ?? 'GET';
    const url = this.buildUrl(path, opts.query);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      opts.timeoutMs ?? this.timeoutMs,
    );

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      'User-Agent': this.userAgent,
      Accept: opts.accept ?? 'application/json',
    };
    let body: string | undefined;
    if (opts.body !== undefined && method !== 'GET') {
      body = JSON.stringify(opts.body);
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') {
        throw new BitbucketApiError(
          `Request timed out after ${opts.timeoutMs ?? this.timeoutMs}ms`,
          0,
          path,
          method,
        );
      }
      throw new BitbucketApiError(
        `Network error: ${(err as Error).message}`,
        0,
        path,
        method,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = await response.text();
      throw buildApiError(response, text, path, method);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    if (opts.raw) {
      return (await response.text()) as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return (await response.text()) as T;
    }
    return (await response.json()) as T;
  }

  /**
   * Iterate a paginated endpoint, yielding items from `values[]` across pages.
   * Use `maxItems` to cap total; otherwise follows `next` cursors until done.
   */
  async *paginate<T>(
    path: string,
    opts: RequestOptions & { maxItems?: number; pagelen?: number } = {},
  ): AsyncGenerator<T, void, void> {
    const { maxItems, pagelen, ...rest } = opts;
    let nextUrl: string | undefined;
    let page = await this.request<Paginated<T>>(path, {
      ...rest,
      query: { pagelen: pagelen ?? 50, ...(rest.query ?? {}) },
    });
    let yielded = 0;

    while (true) {
      for (const item of page.values) {
        yield item;
        yielded++;
        if (maxItems !== undefined && yielded >= maxItems) return;
      }
      nextUrl = page.next;
      if (!nextUrl) return;
      page = await this.requestAbsolute<Paginated<T>>(nextUrl);
    }
  }

  /** Collect up to `maxItems` from a paginated endpoint into an array. */
  async collect<T>(
    path: string,
    opts: RequestOptions & { maxItems?: number; pagelen?: number } = {},
  ): Promise<T[]> {
    const out: T[] = [];
    for await (const item of this.paginate<T>(path, opts)) out.push(item);
    return out;
  }

  private async requestAbsolute<T>(absoluteUrl: string): Promise<T> {
    const response = await fetch(absoluteUrl, {
      headers: {
        Authorization: this.authHeader,
        'User-Agent': this.userAgent,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw buildApiError(response, text, absoluteUrl, 'GET');
    }
    return (await response.json()) as T;
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const base = path.startsWith('http')
      ? path
      : `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
    if (!query) return base;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    if (!qs) return base;
    return `${base}${base.includes('?') ? '&' : '?'}${qs}`;
  }
}

function buildAuthHeader(auth: BitbucketAuth): string {
  if (auth.accessToken) {
    return `Bearer ${auth.accessToken}`;
  }
  if (auth.apiToken) {
    const user = auth.username || 'x-bitbucket-api-token-auth';
    return `Basic ${base64(`${user}:${auth.apiToken}`)}`;
  }
  if (auth.appPassword) {
    if (!auth.username) {
      throw new BitbucketAuthError(
        'BITBUCKET_USERNAME is required when using BITBUCKET_APP_PASSWORD.',
      );
    }
    return `Basic ${base64(`${auth.username}:${auth.appPassword}`)}`;
  }
  throw new BitbucketAuthError(
    'No Bitbucket credentials configured. Set BITBUCKET_API_TOKEN ' +
      '(recommended), BITBUCKET_ACCESS_TOKEN, or BITBUCKET_APP_PASSWORD + ' +
      'BITBUCKET_USERNAME.',
  );
}

/** Universal base64 — works in Node 18+ and Workers. */
function base64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function trim(s: string | undefined): string | undefined {
  if (typeof s !== 'string') return undefined;
  const t = s.trim();
  return t.length === 0 ? undefined : t;
}

function buildApiError(
  response: Response,
  text: string,
  path: string,
  method: string,
): BitbucketApiError {
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  const message = extractMessage(parsed) ?? response.statusText ?? 'Request failed';
  const statusLabel = `${response.status} ${response.statusText}`.trim();
  let detail = `${method} ${path} → ${statusLabel}: ${message}`;
  if (response.status === 429) {
    const reset = response.headers.get('x-ratelimit-reset');
    detail += reset ? ` (rate-limited; resets at ${reset})` : ' (rate-limited)';
  }
  if (response.status === 401 || response.status === 403) {
    detail += ' — check that your credentials have the required scopes.';
  }
  return new BitbucketApiError(detail, response.status, path, method, parsed);
}

function extractMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const maybe = body as Partial<BitbucketErrorBody> & { message?: string };
  if (maybe.error?.message) {
    return maybe.error.detail
      ? `${maybe.error.message} — ${maybe.error.detail}`
      : maybe.error.message;
  }
  if (typeof maybe.message === 'string') return maybe.message;
  return undefined;
}
