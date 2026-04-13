"use client";

import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { Pill } from "./ui/Pill";
import type { DomainResult, NameCandidate } from "../lib/types";
import { slugifyName } from "../lib/slug";

interface Props {
  candidate: NameCandidate;
  saved: boolean;
  onToggleSave: () => void;
}

function DomainBadge({ name, result }: { name: string; result: DomainResult }) {
  const slug = slugifyName(name);
  const domain = slug ? `${slug}${result.tld}` : result.tld;
  if (result.status === "checking") {
    return (
      <Pill tone="blue">
        <Loader2 size={10} className="animate-spin" />
        checking {domain}
      </Pill>
    );
  }
  if (result.status === "available") return <Pill tone="green">available {domain}</Pill>;
  if (result.status === "taken") return <Pill tone="gray">taken {domain}</Pill>;
  return <Pill tone="amber">unknown {domain}</Pill>;
}

export function NameCard({ candidate, saved, onToggleSave }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 card-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-gray-900">
            {candidate.name}
          </h3>
          <p className="mt-1 text-sm leading-snug text-gray-600">
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

      <div className="flex flex-wrap gap-2">
        {candidate.domains.map((d) => (
          <DomainBadge key={d.tld} name={candidate.name} result={d} />
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
          <div className="h-5 w-40 rounded skeleton" />
          <div className="h-3 w-full rounded skeleton" />
          <div className="h-3 w-3/4 rounded skeleton" />
        </div>
        <div className="h-9 w-9 rounded-lg skeleton" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-20 rounded-full skeleton" />
        <div className="h-5 w-20 rounded-full skeleton" />
      </div>
    </div>
  );
}
