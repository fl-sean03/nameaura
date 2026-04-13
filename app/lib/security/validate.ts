/**
 * Server-side input validation for /api/generate.
 *
 * All checks are conservative — better to reject a few legitimate but
 * odd inputs than to let through prompt-injection / spam payloads.
 */

export const ALLOWED_STYLES = [
  "any",
  "one-word",
  "two-word",
  "portmanteau",
] as const;
export const ALLOWED_SYLLABLES = ["any", "short", "medium"] as const;

export const MAX_CONCEPT_LEN = 300;
export const MAX_BODY_BYTES = 10 * 1024;

type Style = (typeof ALLOWED_STYLES)[number];
type Syllables = (typeof ALLOWED_SYLLABLES)[number];

export interface GenerateInput {
  concept: string;
  filters: {
    style: Style;
    syllables: Syllables;
  };
  turnstileToken: string | null;
  honeypot: string;
}

export type ValidationError = { ok: false; message: string };
export type ValidationOk = { ok: true; value: GenerateInput };
export type ValidationResult = ValidationOk | ValidationError;

/**
 * Patterns associated with prompt injection or obvious abuse. This is a
 * conservative blocklist, not a complete defense — it's paired with a
 * strict system prompt and a capped max_tokens.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /\[\[\[/,
  /###\s*system\s*:/i,
  /###\s*assistant\s*:/i,
  /ignore\s+(all\s+|the\s+)?(previous|prior|above)\s+(instructions|prompts?|rules?)/i,
  /disregard\s+(all\s+|the\s+)?(previous|prior|above)\s+(instructions|prompts?|rules?)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /jailbreak/i,
  /\bDAN\b\s+mode/i,
  /prompt\s+injection/i,
  /```[a-z]*\s*system/i,
];

function looksInjected(s: string): boolean {
  return INJECTION_PATTERNS.some((r) => r.test(s));
}

/**
 * Flag inputs that are nothing but the same token hammered over and over
 * (classic token-flood abuse). 8+ identical tokens in a row is the cutoff.
 */
function hasRepeatedTokens(s: string): boolean {
  const tokens = s.toLowerCase().match(/[a-z0-9]+/g);
  if (!tokens || tokens.length < 8) return false;
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  const max = Math.max(...counts.values());
  return max >= Math.max(8, Math.floor(tokens.length * 0.6));
}

function isAllowedStyle(v: unknown): v is Style {
  return typeof v === "string" && (ALLOWED_STYLES as readonly string[]).includes(v);
}
function isAllowedSyllables(v: unknown): v is Syllables {
  return (
    typeof v === "string" &&
    (ALLOWED_SYLLABLES as readonly string[]).includes(v)
  );
}

export function validateGenerateBody(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, message: "Request body must be a JSON object" };
  }
  const obj = raw as Record<string, unknown>;

  /* ---- concept ------------------------------------------------------- */
  const conceptRaw = obj.concept;
  if (typeof conceptRaw !== "string") {
    return { ok: false, message: "'concept' must be a string" };
  }
  const concept = conceptRaw.trim();
  if (!concept) {
    return { ok: false, message: "'concept' must not be empty" };
  }
  if (concept.length > MAX_CONCEPT_LEN) {
    return {
      ok: false,
      message: `'concept' must be ${MAX_CONCEPT_LEN} characters or fewer`,
    };
  }
  if (looksInjected(concept)) {
    return { ok: false, message: "'concept' contains disallowed content" };
  }
  if (hasRepeatedTokens(concept)) {
    return { ok: false, message: "'concept' contains repeated tokens" };
  }

  /* ---- filters ------------------------------------------------------- */
  const filtersRaw = (obj.filters && typeof obj.filters === "object"
    ? obj.filters
    : {}) as Record<string, unknown>;

  const styleRaw = filtersRaw.style ?? "any";
  if (!isAllowedStyle(styleRaw)) {
    return { ok: false, message: "Invalid 'filters.style'" };
  }

  const syllablesRaw = filtersRaw.syllables ?? "any";
  if (!isAllowedSyllables(syllablesRaw)) {
    return { ok: false, message: "Invalid 'filters.syllables'" };
  }

  /* ---- turnstile + honeypot ----------------------------------------- */
  const turnstileToken =
    typeof obj.turnstileToken === "string" && obj.turnstileToken
      ? obj.turnstileToken
      : null;

  const honeypot = typeof obj.website === "string" ? obj.website : "";

  return {
    ok: true,
    value: {
      concept,
      filters: { style: styleRaw, syllables: syllablesRaw },
      turnstileToken,
      honeypot,
    },
  };
}
