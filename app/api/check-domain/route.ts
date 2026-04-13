import { NextResponse } from "next/server";
import { promises as dns } from "node:dns";

export const runtime = "nodejs";

interface Body {
  name?: string;
  tld?: string;
}

const ALLOWED_TLDS = new Set([".com", ".co", ".io", ".ai"]);

function isValidLabel(label: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
}

/**
 * Heuristic domain availability check via DNS A-record lookup.
 *
 * NOTE: This is NOT a real registration check. A registered domain can
 * resolve to nothing (parked, no A record) and will be reported here as
 * "available". For ground truth you need a registrar WHOIS/RDAP API
 * (Namecheap, GoDaddy, RDAP). TODO in README.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name || "").trim().toLowerCase();
  const tld = (body.tld || "").trim().toLowerCase();

  if (!name || !isValidLabel(name)) {
    return NextResponse.json(
      { error: "Invalid or missing 'name' (must be a DNS label)" },
      { status: 400 }
    );
  }
  if (!ALLOWED_TLDS.has(tld)) {
    return NextResponse.json(
      { error: "Unsupported TLD" },
      { status: 400 }
    );
  }

  const fqdn = `${name}${tld}`;

  try {
    // resolve4 throws ENOTFOUND / ENODATA on no A record.
    await dns.resolve4(fqdn);
    return NextResponse.json({ domain: fqdn, status: "taken" });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      return NextResponse.json({ domain: fqdn, status: "available" });
    }
    if (code === "ETIMEOUT" || code === "ESERVFAIL") {
      return NextResponse.json(
        { domain: fqdn, status: "error", reason: code },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { domain: fqdn, status: "error", reason: code ?? "unknown" },
      { status: 200 }
    );
  }
}
