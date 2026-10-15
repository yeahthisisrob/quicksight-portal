import { describe, expect, it, vi } from 'vitest';

import type { NewNote, Note } from '../../../../shared/services/knowledge/KnowledgeStore';
import { LearnService } from '../LearnService';
import type { PlannerModel, StructuredRequest } from '../planner/PlannerModel';

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/** A store in memory, enough for the service: add, list, remove, confirmedFor. */
function memoryStore(seed: Note[] = []) {
  const notes = [...seed];
  let n = 0;
  return {
    notes,
    async add(input: NewNote): Promise<Note> {
      const note: Note = {
        entityId: input.entityId,
        noteId: `n${++n}`,
        kind: input.kind,
        text: input.text,
        source: input.source,
        status: input.status ?? 'confirmed',
        by: input.by,
        at: input.at ?? '2026-10-15T00:00:00.000Z',
      };
      notes.push(note);
      return note;
    },
    async list(entityId: string, options: { status?: string } = {}): Promise<Note[]> {
      return notes.filter(
        (x) => x.entityId === entityId && (!options.status || x.status === options.status)
      );
    },
    async remove(entityId: string, noteId: string): Promise<void> {
      const i = notes.findIndex((x) => x.entityId === entityId && x.noteId === noteId);
      if (i >= 0) notes.splice(i, 1);
    },
    async confirmedFor(ids: string[]): Promise<Map<string, Note[]>> {
      return new Map(
        ids.map((id) => [id, notes.filter((x) => x.entityId === id && x.status === 'confirmed')])
      );
    },
  };
}

const outline = [
  {
    sheetId: 's1',
    name: 'Overview',
    layout: 'grid',
    elements: [
      { elementId: 'v1', kind: 'visual', visualType: 'KPI', title: 'Revenue' },
      { elementId: 'v2', kind: 'visual', visualType: 'LineChart', title: 'Trend' },
      { elementId: 'c1', kind: 'filterControl', title: 'Region' },
    ],
  },
];
const rebind = {
  loadDefinitionOutline: vi.fn(async () => outline),
  describeDatasets: vi.fn(async () => ({
    name: 'Sales review',
    datasets: [{ identifier: 'orders', dataSetId: 'ds-1', columns: [{ name: 'revenue' }] }],
  })),
  describeTargetDataset: vi.fn(async () => ({
    columns: [
      { name: 'revenue', type: 'DECIMAL' },
      { name: 'region', type: 'STRING' },
    ],
  })),
};

class FakeModel implements PlannerModel {
  public readonly provider = 'fake';
  public readonly requests: StructuredRequest[] = [];
  public constructor(private readonly output: unknown) {}
  public async complete(request: StructuredRequest) {
    this.requests.push(request);
    return { output: this.output, provider: 'fake', model: 'fake-1' };
  }
}

describe('LearnService', () => {
  it('drafts a reading of the asset and its visuals, keeps the open questions, and reads what is known first', async () => {
    const store = memoryStore([
      {
        entityId: 'visual:analysis:a1:v1',
        noteId: 'k1',
        kind: 'meaning',
        text: 'Revenue is net of returns.',
        source: 'person',
        status: 'confirmed',
        by: 'rob@example.com',
        at: '2026-10-14T00:00:00.000Z',
      },
      // The model's earlier reading, to be replaced.
      {
        entityId: 'analysis:a1',
        noteId: 'old',
        kind: 'description',
        text: 'An old reading.',
        source: 'model',
        status: 'draft',
        by: 'fake-0',
        at: '2026-10-13T00:00:00.000Z',
      },
    ]);
    const model = new FakeModel({
      asset: 'The weekly sales review for finance.',
      visuals: [
        { elementId: 'v1', description: 'Net revenue this month.' },
        { elementId: 'v2', description: 'Revenue by month, last year.' },
        { elementId: 'nope', description: 'Ignored: not in the outline.' },
      ],
      questions: [
        { elementId: '', question: 'Who signs off on this review?' },
        { elementId: 'v2', question: 'Is the trend meant to be rolling 12 months?' },
      ],
    });
    const result = await new LearnService(rebind as any, model, store as any).learn(
      'analysis',
      'a1'
    );

    expect(result).toMatchObject({ name: 'Sales review', known: 1, model: { model: 'fake-1' } });
    expect(result.drafts.map((d) => [d.entityId, d.text, d.status, d.by])).toEqual([
      ['analysis:a1', 'The weekly sales review for finance.', 'draft', 'fake-1'],
      ['visual:analysis:a1:v1', 'Net revenue this month.', 'draft', 'fake-1'],
      ['visual:analysis:a1:v2', 'Revenue by month, last year.', 'draft', 'fake-1'],
    ]);
    expect(result.questions.map((q) => [q.entityId, q.kind, q.text])).toEqual([
      ['analysis:a1', 'question', 'Who signs off on this review?'],
      ['visual:analysis:a1:v2', 'question', 'Is the trend meant to be rolling 12 months?'],
    ]);
    // The old draft is gone; the person's note stands and was in the prompt.
    expect(store.notes.some((n) => n.noteId === 'old')).toBe(false);
    expect(store.notes.some((n) => n.noteId === 'k1')).toBe(true);
    const prompt = model.requests[0]!;
    expect(prompt.user).toContain('Revenue is net of returns.');
    expect(prompt.user).toContain('Do not ask about any of this');
    expect(prompt.user).toContain('"elementId":"v1"');
    expect(prompt.user).toContain('revenue (DECIMAL)');
    expect(prompt.system).toContain('ask instead of guessing');
  });

  it('says nothing when the model has nothing to say', async () => {
    const store = memoryStore();
    const result = await new LearnService(
      rebind as any,
      new FakeModel({ asset: '', visuals: [], questions: [] }),
      store as any
    ).learn('dashboard', 'd1');
    expect(result.drafts).toEqual([]);
    expect(result.questions).toEqual([]);
    expect(store.notes).toEqual([]);
  });
});
