import {
  optNumber,
  optString,
  repoInputProps,
  requireString,
  resolveRepo,
  type ToolDefinition,
} from '../tool-kit.js';

const listCommits: ToolDefinition = {
  name: 'bitbucket_list_commits',
  description:
    'List commits reachable from a branch or revision (default: repo main branch).',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      branch: { type: 'string', description: 'Branch, tag, or commit hash.' },
      include: {
        type: 'array',
        description: 'Only commits reachable from these refs.',
        items: { type: 'string' },
      },
      exclude: {
        type: 'array',
        description: 'Exclude commits reachable from these refs.',
        items: { type: 'string' },
      },
      path: {
        type: 'string',
        description: 'Only commits touching this path.',
      },
      max_items: { type: 'number' },
    },
    required: ['repo_slug'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const branch = optString(args, 'branch');
    const path = `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/commits${branch ? `/${encodeURIComponent(branch)}` : ''}`;
    const query: Record<string, string | number | undefined> = {};
    if (Array.isArray(args.include)) {
      query.include = args.include.map(String).join(',');
    }
    if (Array.isArray(args.exclude)) {
      query.exclude = args.exclude.map(String).join(',');
    }
    const filePath = optString(args, 'path');
    if (filePath) query.path = filePath;
    return client.collect(path, {
      query,
      maxItems: optNumber(args, 'max_items') ?? 50,
    });
  },
};

const getCommit: ToolDefinition = {
  name: 'bitbucket_get_commit',
  description: 'Get a commit by hash.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      commit: { type: 'string', description: 'Full or short commit hash.' },
    },
    required: ['repo_slug', 'commit'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const commit = requireString(args, 'commit');
    return client.request(
      `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/commit/${encodeURIComponent(commit)}`,
    );
  },
};

const getCommitDiff: ToolDefinition = {
  name: 'bitbucket_get_commit_diff',
  description: 'Get the unified diff for a commit (raw text).',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      commit: { type: 'string' },
      context: { type: 'number', description: 'Context lines around hunks.' },
    },
    required: ['repo_slug', 'commit'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const commit = requireString(args, 'commit');
    const ctx = optNumber(args, 'context');
    return client.request(
      `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/diff/${encodeURIComponent(commit)}`,
      {
        raw: true,
        accept: 'text/plain',
        query: ctx !== undefined ? { context: ctx } : undefined,
      },
    );
  },
};

const getCommitDiffstat: ToolDefinition = {
  name: 'bitbucket_get_commit_diffstat',
  description: 'Summary of files touched by a commit.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      commit: { type: 'string' },
      max_items: { type: 'number' },
    },
    required: ['repo_slug', 'commit'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const commit = requireString(args, 'commit');
    return client.collect(
      `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/diffstat/${encodeURIComponent(commit)}`,
      { maxItems: optNumber(args, 'max_items') ?? 500 },
    );
  },
};

export const commitTools: ToolDefinition[] = [
  listCommits,
  getCommit,
  getCommitDiff,
  getCommitDiffstat,
];
