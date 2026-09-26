/**
 * The portal's context graph: everything it knows about this account as
 * entities and typed relationships, for agents to search and walk.
 *
 * Shaped like AWS Context on purpose (search, get an entity, follow its
 * relationships), so an agent written against this interface can later be
 * pointed at Context without changing. Built from the caches the portal
 * already keeps (the QuickSight export, the field catalog, the SMUS snapshot
 * and the template library), in the same pass as the search index.
 *
 * Pure: data in, graph out. No I/O.
 */

export type EntityType =
  | 'project'
  | 'listing'
  | 'listing-column'
  | 'glossary-term'
  | 'datasource'
  | 'dataset'
  | 'calculated-field'
  | 'analysis'
  | 'dashboard'
  | 'visual'
  | 'template'
  | 'folder';

/**
 * Relations read from the subject to the object:
 *   listing in-project project
 *   listing has-column listing-column
 *   listing tagged glossary-term
 *   dataset reads-listing listing        (the Data Catalog's link)
 *   dataset through-datasource datasource
 *   dataset exposes listing-column       (a dataset column named like the listing's)
 *   analysis|dashboard uses-dataset dataset
 *   calculated-field defined-in dataset|analysis|dashboard
 *   calculated-field reads-column listing-column
 *   visual in-asset analysis|dashboard
 *   analysis|dashboard|dataset in-folder folder
 */
export type Relation =
  | 'in-project'
  | 'has-column'
  | 'tagged'
  | 'reads-listing'
  | 'through-datasource'
  | 'exposes'
  | 'uses-dataset'
  | 'defined-in'
  | 'reads-column'
  | 'in-asset'
  | 'in-folder';

interface ContextEntity {
  /** `${type}:${key}`, stable across rebuilds. */
  id: string;
  type: EntityType;
  name: string;
  description?: string;
  /** One line for a person or an agent. */
  summary: string;
  /** Facts worth filtering or reasoning on: column type, import mode, project id, expression. */
  attributes: Record<string, string | number | boolean>;
  /** Where to open it in the portal. */
  path?: string;
}

interface ContextEdge {
  from: string;
  relation: Relation;
  to: string;
  /** Why the edge exists, when it was inferred (e.g. "by source-table", "via Orders (raw)"). */
  note?: string;
}

export type Direction = 'out' | 'in' | 'both';

interface RelatedQuery {
  relations?: Relation[];
  direction?: Direction;
  /** 1 to MAX_DEPTH hops. */
  depth?: number;
  types?: EntityType[];
  limit?: number;
}

interface RelatedHit {
  entity: ContextEntity;
  /** The path from the start, as relations: ["reads-listing", "in-project"]. */
  via: Array<{ relation: Relation; direction: 'out' | 'in'; note?: string }>;
  depth: number;
}

export const MAX_DEPTH = 3;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function entityId(type: EntityType, key: string): string {
  return `${type}:${key}`;
}

export class ContextGraph {
  private readonly entities = new Map<string, ContextEntity>();
  private readonly outgoing = new Map<string, ContextEdge[]>();
  private readonly incoming = new Map<string, ContextEdge[]>();
  private readonly seenEdges = new Set<string>();

  public add(entity: ContextEntity): void {
    const existing = this.entities.get(entity.id);
    this.entities.set(
      entity.id,
      existing
        ? { ...existing, ...entity, attributes: { ...existing.attributes, ...entity.attributes } }
        : entity
    );
  }

  /** Both ends must exist; a dangling edge is dropped rather than pointing nowhere. */
  public link(from: string, relation: Relation, to: string, note?: string): void {
    const key = `${from}|${relation}|${to}`;
    if (
      from === to ||
      this.seenEdges.has(key) ||
      !this.entities.has(from) ||
      !this.entities.has(to)
    ) {
      return;
    }
    this.seenEdges.add(key);
    const edge: ContextEdge = { from, relation, to, ...(note ? { note } : {}) };
    this.outgoing.set(from, [...(this.outgoing.get(from) ?? []), edge]);
    this.incoming.set(to, [...(this.incoming.get(to) ?? []), edge]);
  }

