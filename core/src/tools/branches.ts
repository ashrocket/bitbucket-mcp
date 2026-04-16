import {
  repoInputProps,
  requireString,
  resolveRepo,
  type ToolDefinition,
} from '../tool-kit.js';

const createBranch: ToolDefinition = {
  name: 'bitbucket_create_branch',
  description: 'Create a new branch pointing at an existing commit/branch/tag.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      name: { type: 'string', description: 'New branch name.' },
      target: {
        type: 'string',
        description: 'Commit hash, branch, or tag to point at.',
      },
    },
    required: ['repo_slug', 'name', 'target'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const name = requireString(args, 'name');
    const target = requireString(args, 'target');
    return client.request(
      `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/refs/branches`,
      { method: 'POST', body: { name, target: { hash: target } } },
    );
  },
};

const deleteBranch: ToolDefinition = {
  name: 'bitbucket_delete_branch',
  description: 'Delete a branch by name. This is irreversible.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      name: { type: 'string' },
    },
    required: ['repo_slug', 'name'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const name = requireString(args, 'name');
    return client.request(
      `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/refs/branches/${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    );
  },
};

const createTag: ToolDefinition = {
  name: 'bitbucket_create_tag',
  description: 'Create a tag pointing at a commit.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      name: { type: 'string' },
      target: { type: 'string', description: 'Commit hash, branch, or tag.' },
      message: { type: 'string', description: 'Annotated tag message (optional).' },
    },
    required: ['repo_slug', 'name', 'target'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const name = requireString(args, 'name');
    const target = requireString(args, 'target');
    const body: Record<string, unknown> = {
      name,
      target: { hash: target },
    };
    if (typeof args.message === 'string' && args.message.length > 0) {
      body.message = args.message;
    }
    return client.request(
      `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/refs/tags`,
      { method: 'POST', body },
    );
  },
};

const deleteTag: ToolDefinition = {
  name: 'bitbucket_delete_tag',
  description: 'Delete a tag by name. This is irreversible.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      name: { type: 'string' },
    },
    required: ['repo_slug', 'name'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const name = requireString(args, 'name');
    return client.request(
      `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/refs/tags/${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    );
  },
};

export const branchTools: ToolDefinition[] = [
  createBranch,
  deleteBranch,
  createTag,
  deleteTag,
];
