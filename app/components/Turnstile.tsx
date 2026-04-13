"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget wrapper.
 *
 * - Loads the CF script once.
 * - Renders invisibly (size=invisible) so legit users don't see it.
 * - Calls `onToken` with the token as soon as CF issues one.
 * - Silently no-ops if the site key isn't configured (dev).
 *
 * We deliberately avoid importing an NPM wrapper — the CF script is
 * small, well-supported, and global.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          size?: "normal" | "compact" | "invisible" | "flexible";
          appearance?: "always" | "execute" | "interaction-only";
          theme?: "light" | "dark" | "auto";
          execution?: "render" | "execute";
        }
      ) => string;
      reset: (id?: string) => void;
      execute: (id?: string) => void;
      remove: (id?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="${SCRIPT_SRC.split("?")[0]}"]`
    );
    if (existing) {
      if (window.turnstile) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("turnstile load failed")));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface Props {
  onToken: (token: string | null) => void;
}

export function TurnstileWidget({ onToken }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  useEffect(() => {
    if (!siteKey) return; // dev fallback — no widget
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled) return;
        if (!window.turnstile || !containerRef.current) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          size: "invisible",
          appearance: "interaction-only",
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => {
        // If CF's script is blocked, we can't provide a token. The server
        // will reject the request — user sees a friendly error.
        onToken(null);
      });

    return () => {
      cancelled = true;
      try {
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
        }
      } catch {
        /* ignore */
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, onToken]);

  const reset = () => {
    if (window.turnstile && widgetIdRef.current) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        /* ignore */
      }
    }
  };

  // Expose reset on the DOM node so callers can trigger a fresh token.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    (el as HTMLDivElement & { _turnstileReset?: () => void })._turnstileReset =
      reset;
  });

  // Invisible — no visual layout impact.
  return <div ref={containerRef} aria-hidden="true" />;
}
