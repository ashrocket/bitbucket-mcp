import type { BitbucketClient } from './bitbucket.js';

export interface ToolInputSchema {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolDefinition<A = Record<string, unknown>> {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  handler: (client: BitbucketClient, args: A) => Promise<unknown>;
}

/** Standard Bitbucket "target repo" shape — used by most tools. */
export const repoInputProps = {
  workspace: {
    type: 'string',
    description:
      'Workspace slug or UUID. Omit to use BITBUCKET_WORKSPACE default.',
  },
  repo_slug: {
    type: 'string',
    description:
      'Repository slug (the part after the workspace in the URL, e.g. `my-api`).',
  },
} as const;

export function requireString(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Missing required string argument: \`${key}\``);
  }
  return v;
}

export function requireNumber(args: Record<string, unknown>, key: string): number {
  const v = args[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  throw new Error(`Missing required number argument: \`${key}\``);
}

export function optString(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = args[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function optNumber(
  args: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = args[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return undefined;
}

export function optBool(
  args: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const v = args[key];
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

/** Resolve workspace + repo_slug, applying env default for workspace. */
export function resolveRepo(
  client: BitbucketClient,
  args: Record<string, unknown>,
): { workspace: string; repo: string } {
  const repo = requireString(args, 'repo_slug');
  const workspace = client.resolveWorkspace(optString(args, 'workspace'));
  return { workspace, repo };
}
