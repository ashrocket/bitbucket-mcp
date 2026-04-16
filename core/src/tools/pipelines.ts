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
  `/repositories/${encodeURIComponent(ws)}/${encodeURIComponent(repo)}/pipelines`;

const listPipelines: ToolDefinition = {
  name: 'bitbucket_list_pipelines',
  description:
    'List recent pipeline runs. Default sort is newest first. Supports BBQL `query`.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      query: {
        type: 'string',
        description: 'BBQL filter (e.g. `target.branch = "master"`).',
      },
      sort: { type: 'string', description: 'Default `-created_on`.' },
      max_items: { type: 'number', description: 'Default 25.' },
    },
    required: ['repo_slug'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    return client.collect(basePath(workspace, repo), {
      query: {
        q: optString(args, 'query'),
        sort: optString(args, 'sort') ?? '-created_on',
      },
      maxItems: optNumber(args, 'max_items') ?? 25,
    });
  },
};

const getPipeline: ToolDefinition = {
  name: 'bitbucket_get_pipeline',
  description: 'Get a single pipeline by UUID or build number.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pipeline: {
        type: 'string',
        description: 'UUID (e.g. `{abc-...}`) or build number as a string.',
      },
    },
    required: ['repo_slug', 'pipeline'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const pipeline = requireString(args, 'pipeline');
    return client.request(
      `${basePath(workspace, repo)}/${encodeURIComponent(pipeline)}`,
    );
  },
};

const triggerPipeline: ToolDefinition = {
  name: 'bitbucket_trigger_pipeline',
  description:
    'Trigger a pipeline. Provide branch (for branch pipelines) or commit+branch, and optionally a named pipeline (custom/default selector).',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      branch: { type: 'string', description: 'Branch name to run against.' },
      commit: { type: 'string', description: 'Specific commit hash (optional).' },
      selector_type: {
        type: 'string',
        enum: ['branches', 'custom', 'default', 'pull-requests', 'tags'],
        description: 'Pipeline selector type from bitbucket-pipelines.yml.',
      },
      selector_pattern: {
        type: 'string',
        description: 'Pattern/name matching the selector (e.g. `deploy-staging`).',
      },
      variables: {
        type: 'array',
        description: 'Custom pipeline variables.',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'string' },
            secured: { type: 'boolean' },
          },
          required: ['key', 'value'],
        },
      },
    },
    required: ['repo_slug'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const target: Record<string, unknown> = { type: 'pipeline_ref_target' };
    const branch = optString(args, 'branch');
    const commit = optString(args, 'commit');
    const selectorType = optString(args, 'selector_type');
    const selectorPattern = optString(args, 'selector_pattern');

    if (branch) {
      target.ref_type = 'branch';
      target.ref_name = branch;
    }
    if (commit) {
      target.type = 'pipeline_commit_target';
      target.commit = { hash: commit };
      if (branch) target.selector = { type: 'branches', pattern: branch };
    }
    if (selectorType || selectorPattern) {
      const selector: Record<string, unknown> = {};
      if (selectorType) selector.type = selectorType;
      if (selectorPattern) selector.pattern = selectorPattern;
      target.selector = selector;
    }

    const body: Record<string, unknown> = { target };
    const vars = args.variables;
    if (Array.isArray(vars) && vars.length > 0) body.variables = vars;

    return client.request(basePath(workspace, repo), { method: 'POST', body });
  },
};

const stopPipeline: ToolDefinition = {
  name: 'bitbucket_stop_pipeline',
  description: 'Stop an in-progress pipeline.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pipeline: { type: 'string' },
    },
    required: ['repo_slug', 'pipeline'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const pipeline = requireString(args, 'pipeline');
    return client.request(
      `${basePath(workspace, repo)}/${encodeURIComponent(pipeline)}/stopPipeline`,
      { method: 'POST' },
    );
  },
};

const listSteps: ToolDefinition = {
  name: 'bitbucket_list_pipeline_steps',
  description: 'List steps for a pipeline run.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pipeline: { type: 'string' },
      max_items: { type: 'number' },
    },
    required: ['repo_slug', 'pipeline'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const pipeline = requireString(args, 'pipeline');
    return client.collect(
      `${basePath(workspace, repo)}/${encodeURIComponent(pipeline)}/steps`,
      { maxItems: optNumber(args, 'max_items') ?? 100 },
    );
  },
};

const getStep: ToolDefinition = {
  name: 'bitbucket_get_pipeline_step',
  description: 'Get details on one step of a pipeline.',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pipeline: { type: 'string' },
      step: { type: 'string', description: 'Step UUID.' },
    },
    required: ['repo_slug', 'pipeline', 'step'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const pipeline = requireString(args, 'pipeline');
    const step = requireString(args, 'step');
    return client.request(
      `${basePath(workspace, repo)}/${encodeURIComponent(pipeline)}/steps/${encodeURIComponent(step)}`,
    );
  },
};

const getStepLog: ToolDefinition = {
  name: 'bitbucket_get_pipeline_step_log',
  description:
    'Fetch the raw log output for a pipeline step. Returns plain text (can be very large — prefer `tail_bytes`).',
  inputSchema: {
    type: 'object',
    properties: {
      ...repoInputProps,
      pipeline: { type: 'string' },
      step: { type: 'string' },
      tail_bytes: {
        type: 'number',
        description:
          'If set, returns only the last N bytes (uses HTTP Range). Useful for failure triage.',
      },
    },
    required: ['repo_slug', 'pipeline', 'step'],
    additionalProperties: false,
  },
  handler: async (client, args) => {
    const { workspace, repo } = resolveRepo(client, args);
    const pipeline = requireString(args, 'pipeline');
    const step = requireString(args, 'step');
    const tailBytes = optNumber(args, 'tail_bytes');
    // Bitbucket's step log endpoint supports a Range header. The simplest way
    // to request "last N bytes" is with `Range: bytes=-N`. Since our client
    // doesn't take arbitrary headers yet we express this via a two-step fetch.
    const path = `${basePath(workspace, repo)}/${encodeURIComponent(pipeline)}/steps/${encodeURIComponent(step)}/log`;
    if (tailBytes === undefined) {
      return client.request(path, { raw: true, accept: 'text/plain' });
    }
    const full = await client.request<string>(path, { raw: true, accept: 'text/plain' });
    const bytes = new TextEncoder().encode(full);
    if (bytes.byteLength <= tailBytes) return full;
    return new TextDecoder().decode(bytes.slice(bytes.byteLength - tailBytes));
  },
};

export const pipelineTools: ToolDefinition[] = [
  listPipelines,
  getPipeline,
  triggerPipeline,
  stopPipeline,
  listSteps,
  getStep,
  getStepLog,
];
