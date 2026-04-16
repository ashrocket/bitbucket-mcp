import {
  optNumber,
  optString,
  repoInputProps,
  requireNumber,
  requireString,
  resolveRepo,
  type ToolDefinition,
} from '../tool-kit.js';

const basePath = (ws: string, repo: string) =>
  `/repositories/${encodeURIComponent(ws)}/${encodeURIComponent(repo)}/issues`;

const listIssues: ToolDefinition = {
  name: 'bitbucket_list_issues',
  description:
    'List issues on a repository. (Requires the repo to have the issue tracker enabled.)',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      query: { type: 'string', description: 'BBQL filter string.' },
      sort: { type: 'string' },
      max_items: { type: 'number' },
    },
    required: ['repo_slug'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    return client.collect(basePath(workspace, repo), {
      query: {
        q: optString(args, 'query'),
        sort: optString(args, 'sort'),
      },
      maxItems: optNumber(args, 'max_items') ?? 50,
    });
  },
};

const getIssue: ToolDefinition = {
  name: 'bitbucket_get_issue',
  description: 'Get a single issue by ID.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      issue_id: { type: 'number' },
    },
    required: ['repo_slug', 'issue_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'issue_id');
    return client.request(`${basePath(workspace, repo)}/${id}`);
  },
};

const createIssue: ToolDefinition = {
  name: 'bitbucket_create_issue',
  description: 'Create a new issue.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      title: { type: 'string' },
      content: { type: 'string', description: 'Markdown body.' },
      kind: {
        type: 'string',
        enum: ['bug', 'enhancement', 'proposal', 'task'],
      },
      priority: {
        type: 'string',
        enum: ['trivial', 'minor', 'major', 'critical', 'blocker'],
      },
      assignee_uuid: { type: 'string' },
    },
    required: ['repo_slug', 'title'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const body: Record<string, unknown> = { title: requireString(args, 'title') };
    const content = optString(args, 'content');
    if (content) body.content = { raw: content };
    const kind = optString(args, 'kind');
    if (kind) body.kind = kind;
    const priority = optString(args, 'priority');
    if (priority) body.priority = priority;
    const assignee = optString(args, 'assignee_uuid');
    if (assignee) body.assignee = { uuid: assignee };
    return client.request(basePath(workspace, repo), { method: 'POST', body });
  },
};

const updateIssue: ToolDefinition = {
  name: 'bitbucket_update_issue',
  description: 'Update an issue (title, content, state, assignee, kind, priority).',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      issue_id: { type: 'number' },
      title: { type: 'string' },
      content: { type: 'string' },
      state: {
        type: 'string',
        enum: [
          'new',
          'open',
          'resolved',
          'on hold',
          'invalid',
          'duplicate',
          'wontfix',
          'closed',
        ],
      },
      assignee_uuid: { type: 'string' },
      kind: { type: 'string' },
      priority: { type: 'string' },
    },
    required: ['repo_slug', 'issue_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'issue_id');
    const body: Record<string, unknown> = {};
    const title = optString(args, 'title');
    if (title) body.title = title;
    const content = optString(args, 'content');
    if (content !== undefined) body.content = { raw: content };
    const state = optString(args, 'state');
    if (state) body.state = state;
    const assignee = optString(args, 'assignee_uuid');
    if (assignee) body.assignee = { uuid: assignee };
    const kind = optString(args, 'kind');
    if (kind) body.kind = kind;
    const priority = optString(args, 'priority');
    if (priority) body.priority = priority;
    return client.request(`${basePath(workspace, repo)}/${id}`, {
      method: 'PUT',
      body,
    });
  },
};

const listIssueComments: ToolDefinition = {
  name: 'bitbucket_list_issue_comments',
  description: 'List comments on an issue.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      issue_id: { type: 'number' },
      max_items: { type: 'number' },
    },
    required: ['repo_slug', 'issue_id'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'issue_id');
    return client.collect(`${basePath(workspace, repo)}/${id}/comments`, {
      maxItems: optNumber(args, 'max_items') ?? 200,
    });
  },
};

const addIssueComment: ToolDefinition = {
  name: 'bitbucket_add_issue_comment',
  description: 'Add a comment to an issue.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      issue_id: { type: 'number' },
      content: { type: 'string' },
    },
    required: ['repo_slug', 'issue_id', 'content'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const id = requireNumber(args, 'issue_id');
    return client.request(`${basePath(workspace, repo)}/${id}/comments`, {
      method: 'POST',
      body: { content: { raw: requireString(args, 'content') } },
    });
  },
};

export const issueTools: ToolDefinition[] = [
  listIssues,
  getIssue,
  createIssue,
  updateIssue,
  listIssueComments,
  addIssueComment,
];
