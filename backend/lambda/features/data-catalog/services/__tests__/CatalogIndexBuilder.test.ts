import { describe, expect, it } from 'vitest';

import { type FieldInfo } from '../../../../shared/services/cache/types';
import { CatalogIndexBuilder } from '../CatalogIndexBuilder';

const EXPECTED_DISTINCT_FIELDS = 3;

function field(partial: Partial<FieldInfo>): FieldInfo {
  return {
    fieldId: partial.fieldId || partial.fieldName || 'f',
    fieldName: partial.fieldName || 'field',
    dataType: partial.dataType || 'STRING',
    isCalculated: partial.isCalculated || false,
    sourceAssetType: partial.sourceAssetType || ('dataset' as any),
    sourceAssetId: partial.sourceAssetId || 'asset',
    sourceAssetName: partial.sourceAssetName || 'Asset',
    usageCount: 0,
    analysisCount: 0,
    dashboardCount: 0,
    lastUpdated: partial.lastUpdated || '2026-01-01T00:00:00.000Z',
    ...partial,
  } as FieldInfo;
}

describe('CatalogIndexBuilder.build', () => {
  const builder = new CatalogIndexBuilder();

  it('groups occurrences of the same field name across assets', () => {
    const index = builder.build([
      field({ fieldName: 'Revenue', sourceAssetId: 'ds-1', sourceAssetType: 'dataset' as any }),
      field({ fieldName: 'Revenue', sourceAssetId: 'dash-1', sourceAssetType: 'dashboard' as any }),
      field({ fieldName: 'Cost', sourceAssetId: 'ds-1', sourceAssetType: 'dataset' as any }),
    ]);

    expect(index.fields).toHaveLength(2);
    const revenue = index.fields.find((f) => f.fieldName === 'Revenue');
    expect(revenue?.perSource).toHaveLength(2);
  });

  it('bakes calculated-field expression analysis per source', () => {
    const index = builder.build([
      field({
        fieldName: 'Margin',
        isCalculated: true,
        expression: 'sum({Revenue}) - sum({Cost}) // profit',
        sourceAssetType: 'dataset' as any,
      }),
    ]);

    const margin = index.fields[0]?.perSource[0];
    expect(margin?.isCalculated).toBe(true);
    expect(margin?.fieldReferences).toEqual(['Revenue', 'Cost']);
    expect(margin?.hasComments).toBe(true);
    expect(margin?.expressionLength).toBeGreaterThan(0);
  });

  it('builds reverse lineage (usedBy) from calculated dependencies', () => {
    const index = builder.build([
      field({
        fieldName: 'Margin',
        isCalculated: true,
        expression: 'sum({Revenue}) - sum({Cost})',
      }),
      field({ fieldName: 'Revenue' }),
      field({ fieldName: 'Cost' }),
    ]);

    expect(index.lineage['Revenue']).toContain('Margin');
    expect(index.lineage['Cost']).toContain('Margin');
    expect(index.summary.totalDistinctFields).toBe(EXPECTED_DISTINCT_FIELDS);
  });
});
