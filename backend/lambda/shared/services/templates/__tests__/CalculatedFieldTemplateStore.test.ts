import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type PortalTestTable,
  startPortalTestTable,
} from '../../../utils/testUtils/portalTestTable';
import {
  CalculatedFieldTemplateStore,
  validateTemplateInput,
} from '../CalculatedFieldTemplateStore';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('validateTemplateInput', () => {
  it('normalises a valid input', () => {
    expect(
      validateTemplateInput({
        name: ' margin ',
        expression: ' {revenue}-{cost} ',
        tags: ['a', ' ', 'b'],
        source: { datasetId: 'ds', junk: 1 },
        description: '',
      })
    ).toEqual({
      name: 'margin',
      expression: '{revenue}-{cost}',
      dataType: undefined,
      description: undefined,
      tags: ['a', 'b'],
      source: { datasetId: 'ds' },
    });
  });

  it('rejects a missing name or expression', () => {
    expect(() => validateTemplateInput({ expression: 'x' })).toThrow('name is required');
    expect(() => validateTemplateInput({ name: 'x' })).toThrow('expression is required');
  });
});

let table: PortalTestTable;
beforeAll(async () => {
  table = await startPortalTestTable();
});
afterAll(async () => {
  await table.stop();
});

describe('CalculatedFieldTemplateStore', () => {
  const store = new CalculatedFieldTemplateStore();

  beforeEach(async () => {
    for (const t of await store.list()) await store.delete(t.id);
  });

  it('creates a template and returns it with its id and who made it', async () => {
    const created = await store.create({ name: 'margin', expression: '{revenue}-{cost}' }, 'rob');
    expect(created).toMatchObject({
      name: 'margin',
      createdBy: 'rob',
      expression: '{revenue}-{cost}',
    });
    expect(await store.get(created.id)).toEqual(created);
  });

  it('lists sorted by name and indexes by normalised expression', async () => {
    await store.create({ name: 'b', expression: '{a}  -  {b}' }, 'rob');
    await store.create({ name: 'a', expression: '{x}' }, 'rob');
    const list = await store.list();
    expect(list.map((t) => t.name)).toEqual(['a', 'b']);
    const index = CalculatedFieldTemplateStore.indexByExpression(list);
    expect(index.size).toBe(2);
  });

  it('updates and deletes only existing templates', async () => {
    await expect(store.update('x', { name: 'n', expression: 'e' })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(store.delete('x')).rejects.toMatchObject({ statusCode: 404 });
    const made = await store.create({ name: 'old', expression: 'e' }, 'rob');
    const updated = await store.update(made.id, { name: 'new', expression: 'e2' });
    expect(updated).toMatchObject({
      id: made.id,
      name: 'new',
      expression: 'e2',
      createdAt: made.createdAt,
    });
    await store.delete(made.id);
    expect(await store.get(made.id)).toBeNull();
  });
});
