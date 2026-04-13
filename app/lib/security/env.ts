/**
 * Env helpers for optional security features.
 *
 * The philosophy: the app should still boot and run in a dev environment
 * even if Turnstile / Upstash env vars aren't configured. In production on
 * Vercel, all of these SHOULD be set — we log prominent warnings when they
 * aren't so it's obvious in the logs.
 */

let warnedTurnstile = false;
let warnedRateLimit = false;

export function turnstileEnv(): {
  siteKey: string | null;
  secretKey: string | null;
  configured: boolean;
} {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
  const secretKey = process.env.TURNSTILE_SECRET_KEY || null;
  const configured = !!siteKey && !!secretKey;
  if (!configured && !warnedTurnstile) {
     
    console.warn(
      "[security] Turnstile env vars missing — captcha verification is DISABLED. " +
        "Set NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY for production."
    );
    warnedTurnstile = true;
  }
  return { siteKey, secretKey, configured };
}

export function upstashEnv(): {
  url: string | null;
  token: string | null;
  configured: boolean;
} {
  const url = process.env.UPSTASH_REDIS_REST_URL || null;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || null;
  const configured = !!url && !!token;
  if (!configured && !warnedRateLimit) {
     
    console.warn(
      "[security] Upstash env vars missing — falling back to IN-MEMORY rate limiter " +
        "(per-instance, not durable across serverless invocations). Set " +
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production."
    );
    warnedRateLimit = true;
  }
  return { url, token, configured };
}

export function dailyGenerationLimit(): number {
  const raw = process.env.DAILY_GENERATION_LIMIT;
  if (!raw) return 200;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 200;
  return n;
}

export function ipHashSalt(): string {
  // Not strictly secret — prevents trivial rainbow tables for IP logs.
  return process.env.IP_HASH_SALT || "nameaura-default-salt-v1";
}
