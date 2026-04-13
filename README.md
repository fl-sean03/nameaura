# NameAura

> **Rebuilt from a single screenshot.** The original NameAura app was deployed on
> Vercel and later deleted. No source was preserved. This repo is a from-zero
> reconstruction based on one surviving screenshot, so the internals don't match
> whatever the original was — only the look, feel, and stated purpose do.

AI-powered brand name ideation for new ventures. Describe your concept, pick a
few preferences, and get 10 brandable name candidates back with rationale and a
heuristic domain-availability signal for common TLDs.

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS v4
- [`lucide-react`](https://lucide.dev) icons
- [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript)
  (Claude Sonnet 4.5)
- Node's built-in `dns.promises.resolve4()` for the availability heuristic
- No database, no auth — shortlist is saved to `localStorage`

## Features

- Single-page app with a clean, light gradient aesthetic
- Textarea for a business concept (up to 300 chars)
- "Advanced Filters" (TLD multi-select, name style, syllable count)
- `POST /api/generate` — asks Claude for 10 candidate names + rationales (JSON)
- `POST /api/check-domain` — DNS lookup per name/TLD pair, returns
  `available` / `taken` / `error`
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
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`  | prod      | Cloudflare Turnstile site key (browser-safe)                            |
| `TURNSTILE_SECRET_KEY`            | prod      | Cloudflare Turnstile secret key (server-only)                           |
| `UPSTASH_REDIS_REST_URL`          | prod      | Upstash Redis REST URL for rate limiting + daily budget                 |
| `UPSTASH_REDIS_REST_TOKEN`        | prod      | Upstash Redis REST token                                                |
| `DAILY_GENERATION_LIMIT`          | no        | Global daily cap on `/api/generate` successes (UTC day). Default `200`. |
| `IP_HASH_SALT`                    | no        | Salt mixed into IP hashes in abuse logs                                 |

Only `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is exposed to the browser. Every other
key is read server-side in the route handler.

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
3. **Strict schema validation** — concept must be 1–300 chars, TLDs must
   be in `.com .co .io .ai`, style and syllables must match allowed
   enums. Prompt-injection markers (`<|im_start|>`, `ignore previous
   instructions`, `[[[`, `### system:`, jailbreak keywords, etc.) are
   blocked outright. Token-repetition floods are rejected.
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
8. **Cost-guard Anthropic wrapper** — `max_tokens: 1500`,
   `temperature: 0.7`, and any model response above 3 KB is rejected as
   anomalous before being returned to the client. Upstream errors never
   leak their details; the client just sees "service temporarily
   unavailable".

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
    "tlds": [".com", ".co"],
    "style": "one-word",
    "syllables": "short"
  }
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

Errors return `{ "error": "..." }` with a non-200 status.

### `POST /api/check-domain`

```json
{ "name": "pagebrew", "tld": ".com" }
```

Response:

```json
{ "domain": "pagebrew.com", "status": "available" }
```

`status` is one of `available | taken | error`.

## Caveats

- **The domain availability check is a heuristic, not a registration check.**
  It does a DNS `A` record lookup. A registered-but-parked domain with no
  `A` record will be reported as **available** here when in fact it is
  **taken**. For ground truth you want a WHOIS/RDAP lookup or a registrar API
  (Namecheap, GoDaddy, Porkbun). **TODO**: swap in RDAP via
  `https://rdap.iana.org/`.
- The Claude prompt asks for strictly JSON. If the model adds prose around the
  JSON, the route handler attempts a second-pass `{...}` extraction. If that
  still fails it returns a 502 with the raw text for debugging.
- Claude calls are rate-limited per IP and globally budgeted (see
  "Security posture" above). Responses are not cached.
- Shortlist is stored only in the user's browser; clearing site data wipes it.

## Scripts

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build
npm run start   # serve the production build
npm run lint    # ESLint
```

## License

MIT. Do whatever.
