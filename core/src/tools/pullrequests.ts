import {
  optBool,
  optNumber,
  optString,
  repoInputProps,
  requireNumber,
  requireString,
  resolveRepo,
  type ToolDefinition,
} from '../tool-kit.js';

const prPathBase = (ws: string, repo: string) =>
  `/repositories/${encodeURIComponent(ws)}/${encodeURIComponent(repo)}/pullrequests`;

const listPullRequests: ToolDefinition = {
  name: 'bitbucket_list_pull_requests',
  description:
    'List pull requests. By default returns OPEN PRs. Supports BBQL `query` (e.g. `author.uuid = "{...}"`).',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      state: {
        type: 'string',
        enum: ['OPEN', 'MERGED', 'DECLINED', 'SUPERSEDED', 'ALL'],
        description: 'Filter by PR state. ALL returns every state.',
      },
      query: { type: 'string', description: 'BBQL filter string.' },
      sort: { type: 'string', description: 'Sort key (e.g. `-updated_on`).' },
      max_items: { type: 'number', description: 'Default 50.' },
    },
    required: ['repo_slug'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const stateArg = optString(args, 'state') ?? 'OPEN';
    const state = stateArg === 'ALL' ? undefined : stateArg;
    return client.collect(prPathBase(workspace, repo), {
      query: {
        state,
        q: optString(args, 'query'),
        sort: optString(args, 'sort'),
      },
      maxItems: optNumber(args, 'max_items') ?? 50,
    });
  },
};

const getPullRequest: ToolDefinition = {
  name: 'bitbucket_get_pull_request',
  description: 'Get a single pull request by ID.',
  inputSchema: {
    type: 'object',
    properties: { ...repoInputProps, pr_id: { type: 'number' } },
    required: ['repo_slug', 'pr_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    return client.request(`${prPathBase(workspace, repo)}/${id}`);
  },
};

const createPullRequest: ToolDefinition = {
  name: 'bitbucket_create_pull_request',
  description: 'Create a new pull request.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      title: { type: 'string' },
      source_branch: { type: 'string', description: 'Source branch name.' },
      destination_branch: {
        type: 'string',
        description: 'Destination branch. Defaults to the repo main branch.',
      },
      description: { type: 'string' },
      close_source_branch: {
        type: 'boolean',
        description: 'Delete the source branch after merge. Default false.',
      },
      reviewers: {
        type: 'array',
        description: 'Reviewer UUIDs (e.g. `{abc-123}`) — NOT usernames.',
        items: { type: 'string' },
      },
      draft: { type: 'boolean', description: 'Open as a draft PR. Default false.' },
    },
    required: ['repo_slug', 'title', 'source_branch'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const body: Record<string, unknown> = {
      title: requireString(args, 'title'),
      source: { branch: { name: requireString(args, 'source_branch') } },
    };
    const dest = optString(args, 'destination_branch');
    if (dest) body.destination = { branch: { name: dest } };
    const description = optString(args, 'description');
    if (description) body.description = description;
    const closeSource = optBool(args, 'close_source_branch');
    if (closeSource !== undefined) body.close_source_branch = closeSource;
    const draft = optBool(args, 'draft');
    if (draft !== undefined) body.draft = draft;
    const reviewers = args.reviewers;
    if (Array.isArray(reviewers) && reviewers.length > 0) {
      body.reviewers = reviewers.map((uuid) => ({ uuid: String(uuid) }));
    }
    return client.request(prPathBase(workspace, repo), { method: 'POST', body });
  },
};

const updatePullRequest: ToolDefinition = {
  name: 'bitbucket_update_pull_request',
  description: 'Update a pull request (title, description, destination, reviewers).',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pr_id: { type: 'number' },
      title: { type: 'string' },
      description: { type: 'string' },
      destination_branch: { type: 'string' },
      reviewers: { type: 'array', items: { type: 'string' } },
    },
    required: ['repo_slug', 'pr_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    const body: Record<string, unknown> = {};
    const title = optString(args, 'title');
    if (title) body.title = title;
    const description = optString(args, 'description');
    if (description !== undefined) body.description = description;
    const dest = optString(args, 'destination_branch');
    if (dest) body.destination = { branch: { name: dest } };
    const reviewers = args.reviewers;
    if (Array.isArray(reviewers)) {
      body.reviewers = reviewers.map((uuid) => ({ uuid: String(uuid) }));
    }
    return client.request(`${prPathBase(workspace, repo)}/${id}`, {
      method: 'PUT',
      body,
    });
  },
};

