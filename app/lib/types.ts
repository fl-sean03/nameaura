export type Tld = ".com" | ".ai" | ".io" | ".co" | ".xyz" | ".app";

/**
 * The six default TLDs every candidate name is checked against. The user can
 * no longer narrow this set — it's a fixed default per product requirements.
 */
export const DEFAULT_TLDS: readonly Tld[] = [
  ".com",
  ".ai",
  ".io",
  ".co",
  ".xyz",
  ".app",
] as const;

export type NameStyle = "any" | "one-word" | "two-word" | "portmanteau";
export type SyllableCount = "any" | "short" | "medium";

export interface Filters {
  style: NameStyle;
  syllables: SyllableCount;
}

export interface GeneratedName {
  name: string;
  rationale: string;
}

export type DomainStatus = "checking" | "available" | "taken" | "error";

export interface DomainResult {
  tld: Tld;
  status: DomainStatus;
}

export interface NameCandidate extends GeneratedName {
  id: string;
  domains: DomainResult[];
}

export interface ShortlistItem {
  id: string;
  name: string;
  rationale: string;
  savedAt: number;
}
