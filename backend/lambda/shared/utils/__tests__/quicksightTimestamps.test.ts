import { describe, expect, it } from 'vitest';

import { reviveQuickSightTimestamps } from '../quicksightTimestamps';

const ISO = '2024-01-01T00:00:00.000Z';

describe('reviveQuickSightTimestamps', () => {
  it('converts TimeRangeFilter StaticValue strings to Date', () => {
    const def = {
      Sheets: [
        {
          FilterControls: [],
          Filters: [
            {
              TimeRangeFilter: {
                RangeMinimumValue: { StaticValue: ISO },
                RangeMaximumValue: { StaticValue: '2024-12-31T23:59:59Z' },
              },
            },
          ],
        },
      ],
    };

    const out: any = reviveQuickSightTimestamps(def);
    const filter = out.Sheets[0].Filters[0].TimeRangeFilter;
    expect(filter.RangeMinimumValue.StaticValue).toBeInstanceOf(Date);
    expect(filter.RangeMaximumValue.StaticValue).toBeInstanceOf(Date);
    expect(filter.RangeMinimumValue.StaticValue.toISOString()).toBe(ISO);
  });

  it('converts TimeEqualityFilter Value but not other Value fields', () => {
    const def = {
      a: { TimeEqualityFilter: { Value: ISO } },
      b: { CategoryFilter: { Value: ISO } }, // not a time filter -> untouched
    };
    const out: any = reviveQuickSightTimestamps(def);
    expect(out.a.TimeEqualityFilter.Value).toBeInstanceOf(Date);
    expect(out.b.CategoryFilter.Value).toBe(ISO);
  });

  it('converts DateTime parameter StaticValues arrays element-wise', () => {
    const def = {
      ParameterDeclarations: [
        { DateTimeParameterDeclaration: { DefaultValues: { StaticValues: [ISO, ISO] } } },
        { StringParameterDeclaration: { DefaultValues: { StaticValues: ['hello', 'world'] } } },
      ],
    };
    const out: any = reviveQuickSightTimestamps(def);
    const dt = out.ParameterDeclarations[0].DateTimeParameterDeclaration.DefaultValues.StaticValues;
    const str = out.ParameterDeclarations[1].StringParameterDeclaration.DefaultValues.StaticValues;
    expect(dt[0]).toBeInstanceOf(Date);
    expect(dt[1]).toBeInstanceOf(Date);
    expect(str).toEqual(['hello', 'world']);
  });

  it('converts refresh schedule StartAfterDateTime', () => {
    const schedule = {
      ScheduleId: 's1',
      StartAfterDateTime: ISO,
      ScheduleFrequency: { Interval: 'DAILY' },
    };
    const out: any = reviveQuickSightTimestamps(schedule);
    expect(out.StartAfterDateTime).toBeInstanceOf(Date);
    expect(out.ScheduleFrequency.Interval).toBe('DAILY');
  });

  it('leaves numeric StaticValue (numeric range filter) untouched', () => {
    const numericValue = 42;
    const def = { NumericRangeFilter: { RangeMinimumValue: { StaticValue: numericValue } } };
    const out: any = reviveQuickSightTimestamps(def);
    expect(out.NumericRangeFilter.RangeMinimumValue.StaticValue).toBe(numericValue);
  });

  it('does not convert non-ISO strings or unrelated fields', () => {
    const def = { Name: 'My Dashboard', StaticValue: 'not-a-date', Expression: 'sum({x})' };
    const out: any = reviveQuickSightTimestamps(def);
    expect(out.Name).toBe('My Dashboard');
    expect(out.StaticValue).toBe('not-a-date');
    expect(out.Expression).toBe('sum({x})');
  });

  it('does not mutate the input', () => {
    const def = { TimeEqualityFilter: { Value: ISO } };
    reviveQuickSightTimestamps(def);
    expect(def.TimeEqualityFilter.Value).toBe(ISO);
  });
});
