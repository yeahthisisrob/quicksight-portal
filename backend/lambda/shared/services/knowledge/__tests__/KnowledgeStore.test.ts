import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type PortalTestTable,
  startPortalTestTable,
} from '../../../utils/testUtils/portalTestTable';
import { KnowledgeStore } from '../KnowledgeStore';
import { knowledgeBlock, PLANNER_NOTE_KINDS } from '../knowledgeLines';

let table: PortalTestTable;
beforeAll(async () => {
  table = await startPortalTestTable();
});
afterAll(async () => {
  await table.stop();
});

describe('KnowledgeStore', () => {
  const store = new KnowledgeStore();

  it('keeps what people and the portal said, newest first, and what a model read as a draft', async () => {
    await store.add({
      entityId: 'analysis:a1',
      kind: 'change',
      text: "Added a table 'Results' to Overview",
      source: 'portal',
      by: 'the portal',
      at: '2026-10-15T10:00:00.000Z',
    });
    await store.add({
      entityId: 'analysis:a1',
      kind: 'identity',
      text: 'The one finance reads; the copy in Sandbox is not.',
      source: 'person',
      by: 'rob@example.com',
      at: '2026-10-15T11:00:00.000Z',
    });
    const draft = await store.add({
      entityId: 'analysis:a1',
      kind: 'description',
      text: 'Revenue and orders by region, monthly.',
      source: 'model',
      status: 'draft',
      by: 'us.anthropic.claude-sonnet-5',
      at: '2026-10-15T12:00:00.000Z',
    });

    const all = await store.list('analysis:a1');
    expect(all.map((n) => [n.kind, n.status])).toEqual([
      ['description', 'draft'],
      ['identity', 'confirmed'],
      ['change', 'confirmed'],
    ]);
    expect((await store.list('analysis:a1', { status: 'confirmed' })).map((n) => n.kind)).toEqual([
      'identity',
      'change',
    ]);

    // A person confirms the draft, in their own words.
    const confirmed = await store.confirm(
      'analysis:a1',
      draft.noteId,
      'rob@example.com',
      'Revenue and orders by region, monthly, for the finance review.'
    );
    expect(confirmed).toMatchObject({
      status: 'confirmed',
      source: 'person',
      by: 'rob@example.com',
      text: 'Revenue and orders by region, monthly, for the finance review.',
    });
    expect(await store.confirm('analysis:a1', 'nope', 'rob@example.com')).toBeNull();

    await store.remove('analysis:a1', draft.noteId);
    expect((await store.list('analysis:a1')).map((n) => n.kind)).toEqual(['identity', 'change']);
  });

  it('reads confirmed notes for several entities at once, as the block a planner reads', async () => {
    await store.add({
      entityId: 'dataset-column:ds1:revenue',
      kind: 'meaning',
      text: 'Net of returns; gross is gross_revenue.',
      source: 'person',
      by: 'rob@example.com',
      at: '2026-10-15T13:00:00.000Z',
    });
    const byEntity = await store.confirmedFor([
      'analysis:a1',
      'dataset-column:ds1:revenue',
      'dataset:nothing',
    ]);
    expect([...byEntity.keys()]).toEqual([
      'analysis:a1',
      'dataset-column:ds1:revenue',
      'dataset:nothing',
    ]);
    const block = knowledgeBlock(byEntity, {
      kinds: PLANNER_NOTE_KINDS,
      label: (id) => (id === 'analysis:a1' ? 'The analysis "Sales review"' : id),
    });
    expect(block).toContain('The analysis "Sales review":');
    expect(block).toContain('(identity, rob@example.com, 2026-10-15) The one finance reads');
    expect(block).toContain('(means, rob@example.com, 2026-10-15) Net of returns');
    // The change log is for people, not the planner.
    expect(block).not.toContain('Added a table');
    expect(knowledgeBlock(new Map([['dataset:nothing', []]]))).toBe('');
  });
});
