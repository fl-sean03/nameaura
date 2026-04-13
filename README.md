# NameAura

> **Rebuilt from a single screenshot.** The original NameAura app was deployed on
> Vercel and later deleted. No source was preserved. This repo is a from-zero
> reconstruction based on one surviving screenshot, so the internals don't match
> whatever the original was — only the look, feel, and stated purpose do.

AI-powered brand name ideation for new ventures. Describe your concept, pick a
few preferences, and get up to 12 brandable name candidates back with rationale.
Every name is checked against six TLDs (`.com .ai .io .co .xyz .app`) and each
available domain links straight to the Namecheap checkout.

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS v4
- [`lucide-react`](https://lucide.dev) icons
- [Vercel AI SDK](https://sdk.vercel.ai) (`ai` + `@ai-sdk/anthropic`) calling
  Claude Sonnet 4.5 via `generateObject` with a Zod schema
- [Namecheap domains API](https://www.namecheap.com/support/api/methods/domains/check/)
  for real availability checks, parsed with `fast-xml-parser`
- DNS fallback (`dns.promises.resolve4`) when Namecheap creds aren't set
- No database, no auth — shortlist is saved to `localStorage`

## Features

- Single-page app with a clean, light gradient aesthetic
- Textarea for a business concept (up to 300 chars)
- **Advanced Filters**: name style (one-word / two-word / portmanteau / any)
  and syllable count. TLDs are fixed defaults and not user-selectable.
- `POST /api/generate` — asks Claude for up to 12 candidate names + rationales
- `POST /api/check-domain` — batched Namecheap lookup for all six TLDs at once,
  with a 60s per-domain in-memory cache
- Results render as **one card per name** with six colored availability pills
  (green = available, red = taken, gray spinning = checking, yellow = error).
  Click a green pill to jump to Namecheap's add-to-cart URL.
- "My Shortlist" side drawer persisted in `localStorage`
- Skeleton loading state while generating

## Setup

Requires Node 20.9+ (Next 16 minimum). This repo was developed on Node 22.

```bash
npm install
cp .env.example .env.local
# edit .env.local and paste your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable                          | Required? | Purpose                                                                 |
|-----------------------------------|-----------|-------------------------------------------------------------------------|
| `ANTHROPIC_API_KEY`               | **yes**   | Server-side Claude API key for `/api/generate`                          |
| `NAMECHEAP_API_USER`              | prod      | Namecheap API username (usually same as account login)                  |
| `NAMECHEAP_API_KEY`               | prod      | Namecheap API key                                                       |
| `NAMECHEAP_USERNAME`              | prod      | Namecheap account username                                              |
| `NAMECHEAP_CLIENT_IP`             | prod      | Outbound IP the API call comes from (must match whitelist in Namecheap) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`  | prod      | Cloudflare Turnstile site key (browser-safe)                            |
| `TURNSTILE_SECRET_KEY`            | prod      | Cloudflare Turnstile secret key (server-only)                           |
| `UPSTASH_REDIS_REST_URL`          | prod      | Upstash Redis REST URL for rate limiting + daily budget                 |
| `UPSTASH_REDIS_REST_TOKEN`        | prod      | Upstash Redis REST token                                                |
| `DAILY_GENERATION_LIMIT`          | no        | Global daily cap on `/api/generate` successes (UTC day). Default `200`. |
| `IP_HASH_SALT`                    | no        | Salt mixed into IP hashes in abuse logs                                 |

Only `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is exposed to the browser. Every other
key is read server-side in the route handler.

#### Getting Namecheap API access

The availability check uses Namecheap's
[`namecheap.domains.check`](https://www.namecheap.com/support/api/methods/domains/check/)
endpoint. To use it:

1. Be a Namecheap customer (any active account).
2. Enable API access at
   [https://ap.www.namecheap.com/settings/tools/apiaccess/](https://ap.www.namecheap.com/settings/tools/apiaccess/).
3. Grab your `ApiUser` and `ApiKey` from that page.
4. **Whitelist the IP your server calls from.** Namecheap rejects any request
   whose source IP isn't in its whitelist.
5. Set `NAMECHEAP_API_USER`, `NAMECHEAP_API_KEY`, `NAMECHEAP_USERNAME`, and
   `NAMECHEAP_CLIENT_IP` (same IP you just whitelisted).

**The Vercel egress gotcha.** On Vercel's serverless runtime your outbound IP
is not fixed — it rotates across a large pool. Namecheap only authorizes by
IP, so production has three realistic options:

- **Accept flakiness.** The route logs a warning and falls back to the DNS
  heuristic when Namecheap rejects the call. Not great UX.
- **Route egress through a static-IP proxy** (QuotaGuard Static, Fixie, or a
  self-hosted proxy on a fixed-IP VPS). Set `NAMECHEAP_CLIENT_IP` to that
  proxy's IP. This is the clean production answer.
- **Deploy on a runtime with stable egress** (Fly.io, Railway, a plain VM).
  Static egress is the default there.

If any of the four `NAMECHEAP_*` env vars are missing, `/api/check-domain`
logs a one-time warning and falls back to a DNS `A`-record heuristic. The
heuristic is **wrong on parked domains** — a registered but unconfigured
domain with no `A` record is reported as available. It's fine for local dev,
not for production.

#### Getting a Turnstile key pair (free)

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com) (free account).
2. Left sidebar → **Turnstile** → **Add site**.
3. Domain: `nameaura.co` (add `www.nameaura.co` and any Vercel preview
   hostnames you care about as well — `*.vercel.app` is not accepted, add
   specific subdomains).
4. Widget mode: **Invisible** (so legit users never see it).
5. Copy the **Site Key** → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
6. Copy the **Secret Key** → `TURNSTILE_SECRET_KEY`.

If both are empty the captcha layer is skipped and a warning is logged —
useful for local dev.

#### Provisioning Upstash Redis (free tier)

1. Sign up at [console.upstash.com](https://console.upstash.com) (GitHub
   login works).
2. **Create Database** → Redis → pick a region near your Vercel region
   (`iad1`/`us-east-1` for US, `fra1`/`eu-west-1` for EU).
3. Free tier gives 10k commands/day which is plenty for rate-limit
   counters.
4. On the database page, open the **REST** tab.
5. Copy **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN** into
   your env.

If both are empty the app falls back to an in-memory limiter. This is
fine for `npm run dev` but **not durable** on Vercel serverless — each
cold start resets the counter, so an attacker who hits several regions
can bypass limits.

## Security posture

`/api/generate` (the only expensive endpoint) is protected by eight
independent layers, all enforced server-side. Any one of them is enough
to reject a hostile request:

1. **Origin / CORS check** — only requests from `nameaura.co`,
   `www.nameaura.co`, `nameaura.vercel.app`, preview
   `nameaura-*.vercel.app`, or `localhost:3000` are accepted. Everything
   else is `403`.
2. **Content-Type + body-size gate** — must be `application/json` and
   ≤ 10 KB. Prevents multipart abuse and giant payloads.
3. **Strict schema validation** — concept must be 1–300 chars, style and
   syllables must match allowed enums. Prompt-injection markers
   (`<|im_start|>`, `ignore previous instructions`, `[[[`, `### system:`,
   jailbreak keywords, etc.) are blocked outright. Token-repetition
   floods are rejected. (TLDs are no longer part of the request — the
   client always checks the fixed default set against
   `/api/check-domain`.)
4. **Honeypot field** — a hidden `website` input is rendered off-screen.
   Humans never see it; naive bots auto-fill it. Non-empty ⇒ silent
   `204`. No feedback for the bot.
5. **Per-IP rate limit** — 5 generate requests per 10-minute sliding
   window, 60 check-domain requests per minute, returned with a
   `Retry-After` header. Backed by Upstash Redis; in-memory fallback in
   dev.
6. **Cloudflare Turnstile** — invisible captcha. Frontend obtains a
   short-lived token; backend verifies it with CF before calling
   Anthropic.
7. **Global daily budget** — a Redis counter keyed by UTC day caps
   successful generations at `DAILY_GENERATION_LIMIT` (default 200).
   Exceeded ⇒ `503` with `Retry-After: 3600`. Tune via env var.
8. **Cost-guard AI SDK wrapper** — `maxOutputTokens: 1500`,
   `temperature: 0.7`, and a Zod schema passed to
   `generateObject` bounds the response shape (5–12 names, each with a
   2–40 char name and 5–200 char rationale). The schema is enforced by
   the provider as a tool call, so the model can't return prose or
   oversized output. Upstream errors never leak their details; the
   client just sees "service temporarily unavailable".

Abuse events (`400`, `403`, `429`, oversized responses, upstream
errors) are logged to `stderr` as single-line JSON with `kind: "abuse"`,
a sha256-hashed IP (salted — not reversible), the route, status, and
reason. Vercel captures this in the function logs — no third-party SDK.

## API

### `POST /api/generate`

Request body:

```json
{
  "concept": "A cozy bookstore cafe with locally roasted coffee.",
  "filters": {
    "style": "one-word",
    "syllables": "short"
  },
  "turnstileToken": "<cf-turnstile-token-or-null>",
  "website": ""
}
```

Response:

```json
{
  "names": [
    { "name": "Pagebrew", "rationale": "Evokes books + coffee in one beat." }
  ]
}
```

TLDs are **no longer part of the request** — every name is always checked
against the full default set client-side via `/api/check-domain`.

Errors return `{ "error": "..." }` with a non-200 status.

### `POST /api/check-domain`

```json
{ "name": "pagebrew", "tlds": [".com", ".ai", ".io", ".co", ".xyz", ".app"] }
```

Response:

```json
{
  "results": [
    { "tld": ".com", "status": "available" },
    { "tld": ".ai",  "status": "taken" },
    { "tld": ".io",  "status": "available" },
    { "tld": ".co",  "status": "available" },
    { "tld": ".xyz", "status": "available" },
    { "tld": ".app", "status": "available" }
  ]
}
```

`status` is one of `available | taken | error`. The endpoint batches all six
TLDs into a single Namecheap request and caches each domain in-memory for 60
seconds so shortlist re-renders don't hammer the upstream.

## AI SDK

`/api/generate` uses the [Vercel AI SDK](https://sdk.vercel.ai)
(`ai` + `@ai-sdk/anthropic`) and calls `generateObject` with a Zod
schema so Claude returns a structured payload directly — no manual JSON
parsing, no regex fallback. The schema caps the array length and each
field's size, which doubles as a cost guard on the model output.

`ANTHROPIC_API_KEY` is the only model-side env var; the AI SDK's
Anthropic provider picks it up from the environment automatically and
nothing client-side ever sees it.

## Caveats

- **With `NAMECHEAP_*` set, availability is a real registration check.**
  Without them the route falls back to a DNS `A`-record heuristic that mis-
  reports registered-but-parked domains as available. See
  [Getting Namecheap API access](#getting-namecheap-api-access) for the
  production story and the Vercel egress caveat.
- The Claude response is shape-enforced by the Vercel AI SDK's
  `generateObject` + Zod — the provider returns a tool-call that matches
  the schema or the call fails, so there's no prose / markdown / JSON
  parsing to worry about.
- Claude calls are rate-limited per IP and globally budgeted (see
  "Security posture" above). The response shape itself is bounded by
  the schema, so a runaway model can't blow the cost budget.
- Shortlist is stored only in the user's browser; clearing site data wipes it.
- Namecheap availability reflects registration status but does not tell you
  whether the owner is willing to sell.

## Scripts

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build
npm run start   # serve the production build
npm run lint    # ESLint
```

## License

MIT. Do whatever.
