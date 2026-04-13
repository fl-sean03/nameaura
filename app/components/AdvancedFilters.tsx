"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { Filters, NameStyle, SyllableCount } from "../lib/types";

interface Props {
  value: Filters;
  onChange: (next: Filters) => void;
  open: boolean;
  onToggle: () => void;
}

export function AdvancedFilters({ value, onChange, open, onToggle }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
          <SlidersHorizontal size={16} className="text-gray-500" />
          Advanced Filters
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-gray-100 px-4 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Name style
              </label>
              <select
                value={value.style}
                onChange={(e) =>
                  onChange({ ...value, style: e.target.value as NameStyle })
                }
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="any">Any</option>
                <option value="one-word">One word</option>
                <option value="two-word">Two words</option>
                <option value="portmanteau">Portmanteau</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Syllable count
              </label>
              <select
                value={value.syllables}
                onChange={(e) =>
                  onChange({
                    ...value,
                    syllables: e.target.value as SyllableCount,
                  })
                }
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="any">Any</option>
                <option value="short">Short (1-2)</option>
                <option value="medium">Medium (2-3)</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Every name is checked against <strong>.com .ai .io .co .xyz .app</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
