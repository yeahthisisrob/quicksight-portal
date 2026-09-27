/**
 * The context graph's vocabulary: what kinds of entity it holds and how they
 * relate. One list, read by the search slice (which builds the graph) and
 * the assistant (which tells a model what it can follow), so the two never
 * drift. The served contract enumerates the same values.
 */
export const CONTEXT_ENTITY_TYPES = [
  'project',
  'listing',
  'listing-column',
  'glossary-term',
  'datasource',
  'dataset',
  'dataset-column',
  'calculated-field',
  'analysis',
  'dashboard',
  'visual',
  'template',
  'folder',
] as const;

export const CONTEXT_RELATIONS = [
  'in-project',
  'has-column',
  'tagged',
  'reads-listing',
  'through-datasource',
  'exposes',
  'uses-dataset',
  'defined-in',
  'reads-column',
  'in-asset',
  'in-folder',
  'column-of',
  'derived-from',
  'reads-field',
  'shows',
] as const;

export type ContextEntityType = (typeof CONTEXT_ENTITY_TYPES)[number];
export type ContextRelation = (typeof CONTEXT_RELATIONS)[number];
