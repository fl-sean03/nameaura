import { createHash } from "node:crypto";
import { ipHashSalt } from "./env";

/**
 * Extract the best-guess client IP from a request.
 *
 * Vercel always sets `x-forwarded-for`; we take the first entry (the
 * original client). Fall back to `x-real-ip`, then a fixed placeholder
 * so the rate limiter has SOMETHING to key on.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "0.0.0.0";
}

/**
 * sha256(ip + salt) truncated — safe to log, not reversible without the salt.
 */
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(ip + ipHashSalt())
    .digest("hex")
    .slice(0, 16);
}
