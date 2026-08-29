/**
 * DynamoDBService - Centralized DynamoDB SDK operations (VSA shared service).
 *
 * Thin DocumentClient wrapper used by JobRepository for per-job items. Keeps
 * all SDK specifics (marshalling, conditional writes, table bootstrap) in one
 * place, mirroring how S3Service wraps the S3 SDK.
 */
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
  UpdateTimeToLiveCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import { getOptimizedAwsConfig } from '../../config/httpConfig';
import { logger } from '../../utils/logger';

const TABLE_BOOTSTRAP_TIMEOUT_SECONDS = 60;
const BATCH_WRITE_CHUNK = 25; // DynamoDB BatchWriteItem hard limit
const DEFAULT_INDEX_QUERY_LIMIT = 500;
const DEFAULT_PARTITION_QUERY_LIMIT = 5000;

/** Thrown-through marker so callers can branch on failed conditional writes */
export function isConditionalCheckFailed(error: unknown): boolean {
  return (error as { name?: string })?.name === 'ConditionalCheckFailedException';
}

export class DynamoDBService {
  private static readonly ensuredTables = new Set<string>();
  private readonly client: DynamoDBClient;
  private readonly docClient: DynamoDBDocumentClient;

  constructor() {
    this.client = new DynamoDBClient(getOptimizedAwsConfig());
    this.docClient = DynamoDBDocumentClient.from(this.client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  /** Delete items in chunks of 25 (BatchWriteItem limit), one retry pass */
  public async batchDelete(tableName: string, keys: Record<string, any>[]): Promise<void> {
    for (let i = 0; i < keys.length; i += BATCH_WRITE_CHUNK) {
      const chunk = keys.slice(i, i + BATCH_WRITE_CHUNK);
      let requestItems: Record<string, any> | undefined = {
        [tableName]: chunk.map((key) => ({ DeleteRequest: { Key: key } })),
      };
      for (let attempt = 0; attempt < 2 && requestItems; attempt++) {
        const result: { UnprocessedItems?: Record<string, any> } = await this.docClient.send(
          new BatchWriteCommand({ RequestItems: requestItems })
        );
        requestItems =
          result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0
            ? result.UnprocessedItems
            : undefined;
      }
      if (requestItems) {
        logger.warn('DynamoDB batchDelete left unprocessed items after retry', { tableName });
      }
    }
  }

  public async deleteItem(
    tableName: string,
    key: Record<string, any>,
    conditionExpression?: string,
    expressionValues?: Record<string, any>
  ): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: key,
        ...(conditionExpression && { ConditionExpression: conditionExpression }),
        ...(expressionValues && { ExpressionAttributeValues: expressionValues }),
      })
    );
  }

  /**
   * Self-healing table bootstrap (mirrors S3Service.ensureBucketExists): in
   * production the CDK stack creates the table; local dev creates it on first
   * use. Checked once per process per table.
   */
  public async ensureJobsTableExists(tableName: string): Promise<void> {
    if (DynamoDBService.ensuredTables.has(tableName)) {
      return;
    }
    try {
      await this.client.send(new DescribeTableCommand({ TableName: tableName }));
      DynamoDBService.ensuredTables.add(tableName);
      return;
    } catch (error) {
      if (!(error instanceof ResourceNotFoundException)) {
        throw error;
      }
    }

    logger.info(`Jobs table ${tableName} not found - creating`);
    await this.client.send(
      new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
          { AttributeName: 'gsi1pk', AttributeType: 'S' },
          { AttributeName: 'startTime', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'byStartTime',
            KeySchema: [
              { AttributeName: 'gsi1pk', KeyType: 'HASH' },
              { AttributeName: 'startTime', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      })
    );
    await waitUntilTableExists(
      { client: this.client, maxWaitTime: TABLE_BOOTSTRAP_TIMEOUT_SECONDS },
      { TableName: tableName }
    );
    try {
      await this.client.send(
        new UpdateTimeToLiveCommand({
          TableName: tableName,
          TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
        })
      );
    } catch (ttlError) {
      // Non-fatal: cleanupOldJobs deletes expired jobs anyway; TTL is a backstop
      logger.warn('Failed to enable TTL on jobs table', { tableName, ttlError });
    }
    DynamoDBService.ensuredTables.add(tableName);
    logger.info(`Jobs table ${tableName} created`);
  }

  public async getItem<T = Record<string, any>>(
    tableName: string,
    key: Record<string, any>
  ): Promise<T | null> {
    const result = await this.docClient.send(
      new GetCommand({ TableName: tableName, Key: key, ConsistentRead: true })
    );
    return (result.Item as T) || null;
  }

  public async putItem(
    tableName: string,
    item: Record<string, any>,
    conditionExpression?: string,
    expressionValues?: Record<string, any>,
    expressionNames?: Record<string, string>
  ): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        ...(conditionExpression && { ConditionExpression: conditionExpression }),
        ...(expressionValues && { ExpressionAttributeValues: expressionValues }),
        ...(expressionNames && { ExpressionAttributeNames: expressionNames }),
      })
    );
  }

  /**
   * Query a GSI by partition value, newest-first on the sort key.
   * Optional sort-key upper bound (exclusive-ish: uses <) for retention sweeps.
   */
  public async queryIndex<T = Record<string, any>>(
    tableName: string,
    indexName: string,
    partitionKey: string,
    partitionValue: string,
    options: { limit?: number; sortKeyBefore?: { name: string; value: string } } = {}
  ): Promise<T[]> {
    const items: T[] = [];
    let exclusiveStartKey: Record<string, any> | undefined;
    const limit = options.limit ?? DEFAULT_INDEX_QUERY_LIMIT;

    do {
      const result: { Items?: Record<string, any>[]; LastEvaluatedKey?: Record<string, any> } =
        await this.docClient.send(
          new QueryCommand({
            TableName: tableName,
            IndexName: indexName,
            KeyConditionExpression: options.sortKeyBefore
              ? `#pk = :pk AND #sk < :before`
              : `#pk = :pk`,
            ExpressionAttributeNames: {
              '#pk': partitionKey,
              ...(options.sortKeyBefore && { '#sk': options.sortKeyBefore.name }),
            },
            ExpressionAttributeValues: {
              ':pk': partitionValue,
              ...(options.sortKeyBefore && { ':before': options.sortKeyBefore.value }),
            },
            ScanIndexForward: false, // newest first
            Limit: limit - items.length,
            ExclusiveStartKey: exclusiveStartKey,
          })
        );
      items.push(...((result.Items as T[]) || []));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey && items.length < limit);

    return items;
  }

  /**
   * Query all items in one table partition, ascending by sort key.
   * Optional begins_with filter on the sort key (e.g. log entries).
   */
  public async queryPartition<T = Record<string, any>>(
    tableName: string,
    partitionKey: string,
    partitionValue: string,
    options: { sortKeyBeginsWith?: { name: string; prefix: string }; limit?: number } = {}
  ): Promise<T[]> {
    const items: T[] = [];
    let exclusiveStartKey: Record<string, any> | undefined;
    const limit = options.limit ?? DEFAULT_PARTITION_QUERY_LIMIT;

    do {
      const result: { Items?: Record<string, any>[]; LastEvaluatedKey?: Record<string, any> } =
        await this.docClient.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: options.sortKeyBeginsWith
              ? `#pk = :pk AND begins_with(#sk, :prefix)`
              : `#pk = :pk`,
            ExpressionAttributeNames: {
              '#pk': partitionKey,
              ...(options.sortKeyBeginsWith && { '#sk': options.sortKeyBeginsWith.name }),
            },
            ExpressionAttributeValues: {
              ':pk': partitionValue,
              ...(options.sortKeyBeginsWith && { ':prefix': options.sortKeyBeginsWith.prefix }),
            },
            ConsistentRead: true,
            Limit: limit - items.length,
            ExclusiveStartKey: exclusiveStartKey,
          })
        );
      items.push(...((result.Items as T[]) || []));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey && items.length < limit);

    return items;
  }

  /**
   * Atomic partial update: SET the given attributes (skipping undefined),
   * SET-if-absent the fallback attributes, REMOVE the listed ones - all in
   * one write with no read. Attribute names are aliased, so reserved words
   * (status, error, duration, ...) are safe. Attributes present in `set`
   * are excluded from `setIfNotExists` (DynamoDB forbids overlapping paths).
   */
  public async updateItem(
    tableName: string,
    key: Record<string, any>,
    changes: {
      set?: Record<string, any>;
      setIfNotExists?: Record<string, any>;
      remove?: string[];
    },
    conditionExpression?: string
  ): Promise<void> {
    const names: Record<string, string> = {};
    const values: Record<string, any> = {};
    const setParts: string[] = [];
    let aliasIndex = 0;

    for (const [attr, value] of Object.entries(changes.set || {})) {
      if (value === undefined) {
        continue;
      }
      aliasIndex++;
      names[`#a${aliasIndex}`] = attr;
      values[`:v${aliasIndex}`] = value;
      setParts.push(`#a${aliasIndex} = :v${aliasIndex}`);
    }
    for (const [attr, value] of Object.entries(changes.setIfNotExists || {})) {
      if (value === undefined || (changes.set && attr in changes.set)) {
        continue;
      }
      aliasIndex++;
      names[`#a${aliasIndex}`] = attr;
      values[`:v${aliasIndex}`] = value;
      setParts.push(`#a${aliasIndex} = if_not_exists(#a${aliasIndex}, :v${aliasIndex})`);
    }
    const removeParts = (changes.remove || []).map((attr) => {
      aliasIndex++;
      names[`#a${aliasIndex}`] = attr;
      return `#a${aliasIndex}`;
    });

    const updateExpression = [
      setParts.length > 0 ? `SET ${setParts.join(', ')}` : '',
      removeParts.length > 0 ? `REMOVE ${removeParts.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (!updateExpression) {
      return;
    }

    await this.docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: names,
        ...(Object.keys(values).length > 0 && { ExpressionAttributeValues: values }),
        ...(conditionExpression && { ConditionExpression: conditionExpression }),
      })
    );
  }
}
