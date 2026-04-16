/** Tool catalog shown on the site. Mirrors the server's registered tools. */

export interface ToolGroup {
  slug: string;
  title: string;
  blurb: string;
  tools: string[];
}

export const toolGroups: ToolGroup[] = [
  {
    slug: 'workspaces',
    title: 'Workspaces & projects',
    blurb: 'Identity, workspace, and project scopes.',
    tools: [
      'bitbucket_current_user',
      'bitbucket_list_workspaces',
      'bitbucket_get_workspace',
      'bitbucket_list_projects',
      'bitbucket_get_project',
    ],
  },
  {
    slug: 'repositories',
    title: 'Repositories & files',
    blurb: 'List repos, browse branches/tags, read files and directories.',
    tools: [
      'bitbucket_list_repositories',
      'bitbucket_get_repository',
      'bitbucket_list_branches',
      'bitbucket_get_branch',
      'bitbucket_list_tags',
      'bitbucket_get_file',
      'bitbucket_list_directory',
      'bitbucket_list_watchers',
      'bitbucket_list_default_reviewers',
      'bitbucket_list_repo_permissions',
    ],
  },
  {
    slug: 'pullrequests',
    title: 'Pull requests',
    blurb: 'Full PR lifecycle — create, review, approve, merge, comment.',
    tools: [
      'bitbucket_list_pull_requests',
      'bitbucket_get_pull_request',
      'bitbucket_create_pull_request',
      'bitbucket_update_pull_request',
      'bitbucket_merge_pull_request',
      'bitbucket_decline_pull_request',
      'bitbucket_approve_pull_request',
      'bitbucket_unapprove_pull_request',
      'bitbucket_request_changes',
      'bitbucket_unrequest_changes',
      'bitbucket_list_pr_comments',
      'bitbucket_add_pr_comment',
      'bitbucket_delete_pr_comment',
      'bitbucket_get_pr_diff',
      'bitbucket_get_pr_diffstat',
      'bitbucket_list_pr_commits',
      'bitbucket_list_pr_activity',
    ],
  },
  {
    slug: 'pipelines',
    title: 'Pipelines (CI)',
    blurb: 'Run, watch, and stop pipelines; fetch step logs for triage.',
    tools: [
      'bitbucket_list_pipelines',
      'bitbucket_get_pipeline',
      'bitbucket_trigger_pipeline',
      'bitbucket_stop_pipeline',
      'bitbucket_list_pipeline_steps',
      'bitbucket_get_pipeline_step',
      'bitbucket_get_pipeline_step_log',
    ],
  },
  {
    slug: 'issues',
    title: 'Issues',
    blurb: 'Repo-level issue tracker — CRUD + comments.',
    tools: [
      'bitbucket_list_issues',
      'bitbucket_get_issue',
      'bitbucket_create_issue',
      'bitbucket_update_issue',
      'bitbucket_list_issue_comments',
      'bitbucket_add_issue_comment',
    ],
  },
  {
    slug: 'commits',
    title: 'Commits',
    blurb: 'Walk history, inspect commits, read diffs and diffstats.',
    tools: [
      'bitbucket_list_commits',
      'bitbucket_get_commit',
      'bitbucket_get_commit_diff',
      'bitbucket_get_commit_diffstat',
    ],
  },
  {
    slug: 'branches',
    title: 'Branches & tags',
    blurb: 'Create or delete branches and tags.',
    tools: [
      'bitbucket_create_branch',
      'bitbucket_delete_branch',
      'bitbucket_create_tag',
      'bitbucket_delete_tag',
    ],
  },
];

export const totalToolCount = toolGroups.reduce(
  (sum, group) => sum + group.tools.length,
  0,
);
