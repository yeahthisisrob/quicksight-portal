import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CalculatedFieldTemplateStore,
  validateTemplateInput,
} from '../CalculatedFieldTemplateStore';

vi.mock('../../../../shared/utils/logger', () => ({
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

describe('CalculatedFieldTemplateStore', () => {
  const dynamo = {
    queryPartition: vi.fn(),
    getItem: vi.fn(),
    putItem: vi.fn(),
    deleteItem: vi.fn(),
  };
  let store: CalculatedFieldTemplateStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new CalculatedFieldTemplateStore(dynamo as any, 'jobs');
  });

  it('creates under the template partition and strips the keys', async () => {
    const created = await store.create({ name: 'margin', expression: '{revenue}-{cost}' }, 'rob');
    const item = dynamo.putItem.mock.calls[0]?.[1];
    expect(item.pk).toBe('CALC_TEMPLATE');
    expect(item.sk).toBe(item.id);
    expect(created).not.toHaveProperty('pk');
    expect(created).toMatchObject({ name: 'margin', createdBy: 'rob' });
  });

  it('lists sorted by name and indexes by normalised expression', async () => {
    dynamo.queryPartition.mockResolvedValue([
      {
        pk: 'CALC_TEMPLATE',
        sk: '2',
        id: '2',
        name: 'b',
        expression: '{a}  -  {b}',
        createdAt: '',
        updatedAt: '',
      },
      {
        pk: 'CALC_TEMPLATE',
        sk: '1',
        id: '1',
        name: 'a',
        expression: '{x}',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    const list = await store.list();
    expect(list.map((t) => t.name)).toEqual(['a', 'b']);
    expect(dynamo.queryPartition).toHaveBeenCalledWith('jobs', 'pk', 'CALC_TEMPLATE');
    const index = CalculatedFieldTemplateStore.indexByExpression(list);
    expect(index.get(index.keys().next().value!)).toBeDefined();
    expect(index.size).toBe(2);
  });

  it('updates and deletes only existing templates', async () => {
    dynamo.getItem.mockResolvedValue(null);
    await expect(store.update('x', { name: 'n', expression: 'e' })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(store.delete('x')).rejects.toMatchObject({ statusCode: 404 });
    dynamo.getItem.mockResolvedValue({
      pk: 'CALC_TEMPLATE',
      sk: 'x',
      id: 'x',
      name: 'old',
      expression: 'e',
      createdAt: 't0',
      updatedAt: 't0',
    });
    const updated = await store.update('x', { name: 'new', expression: 'e2' });
    expect(updated).toMatchObject({ id: 'x', name: 'new', expression: 'e2', createdAt: 't0' });
    await store.delete('x');
    expect(dynamo.deleteItem).toHaveBeenCalledWith('jobs', { pk: 'CALC_TEMPLATE', sk: 'x' });
  });
});
