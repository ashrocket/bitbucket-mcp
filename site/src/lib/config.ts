/**
 * Central config — pulls PUBLIC_ env vars at build time with sensible fallbacks
 * so the site renders even without a .env.
 */

export const config = {
  siteName: 'Bitbucket MCP',
  tagline: 'Bitbucket, from Claude. Free, open source, donation-supported.',

  /** Cloudflare Worker URL — serves /api/total and /api/recent. */
  workerUrl:
    import.meta.env.PUBLIC_WORKER_URL ??
    'https://bitbucket-mcp-api.ashrocket.workers.dev',

  /** Stripe Payment Link — set once the account exists. */
  donationUrl:
    import.meta.env.PUBLIC_DONATION_URL ??
    'https://donate.stripe.com/placeholder-replace-me',

  githubRepo:
    import.meta.env.PUBLIC_GITHUB_REPO ??
    'https://github.com/ashrocket/bitbucket-mcp',

  npmPackage: '@ashrocket/bitbucket-mcp',

  author: {
    name: 'Ashley Raiteri',
    handle: 'ashrocket',
    url: 'https://ashley.raiteri.net',
  },
} as const;

/** Ads — shown in rotating/grid carousel. Atlassian first (they deserve love too). */
export const adSlots = [
  {
    sponsor: 'Bitbucket',
    tagline: 'The source-control half of Atlassian. Free for 5 users, unlimited repos.',
    cta: 'Start free',
    url: 'https://www.atlassian.com/software/bitbucket',
    accent: '#0052CC',
    note: 'Atlassian — first-party',
  },
  {
    sponsor: 'GitLab',
    tagline: 'Git + CI + security scanning + registries in one platform.',
    cta: 'Explore GitLab',
    url: 'https://about.gitlab.com/',
    accent: '#FC6D26',
    note: 'Affiliate link where available',
  },
  {
    sponsor: 'GitHub',
    tagline: 'The one everyone knows. Actions, Copilot, Codespaces.',
    cta: 'Visit GitHub',
    url: 'https://github.com/',
    accent: '#24292F',
    note: 'No affiliate — plain link',
  },
  {
    sponsor: 'Codeberg',
    tagline: 'Non-profit, community-run Gitea host. Privacy-first.',
    cta: 'Try Codeberg',
    url: 'https://codeberg.org/',
    accent: '#2185D0',
    note: 'Non-profit — consider donating to them too',
  },
  {
    sponsor: 'Gitea',
    tagline: 'Self-hosted Git service. Lightweight, Go binary, runs anywhere.',
    cta: 'Self-host',
    url: 'https://about.gitea.com/',
    accent: '#609926',
    note: 'Open source',
  },
  {
    sponsor: 'Forgejo',
    tagline: 'Community-driven Gitea fork under the Codeberg umbrella.',
    cta: 'Learn more',
    url: 'https://forgejo.org/',
    accent: '#FB923C',
    note: 'Copyleft fork',
  },
] as const;

export type AdSlot = (typeof adSlots)[number];
