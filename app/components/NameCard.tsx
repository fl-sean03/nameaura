"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import type { DomainResult, DomainStatus, NameCandidate, Tld } from "../lib/types";
import { slugifyName } from "../lib/slug";

interface Props {
  candidate: NameCandidate;
  saved: boolean;
  onToggleSave: () => void;
}

const DOT_COLOR: Record<DomainStatus, string> = {
  available: "bg-emerald-500",
  taken: "bg-rose-500",
  checking: "bg-gray-400",
  error: "bg-amber-400",
};

const STATUS_LABEL: Record<DomainStatus, string> = {
  available: "available",
  taken: "taken",
  checking: "checking",
  error: "couldn't check",
};

function namecheapCartUrl(name: string, tld: Tld): string {
  const slug = slugifyName(name);
  const domain = `${slug}${tld}`;
  return `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(
    domain
  )}`;
}

function DomainPill({
  name,
  result,
}: {
  name: string;
  result: DomainResult;
}) {
  const { tld, status } = result;
  const dot = (
    <span
      className={[
        "inline-block h-2 w-2 shrink-0 rounded-full",
        DOT_COLOR[status],
        status === "checking" ? "animate-pulse" : "",
      ].join(" ")}
      aria-hidden="true"
    />
  );

  const baseClasses =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors";

  const label = (
    <span aria-label={`${tld} ${STATUS_LABEL[status]}`}>{tld}</span>
  );

  if (status === "available") {
    return (
      <a
        href={namecheapCartUrl(name, tld)}
        target="_blank"
        rel="noopener noreferrer"
        className={[
          baseClasses,
          "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        ].join(" ")}
        title={`Buy ${slugifyName(name)}${tld} on Namecheap`}
      >
        {dot}
        {label}
      </a>
    );
  }

  const toneClasses: Record<Exclude<DomainStatus, "available">, string> = {
    taken: "border-rose-200 bg-rose-50 text-rose-700",
    checking: "border-gray-200 bg-gray-50 text-gray-600",
    error: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <span
      className={[baseClasses, toneClasses[status]].join(" ")}
      title={`${slugifyName(name)}${tld} — ${STATUS_LABEL[status]}`}
    >
      {dot}
      {label}
    </span>
  );
}

export function NameCard({ candidate, saved, onToggleSave }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 card-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-xl font-bold text-gray-900">
            {candidate.name}
          </h3>
          <p className="mt-1 text-xs leading-snug text-gray-500">
            {candidate.rationale}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleSave}
          aria-label={saved ? "Remove from shortlist" : "Add to shortlist"}
          className={[
            "shrink-0 rounded-lg border p-2 transition-colors",
            saved
              ? "border-amber-300 bg-amber-50 text-amber-600"
              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50",
          ].join(" ")}
        >
          {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {candidate.domains.map((d) => (
          <DomainPill key={d.tld} name={candidate.name} result={d} />
        ))}
      </div>
    </div>
  );
}

export function NameCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 card-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="w-full space-y-2">
          <div className="h-6 w-40 rounded skeleton" />
          <div className="h-3 w-full rounded skeleton" />
          <div className="h-3 w-3/4 rounded skeleton" />
        </div>
        <div className="h-9 w-9 rounded-lg skeleton" />
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-6 w-14 rounded-full skeleton" />
        ))}
      </div>
    </div>
  );
}
