/**
 * The Author flow: five steps that turn "a dashboard like this one, on that
 * dataset" into a published asset, with a mockup before anything is written.
 *
 * This module is the pure part - which step is where, what a step needs
 * before it opens, what counts as done, and the list of edits the mockup
 * editor has made. The hook wires it to the server; the rail and the panels
 * only read `stepStatus`.
 */
import type { RebindMode, RebindSource } from '@/entities/definition';

import type { DefinitionChange, DefinitionOp } from '@/shared/api/modules/authoring';

import {
  type ChartRule,
  type EditableVisualType,
  NO_TYPE_RULES,
  type StandardTemplate,
  type StandardTypeRules,
  type TemplatePart,
  withChartRule,
  withoutChartRule,
} from './standard';

export type AuthorStep =
  | 'source'
  | 'repair'
  | 'targets'
  | 'review'
  | 'standard'
  | 'mockup'
  | 'publish';

export interface AuthorStepMeta {
  id: AuthorStep;
  label: string;
  hint: string;
}

/** Every step, in order. Repair only shows when the source has issues. */
export const AUTHOR_STEPS: readonly AuthorStepMeta[] = [
  { id: 'source', label: 'Source', hint: 'A dashboard or analysis to start from' },
  { id: 'repair', label: 'Repair', hint: 'Fix what stops QuickSight from writing it' },
  { id: 'targets', label: 'Datasets', hint: 'Where the copy should read from' },
  { id: 'review', label: 'Describe & review', hint: 'Say what you want, check the columns' },
  { id: 'standard', label: 'Standard', hint: 'The template and the rules to migrate onto' },
  { id: 'mockup', label: 'Mockup', hint: 'See and edit the result before it exists' },
  { id: 'publish', label: 'Publish', hint: 'Create the copy or apply in place' },
];

/** The steps the rail shows: repair only when there is something to repair. */
export function authorSteps(hasRepair: boolean): AuthorStepMeta[] {
  return AUTHOR_STEPS.filter((s) => s.id !== 'repair' || hasRepair);
}

export interface AuthorResult {
  assetType: RebindSource['type'];
  assetId: string;
  name: string;
  mode: RebindMode;
  versionNumber?: number;
  /** The folder the copy was placed in, when one was chosen. */
  folderId?: string;
  /** What the server wrote, in plain language. */
  changes?: DefinitionChange[];
}

/** A QuickSight folder a copy can be published into. */
export interface AuthorFolder {
  id: string;
  name: string;
  path?: string;
}

/** The card the mockup editor's inspector is showing. */
export interface SelectedElement {
  sheetId: string;
  elementId: string;
}

export interface AuthorFlowState {
  step: AuthorStep;
  source: RebindSource | null;
  result: AuthorResult | null;
  /** Steps the person has opened at least once. */
  visited: AuthorStep[];
  /** Edits made in the mockup editor (and proposed by the planner), in order. */
  ops: DefinitionOp[];
  folder: AuthorFolder | null;
  selectedElement: SelectedElement | null;
  /** The template dashboard to migrate onto, when one is chosen. */
  template: StandardTemplate | null;
  /** Bulk conversions applied to every visual. */
  typeRules: StandardTypeRules;
}

export type AuthorFlowAction =
  | { type: 'selectSource'; source: RebindSource | null }
  | { type: 'goTo'; step: AuthorStep }
  | { type: 'published'; result: AuthorResult }
  | { type: 'addOps'; ops: DefinitionOp[] }
  | { type: 'removeOp'; index: number }
  | { type: 'undoOp' }
  | { type: 'clearOps' }
  | { type: 'setFolder'; folder: AuthorFolder | null }
  | { type: 'selectElement'; element: SelectedElement | null }
  | { type: 'setTemplate'; template: StandardTemplate | null }
  | { type: 'setTemplatePart'; part: TemplatePart; on: boolean }
  | { type: 'setTypeRules'; rules: Partial<StandardTypeRules> }
  | { type: 'addChartRule'; rule: ChartRule }
  | { type: 'removeChartRule'; from: EditableVisualType }
  | { type: 'reset' };

export const initialAuthorFlowState: AuthorFlowState = {
  step: 'source',
  source: null,
  result: null,
  visited: ['source'],
  ops: [],
  folder: null,
  selectedElement: null,
  template: null,
  typeRules: NO_TYPE_RULES,
};

function visit(visited: AuthorStep[], step: AuthorStep): AuthorStep[] {
  return visited.includes(step) ? visited : [...visited, step];
}

/** A removed element cannot stay selected. */
function selectionAfter(
  ops: DefinitionOp[],
  selected: SelectedElement | null
): SelectedElement | null {
  if (!selected) {
    return null;
  }
  const removed = ops.some(
    (op) =>
      op.op === 'remove' && op.sheetId === selected.sheetId && op.elementId === selected.elementId
  );
  return removed ? null : selected;
}