const mergePullRequest: ToolDefinition = {
  name: 'bitbucket_merge_pull_request',
  description: 'Merge a pull request.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pr_id: { type: 'number' },
      message: { type: 'string', description: 'Custom merge commit message.' },
      close_source_branch: { type: 'boolean' },
      merge_strategy: {
        type: 'string',
        enum: ['merge_commit', 'squash', 'fast_forward'],
      },
    },
    required: ['repo_slug', 'pr_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    const body: Record<string, unknown> = {};
    const msg = optString(args, 'message');
    if (msg) body.message = msg;
    const close = optBool(args, 'close_source_branch');
    if (close !== undefined) body.close_source_branch = close;
    const strategy = optString(args, 'merge_strategy');
    if (strategy) body.merge_strategy = strategy;
    return client.request(`${prPathBase(workspace, repo)}/${id}/merge`, {
      method: 'POST',
      body,
    });
  },
};

const declinePullRequest: ToolDefinition = {
  name: 'bitbucket_decline_pull_request',
  description: 'Decline (close without merging) a pull request.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pr_id: { type: 'number' },
    },
    required: ['repo_slug', 'pr_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    return client.request(`${prPathBase(workspace, repo)}/${id}/decline`, {
      method: 'POST',
    });
  },
};

const approvePullRequest: ToolDefinition = {
  name: 'bitbucket_approve_pull_request',
  description: 'Approve a pull request as the authenticated user.',
  inputSchema: {
    type: 'object',
    properties: { ...repoInputProps, pr_id: { type: 'number' } },
    required: ['repo_slug', 'pr_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    return client.request(`${prPathBase(workspace, repo)}/${id}/approve`, {
      method: 'POST',
    });
  },
};

const unapprovePullRequest: ToolDefinition = {
  name: 'bitbucket_unapprove_pull_request',
  description: 'Remove your approval from a pull request.',
  inputSchema: {
    type: 'object',
    properties: { ...repoInputProps, pr_id: { type: 'number' } },
    required: ['repo_slug', 'pr_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    return client.request(`${prPathBase(workspace, repo)}/${id}/approve`, {
      method: 'DELETE',
    });
  },
};

const requestChanges: ToolDefinition = {
  name: 'bitbucket_request_changes',
  description: 'Mark "Request changes" on a pull request as the authenticated user.',
  inputSchema: {
    type: 'object',
    properties: { ...repoInputProps, pr_id: { type: 'number' } },
    required: ['repo_slug', 'pr_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    return client.request(`${prPathBase(workspace, repo)}/${id}/request-changes`, {
      method: 'POST',
    });
  },
};

const unrequestChanges: ToolDefinition = {
  name: 'bitbucket_unrequest_changes',
  description: 'Remove your "Request changes" status from a pull request.',
  inputSchema: {
    type: 'object',
    properties: { ...repoInputProps, pr_id: { type: 'number' } },
    required: ['repo_slug', 'pr_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    return client.request(`${prPathBase(workspace, repo)}/${id}/request-changes`, {
      method: 'DELETE',
    });
  },
};

const listPrComments: ToolDefinition = {
  name: 'bitbucket_list_pr_comments',
  description: 'List comments on a pull request.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pr_id: { type: 'number' },
      max_items: { type: 'number' },
    },
    required: ['repo_slug', 'pr_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    return client.collect(`${prPathBase(workspace, repo)}/${id}/comments`, {
      maxItems: optNumber(args, 'max_items') ?? 200,
    });
  },
};

