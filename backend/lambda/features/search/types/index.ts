/** What can be found: every exported QuickSight asset kind, plus SMUS listings. */
export type SearchableType =
  | 'dashboard'
  | 'analysis'
  | 'dataset'
  | 'datasource'
  | 'folder'
  | 'smus-listing'
  | 'calculated-field'
  | 'visual'
  | 'template';

export const SEARCHABLE_TYPES: readonly SearchableType[] = [
  'dashboard',
  'analysis',
  'dataset',
  'datasource',
  'folder',
  'smus-listing',
  'calculated-field',
  'visual',
  'template',
];

/** One indexed thing. Field lists are what scoring reads; `summary` is one line for people and agents. */
export interface SearchDocument {
  type: SearchableType;
  id: string;
  name: string;
  description?: string;
  /** Column, field and calculated-field names. */
  columns: string[];
  calculatedFields: string[];
  tags: string[];
  /** Glossary terms (SMUS), folder names, project or table names, sheet and chart type for visuals. */
  context: string[];
  /** Calculated fields and templates: the expression, where the business rules live. */
  expression?: string;
  /** The asset a calculated field or visual belongs to. */
  parent?: { type: 'dashboard' | 'analysis' | 'dataset'; id: string; name: string };
  /** Calculated fields: every asset that defines this exact expression. */
  definedIn?: Array<{ type: 'dashboard' | 'analysis' | 'dataset'; id: string; name: string }>;
  /** Views in the activity window, when known; used as a popularity boost. */
  views?: number;
  updatedAt?: string;
  /** One line: kind, name, and the two or three facts that tell it apart. */
  summary: string;
  /** Where to open it in the portal. */
  path: string;
}

export interface SearchHit {
  type: SearchableType;
  id: string;
  name: string;
  score: number;
  /** Which fields matched which query words, e.g. "column: revenue". */
  why: string[];
  summary: string;
  path: string;
  description?: string;
  views?: number;
  updatedAt?: string;
  expression?: string;
  parent?: SearchDocument['parent'];
  definedIn?: SearchDocument['definedIn'];
}

export interface SearchRequest {
  q: string;
  types?: SearchableType[];
  limit?: number;
}

export interface SearchResponse {
  q: string;
  hits: SearchHit[];
  /** Documents considered, by type, so an empty result can say what was searched. */
  indexed: Partial<Record<SearchableType, number>>;
  /** When the index was built from the caches. */
  indexedAt: string;
}
