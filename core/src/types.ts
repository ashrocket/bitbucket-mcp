export interface BitbucketAuth {
  /** Bearer token (workspace / repo / project access token). Takes precedence. */
  accessToken?: string;
  /** Atlassian API token (Basic auth). */
  apiToken?: string;
  /** Legacy app password (Basic auth). */
  appPassword?: string;
  /**
   * Basic auth username. Defaults to `x-bitbucket-api-token-auth` when
   * `apiToken` is set; required for `appPassword`.
   */
  username?: string;
}

export interface BitbucketConfig {
  auth: BitbucketAuth;
  /** Default workspace slug applied when a tool omits one. */
  defaultWorkspace?: string;
  /** Base URL override (useful for tests). */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Default 30_000. */
  timeoutMs?: number;
  /** Custom User-Agent. Default `@ashrocket/bitbucket-mcp/<version>`. */
  userAgent?: string;
}

export interface Paginated<T> {
  pagelen: number;
  page?: number;
  size?: number;
  next?: string;
  previous?: string;
  values: T[];
}

export interface BitbucketErrorBody {
  type: 'error';
  error: {
    message: string;
    detail?: string;
    data?: unknown;
  };
}

export class BitbucketApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly method: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'BitbucketApiError';
  }
}

export class BitbucketAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BitbucketAuthError';
  }
}
