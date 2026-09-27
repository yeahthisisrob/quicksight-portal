import { describe, expect, it, vi } from 'vitest';

import { DynamoDBService } from '../DynamoDBService';

/** Every request the service would send, as sent: the document client stubbed. */
function withRequests(pages: Array<{ Items: unknown[]; LastEvaluatedKey?: unknown }>) {
  const service = new DynamoDBService();
  const sent: Array<Record<string, unknown>> = [];
  const send = vi.fn(async (command: { input: Record<string, unknown> }) => {
    sent.push(command.input);
    return pages[sent.length - 1] ?? { Items: [] };
  });
  (service as unknown as { docClient: { send: typeof send } }).docClient = { send };
  return { service, sent };
}

describe('DynamoDBService.queryPartition', () => {
  it('reads a whole partition without sending a Limit DynamoDB would reject', async () => {
    const { service, sent } = withRequests([
      { Items: [{ sk: 'ITEM#1' }], LastEvaluatedKey: { sk: 'ITEM#1' } },
      { Items: [{ sk: 'ITEM#2' }] },
    ]);
    const rows = await service.queryPartition('jobs', 'pk', 'job-1', {
      sortKeyBeginsWith: { name: 'sk', prefix: 'ITEM#' },
      limit: Number.POSITIVE_INFINITY,
    });
    expect(rows).toHaveLength(2);
    // "Infinity" would serialise as a string: DynamoDB answers
    // "STRING_VALUE can not be converted to an Integer".
    for (const request of sent) expect(request).not.toHaveProperty('Limit');
  });

  it('sends what is left of a finite limit as an integer', async () => {
    const { service, sent } = withRequests([
      { Items: [{ sk: 'a' }], LastEvaluatedKey: { sk: 'a' } },
    ]);
    await service.queryPartition('jobs', 'pk', 'job-1', { limit: 3 });
    expect(sent[0]).toMatchObject({ Limit: 3 });
    expect(sent[1]).toMatchObject({ Limit: 2 });
  });
});
