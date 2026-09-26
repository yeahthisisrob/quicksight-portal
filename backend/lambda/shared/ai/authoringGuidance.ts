/**
 * Your organisation's authoring conventions, from Settings, as the models
 * read them. The assistant and the planner both take them, so a rule
 * written once ("push row-level logic down to gold", "KPIs first") is
 * followed wherever a model builds or changes something.
 */
import { settingsStore } from '../services/settings/SettingsStore';

export type FieldStrategy = 'source' | 'dataset' | 'none';

export interface AuthoringGuidance {
  fieldStrategy: FieldStrategy;
  architecture: string;
  datasets: string;
  explorations: string;
  visuals: string;
  /** Calculated-field name prefixes: in analyses and dashboards, and in datasets. */
  calcFieldPrefix?: string;
  datasetCalcFieldPrefix?: string;
}

/** Which parts a given model call needs. */
export type GuidanceFocus = 'architecture' | 'datasets' | 'explorations' | 'visuals';

const STRATEGIES: readonly FieldStrategy[] = ['source', 'dataset', 'none'];

export function readAuthoringGuidance(
  get: (key: string) => string = (k) => settingsStore.getString(k)
): AuthoringGuidance {
  const strategy = get('guidance.fieldStrategy');
  return {
    fieldStrategy: (STRATEGIES as readonly string[]).includes(strategy)
      ? (strategy as FieldStrategy)
      : 'none',
    architecture: get('guidance.architecture').trim(),
    datasets: get('guidance.datasets').trim(),
    explorations: get('guidance.explorations').trim(),
    visuals: get('guidance.visuals').trim(),
    calcFieldPrefix: get('guidance.calcFieldPrefix').trim(),
    datasetCalcFieldPrefix: get('guidance.datasetCalcFieldPrefix').trim(),
  };
}

const HEADINGS: Record<GuidanceFocus, string> = {
  architecture: 'Architecture',
  datasets: 'Datasets',
  explorations: 'Analyses and dashboards',
  visuals: 'Visuals',
};

const STRATEGY_TEXT: Record<FieldStrategy, string> = {
  source:
    'Row-level (scalar) calculated fields belong upstream, materialised in the source tables (for example gold): never recompute one the dataset already has as a column, and recommend pushing the rest down as a follow-up.',
  dataset:
    'Row-level (scalar) calculated fields belong in the QuickSight dataset, where they are computed once: never recompute one the dataset already has as a column, and recommend moving the rest into the dataset.',
  none: 'Row-level calculated fields can live in the dataset or the analysis; never recompute one the dataset already has as a column.',
};

/** The naming standard as one sentence, or '' when neither prefix is set. */
function namingText(guidance: AuthoringGuidance): string {
  const rules = [
    guidance.calcFieldPrefix
      ? `"${guidance.calcFieldPrefix}" for calculated fields defined in an analysis or dashboard`
      : '',
    guidance.datasetCalcFieldPrefix
      ? `"${guidance.datasetCalcFieldPrefix}" for calculated fields defined in a dataset`
      : '',
  ].filter(Boolean);
  return rules.length
    ? `Name every new calculated field with the organisation's prefix: ${rules.join(', and ')}. Keep the rest of the name snake_case and say what it computes.`
    : '';
}

/**
 * The guidance as a prompt section, only the parts asked for and only the
 * parts written. Empty when nothing is configured, so an unconfigured
 * portal's prompts are unchanged.
 */
export function guidanceSection(guidance: AuthoringGuidance, focus: GuidanceFocus[]): string {
  const parts = focus.filter((f) => guidance[f]).map((f) => `${HEADINGS[f]}:\n${guidance[f]}`);
  const strategy =
    guidance.fieldStrategy !== 'none' || parts.length > 0
      ? `Calculated fields: ${STRATEGY_TEXT[guidance.fieldStrategy]} Aggregations, table calculations, level-aware calculations and anything that reads a parameter always stay in the analysis.`
      : '';
  const body = [...parts, strategy, namingText(guidance)].filter(Boolean);
  return body.length
    ? `This organisation's authoring guidance (from Settings). Follow it; where it conflicts with a general habit, it wins:\n${body.join('\n\n')}`
    : '';
}