  public get(id: string): ContextEntity | undefined {
    return this.entities.get(id);
  }

  public has(id: string): boolean {
    return this.entities.has(id);
  }

  public all(): ContextEntity[] {
    return [...this.entities.values()];
  }

  /** How many relationships of each kind an entity has, in and out: what an agent can ask next. */
  public relationCounts(
    id: string
  ): Array<{ relation: Relation; direction: 'out' | 'in'; count: number }> {
    const counts = new Map<string, number>();
    for (const e of this.outgoing.get(id) ?? []) {
      counts.set(`out|${e.relation}`, (counts.get(`out|${e.relation}`) ?? 0) + 1);
    }
    for (const e of this.incoming.get(id) ?? []) {
      counts.set(`in|${e.relation}`, (counts.get(`in|${e.relation}`) ?? 0) + 1);
    }
    return [...counts.entries()].map(([key, count]) => {
      const [direction, relation] = key.split('|') as ['out' | 'in', Relation];
      return { relation, direction, count };
    });
  }

  /**
   * Breadth-first from `id`, following only the relations and direction
   * asked for, up to `depth` hops. Each entity is reported once, at its
   * nearest distance, with the path that reached it.
   */
  public related(id: string, query: RelatedQuery = {}): RelatedHit[] {
    if (!this.entities.has(id)) {
      return [];
    }
    const depth = Math.min(Math.max(query.depth ?? 1, 1), MAX_DEPTH);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const direction = query.direction ?? 'both';
    const relations = query.relations?.length ? new Set(query.relations) : null;
    const types = query.types?.length ? new Set(query.types) : null;

    const seen = new Set<string>([id]);
    const hits: RelatedHit[] = [];
    let frontier: Array<{ id: string; via: RelatedHit['via'] }> = [{ id, via: [] }];
    for (let hop = 1; hop <= depth && frontier.length > 0; hop += 1) {
      const next: typeof frontier = [];
      for (const node of frontier) {
        const steps: Array<{
          to: string;
          relation: Relation;
          direction: 'out' | 'in';
          note?: string;
        }> = [];
        if (direction !== 'in') {
          for (const e of this.outgoing.get(node.id) ?? []) {
            steps.push({ to: e.to, relation: e.relation, direction: 'out', note: e.note });
          }
        }
        if (direction !== 'out') {
          for (const e of this.incoming.get(node.id) ?? []) {
            steps.push({ to: e.from, relation: e.relation, direction: 'in', note: e.note });
          }
        }
        for (const step of steps) {
          if ((relations && !relations.has(step.relation)) || seen.has(step.to)) {
            continue;
          }
          seen.add(step.to);
          const via = [
            ...node.via,
            {
              relation: step.relation,
              direction: step.direction,
              ...(step.note ? { note: step.note } : {}),
            },
          ];
          const entity = this.entities.get(step.to)!;
          if (!types || types.has(entity.type)) {
            hits.push({ entity, via, depth: hop });
            if (hits.length >= limit) {
              return hits;
            }
          }
          next.push({ id: step.to, via });
        }
      }
      frontier = next;
    }
    return hits;
  }

  public counts(): Partial<Record<EntityType, number>> & { edges: number } {
    const counts: Partial<Record<EntityType, number>> = {};
    for (const entity of this.entities.values()) {
      counts[entity.type] = (counts[entity.type] ?? 0) + 1;
    }
    return { ...counts, edges: this.seenEdges.size };
  }
}

/** Column and field names compared the way people write them: case, spaces and underscores ignored. */
export function normalName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]+/g, '');
}

/** `{column}` tokens in a calculated-field expression; `${param}` is a parameter and skipped. */
export function expressionColumnNames(expression: string): string[] {
  return [...new Set([...expression.matchAll(/(?<!\$)\{([^{}]+)\}/g)].map((m) => m[1]!.trim()))];
}
