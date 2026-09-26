import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { BUILDABLE_VISUAL_TYPES } from '../../../../features/authoring/lib/definitionBuilder';
import { VISUAL_TEMPLATE_TYPES, validateVisualTemplateInput } from '../VisualTemplateStore';

describe('visual templates', () => {
  it('offers exactly the visual types the builder makes', () => {
    expect([...VISUAL_TEMPLATE_TYPES].sort()).toEqual([...BUILDABLE_VISUAL_TYPES].sort());
  });

  it('keeps a visual by column names, and refuses one the builder could not make', () => {
    expect(
      validateVisualTemplateInput({
        name: ' Revenue trend ',
        visual: {
          type: 'LineChart',
          category: 'order_date',
          granularity: 'MONTH',
          values: [{ column: 'revenue', aggregation: 'SUM' }, { column: '' }],
        },
      })
    ).toEqual({
      name: 'Revenue trend',
      visual: {
        type: 'LineChart',
        category: 'order_date',
        granularity: 'MONTH',
        values: [{ column: 'revenue', aggregation: 'SUM' }],
      },
    });
    expect(
      validateVisualTemplateInput({
        name: 'k',
        visual: { type: 'KPI', category: 'x', values: [{ column: 'n' }] },
      }).visual
    ).toEqual({
      type: 'KPI',
      values: [{ column: 'n' }],
    });
    expect(() =>
      validateVisualTemplateInput({
        name: 'x',
        visual: { type: 'Radar', values: [{ column: 'a' }] },
      })
    ).toThrow('visual.type');
    expect(() =>
      validateVisualTemplateInput({
        name: 'x',
        visual: { type: 'BarChart', values: [{ column: 'a' }] },
      })
    ).toThrow('needs visual.category');
    expect(() =>
      validateVisualTemplateInput({ name: 'x', visual: { type: 'Table', values: [] } })
    ).toThrow('1 to 10');
  });
});
