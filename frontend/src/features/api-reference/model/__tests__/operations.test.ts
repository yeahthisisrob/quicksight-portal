import spec from '@shared/generated/openapi.json';
import { describe, expect, it } from 'vitest';

import {
  curlFor,
  groupByArea,
  type OpenApiDocument,
  parseOperations,
  searchOperations,
} from '../operations';

const doc = spec as unknown as OpenApiDocument;
const operations = parseOperations(doc);
const byId = (id: string) => operations.find((op) => op.id === id);

describe('parseOperations', () => {
  it('reads every method of every path from the served contract', () => {
    expect(operations.length).toBeGreaterThan(90);
    expect(byId('GET /api/api-docs/openapi')).toMatchObject({ area: 'API docs', job: false });
    expect(byId('POST /api/authoring/new/propose')).toMatchObject({ job: true });
  });

  it('resolves shared parameters and request bodies to names and placeholders', () => {
    const rebind = byId('POST /api/authoring/{assetType}/{assetId}/rebind');
    expect(rebind?.parameters.map((p) => `${p.in}:${p.name}`)).toEqual([
      'path:assetType',
      'path:assetId',
    ]);
    expect(rebind?.requestBody).toBe('ApplyRebindRequest');
    expect(JSON.parse(rebind?.requestExample ?? '{}')).toMatchObject({ mode: 'update' });
    expect(rebind?.responseSchema).toBe('ApplyRebindResult');

    const jobs = byId('GET /api/jobs');
    expect(jobs?.parameters.find((p) => p.name === 'type')).toMatchObject({
      in: 'query',
      required: false,
    });
    expect(jobs?.responseSchema).toBe('Job[]');
  });

  it('merges allOf bodies so a definition request shows its required fields', () => {
    const apply = byId('POST /api/authoring/{assetType}/{assetId}/definition');
    expect(JSON.parse(apply?.requestExample ?? '{}')).toMatchObject({
      definition: {},
      mode: 'update',
    });
  });
});

describe('searchOperations and groupByArea', () => {
  it('needs every word, anywhere in the operation', () => {
    const hits = searchOperations(operations, 'calculated fields template');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((op) => /template/i.test(`${op.path} ${op.summary} ${op.description}`))).toBe(
      true
    );
    expect(searchOperations(operations, 'zzz-nothing-here')).toEqual([]);
    expect(searchOperations(operations, '   ')).toBe(operations);
  });

  it('groups by area with the read-first areas leading', () => {
    const areas = groupByArea(operations).map((a) => a.area);
    expect(areas.slice(0, 3)).toEqual(['API docs', 'Search', 'Assets']);
    expect(areas).toContain('Data catalog');
  });
});

describe('curlFor', () => {
  it('writes the request the guide would, with the key and URL from the environment', () => {
    const search = byId('GET /api/search')!;
    expect(curlFor(search)).toBe(
      'curl -sS -X GET "$QSP_API_URL/api/search?q=…" \\\n  -H "Authorization: Bearer $QSP_API_KEY"'
    );
    const propose = byId('POST /api/authoring/{assetType}/{assetId}/propose')!;
    const line = curlFor(propose, { compact: true });
    expect(line).toContain('-H "Content-Type: application/json"');
    expect(line).toContain(`--data '{"ask":"…"}'`);
  });
});
