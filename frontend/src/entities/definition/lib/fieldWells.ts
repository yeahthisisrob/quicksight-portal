/**
 * Field-well extraction.
 *
 * Every visual type nests its wells differently
 * (`BarChartAggregatedFieldWells.Category`, `PivotTableAggregatedFieldWells.Rows`,
 * KPI's bare `Values`, plugin visuals' `[{ AxisName, Dimensions, Measures }]`),
 * but the leaves are always arrays of single-key field objects:
 *
 *   { NumericalMeasureField: { FieldId, Column: { DataSetIdentifier, ColumnName }, AggregationFunction } }
 *
 * So rather than enumerate ~30 visual types, walk the FieldWells subtree and
 * treat any array of field objects as a well named after its key.
 */

import type { WireframeField, WireframeFieldWell } from '../model/types';

const FIELD_KEY = /Field$/;

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `{ CategoricalDimensionField: {...} }` - exactly one key, ending in Field. */
function isFieldObject(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 1 && FIELD_KEY.test(keys[0]) && isPlainObject(value[keys[0]]);
}

/**
 * AggregationFunction is either a string (`'COUNT'`, `'DISTINCT_COUNT'`) or
 * an object naming the family:
 *   { SimpleNumericalAggregation: 'SUM' }
 *   { PercentileAggregation: { PercentileValue: 90 } }
 *   { AttributeAggregationFunction: { SimpleAttributeAggregation: 'UNIQUE_VALUE' } }
 */
function readAggregation(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!isPlainObject(value)) return undefined;

  if (value.PercentileAggregation?.PercentileValue !== undefined) {
    return `PERCENTILE(${value.PercentileAggregation.PercentileValue})`;
  }
  for (const inner of Object.values(value)) {
    if (typeof inner === 'string') return inner;
    if (isPlainObject(inner)) {
      const nested = Object.values(inner).find((v) => typeof v === 'string');
      if (typeof nested === 'string') return nested;
    }
  }
  return undefined;
}

function readField(fieldObject: Record<string, any>): WireframeField {
  const [kind] = Object.keys(fieldObject);
  const body = fieldObject[kind] ?? {};
  const column = body.Column;

  const label: string =
    column?.ColumnName ??
    (kind === 'CalculatedMeasureField' && body.FieldId ? body.FieldId : undefined) ??
    body.FieldId ??
    kind;

  const field: WireframeField = { label };
  if (column?.DataSetIdentifier) field.dataSetIdentifier = column.DataSetIdentifier;

  const aggregation = readAggregation(body.AggregationFunction);
  if (aggregation) field.aggregation = aggregation;
  if (typeof body.DateGranularity === 'string') field.granularity = body.DateGranularity;

  return field;
}

/** Walk a FieldWells subtree and collect every well that has at least one field. */
export function collectFieldWells(
  node: unknown,
  wells: WireframeFieldWell[] = []
): WireframeFieldWell[] {
  if (Array.isArray(node)) {
    for (const item of node) collectFieldWells(item, wells);
    return wells;
  }
  if (!isPlainObject(node)) return wells;

  for (const [key, value] of Object.entries(node)) {
    if (Array.isArray(value) && value.length > 0 && value.every(isFieldObject)) {
      wells.push({ role: key, fields: value.map((f) => readField(f)) });
    } else if (Array.isArray(value) || isPlainObject(value)) {
      collectFieldWells(value, wells);
    }
  }
  return wells;
}
