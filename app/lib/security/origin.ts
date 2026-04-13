/**
 * Origin / CORS whitelist enforcement.
 *
 * Production: nameaura.co + www + vercel deployment aliases.
 * Dev: localhost:3000.
 */

const STATIC_ALLOWED = new Set<string>([
  "https://nameaura.co",
  "https://www.nameaura.co",
  "https://nameaura.vercel.app",
  "http://localhost:3000",
]);

/**
 * Match preview-deploy aliases: https://nameaura-<hash>.vercel.app and
 * https://nameaura-*-<team>.vercel.app.
 */
const PREVIEW_PATTERN = /^https:\/\/nameaura-[a-z0-9-]+\.vercel\.app$/i;

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (STATIC_ALLOWED.has(origin)) return true;
  if (PREVIEW_PATTERN.test(origin)) return true;
  return false;
}
