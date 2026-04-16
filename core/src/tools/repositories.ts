import {
  optBool,
  optNumber,
  optString,
  repoInputProps,
  requireString,
  resolveRepo,
  type ToolDefinition,
} from '../tool-kit.js';

const listRepositories: ToolDefinition = {
  name: 'bitbucket_list_repositories',
  description:
    'List repositories in a workspace. Supports BBQL `query` for filtering (e.g. `updated_on > 2025-01-01 AND language = "typescript"`).',
  inputSchema: {
    type: 'object',
    properties: {
      workspace: { type: 'string' },
      query: { type: 'string', description: 'BBQL filter string.' },
      sort: {
        type: 'string',
        description: 'Sort key (e.g. `-updated_on`, `name`).',
      },
      role: {
        type: 'string',
        enum: ['owner', 'admin', 'contributor', 'member'],
      },
      max_items: { type: 'number' },
    },
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const ws = client.resolveWorkspace(optString(args, 'workspace'));
    return client.collect(`/repositories/${encodeURIComponent(ws)}`, {
      query: {
        q: optString(args, 'query'),
        sort: optString(args, 'sort'),
        role: optString(args, 'role'),
      },
      maxItems: optNumber(args, 'max_items') ?? 100,
    });
  },
};

const getRepository: ToolDefinition = {
  name: 'bitbucket_get_repository',
  description: 'Get a repository by slug.',
  inputSchema: {
    type: 'object',
    properties: repoInputProps,
    required: ['repo_slug'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    return client.request(
      `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}`,
    );
  },
};

const listBranches: ToolDefinition = {
  name: 'bitbucket_list_branches',
  description: 'List branches in a repository.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      query: { type: 'string', description: 'BBQL filter (e.g. `name ~ "feat/"`).' },
      sort: { type: 'string', description: 'Sort key (e.g. `-target.date`).' },
      max_items: { type: 'number' },
    },
    required: ['repo_slug'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    return client.collect(
      `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/refs/branches`,
      {
        query: {
          q: optString(args, 'query'),
          sort: optString(args, 'sort'),
        },
        maxItems: optNumber(args, 'max_items') ?? 100,
      },
    );
  },
};

const getBranch: ToolDefinition = {
  name: 'bitbucket_get_branch',
  description: 'Get a branch by name.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      branch: { type: 'string' },
    },
    required: ['repo_slug', 'branch'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const branch = requireString(args, 'branch');
    return client.request(
      `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/refs/branches/${encodeURIComponent(branch)}`,
    );
  },
};

const listTags: ToolDefinition = {
  name: 'bitbucket_list_tags',
  description: 'List tags in a repository.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      sort: { type: 'string' },
      max_items: { type: 'number' },
    },
    required: ['repo_slug'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    return client.collect(
      `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/refs/tags`,
      {
        query: { sort: optString(args, 'sort') },
        maxItems: optNumber(args, 'max_items') ?? 100,
      },
    );
  },
};

const getFile: ToolDefinition = {
  name: 'bitbucket_get_file',
  description:
    'Fetch the contents of a file at a specific ref (commit hash, branch, or tag). Returns raw text.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      ref: {
        type: 'string',
        description: 'Commit hash, branch name, or tag. Defaults to the main branch.',
      },
      path: { type: 'string', description: 'Path within the repo (no leading slash).' },
    },
    required: ['repo_slug', 'path'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const ref = optString(args, 'ref') ?? 'HEAD';
    const path = requireString(args, 'path').replace(/^\/+/, '');
    const url = `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/src/${encodeURIComponent(ref)}/${path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
    return client.request(url, { raw: true, accept: '*/*' });
  },
};

const listDirectory: ToolDefinition = {
  name: 'bitbucket_list_directory',
  description:
    'List files and subdirectories at a path. Use path="" for the repo root.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      ref: { type: 'string', description: 'Commit hash, branch, or tag. Default HEAD.' },
      path: { type: 'string', description: 'Directory path. Empty string for root.' },
      max_items: { type: 'number' },
    },
    required: ['repo_slug'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const ref = optString(args, 'ref') ?? 'HEAD';
    const path = (optString(args, 'path') ?? '').replace(/^\/+/, '');
    const encodedPath = path
      ? '/' + path.split('/').map(encodeURIComponent).join('/')
      : '';
    const url = `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/src/${encodeURIComponent(ref)}${encodedPath}/`;
    return client.collect(url, {
      maxItems: optNumber(args, 'max_items') ?? 500,
    });
  },
};

const listWatchers: ToolDefinition = {
  name: 'bitbucket_list_watchers',
  description: 'List users watching a repository.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      max_items: { type: 'number' },
    },
    required: ['repo_slug'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    return client.collect(
      `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/watchers`,
      { maxItems: optNumber(args, 'max_items') ?? 200 },
    );
  },
};

const getDefaultReviewers: ToolDefinition = {
  name: 'bitbucket_list_default_reviewers',
  description: 'List the default reviewers configured for a repository.',
  inputSchema: {
    type: 'object',
    properties: repoInputProps,
    required: ['repo_slug'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    return client.collect(
      `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/default-reviewers`,
      { maxItems: 200 },
    );
  },
};

const getRepositoryPermissions: ToolDefinition = {
  name: 'bitbucket_list_repo_permissions',
  description:
    'List user/group permissions on a repository (who can read/write/admin).',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      include_groups: {
        type: 'boolean',
        description: 'Include group permissions in addition to user perms. Default true.',
      },
      max_items: { type: 'number' },
    },
    required: ['repo_slug'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const includeGroups = optBool(args, 'include_groups') ?? true;
    const users = await client.collect(
      `/workspaces/${encodeURIComponent(workspace)}/permissions/repositories/${encodeURIComponent(repo)}`,
      { maxItems: optNumber(args, 'max_items') ?? 200 },
    );
    if (!includeGroups) return { users };
    // Group perms endpoint is not universally available — tolerate 404.
    let groups: unknown[] = [];
    try {
      groups = await client.collect(
        `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/permissions-config/groups`,
        { maxItems: optNumber(args, 'max_items') ?? 200 },
      );
    } catch {
      // ignore — not all workspaces expose this
    }
    return { users, groups };
  },
};

export const repositoryTools: ToolDefinition[] = [
  listRepositories,
  getRepository,
  listBranches,
  getBranch,
  listTags,
  getFile,
  listDirectory,
  listWatchers,
  getDefaultReviewers,
  getRepositoryPermissions,
];
