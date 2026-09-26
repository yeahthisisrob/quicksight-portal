/**
 * What people mean when they ask for things: the phrases that turn up in
 * authoring requests, mapped onto the constructs the API can build
 * (VisualSpec, FilterSpec with its control and placement, VisualAction,
 * DefinitionOp). The assistant reads it in its prompt and in its plan
 * tool's schema, so "a table with a filter" and "add an action filter"
 * always become the same build, and the API contract is the only place the
 * constructs themselves are defined.
 *
 * An organisation adds its own words in Settings (guidance.vocabulary),
 * one "phrase = meaning" per line.
 */
import { settingsStore } from '../services/settings/SettingsStore';

export interface VocabularyEntry {
  /** How people say it. */
  phrases: string[];
  /** What to build, in the API's terms. */
  means: string;
}

const AUTHORING_VOCABULARY: readonly VocabularyEntry[] = [
  // Filters and their controls
  {
    phrases: ['with a filter', 'filter by X', 'let me filter', 'filter control', 'slicer'],
    means:
      'a filter on that column with its control: create.filters[] (or an addFilter op on an existing asset). Every filter asked for is in the build; none is implied.',
  },
  {
    phrases: ['dropdown', 'pick list', 'multi-select'],
    means: "control 'dropdown' (multi-select) - the default for a text column",
  },
  { phrases: ['pick one', 'single select', 'one at a time'], means: "control 'singleSelect'" },
  { phrases: ['checkbox list', 'list of values'], means: "control 'list'" },
  {
    phrases: ['date range', 'between dates', 'from/to dates'],
    means: "control 'dateRange' - the default for a date column",
  },
  {
    phrases: ['last 30 days', 'last N days', 'rolling window', 'recent'],
    means: "control 'relativeDate' with lastDays",
  },
  {
    phrases: ['range slider', 'between N and M', 'min/max'],
    means:
      "control 'slider' on a number column; it needs min and max (read them from the data or ask)",
  },
  {
    phrases: ['filter bar', 'top bar', 'control bar', 'at the top'],
    means: "placement 'controlBar' - the collapsible strip at the top; the default",
  },
  {
    phrases: ['on the sheet', 'on the canvas', 'next to the chart', 'visible above the visuals'],
    means: "placement 'canvas'",
  },
  {
    phrases: ['only for the table', 'just this chart', 'only filters X'],
    means: 'appliesTo: [the key or title of those visuals]; every visual when omitted',
  },
  // Interactions
  {
    phrases: [
      'action filter',
      'click to filter',
      'cross-filter',
      'clicking X filters Y',
      'interactive',
      'drill down on click',
    ],
    means:
      "a VisualAction kind 'filter' on the visual that is clicked (visual.actions[] when creating, an addAction op when editing); targets = the visuals it filters, every other visual when omitted",
  },
  {
    phrases: ['drill through', 'drill to', 'go to the detail sheet', 'navigate to'],
    means: "a VisualAction kind 'navigate' with the sheet's name",
  },
  // Visuals
  {
    phrases: ['KPI', 'big number', 'headline number', 'scorecard'],
    means: 'visual type KPI (values only, no category)',
  },
  { phrases: ['table', 'list of', 'detail rows', 'grid'], means: 'visual type Table' },
  { phrases: ['pivot', 'matrix', 'crosstab'], means: 'visual type PivotTable (rows + columns)' },
  {
    phrases: ['trend', 'over time', 'by month'],
    means: 'visual type LineChart with the date as category and a granularity',
  },
  {
    phrases: ['breakdown', 'by region', 'compare', 'ranking', 'top N'],
    means: 'visual type BarChart (horizontal) or ColumnChart (vertical)',
  },
  { phrases: ['share', 'mix', 'proportion', 'split'], means: 'visual type PieChart or DonutChart' },
  // Edits
  {
    phrases: [
      'add a filter',
      'add a chart',
      'add an action',
      'change the chart to',
      'move',
      'rename',
    ],
    means:
      "on an existing asset these are ops (addFilter, addVisual, addAction, retype, move, retitle); the plan's build is `edit`",
  },
];

/** The organisation's own words from Settings: "phrase = meaning" per line. */
export function readCustomVocabulary(
  get: (key: string) => string = (k) => settingsStore.getString(k)
): VocabularyEntry[] {
  return get('guidance.vocabulary')
    .split('\n')
    .map((line) => line.split('='))
    .filter((parts) => parts.length >= 2 && parts[0]!.trim() && parts.slice(1).join('=').trim())
    .map((parts) => ({ phrases: [parts[0]!.trim()], means: parts.slice(1).join('=').trim() }));
}

/** The vocabulary as a prompt section; the organisation's words win and come first. */
export function vocabularySection(custom: VocabularyEntry[] = []): string {
  const line = (e: VocabularyEntry) => `- "${e.phrases.join('", "')}" -> ${e.means}`;
  return [
    'What people mean (map every request onto these before planning; build exactly what was asked, no more, no less):',
    ...(custom.length ? ["This organisation's words:", ...custom.map(line), 'In general:'] : []),
    ...AUTHORING_VOCABULARY.map(line),
  ].join('\n');
}