export function authorFlowReducer(
  state: AuthorFlowState,
  action: AuthorFlowAction
): AuthorFlowState {
  switch (action.type) {
    case 'selectSource': {
      const same =
        state.source?.id === action.source?.id && state.source?.type === action.source?.type;
      if (same) {
        return { ...state, source: action.source };
      }
      // A different source invalidates everything downstream.
      return { ...initialAuthorFlowState, source: action.source };
    }
    case 'goTo':
      return { ...state, step: action.step, visited: visit(state.visited, action.step) };
    case 'published':
      return { ...state, result: action.result, step: 'publish' };
    case 'addOps': {
      if (action.ops.length === 0) {
        return state;
      }
      const ops = [...state.ops, ...action.ops];
      return { ...state, ops, selectedElement: selectionAfter(ops, state.selectedElement) };
    }
    case 'removeOp': {
      if (action.index < 0 || action.index >= state.ops.length) {
        return state;
      }
      return { ...state, ops: state.ops.filter((_, i) => i !== action.index) };
    }
    case 'undoOp':
      return state.ops.length === 0 ? state : { ...state, ops: state.ops.slice(0, -1) };
    case 'clearOps':
      return state.ops.length === 0 ? state : { ...state, ops: [] };
    case 'setFolder':
      return { ...state, folder: action.folder };
    case 'selectElement':
      return { ...state, selectedElement: action.element };
    case 'setTemplate':
      return { ...state, template: action.template };
    case 'setTemplatePart':
      return state.template
        ? {
            ...state,
            template: {
              ...state.template,
              parts: { ...state.template.parts, [action.part]: action.on },
            },
          }
        : state;
    case 'setTypeRules':
      return { ...state, typeRules: { ...state.typeRules, ...action.rules } };
    case 'addChartRule':
      return { ...state, typeRules: withChartRule(state.typeRules, action.rule) };
    case 'removeChartRule':
      return { ...state, typeRules: withoutChartRule(state.typeRules, action.from) };
    case 'reset':
      return initialAuthorFlowState;
    default:
      return state;
  }
}

/** What the reducer cannot know on its own: the draft's server-checked state. */
export interface DraftFacts {
  /** At least one identifier has a target dataset. */
  hasTargets: boolean;
  /** The server dry run says everything resolves (or nothing needs to). */
  canApply: boolean;
  /** The mockup editor or the planner has made edits. */
  hasOps?: boolean;
  /** Calculated fields from the template library will be added. */
  hasAddedFields?: boolean;
  /** The result gets a name of its own (always true for a copy with a name). */
  renamed?: boolean;
  /** The server's repair plan found issues; the Repair step is shown. */
  repairIssues?: number;
  /** Accepted repairs (repair ops or renames) will be written. */
  hasRepairs?: boolean;
  /** Every issue has been dealt with: accepted, or left on purpose. */
  repairsSettled?: boolean;
  /** A template or a type rule was chosen in the Standard step. */
  hasStandard?: boolean;
}

export type StepStatus = 'locked' | 'available' | 'current' | 'done';

/** Anything at all would be different in the written asset. */
export function hasChanges(facts: DraftFacts): boolean {
  return Boolean(
    facts.hasTargets ||
      facts.hasOps ||
      facts.hasAddedFields ||
      facts.renamed ||
      facts.hasRepairs ||
      facts.hasStandard
  );
}

/**
 * The status of every step the rail shows. The record only carries the
 * repair step when the plan found issues, so the rail and the reducer's
 * callers never have to special-case a clean source.
 */
export function stepStatus(
  state: AuthorFlowState,
  facts: DraftFacts
): Record<AuthorStep, StepStatus> {
  const hasSource = state.source !== null;
  const published = state.result !== null;
  const changed = hasChanges(facts);
  const hasRepair = (facts.repairIssues ?? 0) > 0;

  const available: Record<AuthorStep, boolean> = {
    source: true,
    repair: hasSource && hasRepair,
    targets: hasSource,
    review: hasSource,
    standard: hasSource,
    // The editor lives in the mockup, so a source with anything to write is enough.
    mockup: hasSource && changed,
    publish: hasSource && changed && facts.canApply,
  };
  const done: Record<AuthorStep, boolean> = {
    source: hasSource,
    repair: hasRepair && Boolean(facts.repairsSettled) && state.visited.includes('repair'),
    targets: facts.hasTargets,
    review: facts.hasTargets && facts.canApply,
    standard: Boolean(facts.hasStandard),
    mockup: changed && facts.canApply && state.visited.includes('mockup'),
    publish: published,
  };

  const out = {} as Record<AuthorStep, StepStatus>;
  for (const { id } of authorSteps(hasRepair)) {
    if (id === state.step) {
      out[id] = 'current';
    } else if (done[id]) {
      out[id] = 'done';
    } else if (available[id]) {
      out[id] = 'available';
    } else {
      out[id] = 'locked';
    }
  }
  return out;
}

/** Step walkers default to the clean list; the hook passes the list it shows. */
const CLEAN_STEPS = authorSteps(false);

export function nextStep(
  step: AuthorStep,
  steps: readonly AuthorStepMeta[] = CLEAN_STEPS
): AuthorStep | null {
  const index = steps.findIndex((s) => s.id === step);
  return steps[index + 1]?.id ?? null;
}

export function previousStep(
  step: AuthorStep,
  steps: readonly AuthorStepMeta[] = CLEAN_STEPS
): AuthorStep | null {
  const index = steps.findIndex((s) => s.id === step);
  return index > 0 ? (steps[index - 1]?.id ?? null) : null;
}
