"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rocket, Star } from "lucide-react";
import { Button } from "./ui/Button";
import { AdvancedFilters } from "./AdvancedFilters";
import { NameCard, NameCardSkeleton } from "./NameCard";
import { ShortlistDrawer } from "./ShortlistDrawer";
import { TurnstileWidget } from "./Turnstile";
import { readShortlist, writeShortlist } from "../lib/shortlist";
import { slugifyName } from "../lib/slug";
import {
  DEFAULT_TLDS,
  type DomainResult,
  type DomainStatus,
  type Filters,
  type GeneratedName,
  type NameCandidate,
  type ShortlistItem,
  type Tld,
} from "../lib/types";

const MAX_CHARS = 300;

const DEFAULT_FILTERS: Filters = {
  style: "any",
  syllables: "any",
};

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function NameAuraApp() {
  const [concept, setConcept] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<NameCandidate[]>([]);

  const [shortlist, setShortlist] = useState<ShortlistItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Turnstile token — null until CF issues one (or if captcha is disabled in dev).
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileConfigured =
    !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  // Honeypot field — bots fill it; humans don't see it.
  const honeypotRef = useRef<HTMLInputElement | null>(null);

  const handleTurnstileToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  // Hydrate shortlist from localStorage
  useEffect(() => {
    setShortlist(readShortlist());
  }, []);

  // Persist shortlist
  useEffect(() => {
    writeShortlist(shortlist);
  }, [shortlist]);

  const savedNames = useMemo(
    () => new Set(shortlist.map((s) => s.name.toLowerCase())),
    [shortlist]
  );

  const canSubmit = concept.trim().length > 0 && !loading;

  const checkDomainsFor = useCallback(
    async (nameId: string, rawName: string, tlds: readonly Tld[]) => {
      const slug = slugifyName(rawName);
      if (!slug) {
        setCandidates((prev) =>
          prev.map((c) =>
            c.id === nameId
              ? {
                  ...c,
                  domains: tlds.map((t) => ({
                    tld: t,
                    status: "error" as DomainStatus,
                  })),
                }
              : c
          )
        );
        return;
      }

      try {
        const res = await fetch("/api/check-domain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: slug, tlds }),
        });
        const json = (await res.json()) as {
          results?: Array<{ tld: Tld; status: DomainStatus }>;
        };
        const results = Array.isArray(json.results) ? json.results : [];
        setCandidates((prev) =>
          prev.map((c) => {
            if (c.id !== nameId) return c;
            const byTld = new Map<Tld, DomainStatus>();
            for (const r of results) byTld.set(r.tld, r.status);
            return {
              ...c,
              domains: c.domains.map((d) => ({
                ...d,
                status: byTld.get(d.tld) ?? "error",
              })),
            };
          })
        );
      } catch {
        setCandidates((prev) =>
          prev.map((c) =>
            c.id === nameId
              ? {
                  ...c,
                  domains: c.domains.map((d) => ({
                    ...d,
                    status: "error" as DomainStatus,
                  })),
                }
              : c
          )
        );
      }
    },
    []
  );

  async function onGenerate() {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    setCandidates([]);

    try {
      // If captcha is configured but we don't have a token yet, bail out
      // politely. The widget will usually have resolved by the time the
      // user clicks Generate, but network hiccups happen.
      if (turnstileConfigured && !turnstileToken) {
        setLoading(false);
        setError(
          "Still verifying you're human — please wait a moment and try again."
        );
        return;
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: concept.trim(),
          filters,
          turnstileToken,
          website: honeypotRef.current?.value || "",
        }),
      });

      // Silent honeypot 204 — legitimate users never see this.
      if (res.status === 204) {
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          typeof j?.error === "string" ? j.error : `Request failed (${res.status})`
        );
      }

      const data = (await res.json()) as { names: GeneratedName[] };
      const names = Array.isArray(data.names) ? data.names : [];

      const fresh: NameCandidate[] = names.map((n) => ({
        id: makeId(),
        name: n.name,
        rationale: n.rationale,
        domains: DEFAULT_TLDS.map<DomainResult>((t) => ({
          tld: t,
          status: "checking",
        })),
      }));

      setCandidates(fresh);
      setLoading(false);

      // Kick off domain checks after loading flips off so the cards render first.
      for (const c of fresh) {
        // Don't await — run in parallel across names.
        void checkDomainsFor(c.id, c.name, DEFAULT_TLDS);
      }
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  function toggleSave(c: NameCandidate) {
    setShortlist((prev) => {
      const hit = prev.find((s) => s.name.toLowerCase() === c.name.toLowerCase());
      if (hit) return prev.filter((s) => s.id !== hit.id);
      const item: ShortlistItem = {
        id: makeId(),
        name: c.name,
        rationale: c.rationale,
        savedAt: Date.now(),
      };
      return [item, ...prev];
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <header className="text-center">
          <h1 className="brand-title text-5xl font-extrabold tracking-tight sm:text-6xl">
            NameAura
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-gray-600 sm:text-base">
            Ignite your next venture with AI-powered name suggestions and availability checks.
          </p>
        </header>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Star size={14} className="text-amber-400 fill-amber-400" />
            My Shortlist
            {shortlist.length > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700">
                {shortlist.length}
              </span>
            )}
          </button>
        </div>

        <section className="mt-3 rounded-2xl bg-white p-5 card-soft sm:p-6">
          <label
            htmlFor="concept"
            className="block text-sm font-medium text-gray-800"
          >
            Your Business Concept
          </label>

          <div className="relative mt-2">
            <textarea
              id="concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value.slice(0, MAX_CHARS))}
              placeholder="e.g., A cozy bookstore cafe with locally roasted coffee."
              rows={3}
              className="block w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 pr-16 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <div className="pointer-events-none absolute bottom-2 right-3 text-xs text-gray-400">
              {concept.length}/{MAX_CHARS}
            </div>
          </div>

          <div className="mt-4">
            <AdvancedFilters
              value={filters}
              onChange={setFilters}
              open={filtersOpen}
              onToggle={() => setFiltersOpen((o) => !o)}
            />
          </div>

          {/* Honeypot: invisible to humans, irresistible to naive bots.
              Positioned off-screen + aria-hidden + autocomplete off. */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "-10000px",
              top: "auto",
              width: "1px",
              height: "1px",
              overflow: "hidden",
            }}
          >
            <label htmlFor="website">
              Website (leave blank)
              <input
                ref={honeypotRef}
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                defaultValue=""
              />
            </label>
          </div>

          <TurnstileWidget onToken={handleTurnstileToken} />

          <div className="mt-4">
            <Button
              size="lg"
              className="w-full"
              onClick={onGenerate}
              disabled={!canSubmit}
            >
              <Rocket size={18} />
              {loading ? "Generating..." : "Generate Names"}
            </Button>
          </div>

          <p className="mt-3 text-center text-xs text-gray-500">
            AI suggestions typically take 5-10 seconds
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </section>

        {(loading || candidates.length > 0) && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Suggestions
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <NameCardSkeleton key={i} />
                ))}
              {!loading &&
                candidates.map((c) => (
                  <NameCard
                    key={c.id}
                    candidate={c}
                    saved={savedNames.has(c.name.toLowerCase())}
                    onToggleSave={() => toggleSave(c)}
                  />
                ))}
            </div>
          </section>
        )}
      </main>

      <ShortlistDrawer
        open={drawerOpen}
        items={shortlist}
        onClose={() => setDrawerOpen(false)}
        onRemove={(id) => setShortlist((prev) => prev.filter((s) => s.id !== id))}
        onClear={() => setShortlist([])}
      />
    </div>
  );
}
