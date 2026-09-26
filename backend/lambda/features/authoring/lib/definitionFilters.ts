/**
 * Filters for a built sheet, by column name. The caller says which columns
 * the person filters on, and optionally the control, where it sits and
 * which visuals it narrows; the column's type decides the rest:
 *
 * - text: a multi-select dropdown (or single select, or a list)
 * - date: a date-range picker (or a relative date, "last 30 days")
 * - number: a range slider, which needs its bounds
 *
 * A control goes in the sheet's control bar unless it is placed on the
 * canvas; a filter narrows every visual on the sheet unless it names some.
 * A filter that cannot be built as asked is an error, never a quiet
 * omission: the person asked for it.
 */
import { randomUUID } from 'node:crypto';

import type { TargetColumn } from './columnResolution';

export const FILTER_CONTROLS = [
  'dropdown',
  'singleSelect',
  'list',
  'dateRange',
  'relativeDate',
  'slider',
] as const;
export type FilterControlKind = (typeof FILTER_CONTROLS)[number];

export const CONTROL_PLACEMENTS = ['controlBar', 'canvas'] as const;
export type ControlPlacement = (typeof CONTROL_PLACEMENTS)[number];

export interface FilterSpec {
  /** The dataset identifier the column belongs to. */
  identifier: string;
  column: string;
  /** Title on the control; the column name when omitted. */
  title?: string;
  /** The control; the column type's default when omitted. */
  control?: FilterControlKind;
  /** Where the control sits; the control bar when omitted. */
  placement?: ControlPlacement;
  /** Keys of the visuals it narrows (as given on each visual); all when omitted. */
  appliesTo?: string[];
  /** Text columns: the values selected to start with; all when omitted. */
  values?: string[];
  /** Numeric columns: the slider's bounds. */
  min?: number;
  max?: number;
  /** relativeDate: the last N days to start with. */
  lastDays?: number;
  /** Width in the control bar (grid units); a filter bar template sets it. */
  span?: number;
}

export interface BuiltFilters {
  filterGroups: any[];
  filterControls: any[];
  /** Control ids in the order they are laid out, with where and how wide. */
  controls: Array<{ id: string; placement: ControlPlacement; span?: number }>;
  /** Filters that could not be built as asked, each with the reason. */
  errors: string[];
}

const ID_LENGTH = 8;
const NUMERIC = new Set(['INTEGER', 'DECIMAL']);
const SLIDER_STEPS = 100;
const MAX_FILTERS = 12;
const DEFAULT_LAST_DAYS = 30;

const CONTROLS_FOR: Record<'text' | 'date' | 'number', FilterControlKind[]> = {
  text: ['dropdown', 'singleSelect', 'list'],
  date: ['dateRange', 'relativeDate'],
  number: ['slider'],
};
const DEFAULT_CONTROL: Record<'text' | 'date' | 'number', FilterControlKind> = {
  text: 'dropdown',
  date: 'dateRange',
  number: 'slider',
};

