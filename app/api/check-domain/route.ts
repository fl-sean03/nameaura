import { NextResponse } from "next/server";
import { promises as dns } from "node:dns";
import { XMLParser } from "fast-xml-parser";
import { getClientIp } from "../../lib/security/ip";
import { logAbuse } from "../../lib/security/log";
import { isOriginAllowed } from "../../lib/security/origin";
import { limitCheckDomain } from "../../lib/security/ratelimit";
import { readJsonBody } from "../../lib/security/request";

export const runtime = "nodejs";

/**
 * Availability check endpoint.
 *
 * Primary path: Namecheap's `namecheap.domains.check` XML API. Requires
 * NAMECHEAP_API_USER / NAMECHEAP_API_KEY / NAMECHEAP_USERNAME /
 * NAMECHEAP_CLIENT_IP and the Vercel egress IP whitelisted in Namecheap's
 * API settings.
 *
 * Fallback: DNS A-record heuristic. Runs when Namecheap env vars are absent
 * (dev) OR when Namecheap returns an error we can't classify. The heuristic
 * has false-positives on parked domains and is logged as such.
 *
 * Responses are cached per-domain in-memory for 60s so shortlist re-renders
 * don't hammer the upstream.
 */

const ALLOWED_TLDS = new Set<string>([
  ".com",
  ".ai",
  ".io",
  ".co",
  ".xyz",
  ".app",
]);
const MAX_TLDS_PER_REQUEST = ALLOWED_TLDS.size;

type Status = "available" | "taken" | "error";

interface Body {
  name?: string;
  tlds?: unknown;
}

interface PerTldResult {
  tld: string;
  status: Status;
}

function isValidLabel(label: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
}

/* ------------------------------------------------------------------ */
/* 60-second in-memory cache                                          */
/* ------------------------------------------------------------------ */

interface CacheEntry {
  status: Status;
  expires: number;
}
const CACHE_TTL_MS = 60_000;
const cache: Map<string, CacheEntry> = new Map();

function cacheGet(domain: string): Status | null {
  const hit = cache.get(domain);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(domain);
    return null;
  }
  return hit.status;
}

function cachePut(domain: string, status: Status) {
  // Don't cache transient errors — we want the next call to retry quickly.
  if (status === "error") return;
  cache.set(domain, { status, expires: Date.now() + CACHE_TTL_MS });
}

/* ------------------------------------------------------------------ */
/* Namecheap                                                          */
/* ------------------------------------------------------------------ */

interface NamecheapEnv {
  apiUser: string;
  apiKey: string;
  userName: string;
  clientIp: string;
}

let warnedMissingNamecheap = false;

function readNamecheapEnv(): NamecheapEnv | null {
  const apiUser = process.env.NAMECHEAP_API_USER;
  const apiKey = process.env.NAMECHEAP_API_KEY;
  const userName = process.env.NAMECHEAP_USERNAME;
  const clientIp = process.env.NAMECHEAP_CLIENT_IP;
  if (!apiUser || !apiKey || !userName || !clientIp) {
    if (!warnedMissingNamecheap) {
       
      console.warn(
        "[check-domain] Namecheap env vars missing — falling back to DNS heuristic. " +
          "Set NAMECHEAP_API_USER, NAMECHEAP_API_KEY, NAMECHEAP_USERNAME, " +
          "NAMECHEAP_CLIENT_IP and whitelist that IP at Namecheap's API settings."
      );
      warnedMissingNamecheap = true;
    }
    return null;
  }
  return { apiUser, apiKey, userName, clientIp };
}

interface NamecheapParsed {
  ApiResponse?: {
    "@_Status"?: string;
    Errors?: { Error?: unknown };
    CommandResponse?: {
      DomainCheckResult?:
        | Array<{
            "@_Domain"?: string;
            "@_Available"?: string;
          }>
        | {
            "@_Domain"?: string;
            "@_Available"?: string;
          };
    };
  };
}

async function checkViaNamecheap(
  env: NamecheapEnv,
  domains: string[]
): Promise<Map<string, Status>> {
  const params = new URLSearchParams({
    ApiUser: env.apiUser,
    ApiKey: env.apiKey,
    UserName: env.userName,
    ClientIp: env.clientIp,
    Command: "namecheap.domains.check",
    DomainList: domains.join(","),
  });
  const url = `https://api.namecheap.com/xml.response?${params.toString()}`;

  const results = new Map<string, Status>();
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
       
      console.warn(
        `[check-domain] Namecheap HTTP ${res.status} — marking batch as error`
      );
      for (const d of domains) results.set(d, "error");
      return results;
    }
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml) as NamecheapParsed;

    const status = parsed.ApiResponse?.["@_Status"];
    const rawResults = parsed.ApiResponse?.CommandResponse?.DomainCheckResult;

    if (status !== "OK" || rawResults == null) {
       
      console.warn(
        "[check-domain] Namecheap API returned non-OK: " +
          JSON.stringify(parsed.ApiResponse?.Errors || {})
      );
      for (const d of domains) results.set(d, "error");
      return results;
    }

    const arr = Array.isArray(rawResults) ? rawResults : [rawResults];
    for (const item of arr) {
      const domain = (item["@_Domain"] || "").toLowerCase();
      const availableRaw = (item["@_Available"] || "").toLowerCase();
      if (!domain) continue;
      if (availableRaw === "true") results.set(domain, "available");
      else if (availableRaw === "false") results.set(domain, "taken");
      else results.set(domain, "error");
    }
    // Anything we asked about but didn't get a row for -> error
    for (const d of domains) {
      if (!results.has(d)) results.set(d, "error");
    }
    return results;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
     
    console.warn(`[check-domain] Namecheap fetch failed: ${message}`);
    for (const d of domains) results.set(d, "error");
    return results;
  }
}

