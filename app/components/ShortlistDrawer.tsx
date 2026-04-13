"use client";

import { Trash2, X } from "lucide-react";
import type { ShortlistItem } from "../lib/types";

interface Props {
  open: boolean;
  items: ShortlistItem[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function ShortlistDrawer({
  open,
  items,
  onClose,
  onRemove,
  onClear,
}: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={[
          "fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-sm transition-opacity",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="My shortlist"
        className={[
          "fixed right-0 top-0 z-50 h-full w-full max-w-md transform bg-white shadow-xl transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">My Shortlist</h2>
            <p className="text-xs text-gray-500">
              Saved locally in your browser
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex h-[calc(100%-64px)] flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {items.length === 0 ? (
              <p className="mt-20 text-center text-sm text-gray-500">
                No names yet. Tap the bookmark on a name to save it.
              </p>
            ) : (
              <ul className="space-y-3">
                {items.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">
                        {it.name}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        {it.rationale}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(it.id)}
                      aria-label={`Remove ${it.name}`}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <footer className="border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={onClear}
                className="text-sm text-gray-500 hover:text-rose-600"
              >
                Clear all
              </button>
            </footer>
          )}
        </div>
      </aside>
    </>
  );
}
