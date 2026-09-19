/**
 * The layout standard a migration lands on: a template dashboard and the
 * bulk type rules. Pure: what the state holds, what the server is sent, and
 * the words the UI uses for it.
 */
import type { TemplateRequest, TypeRules } from '@/shared/api/modules/authoring';

export type EditableVisualType = NonNullable<TypeRules['chartFamily']>[number]['from'];

export const EDITABLE_VISUAL_TYPES: readonly EditableVisualType[] = [
  'BarChart',
  'ColumnChart',
  'LineChart',
  'PieChart',
  'DonutChart',
  'Table',
  'PivotTable',
];

export const VISUAL_TYPE_LABELS: Record<EditableVisualType, string> = {
  BarChart: 'Bar chart',
  ColumnChart: 'Column chart',
  LineChart: 'Line chart',
  PieChart: 'Pie chart',
  DonutChart: 'Donut chart',
  Table: 'Table',
  PivotTable: 'Pivot table',
};

export interface ChartRule {
  from: EditableVisualType;
  to: EditableVisualType;
}

/** The swaps people ask for most; the list accepts any pair. */
export const CHART_FAMILY_PRESETS: readonly ChartRule[] = [
  { from: 'Table', to: 'PivotTable' },
  { from: 'BarChart', to: 'ColumnChart' },
  { from: 'PieChart', to: 'DonutChart' },
];

export type TemplatePart = 'textBoxes' | 'controls' | 'sheetNames' | 'kpisFirst' | 'theme';

export const TEMPLATE_PARTS: ReadonlyArray<{ key: TemplatePart; label: string; help: string }> = [
  {
    key: 'textBoxes',
    label: 'Text boxes and title band',
    help: 'The template’s titles, notes and links come across at their positions.',
  },
  {
    key: 'controls',
    label: 'Filter and parameter controls',
    help: 'Rebound to your datasets where a column of the same name exists; dropped otherwise.',
  },
  { key: 'sheetNames', label: 'Sheet names', help: 'Each sheet takes the template’s name.' },
  {
    key: 'kpisFirst',
    label: 'KPIs first',
    help: 'When the template has a KPI band, KPIs lead at its KPI size.',
  },
  { key: 'theme', label: 'Theme', help: 'The template’s theme is written on the result.' },
];

/** A template chosen in the Standard step. */
export interface StandardTemplate {
  assetType: 'dashboard' | 'analysis';
  assetId: string;
  name: string;
  parts: Record<TemplatePart, boolean>;
}

export interface StandardTypeRules {
  chartFamily: ChartRule[];
  kpi: boolean;
  casts: boolean;
}

export const NO_TYPE_RULES: StandardTypeRules = { chartFamily: [], kpi: false, casts: false };

export function defaultParts(): Record<TemplatePart, boolean> {
  return { textBoxes: true, controls: true, sheetNames: true, kpisFirst: true, theme: true };
}

export function hasTypeRules(rules: StandardTypeRules): boolean {
  return rules.chartFamily.length > 0 || rules.kpi || rules.casts;
}

/** Anything in the Standard step that changes the written asset. */
export function hasStandard(template: StandardTemplate | null, rules: StandardTypeRules): boolean {
  return template !== null || hasTypeRules(rules);
}

export function templateRequest(template: StandardTemplate | null): TemplateRequest | undefined {
  if (!template) {
    return undefined;
  }
  return { assetType: template.assetType, assetId: template.assetId, ...template.parts };
}

export function typeRulesRequest(rules: StandardTypeRules): TypeRules | undefined {
  if (!hasTypeRules(rules)) {
    return undefined;
  }
  return {
    ...(rules.chartFamily.length > 0 ? { chartFamily: rules.chartFamily } : {}),
    ...(rules.kpi ? { kpi: true } : {}),
    ...(rules.casts ? { casts: true } : {}),
  };
}

/** Add a rule, replacing one with the same source type. A no-op swap is ignored. */
export function withChartRule(rules: StandardTypeRules, rule: ChartRule): StandardTypeRules {
  if (rule.from === rule.to) {
    return rules;
  }
  return {
    ...rules,
    chartFamily: [...rules.chartFamily.filter((r) => r.from !== rule.from), rule],
  };
}

export function withoutChartRule(
  rules: StandardTypeRules,
  from: EditableVisualType
): StandardTypeRules {
  return { ...rules, chartFamily: rules.chartFamily.filter((r) => r.from !== from) };
}

/** "text boxes and title band, theme" - the parts kept, for a summary row. */
export function describeParts(parts: Record<TemplatePart, boolean>): string {
  const kept = TEMPLATE_PARTS.filter((p) => parts[p.key]).map((p) => p.label.toLowerCase());
  if (kept.length === TEMPLATE_PARTS.length) {
    return 'everything';
  }
  return kept.length === 0 ? 'layout only' : kept.join(', ');
}

/** "table → pivot table, KPIs standardised, column casts" for a summary row. */
export function describeTypeRules(rules: StandardTypeRules): string {
  const parts = [
    ...rules.chartFamily.map(
      (r) =>
        `${VISUAL_TYPE_LABELS[r.from].toLowerCase()} → ${VISUAL_TYPE_LABELS[r.to].toLowerCase()}`
    ),
    ...(rules.kpi ? ['KPIs standardised'] : []),
    ...(rules.casts ? ['column casts'] : []),
  ];
  return parts.length === 0 ? 'None' : parts.join(', ');
}