/* ------------------------------------------------------------------ */
/* DNS heuristic fallback                                             */
/* ------------------------------------------------------------------ */

async function checkViaDns(domains: string[]): Promise<Map<string, Status>> {
  const results = new Map<string, Status>();
  await Promise.all(
    domains.map(async (d) => {
      try {
        await dns.resolve4(d);
        results.set(d, "taken");
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOTFOUND" || code === "ENODATA") {
          results.set(d, "available");
        } else {
          results.set(d, "error");
        }
      }
    })
  );
  return results;
}

/* ------------------------------------------------------------------ */
/* Handler                                                            */
/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  const ip = getClientIp(req);

  /* Origin check ------------------------------------------------------- */
  const origin = req.headers.get("origin");
  if (!isOriginAllowed(origin)) {
    logAbuse({
      route: "/api/check-domain",
      status: 403,
      reason: "bad_origin",
      ip,
      extra: { origin: origin || "(none)" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  /* Body read + content-type/size checks ------------------------------ */
  const read = await readJsonBody(req);
  if (!read.ok) {
    logAbuse({
      route: "/api/check-domain",
      status: read.status,
      reason: read.reason,
      ip,
    });
    return NextResponse.json({ error: read.message }, { status: read.status });
  }

  const body = (read.json as Body) || {};
  const name = (typeof body.name === "string" ? body.name : "")
    .trim()
    .toLowerCase();

  if (!name || name.length > 63 || !isValidLabel(name)) {
    logAbuse({
      route: "/api/check-domain",
      status: 400,
      reason: "validation_failed",
      ip,
      extra: { field: "name" },
    });
    return NextResponse.json(
      { error: "Invalid or missing 'name' (must be a DNS label)" },
      { status: 400 }
    );
  }

  const rawTlds = Array.isArray(body.tlds) ? body.tlds : [];
  const tlds = Array.from(
    new Set(
      rawTlds
        .map((t) => (typeof t === "string" ? t.trim().toLowerCase() : ""))
        .filter((t) => ALLOWED_TLDS.has(t))
    )
  );

  if (tlds.length === 0 || tlds.length > MAX_TLDS_PER_REQUEST) {
    logAbuse({
      route: "/api/check-domain",
      status: 400,
      reason: "validation_failed",
      ip,
      extra: { field: "tlds" },
    });
    return NextResponse.json(
      {
        error:
          "'tlds' must be a non-empty subset of .com/.ai/.io/.co/.xyz/.app",
      },
      { status: 400 }
    );
  }

  /* Rate limit (post-validation so we don't count garbage) ------------ */
  const limit = await limitCheckDomain(ip);
  if (!limit.success) {
    logAbuse({
      route: "/api/check-domain",
      status: 429,
      reason: "rate_limited",
      ip,
    });
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again soon." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter) },
      }
    );
  }

  /* Resolve via cache + Namecheap (or DNS fallback) ------------------- */
  const domains = tlds.map((tld) => ({ tld, fqdn: `${name}${tld}` }));
  const resultsByTld = new Map<string, Status>();
  const toQuery: string[] = [];
  for (const { tld, fqdn } of domains) {
    const cached = cacheGet(fqdn);
    if (cached) {
      resultsByTld.set(tld, cached);
    } else {
      toQuery.push(fqdn);
    }
  }

  if (toQuery.length > 0) {
    const env = readNamecheapEnv();
    // Namecheap's DomainList supports up to 50 — we only ever send <=6.
    const fresh = env
      ? await checkViaNamecheap(env, toQuery)
      : await checkViaDns(toQuery);

    for (const { tld, fqdn } of domains) {
      if (resultsByTld.has(tld)) continue;
      const status = fresh.get(fqdn) ?? "error";
      resultsByTld.set(tld, status);
      cachePut(fqdn, status);
    }
  }

  const results: PerTldResult[] = tlds.map((tld) => ({
    tld,
    status: resultsByTld.get(tld) ?? "error",
  }));

  return NextResponse.json({ results });
}
