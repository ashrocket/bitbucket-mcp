export interface Env {
  DB: D1Database;

  // Public vars (wrangler.toml → [vars])
  PUBLIC_SITE_URL: string;
  OAUTH_CALLBACK_URL: string;
  OAUTH_SCOPES: string;

  // Secrets (wrangler secret put)
  BITBUCKET_OAUTH_CLIENT_ID?: string;
  BITBUCKET_OAUTH_CLIENT_SECRET?: string;
  ENCRYPTION_KEY_HEX?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_RESTRICTED_KEY?: string;
}

export interface UserRow {
  id: string;
  atlassian_account_id: string;
  bitbucket_username: string | null;
  display_name: string | null;
  refresh_token_enc: string;
  access_token_enc: string;
  access_token_expires_at: number;
  default_workspace: string | null;
  scopes: string;
  created_at: number;
  last_used_at: number;
}

export interface DonationRow {
  id: string;
  stripe_event_id: string;
  amount_cents: number;
  currency: string;
  project: string;
  donor_name: string | null;
  donor_message: string | null;
  created_at: number;
}
