/**
 * Six users archived at once, as a playbook run deletes them, against an
 * S3 that enforces ETags the way the real one does, with reads and writes
 * interleaved. Every user must leave the active file and reach the archive:
 * whole-file writes used to let the last one undo the others, so deleted
 * users stayed listed and every retry failed on "does not exist".
 */
import { describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => new Map<string, { body: string; etag: string }>());
const puts = vi.hoisted(() => ({ conflicts: 0, n: 0 }));

vi.mock('../../../config/awsClients', () => ({ createS3Client: () => ({}) }));
vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../../adapters/aws/S3Adapter', () => {
  const jitter = () => new Promise((r) => setTimeout(r, Math.random() * 5));
  return {
    S3Adapter: vi.fn(function S3Adapter() {
      return {
        async getObject(_bucket: string, key: string) {
          await jitter();
          const hit = store.get(key);
          if (!hit) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
          return {
            ETag: hit.etag,
            Body: { transformToWebStream: () => new Response(hit.body).body },
          };
        },
        async putObject(
          _bucket: string,
          key: string,
          body: string,
          _type?: string,
          condition?: { ifMatch?: string; ifNoneMatch?: '*' }
        ) {
          await jitter();
          const hit = store.get(key);
          const refused =
            (condition?.ifMatch && hit?.etag !== condition.ifMatch) ||
            (condition?.ifNoneMatch === '*' && hit);
          if (refused) {
            puts.conflicts++;
            throw Object.assign(new Error('At least one of the pre-conditions failed'), {
              name: 'PreconditionFailed',
              $metadata: { httpStatusCode: 412 },
            });
          }
          const etag = `"v${++puts.n}"`;
          store.set(key, { body, etag });
          return { ETag: etag };
        },
      };
    }),
  };
});

import { ArchiveService } from '../ArchiveService';

const ACTIVE = 'assets/organization/users.json';
const ARCHIVED = 'archived/organization/users.json';
const read = (key: string) => JSON.parse(store.get(key)?.body ?? '{}');

describe('archiving users at once', () => {
  it('moves every one of them, none undone by another', async () => {
    const users = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
    store.set(ACTIVE, {
      body: JSON.stringify(
        Object.fromEntries([...users, 'stays'].map((u) => [u, { UserName: u }]))
      ),
      etag: '"v0"',
    });
    const service = new ArchiveService('bucket');

    const results = await Promise.all(
      users.map((u) => service.archiveCollectionItem('user', u, 'Idle reader', 'playbook'))
    );

    expect(results.every((r) => r.success)).toBe(true);
    expect(Object.keys(read(ACTIVE))).toEqual(['stays']);
    expect(Object.keys(read(ARCHIVED)).sort()).toEqual(users);
    // They really did collide, and each collision was re-applied, not lost.
    expect(puts.conflicts).toBeGreaterThan(0);
  });
});
