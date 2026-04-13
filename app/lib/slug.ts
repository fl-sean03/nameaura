/**
 * Turn a candidate name into a DNS-safe lower-case label.
 * - Removes anything that isn't [a-z0-9-]
 * - Collapses consecutive dashes
 * - Trims leading/trailing dashes
 * - Caps length at 63 (DNS label max)
 */
export function slugifyName(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}
