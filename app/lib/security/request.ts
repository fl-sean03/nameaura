import { MAX_BODY_BYTES } from "./validate";

export type ReadBodyResult =
  | { ok: true; json: unknown }
  | { ok: false; status: number; message: string; reason: "bad_content_type" | "body_too_large" | "invalid_json" };

/**
 * Read a JSON body while enforcing:
 *  - Content-Type must be application/json (with optional charset)
 *  - Content-Length (when provided) <= MAX_BODY_BYTES
 *  - Raw text length <= MAX_BODY_BYTES (defensive — header can be missing)
 *  - Body must parse as JSON
 */
export async function readJsonBody(req: Request): Promise<ReadBodyResult> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (!ct.startsWith("application/json")) {
    return {
      ok: false,
      status: 400,
      message: "Content-Type must be application/json",
      reason: "bad_content_type",
    };
  }

  const lenHeader = req.headers.get("content-length");
  if (lenHeader) {
    const n = Number.parseInt(lenHeader, 10);
    if (Number.isFinite(n) && n > MAX_BODY_BYTES) {
      return {
        ok: false,
        status: 413,
        message: "Request body too large",
        reason: "body_too_large",
      };
    }
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return {
      ok: false,
      status: 400,
      message: "Could not read request body",
      reason: "invalid_json",
    };
  }
  if (text.length > MAX_BODY_BYTES) {
    return {
      ok: false,
      status: 413,
      message: "Request body too large",
      reason: "body_too_large",
    };
  }

  try {
    return { ok: true, json: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      status: 400,
      message: "Invalid JSON body",
      reason: "invalid_json",
    };
  }
}
