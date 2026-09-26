/**
 * Filters for a built sheet, by column name: the model says which columns
 * the person filters on (and any values to start with); the code decides
 * the rest. A text column gets a multi-select dropdown, a date a date-range
 * picker, a number a range slider when its bounds are known. Every filter
 * applies to all visuals on the sheet; its control goes in the sheet's
 * control bar (the builder places it).
 */
import { randomUUID } from 'node:crypto';

import type { TargetColumn } from './columnResolution';

export interface FilterSpec {
  /** The dataset identifier the column belongs to. */
  identifier: string;
  column: string;
  /** Title on the control; the column name when omitted. */
  title?: string;
  /** Text columns: the values selected to start with; all when omitted. */
  values?: string[];
  /** Numeric columns: the slider's bounds. */
  min?: number;
  max?: number;
}

export interface BuiltFilters {
  filterGroups: any[];
  filterControls: any[];
  /** Control ids in the order they are laid out. */
  controlIds: string[];
  warnings: string[];
}

const ID_LENGTH = 8;
const NUMERIC = new Set(['INTEGER', 'DECIMAL']);
const SLIDER_STEPS = 100;
export const MAX_FILTERS = 12;

function newId(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, ID_LENGTH)}`;
}

export function buildFilters(
  sheetId: string,
  specs: FilterSpec[],
  columnOf: (identifier: string, name: string) => TargetColumn | undefined
): BuiltFilters {
  const out: BuiltFilters = { filterGroups: [], filterControls: [], controlIds: [], warnings: [] };
  const seen = new Set<string>();
  for (const spec of specs.slice(0, MAX_FILTERS)) {
    const column = columnOf(spec.identifier, spec.column);
    if (!column) {
      out.warnings.push(`Filter on '${spec.column}' left out: '${spec.identifier}' has no such column.`);
      continue;
    }
    const key = `${spec.identifier}.${column.name.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const filterId = newId('flt');
    const controlId = newId('ctl');
    const ref = { DataSetIdentifier: spec.identifier, ColumnName: column.name };
    const title = spec.title?.trim() || column.name;
    let filter: Record<string, any>;
    let control: Record<string, any>;
    if (column.type === 'DATETIME') {
      filter = {
        TimeRangeFilter: {
          FilterId: filterId,
          Column: ref,
          NullOption: 'ALL_VALUES',
          IncludeMinimum: true,
          IncludeMaximum: true,
          TimeGranularity: 'DAY',
        },
      };
      control = {
        DateTimePicker: { FilterControlId: controlId, Title: title, SourceFilterId: filterId, Type: 'DATE_RANGE' },
      };
    } else if (NUMERIC.has(column.type ?? '')) {
      if (typeof spec.min !== 'number' || typeof spec.max !== 'number' || spec.max <= spec.min) {
        out.warnings.push(`Filter on '${column.name}' left out: a number filter needs min and max for its slider.`);
        continue;
      }
      filter = {
        NumericRangeFilter: {
          FilterId: filterId,
          Column: ref,
          NullOption: 'ALL_VALUES',
          IncludeMinimum: true,
          IncludeMaximum: true,
          RangeMinimum: { StaticValue: spec.min },
          RangeMaximum: { StaticValue: spec.max },
        },
      };
      control = {
        Slider: {
          FilterControlId: controlId,
          Title: title,
          SourceFilterId: filterId,
          Type: 'RANGE',
          MinimumValue: spec.min,
          MaximumValue: spec.max,
          StepSize: (spec.max - spec.min) / SLIDER_STEPS,
        },
      };
    } else {
      const values = (spec.values ?? []).filter((v) => typeof v === 'string' && v.length > 0);
      filter = {
        CategoryFilter: {
          FilterId: filterId,
          Column: ref,
          Configuration: {
            FilterListConfiguration: values.length
              ? { MatchOperator: 'CONTAINS', CategoryValues: values }
              : { MatchOperator: 'CONTAINS', SelectAllOptions: 'FILTER_ALL_VALUES' },
          },
        },
      };
      control = {
        Dropdown: {
          FilterControlId: controlId,
          Title: title,
          SourceFilterId: filterId,
          Type: 'MULTI_SELECT',
          DisplayOptions: { SelectAllOptions: { Visibility: 'VISIBLE' } },
        },
      };
    }
    out.filterGroups.push({
      FilterGroupId: newId('fg'),
      Filters: [filter],
      ScopeConfiguration: {
        SelectedSheets: { SheetVisualScopingConfigurations: [{ SheetId: sheetId, Scope: 'ALL_VISUALS' }] },
      },
      CrossDataset: 'SINGLE_DATASET',
      Status: 'ENABLED',
    });
    out.filterControls.push(control);
    out.controlIds.push(controlId);
  }
  return out;
}
