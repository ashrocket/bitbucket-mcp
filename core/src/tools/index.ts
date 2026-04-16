import type { ToolDefinition } from '../tool-kit.js';
import { branchTools } from './branches.js';
import { commitTools } from './commits.js';
import { issueTools } from './issues.js';
import { pipelineTools } from './pipelines.js';
import { pullRequestTools } from './pullrequests.js';
import { repositoryTools } from './repositories.js';
import { workspaceTools } from './workspaces.js';

export const allTools: ToolDefinition[] = [
  ...workspaceTools,
  ...repositoryTools,
  ...pullRequestTools,
  ...pipelineTools,
  ...issueTools,
  ...commitTools,
  ...branchTools,
];