const addPrComment: ToolDefinition = {
  name: 'bitbucket_add_pr_comment',
  description:
    'Add a comment to a pull request. Pass `inline` with path + line for a review comment.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pr_id: { type: 'number' },
      content: { type: 'string', description: 'Markdown body of the comment.' },
      inline_path: { type: 'string', description: 'File path (for inline comments).' },
      inline_to: {
        type: 'number',
        description: 'Line in the new version (inline comments). Use one of to/from.',
      },
      inline_from: {
        type: 'number',
        description: 'Line in the old version (inline comments).',
      },
      parent_id: { type: 'number', description: 'Reply to this comment ID.' },
    },
    required: ['repo_slug', 'pr_id', 'content'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    const body: Record<string, unknown> = {
      content: { raw: requireString(args, 'content') },
    };
    const path = optString(args, 'inline_path');
    const to = optNumber(args, 'inline_to');
    const from = optNumber(args, 'inline_from');
    if (path) {
      const inline: Record<string, unknown> = { path };
      if (to !== undefined) inline.to = to;
      if (from !== undefined) inline.from = from;
      body.inline = inline;
    }
    const parent = optNumber(args, 'parent_id');
    if (parent !== undefined) body.parent = { id: parent };
    return client.request(`${prPathBase(workspace, repo)}/${id}/comments`, {
      method: 'POST',
      body,
    });
  },
};

const deletePrComment: ToolDefinition = {
  name: 'bitbucket_delete_pr_comment',
  description: 'Delete one of your own comments on a pull request.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pr_id: { type: 'number' },
      comment_id: { type: 'number' },
    },
    required: ['repo_slug', 'pr_id', 'comment_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    const commentId = requireNumber(args, 'comment_id');
    return client.request(
      `${prPathBase(workspace, repo)}/${id}/comments/${commentId}`,
      { method: 'DELETE' },
    );
  },
};

const getPrDiff: ToolDefinition = {
  name: 'bitbucket_get_pr_diff',
  description: 'Get the unified diff for a pull request as raw text.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pr_id: { type: 'number' },
      context: {
        type: 'number',
        description: 'Context lines around each hunk. Default 3.',
      },
    },
    required: ['repo_slug', 'pr_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    const ctx = optNumber(args, 'context');
    return client.request(`${prPathBase(workspace, repo)}/${id}/diff`, {
      raw: true,
      accept: 'text/plain',
      query: ctx !== undefined ? { context: ctx } : undefined,
    });
  },
};

const getPrDiffstat: ToolDefinition = {
  name: 'bitbucket_get_pr_diffstat',
  description:
    'Summary of files changed in a pull request (path, status, lines added/removed).',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pr_id: { type: 'number' },
      max_items: { type: 'number' },
    },
    required: ['repo_slug', 'pr_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    return client.collect(`${prPathBase(workspace, repo)}/${id}/diffstat`, {
      maxItems: optNumber(args, 'max_items') ?? 500,
    });
  },
};

const listPrCommits: ToolDefinition = {
  name: 'bitbucket_list_pr_commits',
  description: 'List commits included in a pull request.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pr_id: { type: 'number' },
      max_items: { type: 'number' },
    },
    required: ['repo_slug', 'pr_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    return client.collect(`${prPathBase(workspace, repo)}/${id}/commits`, {
      maxItems: optNumber(args, 'max_items') ?? 200,
    });
  },
};

const listPrActivity: ToolDefinition = {
  name: 'bitbucket_list_pr_activity',
  description: 'List activity events (approvals, comments, updates) on a pull request.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pr_id: { type: 'number' },
      max_items: { type: 'number' },
    },
    required: ['repo_slug', 'pr_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'pr_id');
    return client.collect(`${prPathBase(workspace, repo)}/${id}/activity`, {
      maxItems: optNumber(args, 'max_items') ?? 200,
    });
  },
};

export const pullRequestTools: ToolDefinition[] = [
  listPullRequests,
  getPullRequest,
  createPullRequest,
  updatePullRequest,
  mergePullRequest,
  declinePullRequest,
  approvePullRequest,
  unapprovePullRequest,
  requestChanges,
  unrequestChanges,
  listPrComments,
  addPrComment,
  deletePrComment,
  getPrDiff,
  getPrDiffstat,
  listPrCommits,
  listPrActivity,
];
