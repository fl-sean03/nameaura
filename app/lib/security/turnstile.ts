import { turnstileEnv } from "./env";

const VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  ok: boolean;
  /** `"disabled"` when env vars aren't set (dev fallback). */
  reason?: string;
}

/**
 * Verify a Turnstile token server-side.
 *
 * If the env vars aren't set, we treat the captcha as disabled — this is
 * the dev fallback. A warning is logged from `turnstileEnv()` the first
 * time it's read.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip: string
): Promise<TurnstileResult> {
  const env = turnstileEnv();
  if (!env.configured) {
    return { ok: true, reason: "disabled" };
  }
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "missing_token" };
  }

  const body = new URLSearchParams();
  body.set("secret", env.secretKey!);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      // Short timeout so we don't hang the serverless function if CF is down.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, reason: `cf_http_${res.status}` };
    }
    const json = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (json.success) return { ok: true };
    const codes = (json["error-codes"] || []).join(",") || "unknown";
    return { ok: false, reason: `cf_${codes}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { ok: false, reason: `verify_error:${message}` };
  }
}
