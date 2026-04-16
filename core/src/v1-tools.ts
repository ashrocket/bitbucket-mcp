import type { ToolDefinition } from './tool-kit.js';
import { allTools } from './tools/index.js';

/**
 * The 20-tool v1 surface exposed by the hosted MCP. The full set is available
 * via the stdio server for power users.
 *
 * Criteria: daily-use operations for PR review, CI babysitting, and repo
 * triage. Issues (most shops use Jira), workspace/project admin, and
 * tag/branch lifecycle are deferred to v1.1.
 */
export const V1_TOOL_NAMES: readonly string[] = [
  // Auth sanity
  'bitbucket_current_user',
  // Repos & files
  'bitbucket_list_repositories',
  'bitbucket_list_branches',
  'bitbucket_get_file',
  // PRs — read
  'bitbucket_list_pull_requests',
  'bitbucket_get_pull_request',
  'bitbucket_get_pr_diff',
  'bitbucket_get_pr_diffstat',
  'bitbucket_list_pr_comments',
  'bitbucket_list_pr_activity',
  // PRs — write
  'bitbucket_create_pull_request',
  'bitbucket_add_pr_comment',
  'bitbucket_approve_pull_request',
  'bitbucket_merge_pull_request',
  // Pipelines
  'bitbucket_list_pipelines',
  'bitbucket_get_pipeline',
  'bitbucket_get_pipeline_step_log',
  'bitbucket_trigger_pipeline',
  // Commits
  'bitbucket_list_commits',
  'bitbucket_get_commit_diff',
] as const;

export const v1Tools: ToolDefinition[] = allTools.filter((t) =>
  V1_TOOL_NAMES.includes(t.name),
);

if (v1Tools.length !== V1_TOOL_NAMES.length) {
  const missing = V1_TOOL_NAMES.filter(
    (name) => !v1Tools.some((t) => t.name === name),
  );
  throw new Error(
    `v1-tools: ${missing.length} named tool(s) not found in allTools: ${missing.join(', ')}`,
  );
}
