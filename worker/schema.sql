-- ─── Users (OAuth-authorized) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                        TEXT PRIMARY KEY,              -- random UUID we generate; appears in /mcp/u/<id>
  atlassian_account_id      TEXT UNIQUE NOT NULL,          -- from GET /user.account_id
  bitbucket_username        TEXT,
  display_name              TEXT,
  refresh_token_enc         TEXT NOT NULL,                 -- AES-GCM ciphertext, base64
  access_token_enc          TEXT NOT NULL,
  access_token_expires_at   INTEGER NOT NULL,              -- unix seconds
  default_workspace         TEXT,
  scopes                    TEXT NOT NULL,                 -- space-separated
  created_at                INTEGER NOT NULL,
  last_used_at              INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_atlassian
  ON users (atlassian_account_id);

-- ─── OAuth state tokens (short-lived CSRF protection) ───────────────────
CREATE TABLE IF NOT EXISTS oauth_states (
  state        TEXT PRIMARY KEY,
  created_at   INTEGER NOT NULL,
  return_to    TEXT
);

-- ─── Donations (populated by Stripe webhook) ────────────────────────────
CREATE TABLE IF NOT EXISTS donations (
  id                TEXT PRIMARY KEY,
  stripe_event_id   TEXT UNIQUE NOT NULL,
  amount_cents      INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'usd',
  project           TEXT NOT NULL DEFAULT 'bitbucket-mcp',
  donor_name        TEXT,
  donor_message     TEXT,
  created_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_donations_project
  ON donations (project);
CREATE INDEX IF NOT EXISTS idx_donations_created
  ON donations (created_at DESC);
