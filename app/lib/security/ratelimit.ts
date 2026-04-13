import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { upstashEnv } from "./env";

export interface LimitResult {
  success: boolean;
  /** Seconds until the client may retry. */
  retryAfter: number;
  /** Best-guess remaining allowance (may be 0 when limited). */
  remaining: number;
}

/* ------------------------------------------------------------------ */
/* Upstash-backed limiter                                             */
/* ------------------------------------------------------------------ */

let cachedRedis: Redis | null = null;
function getRedis(): Redis | null {
  const env = upstashEnv();
  if (!env.configured) return null;
  if (cachedRedis) return cachedRedis;
  cachedRedis = new Redis({ url: env.url!, token: env.token! });
  return cachedRedis;
}

let cachedGenerate: Ratelimit | null = null;
let cachedCheckDomain: Ratelimit | null = null;

function generateLimiter(): Ratelimit | null {
  if (cachedGenerate) return cachedGenerate;
  const redis = getRedis();
  if (!redis) return null;
  cachedGenerate = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "10 m"),
    analytics: false,
    prefix: "nameaura:rl:generate",
  });
  return cachedGenerate;
}

function checkDomainLimiter(): Ratelimit | null {
  if (cachedCheckDomain) return cachedCheckDomain;
  const redis = getRedis();
  if (!redis) return null;
  cachedCheckDomain = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    analytics: false,
    prefix: "nameaura:rl:checkdomain",
  });
  return cachedCheckDomain;
}

/* ------------------------------------------------------------------ */
/* In-memory fallback (sliding-ish window via timestamp array)        */
/* ------------------------------------------------------------------ */

interface Bucket {
  hits: number[]; // ms epoch timestamps
}

const memStore: Map<string, Bucket> = new Map();

function memoryLimit(
  key: string,
  max: number,
  windowMs: number
): LimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = memStore.get(key) || { hits: [] };
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= max) {
    const earliest = bucket.hits[0];
    const retryAfter = Math.max(1, Math.ceil((earliest + windowMs - now) / 1000));
    memStore.set(key, bucket);
    return { success: false, retryAfter, remaining: 0 };
  }

  bucket.hits.push(now);
  memStore.set(key, bucket);
  return {
    success: true,
    retryAfter: 0,
    remaining: Math.max(0, max - bucket.hits.length),
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

async function applyLimiter(
  limiter: Ratelimit | null,
  key: string,
  memMax: number,
  memWindowMs: number
): Promise<LimitResult> {
  if (limiter) {
    const r = await limiter.limit(key);
    const retryAfter = r.success
      ? 0
      : Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
    return {
      success: r.success,
      retryAfter,
      remaining: Math.max(0, r.remaining),
    };
  }
  return memoryLimit(key, memMax, memWindowMs);
}

export async function limitGenerate(ip: string): Promise<LimitResult> {
  return applyLimiter(generateLimiter(), `ip:${ip}`, 5, 10 * 60 * 1000);
}

export async function limitCheckDomain(ip: string): Promise<LimitResult> {
  return applyLimiter(checkDomainLimiter(), `ip:${ip}`, 60, 60 * 1000);
}

/* ------------------------------------------------------------------ */
/* Daily global budget                                                */
/* ------------------------------------------------------------------ */

interface DailyResult {
  count: number;
  limit: number;
  exceeded: boolean;
}

const memDaily: { day: string; count: number } = { day: "", count: 0 };

function utcDayKey(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

/**
 * Peek at the daily counter. Does NOT increment. Use before the expensive
 * call so we can 503 instead of spending budget.
 */
export async function peekDailyBudget(limit: number): Promise<DailyResult> {
  const day = utcDayKey();
  const redis = getRedis();
  if (redis) {
    const key = `nameaura:daily:${day}`;
    const current = (await redis.get<number>(key)) || 0;
    return { count: current, limit, exceeded: current >= limit };
  }
  if (memDaily.day !== day) {
    memDaily.day = day;
    memDaily.count = 0;
  }
  return {
    count: memDaily.count,
    limit,
    exceeded: memDaily.count >= limit,
  };
}

/**
 * Increment the daily counter AFTER a successful, billable call.
 * Sets a TTL of 48h on first write so the key self-cleans.
 */
export async function bumpDailyBudget(): Promise<void> {
  const day = utcDayKey();
  const redis = getRedis();
  if (redis) {
    const key = `nameaura:daily:${day}`;
    const next = await redis.incr(key);
    // Only set expiry on first increment to avoid resetting the TTL.
    if (next === 1) {
      await redis.expire(key, 60 * 60 * 48);
    }
    return;
  }
  if (memDaily.day !== day) {
    memDaily.day = day;
    memDaily.count = 0;
  }
  memDaily.count += 1;
}
