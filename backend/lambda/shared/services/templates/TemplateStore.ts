/**
 * A library of templates the organisation saves for reuse, one DynamoDB item
 * per template in the jobs table under its own partition. The kinds (filter
 * bars, visuals) share the storage and differ only in their shape and rules.
 */
import { randomUUID } from 'node:crypto';

import { ValidationError } from '../../errors/ValidationError';
import { logger } from '../../utils/logger';
import { DynamoDBService } from '../aws/DynamoDBService';

export interface TemplateMeta {
  id: string;
  name: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

type Stored<T> = T & { pk: string; sk: string };

export function strip<T extends TemplateMeta>({ pk: _pk, sk: _sk, ...rest }: Stored<T>): T {
  return rest as unknown as T;
}

export class TemplateStore<T extends TemplateMeta, Input extends { name: string }> {
  protected readonly tableName: string;

  public constructor(
    protected readonly partition: string,
    protected readonly noun: string,
    protected readonly dynamo: DynamoDBService = new DynamoDBService(),
    tableName?: string
  ) {
    this.tableName =
      tableName ||
      process.env.JOBS_TABLE_NAME ||
      `quicksight-portal-jobs-${process.env.AWS_ACCOUNT_ID || ''}`;
  }

  public async list(): Promise<T[]> {
    const items = await this.dynamo.queryPartition<Stored<T>>(this.tableName, 'pk', this.partition);
    return items.map((i) => strip<T>(i)).sort((a, b) => this.order(a, b));
  }

  public async get(id: string): Promise<T | null> {
    const item = await this.dynamo.getItem<Stored<T>>(this.tableName, {
      pk: this.partition,
      sk: id,
    });
    return item ? strip<T>(item) : null;
  }

  public async create(input: Input, createdBy: string): Promise<T> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const item = { ...input, id, createdBy, createdAt: now, updatedAt: now } as unknown as T;
    await this.beforeWrite(item, null);
    await this.dynamo.putItem(this.tableName, { ...item, pk: this.partition, sk: id });
    logger.info(`${this.noun} saved`, { id, name: input.name, createdBy });
    return item;
  }

  public async update(id: string, input: Input): Promise<T> {
    const existing = await this.get(id);
    if (!existing) {
      throw Object.assign(new ValidationError(`No ${this.noun} '${id}'`), { statusCode: 404 });
    }
    const item = { ...existing, ...input, id, updatedAt: new Date().toISOString() } as T;
    await this.beforeWrite(item, existing);
    await this.dynamo.putItem(this.tableName, { ...item, pk: this.partition, sk: id });
    return item;
  }

  public async delete(id: string): Promise<void> {
    await this.dynamo.deleteItem(this.tableName, { pk: this.partition, sk: id });
  }

  /** List order; by name unless a kind says otherwise. */
  protected order(a: T, b: T): number {
    return a.name.localeCompare(b.name);
  }

  /** A kind's rule to apply before an item is written (e.g. only one default). */
  protected async beforeWrite(_item: T, _existing: T | null): Promise<void> {}
}
