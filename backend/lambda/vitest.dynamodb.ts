/**
 * One DynamoDB Local (AWS's own implementation, in memory) for the whole
 * test run. Store tests create their own table in it, so they run against
 * real DynamoDB semantics - conditions, transactions, paging - with no AWS.
 */
import { createServer } from 'node:net';

import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import DynamoDbLocal from 'dynamodb-local';
import type { TestProject } from 'vitest/node';

async function freePort(): Promise<number> {
  return await new Promise((resolve) => {
    const server = createServer().listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

/** The JVM takes a moment after launch (and the first run downloads the jar): wait until it answers. */
async function ready(endpoint: string): Promise<void> {
  const client = new DynamoDBClient({
    endpoint,
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    try {
      await client.send(new ListTablesCommand({}));
      return;
    } catch (error) {
      if (Date.now() > deadline) throw new Error(`DynamoDB Local did not start: ${String(error)}`);
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }
}

const READY_TIMEOUT_MS = 120_000;
const POLL_MS = 200;

export default async function setup(project: TestProject) {
  const port = await freePort();
  const endpoint = `http://127.0.0.1:${port}`;
  const child = await DynamoDbLocal.launch(port, null, ['-inMemory'], false, true);
  await ready(endpoint);
  project.provide('dynamodbEndpoint', endpoint);
  return async () => {
    await DynamoDbLocal.stopChild(child);
  };
}
