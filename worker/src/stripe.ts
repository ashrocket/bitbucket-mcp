import { hmacSha256Hex, randomId, timingSafeEqual } from './crypto.js';
import {
  donationTotal,
  recentDonations,
  recordDonation,
} from './db.js';
import type { Env } from './types.js';

/**
 * POST /api/stripe-webhook — verify HMAC signature, then handle
 * `checkout.session.completed` events (and `charge.succeeded` as a fallback
 * for non-Checkout donations). Other events are acknowledged and ignored.
 */
export async function stripeWebhook(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response('Webhook not configured', { status: 503 });
  }
  const sigHeader = request.headers.get('Stripe-Signature');
  if (!sigHeader) return new Response('Missing signature', { status: 400 });

  const body = await request.text();
  const parsed = parseStripeSignature(sigHeader);
  if (!parsed) return new Response('Malformed signature', { status: 400 });

  const signedPayload = `${parsed.timestamp}.${body}`;
  const expected = await hmacSha256Hex(secret, signedPayload);
  const matched = parsed.signatures.some((s) => timingSafeEqual(s, expected));
  if (!matched) return new Response('Invalid signature', { status: 400 });

  // 5-minute tolerance window (Stripe's default)
  const age = Math.floor(Date.now() / 1000) - parsed.timestamp;
  if (age > 300) return new Response('Timestamp out of tolerance', { status: 400 });

  let event: StripeEvent;
  try {
    event = JSON.parse(body) as StripeEvent;
  } catch {
    return new Response('Invalid event JSON', { status: 400 });
  }

  const stored = await storeDonationFromEvent(env, event);
  return new Response(
    JSON.stringify({ received: true, stored }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}

/** GET /api/total?project=bitbucket-mcp — public running total for the widget. */
export async function apiTotal(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const project = url.searchParams.get('project') ?? 'bitbucket-mcp';
  const { total_cents, count } = await donationTotal(env, project);
  return new Response(
    JSON.stringify({
      project,
      total_cents,
      total_usd: (total_cents / 100).toFixed(2),
      count,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': env.PUBLIC_SITE_URL,
      },
    },
  );
}

/** GET /api/recent?project=bitbucket-mcp&limit=20 — public transparency feed. */
export async function apiRecent(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const project = url.searchParams.get('project') ?? 'bitbucket-mcp';
  const limitRaw = Number(url.searchParams.get('limit') ?? '20');
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), 100)
    : 20;
  const rows = await recentDonations(env, project, limit);
  return new Response(
    JSON.stringify({
      project,
      donations: rows.map((r) => ({
        amount_cents: r.amount_cents,
        amount_usd: (r.amount_cents / 100).toFixed(2),
        currency: r.currency,
        donor_name: r.donor_name,
        donor_message: r.donor_message,
        created_at: r.created_at,
      })),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': env.PUBLIC_SITE_URL,
      },
    },
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

interface StripeEvent {
  id: string;
  type: string;
  data: { object: StripeCheckoutSession | StripeCharge };
}
interface StripeCheckoutSession {
  id: string;
  object: 'checkout.session';
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, string> | null;
  customer_details: { name?: string | null; email?: string | null } | null;
  custom_fields?: Array<{ key: string; text?: { value?: string } }>;
}
interface StripeCharge {
  id: string;
  object: 'charge';
  amount: number;
  currency: string;
  metadata: Record<string, string> | null;
  billing_details: { name?: string | null } | null;
}

async function storeDonationFromEvent(
  env: Env,
  event: StripeEvent,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as StripeCheckoutSession;
    if (!s.amount_total) return false;
    const message = s.custom_fields?.find((f) => f.key === 'message')?.text?.value;
    return recordDonation(env, {
      id: randomId(),
      stripe_event_id: event.id,
      amount_cents: s.amount_total,
      currency: s.currency ?? 'usd',
      project: s.metadata?.project ?? 'bitbucket-mcp',
      donor_name: s.customer_details?.name ?? null,
      donor_message: message ?? null,
      created_at: now,
    });
  }
  if (event.type === 'charge.succeeded') {
    const c = event.data.object as StripeCharge;
    // Only record if it carries our project metadata — avoids capturing
    // unrelated charges if this Stripe account is shared with other flows.
    if (!c.metadata?.project) return false;
    return recordDonation(env, {
      id: randomId(),
      stripe_event_id: event.id,
      amount_cents: c.amount,
      currency: c.currency,
      project: c.metadata.project,
      donor_name: c.billing_details?.name ?? null,
      donor_message: null,
      created_at: now,
    });
  }
  return false;
}

interface StripeSigHeader {
  timestamp: number;
  signatures: string[];
}

function parseStripeSignature(header: string): StripeSigHeader | null {
  const parts = header.split(',').map((p) => p.trim());
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === 't') {
      const t = Number(value);
      if (Number.isFinite(t)) timestamp = t;
    } else if (key === 'v1') {
      signatures.push(value);
    }
  }
  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}
