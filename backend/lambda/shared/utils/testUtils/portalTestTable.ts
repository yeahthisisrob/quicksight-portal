/**
 * The portal table for a test file: a table of its own, with the same keys
 * and index as the stack's, in the run's DynamoDB Local (vitest.dynamodb.ts),
 * and the entities bound to it. Store tests run against real DynamoDB
 * semantics (conditions, transactions, paging) with no AWS.
 */
import { randomUUID } from 'node:crypto';

import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { inject } from 'vitest';

import { bindPortal } from '../../services/store/portalTable';

/** What vitest.dynamodb.ts hands every test file. */
declare module 'vitest' {
  export interface ProvidedContext {
    dynamodbEndpoint: string;
  }
}

export interface PortalTestTable {
  client: DynamoDBDocumentClient;
  table: string;
  stop: () => Promise<void>;
}

/** Start an in-process table and bind the portal's entities to it. */
export async function startPortalTestTable(): Promise<PortalTestTable> {
  const table = `portal-test-${randomUUID()}`;
  const raw = new DynamoDBClient({
    endpoint: inject('dynamodbEndpoint'),
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
  await raw.send(
    new CreateTableCommand({
      TableName: table,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'gsi1pk', AttributeType: 'S' },
        { AttributeName: 'gsi1sk', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'gsi1',
          KeySchema: [
            { AttributeName: 'gsi1pk', KeyType: 'HASH' },
            { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    })
  );
  const client = DynamoDBDocumentClient.from(raw, {
    marshallOptions: { removeUndefinedValues: true },
  });
  bindPortal(client, table);
  return {
    client,
    table,
    stop: async () => {
      await raw.send(new DeleteTableCommand({ TableName: table }));
    },
  };
}
