import type { BitbucketClient } from '../bitbucket.js';
import {
  optNumber,
  optString,
  requireString,
  type ToolDefinition,
} from '../tool-kit.js';

const currentUser: ToolDefinition = {
  name: 'bitbucket_current_user',
  description: 'Return the authenticated user (GET /user). Useful to confirm credentials work.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: async (client) => client.request('/user'),
};

const listWorkspaces: ToolDefinition = {
  name: 'bitbucket_list_workspaces',
  description:
    'List workspaces the authenticated user belongs to. Supports `role` filter (member, collaborator, owner).',
  inputSchema: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        enum: ['member', 'collaborator', 'owner'],
        description: 'Filter workspaces by your role.',
      },
      max_items: {
        type: 'number',
        description: 'Cap on total results. Default 100.',
      },
    },
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const role = optString(args, 'role');
    const maxItems = optNumber(args, 'max_items') ?? 100;
    return client.collect('/workspaces', {
      query: role ? { role } : undefined,
      maxItems,
    });
  },
};

const getWorkspace: ToolDefinition = {
  name: 'bitbucket_get_workspace',
  description: 'Get workspace details by slug.',
  inputSchema: {
    type: 'object',
    properties: {
      workspace: {
        type: 'string',
        description: 'Workspace slug. Omit to use BITBUCKET_WORKSPACE default.',
      },
    },
    additionalProperties: false,
  },
  handler: async (client: BitbucketClient, args) => {
    const ws = client.resolveWorkspace(optString(args, 'workspace'));
    return client.request(`/workspaces/${encodeURIComponent(ws)}`);
  },
};

const listProjects: ToolDefinition = {
  name: 'bitbucket_list_projects',
  description: 'List projects in a workspace.',
  inputSchema: {
    type: 'object',
    properties: {
      workspace: { type: 'string' },
      query: {
        type: 'string',
        description: 'Optional BBQL filter string (e.g. `name ~ "platform"`).',
      },
      max_items: { type: 'number' },
    },
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const ws = client.resolveWorkspace(optString(args, 'workspace'));
    return client.collect(
      `/workspaces/${encodeURIComponent(ws)}/projects`,
      {
        query: { q: optString(args, 'query') },
        maxItems: optNumber(args, 'max_items') ?? 100,
      },
    );
  },
};

const getProject: ToolDefinition = {
  name: 'bitbucket_get_project',
  description: 'Get project details by key.',
  inputSchema: {
    type: 'object',
    properties: {
      workspace: { type: 'string' },
      project_key: { type: 'string', description: 'Project key (e.g. `PLAT`).' },
    },
    required: ['project_key'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const ws = client.resolveWorkspace(optString(args, 'workspace'));
    const key = requireString(args, 'project_key');
    return client.request(
      `/workspaces/${encodeURIComponent(ws)}/projects/${encodeURIComponent(key)}`,
    );
  },
};

export const workspaceTools: ToolDefinition[] = [
  currentUser,
  listWorkspaces,
  getWorkspace,
  listProjects,
  getProject,
];
