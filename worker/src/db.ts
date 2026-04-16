import type { DonationRow, Env, UserRow } from './types.js';

export async function getUserById(
  env: Env,
  id: string,
): Promise<UserRow | null> {
  const row = await env.DB.prepare(
    'SELECT * FROM users WHERE id = ?',
  )
    .bind(id)
    .first<UserRow>();
  return row ?? null;
}

export async function getUserByAtlassianId(
  env: Env,
  atlassianId: string,
): Promise<UserRow | null> {
  const row = await env.DB.prepare(
    'SELECT * FROM users WHERE atlassian_account_id = ?',
  )
    .bind(atlassianId)
    .first<UserRow>();
  return row ?? null;
}

export async function upsertUser(
  env: Env,
  user: UserRow,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO users (
      id, atlassian_account_id, bitbucket_username, display_name,
      refresh_token_enc, access_token_enc, access_token_expires_at,
      default_workspace, scopes, created_at, last_used_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(atlassian_account_id) DO UPDATE SET
      refresh_token_enc = excluded.refresh_token_enc,
      access_token_enc = excluded.access_token_enc,
      access_token_expires_at = excluded.access_token_expires_at,
      bitbucket_username = excluded.bitbucket_username,
      display_name = excluded.display_name,
      scopes = excluded.scopes,
      last_used_at = excluded.last_used_at`,
  )
    .bind(
      user.id,
      user.atlassian_account_id,
      user.bitbucket_username,
      user.display_name,
      user.refresh_token_enc,
      user.access_token_enc,
      user.access_token_expires_at,
      user.default_workspace,
      user.scopes,
      user.created_at,
      user.last_used_at,
    )
    .run();
}

export async function updateUserTokens(
  env: Env,
  id: string,
  refreshEnc: string,
  accessEnc: string,
  expiresAt: number,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE users SET
       refresh_token_enc = ?,
       access_token_enc = ?,
       access_token_expires_at = ?,
       last_used_at = ?
     WHERE id = ?`,
  )
    .bind(refreshEnc, accessEnc, expiresAt, Math.floor(Date.now() / 1000), id)
    .run();
}

export async function touchUser(env: Env, id: string): Promise<void> {
  await env.DB.prepare('UPDATE users SET last_used_at = ? WHERE id = ?')
    .bind(Math.floor(Date.now() / 1000), id)
    .run();
}

// ─── OAuth state helpers ─────────────────────────────────────────────────

export async function saveOauthState(
  env: Env,
  state: string,
  returnTo?: string,
): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO oauth_states (state, created_at, return_to) VALUES (?, ?, ?)',
  )
    .bind(state, Math.floor(Date.now() / 1000), returnTo ?? null)
    .run();
}

export async function consumeOauthState(
  env: Env,
  state: string,
): Promise<{ valid: boolean; returnTo?: string }> {
  const row = await env.DB.prepare(
    'SELECT created_at, return_to FROM oauth_states WHERE state = ?',
  )
    .bind(state)
    .first<{ created_at: number; return_to: string | null }>();
  if (!row) return { valid: false };
  await env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();
  const age = Math.floor(Date.now() / 1000) - row.created_at;
  if (age > 600) return { valid: false }; // 10 min max
  return { valid: true, returnTo: row.return_to ?? undefined };
}

// ─── Donations ──────────────────────────────────────────────────────────

export async function recordDonation(
  env: Env,
  donation: DonationRow,
): Promise<boolean> {
  try {
    await env.DB.prepare(
      `INSERT INTO donations (
         id, stripe_event_id, amount_cents, currency, project,
         donor_name, donor_message, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        donation.id,
        donation.stripe_event_id,
        donation.amount_cents,
        donation.currency,
        donation.project,
        donation.donor_name,
        donation.donor_message,
        donation.created_at,
      )
      .run();
    return true;
  } catch (err) {
    // UNIQUE constraint on stripe_event_id → idempotent replay, not an error.
    if (String(err).includes('UNIQUE')) return false;
    throw err;
  }
}

export async function donationTotal(
  env: Env,
  project: string,
): Promise<{ total_cents: number; count: number }> {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total_cents, COUNT(*) AS count
     FROM donations WHERE project = ?`,
  )
    .bind(project)
    .first<{ total_cents: number; count: number }>();
  return row ?? { total_cents: 0, count: 0 };
}

export async function recentDonations(
  env: Env,
  project: string,
  limit = 20,
): Promise<Array<Pick<DonationRow, 'amount_cents' | 'currency' | 'donor_name' | 'donor_message' | 'created_at'>>> {
  const r = await env.DB.prepare(
    `SELECT amount_cents, currency, donor_name, donor_message, created_at
     FROM donations WHERE project = ?
     ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(project, limit)
    .all<Pick<DonationRow, 'amount_cents' | 'currency' | 'donor_name' | 'donor_message' | 'created_at'>>();
  return r.results ?? [];
}
