export type Tld = ".com" | ".co" | ".io" | ".ai";

export type NameStyle = "any" | "one-word" | "two-word" | "portmanteau";
export type SyllableCount = "any" | "short" | "medium";

export interface Filters {
  tlds: Tld[];
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