function newId(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, ID_LENGTH)}`;
}

function familyOf(column: TargetColumn): 'text' | 'date' | 'number' {
  if (column.type === 'DATETIME') return 'date';
  return NUMERIC.has(column.type ?? '') ? 'number' : 'text';
}

type Built = { filter: Record<string, any>; control: Record<string, any> } | string;

function buildOne(
  spec: FilterSpec,
  column: TargetColumn,
  kind: FilterControlKind,
  ids: { filterId: string; controlId: string }
): Built {
  const ref = { DataSetIdentifier: spec.identifier, ColumnName: column.name };
  const head = {
    FilterControlId: ids.controlId,
    Title: spec.title?.trim() || column.name,
    SourceFilterId: ids.filterId,
  };
  switch (kind) {
    case 'dateRange':
      return {
        filter: {
          TimeRangeFilter: {
            FilterId: ids.filterId,
            Column: ref,
            NullOption: 'ALL_VALUES',
            IncludeMinimum: true,
            IncludeMaximum: true,
            TimeGranularity: 'DAY',
          },
        },
        control: { DateTimePicker: { ...head, Type: 'DATE_RANGE' } },
      };
    case 'relativeDate':
      return {
        filter: {
          RelativeDatesFilter: {
            FilterId: ids.filterId,
            Column: ref,
            AnchorDateConfiguration: { AnchorOption: 'NOW' },
            TimeGranularity: 'DAY',
            RelativeDateType: 'LAST',
            RelativeDateValue: spec.lastDays ?? DEFAULT_LAST_DAYS,
            NullOption: 'ALL_VALUES',
          },
        },
        control: { RelativeDateTime: head },
      };
    case 'slider': {
      if (typeof spec.min !== 'number' || typeof spec.max !== 'number' || spec.max <= spec.min) {
        return `a slider on '${column.name}' needs min and max (min below max)`;
      }
      return {
        filter: {
          NumericRangeFilter: {
            FilterId: ids.filterId,
            Column: ref,
            NullOption: 'ALL_VALUES',
            IncludeMinimum: true,
            IncludeMaximum: true,
            RangeMinimum: { StaticValue: spec.min },
            RangeMaximum: { StaticValue: spec.max },
          },
        },
        control: {
          Slider: {
            ...head,
            Type: 'RANGE',
            MinimumValue: spec.min,
            MaximumValue: spec.max,
            StepSize: (spec.max - spec.min) / SLIDER_STEPS,
          },
        },
      };
    }
    default: {
      const values = (spec.values ?? []).filter((v) => typeof v === 'string' && v.length > 0);
      const single = kind === 'singleSelect';
      return {
        filter: {
          CategoryFilter: {
            FilterId: ids.filterId,
            Column: ref,
            Configuration: {
              FilterListConfiguration: values.length
                ? {
                    MatchOperator: 'CONTAINS',
                    CategoryValues: single ? values.slice(0, 1) : values,
                  }
                : { MatchOperator: 'CONTAINS', SelectAllOptions: 'FILTER_ALL_VALUES' },
            },
          },
        },
        control:
          kind === 'list'
            ? {
                List: {
                  ...head,
                  Type: 'MULTI_SELECT',
                  DisplayOptions: { SelectAllOptions: { Visibility: 'VISIBLE' } },
                },
              }
            : {
                Dropdown: {
                  ...head,
                  Type: single ? 'SINGLE_SELECT' : 'MULTI_SELECT',
                  ...(single
                    ? {}
                    : { DisplayOptions: { SelectAllOptions: { Visibility: 'VISIBLE' } } }),
                },
              },
      };
    }
  }
}

/**
 * Build the filters for one sheet. `visualIdOf` turns a visual key from
 * `appliesTo` into the visual's id on the sheet (undefined when there is no
 * such visual).
 */
export function buildFilters(
  sheetId: string,
  specs: FilterSpec[],
  columnOf: (identifier: string, name: string) => TargetColumn | undefined,
  visualIdOf: (key: string) => string | undefined = () => undefined
): BuiltFilters {
  const out: BuiltFilters = { filterGroups: [], filterControls: [], controls: [], errors: [] };
  if (specs.length > MAX_FILTERS) {
    out.errors.push(`At most ${MAX_FILTERS} filters on a sheet; ${specs.length} were asked for.`);
  }
  const seen = new Set<string>();
  for (const spec of specs.slice(0, MAX_FILTERS)) {
    const column = columnOf(spec.identifier, spec.column);
    if (!column) {
      out.errors.push(`Filter on '${spec.column}': '${spec.identifier}' has no such column.`);
      continue;
    }
    const key = `${spec.identifier}.${column.name.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const family = familyOf(column);
    const kind = spec.control ?? DEFAULT_CONTROL[family];
    if (!CONTROLS_FOR[family].includes(kind)) {
      out.errors.push(
        `Filter on '${column.name}': a ${kind} control does not fit a ${family} column; use ${CONTROLS_FOR[family].join(' or ')}.`
      );
      continue;
    }
    const scoped = (spec.appliesTo ?? []).map((k) => ({ key: k, id: visualIdOf(k) }));
    const unknown = scoped.filter((s) => !s.id).map((s) => s.key);
    if (unknown.length > 0) {
      out.errors.push(
        `Filter on '${column.name}' applies to ${unknown.map((k) => `'${k}'`).join(', ')}, which ${unknown.length === 1 ? 'is not a visual' : 'are not visuals'} on the sheet.`
      );
      continue;
    }
    const ids = { filterId: newId('flt'), controlId: newId('ctl') };
    const built = buildOne(spec, column, kind, ids);
    if (typeof built === 'string') {
      out.errors.push(`Filter on '${column.name}': ${built}.`);
      continue;
    }
    out.filterGroups.push({
      FilterGroupId: newId('fg'),
      Filters: [built.filter],
      ScopeConfiguration: {
        SelectedSheets: {
          SheetVisualScopingConfigurations: [
            scoped.length > 0
              ? {
                  SheetId: sheetId,
                  Scope: 'SELECTED_VISUALS',
                  VisualIds: scoped.map((s) => s.id as string),
                }
              : { SheetId: sheetId, Scope: 'ALL_VISUALS' },
          ],
        },
      },
      CrossDataset: 'SINGLE_DATASET',
      Status: 'ENABLED',
    });
    out.filterControls.push(built.control);
    out.controls.push({
      id: ids.controlId,
      placement: spec.placement ?? 'controlBar',
      ...(spec.span !== undefined ? { span: spec.span } : {}),
    });
  }
  return out;
}
