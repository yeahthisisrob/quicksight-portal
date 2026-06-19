/**
 * Revive QuickSight timestamp fields from ISO strings back to Date objects.
 *
 * Archived assets are stored as JSON, which serializes the Date timestamps that
 * QuickSight returns (e.g. time-range filter values, DateTime parameter
 * defaults, refresh-schedule StartAfterDateTime) into ISO strings. When those
 * values are fed back into Create* calls, the AWS SDK v3 marshals them as
 * `timestamp` shapes and throws:
 *   "string value cannot be converted to milliseconds since epoch"
 * (see https://github.com/aws/aws-sdk-js-v3/issues/6176).
 *
 * This walks a definition/schedule object and converts the known QuickSight
 * timestamp fields from ISO strings to Date objects, leaving everything else
 * untouched. It returns a new object; the input is not mutated.
 */

// Strict ISO-8601 date-time (date + time, optional fractional seconds + zone).
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

// Keys whose string values are QuickSight timestamps:
// - StaticValue: TimeRangeFilterValue (filter range min/max)
// - StaticValues: DateTime parameter declaration defaults (array)
// - StartAfterDateTime: refresh schedule start
// `Value` is handled separately (only under a TimeEqualityFilter) because the
// key is heavily reused for non-timestamp values elsewhere.
const TIMESTAMP_KEYS = new Set(['StaticValue', 'StaticValues', 'StartAfterDateTime']);

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATETIME.test(value) && !Number.isNaN(Date.parse(value));
}

export function reviveQuickSightTimestamps<T>(input: T, key?: string, parentKey?: string): T {
  if (Array.isArray(input)) {
    return input.map((item) => reviveQuickSightTimestamps(item, key, parentKey)) as unknown as T;
  }

  if (input && typeof input === 'object' && !(input instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = reviveQuickSightTimestamps(v, k, key);
    }
    return out as unknown as T;
  }

  if (typeof input === 'string') {
    const isTimestampField =
      TIMESTAMP_KEYS.has(key || '') || (key === 'Value' && parentKey === 'TimeEqualityFilter');
    if (isTimestampField && isIsoDateTime(input)) {
      return new Date(input) as unknown as T;
    }
  }

  return input;
}
