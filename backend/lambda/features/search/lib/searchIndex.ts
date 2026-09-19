/**
 * A small inverted index over search documents with field-weighted scoring:
 * a hit on the name outranks a column, which outranks a description. Each
 * query word contributes once per field it matches (so repeating a column
 * name across ten visuals does not drown a name match), the score is
 * scaled by how many query words matched, and a popularity boost keeps the
 * things people use on top. No model, no network: it runs in the request.
 */
import type { SearchableType, SearchDocument, SearchHit } from '../types';
import { queryTokens, tokenize } from './tokenize';

type Field =
  | 'name'
  | 'columns'
  | 'calculatedFields'
  | 'tags'
  | 'context'
  | 'expression'
  | 'description';

const FIELD_WEIGHT: Record<Field, number> = {
  name: 10,
  calculatedFields: 6,
  columns: 5,
  tags: 4,
  context: 3,
  expression: 3,
  description: 2,
};
/** Exact whole-name match on top of token hits. */
const EXACT_NAME_BONUS = 12;
/** A word that starts a name token ("rev" for revenue) counts, at a discount. */
const PREFIX_WEIGHT = 0.5;
const MIN_PREFIX_LENGTH = 3;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const WHY_LIMIT = 6;

interface Indexed {
  doc: SearchDocument;
  fields: Record<Field, Set<string>>;
}

export class SearchIndex {
  private readonly items: Indexed[];
  public readonly indexedAt: string;
  public readonly counts: Partial<Record<SearchableType, number>>;

  public constructor(documents: SearchDocument[], indexedAt = new Date().toISOString()) {
    this.indexedAt = indexedAt;
    this.items = documents.map((doc) => ({
      doc,
      fields: {
        name: new Set(tokenize(doc.name)),
        columns: new Set(doc.columns.flatMap(tokenize)),
        calculatedFields: new Set(doc.calculatedFields.flatMap(tokenize)),
        tags: new Set(doc.tags.flatMap(tokenize)),
        context: new Set(doc.context.flatMap(tokenize)),
        expression: new Set(tokenize(doc.expression ?? '')),
        description: new Set(tokenize(doc.description ?? '')),
      },
    }));
    this.counts = {};
    for (const doc of documents) {
      this.counts[doc.type] = (this.counts[doc.type] ?? 0) + 1;
    }
  }

  public get size(): number {
    return this.items.length;
  }

  public search(query: string, options: { types?: SearchableType[]; limit?: number } = {}): SearchHit[] {
    const words = queryTokens(query);
    if (words.length === 0) {
      return [];
    }
    const types = options.types && options.types.length > 0 ? new Set(options.types) : null;
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const wholeQuery = query.trim().toLowerCase();

    const scored: SearchHit[] = [];
    for (const { doc, fields } of this.items) {
      if (types && !types.has(doc.type)) {
        continue;
      }
      let score = 0;
      let matchedWords = 0;
      const why: string[] = [];
      for (const word of words) {
        let best = 0;
        let bestField: Field | null = null;
        for (const field of Object.keys(FIELD_WEIGHT) as Field[]) {
          const tokens = fields[field];
          let weight = 0;
          if (tokens.has(word)) {
            weight = FIELD_WEIGHT[field];
          } else if (word.length >= MIN_PREFIX_LENGTH) {
            for (const token of tokens) {
              if (token.startsWith(word)) {
                weight = FIELD_WEIGHT[field] * PREFIX_WEIGHT;
                break;
              }
            }
          }
          if (weight > best) {
            best = weight;
            bestField = field;
          }
        }
        if (best > 0 && bestField) {
          score += best;
          matchedWords += 1;
          if (why.length < WHY_LIMIT) {
            why.push(`${labelFor(bestField)}: ${word}`);
          }
        }
      }
      if (matchedWords === 0) {
        continue;
      }
      if ((doc.name ?? '').trim().toLowerCase() === wholeQuery) {
        score += EXACT_NAME_BONUS;
        why.unshift('exact name');
      }
      // All words matching beats half of them matching with a bigger field.
      score *= matchedWords / words.length;
      // Popularity: log scale so a thousand views does not bury an exact name.
      score *= 1 + Math.log10(1 + (doc.views ?? 0)) / 4;
      scored.push({
        type: doc.type,
        id: doc.id,
        name: doc.name,
        score: Math.round(score * 100) / 100,
        why,
        summary: doc.summary,
        path: doc.path,
        description: doc.description,
        views: doc.views,
        updatedAt: doc.updatedAt,
        expression: doc.expression,
        parent: doc.parent,
        definedIn: doc.definedIn,
      });
    }
    scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return scored.slice(0, limit);
  }
}

function labelFor(field: Field): string {
  switch (field) {
    case 'name':
      return 'name';
    case 'columns':
      return 'column';
    case 'calculatedFields':
      return 'calculated field';
    case 'tags':
      return 'tag';
    case 'context':
      return 'context';
    case 'expression':
      return 'expression';
    default:
      return 'description';
  }
}
