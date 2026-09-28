/**
 * The organisation's library: templates and playbooks saved for reuse, one
 * item each, grouped by kind. The kinds (calculated fields, filter bars,
 * visuals, playbooks) share the storage and differ only in their shape and
 * rules. An item keeps its shared facts (name, who and when) as attributes
 * and the kind's own fields in `body`.
 */
import { randomUUID } from 'node:crypto';

import { ValidationError } from '../../errors/ValidationError';
import { logger } from '../../utils/logger';
import { isConditionFailed, type LibraryKind, portal } from '../store/portalTable';

export interface TemplateMeta {
  id: string;
  name: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  kind: LibraryKind;
  id: string;
  name: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  body: unknown;
};

function notFound(noun: string, id: string): Error {
  return Object.assign(new ValidationError(`No ${noun} '${id}'`), { statusCode: 404 });
}

export class TemplateStore<T extends TemplateMeta, Input extends { name: string }> {
  public constructor(
    protected readonly kind: LibraryKind,
    protected readonly noun: string,
    /** Put before every new id, so a kind's ids are recognisable (and never collide). */
    private readonly idPrefix = ''
  ) {}

  public async list(): Promise<T[]> {
    const { data } = await portal()
      .libraryItem.query.byKind({ kind: this.kind })
      .go({ pages: 'all' });
    return data.map((row) => this.fromRow(row as Row)).sort((a, b) => this.order(a, b));
  }

  public async get(id: string): Promise<T | null> {
    const { data } = await portal().libraryItem.get({ kind: this.kind, id }).go();
    return data ? this.fromRow(data as Row) : null;
  }

  public async create(input: Input, createdBy: string): Promise<T> {
    const now = new Date().toISOString();
    const id = `${this.idPrefix}${randomUUID()}`;
    const item = { ...input, id, createdBy, createdAt: now, updatedAt: now } as unknown as T;
    await this.beforeWrite(item, null);
    await portal().libraryItem.create(this.toRow(item)).go();
    logger.info(`${this.noun} saved`, { id, name: input.name, createdBy });
    return item;
  }

  public async update(id: string, input: Input): Promise<T> {
    const existing = await this.get(id);
    if (!existing) {
      throw notFound(this.noun, id);
    }
    const item = { ...existing, ...input, id, updatedAt: new Date().toISOString() } as T;
    await this.beforeWrite(item, existing);
    await this.save(item);
    return item;
  }

  public async delete(id: string): Promise<void> {
    try {
      await portal().libraryItem.remove({ kind: this.kind, id }).go();
    } catch (error) {
      if (isConditionFailed(error)) throw notFound(this.noun, id);
      throw error;
    }
    logger.info(`${this.noun} deleted`, { id });
  }

  /** Write one item as it is (a kind's rule uses it to change another item). */
  protected async save(item: T): Promise<void> {
    await portal().libraryItem.put(this.toRow(item)).go();
  }

  /** List order; by name unless a kind says otherwise. */
  protected order(a: T, b: T): number {
    return a.name.localeCompare(b.name);
  }

  /** A kind's rule to apply before an item is written (e.g. only one default). */
  protected async beforeWrite(_item: T, _existing: T | null): Promise<void> {}

  private toRow(item: T): Row {
    const { id, name, description, createdBy, createdAt, updatedAt, ...body } = item;
    return {
      kind: this.kind,
      id,
      name,
      ...(description ? { description } : {}),
      ...(createdBy ? { createdBy } : {}),
      createdAt,
      updatedAt,
      body: JSON.parse(JSON.stringify(body)),
    };
  }

  private fromRow({ kind: _kind, body, ...meta }: Row): T {
    return { ...(body as object), ...meta } as T;
  }
}
