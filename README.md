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

| Variable            | Purpose                                          |
|---------------------|--------------------------------------------------|
| `ANTHROPIC_API_KEY` | Server-side Claude API key for `/api/generate`   |

The key is only read in the route handler (server-side), so it never ships to
the browser.

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
- Claude calls are not cached or rate-limited. For production you want both.
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
