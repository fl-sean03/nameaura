import { hashIp } from "./ip";

export type AbuseReason =
  | "bad_origin"
  | "bad_content_type"
  | "body_too_large"
  | "invalid_json"
  | "validation_failed"
  | "honeypot_tripped"
  | "captcha_failed"
  | "captcha_missing"
  | "rate_limited"
  | "daily_limit"
  | "oversized_response"
  | "upstream_error";

/**
 * Single-line structured log of a rejected request. We deliberately avoid
 * adding an SDK — Vercel captures stdout/stderr automatically.
 */
export function logAbuse(params: {
  route: string;
  status: number;
  reason: AbuseReason;
  ip: string;
  extra?: Record<string, unknown>;
}): void {
  const { route, status, reason, ip, extra } = params;
  const payload = {
    t: new Date().toISOString(),
    kind: "abuse",
    route,
    status,
    reason,
    ipHash: hashIp(ip),
    ...(extra || {}),
  };
   
  console.warn(`[abuse] ${JSON.stringify(payload)}`);
}
