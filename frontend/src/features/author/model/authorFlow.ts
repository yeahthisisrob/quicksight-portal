/**
 * The Author flow: the steps that turn "a dashboard like this one, on that
 * dataset" - or "a dashboard from nothing, on these datasets" - into a
 * published asset, with a mockup before anything is written.
 *
 * This module is the pure part - which step is where, what a step needs
 * before it opens, what counts as done, and the list of edits the mockup
 * editor has made. The hook wires it to the server; the rail and the panels
 * only read `stepStatus`.
 */
import type { RebindMode, RebindSource } from '@/entities/definition';

import type {
  AuthorableAssetType,
  DefinitionChange,
  DefinitionOp,
} from '@/shared/api/modules/authoring';

import {
  addValue,
  type DraftValue,
  type DraftVisual,
  type NewAssetDataset,
  newVisual,
  removeValue,
  removeVisual,
  uniqueIdentifier,
  updateValue,
  updateVisual,
} from './newAsset';
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
  | 'visuals'
  | 'standard'
  | 'mockup'
  | 'publish';

/** Start from an existing dashboard or analysis, or from nothing. */
export type AuthorMode = 'from-source' | 'new';

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

/** From nothing: datasets, visuals, an optional standard, the mockup, publish. */
export const NEW_STEPS: readonly AuthorStepMeta[] = [
  { id: 'targets', label: 'Datasets', hint: 'What the new one reads from' },
  { id: 'visuals', label: 'Visuals', hint: 'Describe it, or name the columns' },
  { id: 'standard', label: 'Standard', hint: 'A template dashboard to lay it out on' },
  { id: 'mockup', label: 'Mockup', hint: 'See the result before it exists' },
  { id: 'publish', label: 'Publish', hint: 'Create it' },
];

/** The steps the rail shows: repair only when there is something to repair. */
export function authorSteps(
  hasRepair: boolean,
  mode: AuthorMode = 'from-source'
): AuthorStepMeta[] {
  if (mode === 'new') {
    return [...NEW_STEPS];
  }
  return AUTHOR_STEPS.filter((s) => s.id !== 'repair' || hasRepair);
}

export interface AuthorResult {
  assetType: RebindSource['type'];
  assetId: string;
  name: string;
  /** How it was written: in place, as a copy, or created from nothing. */
  mode: RebindMode | 'create';
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
  mode: AuthorMode;
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
  /** New mode: what is being made from nothing. */
  fresh: FreshAsset;
}

/** New mode: the datasets chosen, the visuals typed in or proposed, and where the audience comes from. */
export interface FreshAsset {
  assetType: AuthorableAssetType;
  name: string;
  sheetName: string;
  datasets: NewAssetDataset[];
  visuals: DraftVisual[];
  /** The asset whose permissions the new one inherits. */
  audience: RebindSource | null;
}

export const EMPTY_FRESH: FreshAsset = {
  assetType: 'dashboard',
  name: '',
  sheetName: '',
  datasets: [],
  visuals: [],
  audience: null,
};

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
  | { type: 'startNew' }
  | { type: 'setFreshAssetType'; assetType: AuthorableAssetType }
  | { type: 'setFreshName'; name: string }
  | { type: 'setFreshSheetName'; sheetName: string }
  | { type: 'addFreshDataset'; dataSetId: string; name: string }
  | { type: 'removeFreshDataset'; identifier: string }
  | { type: 'setFreshIdentifier'; identifier: string; next: string }
  | { type: 'setVisuals'; visuals: DraftVisual[] }
  | { type: 'addVisual' }
  | { type: 'updateVisual'; id: string; patch: Partial<Omit<DraftVisual, 'id'>> }
  | { type: 'removeVisual'; id: string }
  | { type: 'addValue'; id: string }
  | { type: 'updateValue'; id: string; index: number; patch: Partial<DraftValue> }
  | { type: 'removeValue'; id: string; index: number }
  | { type: 'setAudience'; audience: RebindSource | null }
  | { type: 'reset' };

export const initialAuthorFlowState: AuthorFlowState = {
  step: 'source',
  mode: 'from-source',
  source: null,
  result: null,
  visited: ['source'],
  ops: [],
  folder: null,
  selectedElement: null,
  template: null,
  typeRules: NO_TYPE_RULES,
  fresh: EMPTY_FRESH,
};

/** New mode starts on the Datasets step with nothing chosen. */
export const initialNewFlowState: AuthorFlowState = {
  ...initialAuthorFlowState,
  mode: 'new',
  step: 'targets',
  visited: ['targets'],
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

function withFresh(state: AuthorFlowState, patch: Partial<FreshAsset>): AuthorFlowState {
  return { ...state, fresh: { ...state.fresh, ...patch } };
}

export function authorFlowReducer(
  state: AuthorFlowState,
  action: AuthorFlowAction
): AuthorFlowState {
  switch (action.type) {
    case 'selectSource': {
      const same =
        state.mode === 'from-source' &&
        state.source?.id === action.source?.id &&
        state.source?.type === action.source?.type;
      if (same) {
        return { ...state, source: action.source };
      }
      // A different source invalidates everything downstream.
      return { ...initialAuthorFlowState, source: action.source };
    }
    case 'startNew':
      return state.mode === 'new' ? state : initialNewFlowState;
    case 'setFreshAssetType':
      return withFresh(state, { assetType: action.assetType });
    case 'setFreshName':
      return withFresh(state, { name: action.name });
    case 'setFreshSheetName':
      return withFresh(state, { sheetName: action.sheetName });
    case 'addFreshDataset': {
      if (state.fresh.datasets.some((d) => d.dataSetId === action.dataSetId)) {
        return state;
      }
      const identifier = uniqueIdentifier(
        action.name,
        state.fresh.datasets.map((d) => d.identifier)
      );
      return withFresh(state, {
        datasets: [
          ...state.fresh.datasets,
          { identifier, dataSetId: action.dataSetId, name: action.name },
        ],
      });
    }
    case 'removeFreshDataset':
      return withFresh(state, {
        datasets: state.fresh.datasets.filter((d) => d.identifier !== action.identifier),
        // Its visuals have nothing to read any more.
        visuals: state.fresh.visuals.filter((v) => v.identifier !== action.identifier),
      });
    case 'setFreshIdentifier': {
      const next = action.next.trim();
      if (
        !next ||
        next === action.identifier ||
        state.fresh.datasets.some((d) => d.identifier === next)
      ) {
        return state;
      }
      return withFresh(state, {
        datasets: state.fresh.datasets.map((d) =>
          d.identifier === action.identifier ? { ...d, identifier: next } : d
        ),
        visuals: state.fresh.visuals.map((v) =>
          v.identifier === action.identifier ? { ...v, identifier: next } : v
        ),
      });
    }
    case 'setVisuals':
      return withFresh(state, { visuals: action.visuals });
    case 'addVisual': {
      const identifier = state.fresh.datasets[0]?.identifier ?? '';
      return withFresh(state, { visuals: [...state.fresh.visuals, newVisual(identifier)] });
    }
    case 'updateVisual':
      return withFresh(state, {
        visuals: updateVisual(state.fresh.visuals, action.id, action.patch),
      });
    case 'removeVisual':
      return withFresh(state, { visuals: removeVisual(state.fresh.visuals, action.id) });
    case 'addValue':
      return withFresh(state, { visuals: addValue(state.fresh.visuals, action.id) });
    case 'updateValue':
      return withFresh(state, {
        visuals: updateValue(state.fresh.visuals, action.id, action.index, action.patch),
      });
    case 'removeValue':
      return withFresh(state, {
        visuals: removeValue(state.fresh.visuals, action.id, action.index),
      });
    case 'setAudience':
      return withFresh(state, { audience: action.audience });
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
  /** New mode: at least one visual is complete (title, dataset, a value column). */
  hasVisuals?: boolean;
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
  const published = state.result !== null;
  const hasRepair = (facts.repairIssues ?? 0) > 0;
  const { available, done } =
    state.mode === 'new' ? newModeGates(state, facts) : sourceModeGates(state, facts);

  const out = {} as Record<AuthorStep, StepStatus>;
  for (const { id } of authorSteps(hasRepair, state.mode)) {
    if (id === state.step) {
      out[id] = 'current';
    } else if (id === 'publish' ? published : done[id]) {
      out[id] = 'done';
    } else if (available[id]) {
      out[id] = 'available';
    } else {
      out[id] = 'locked';
    }
  }
  return out;
}

interface StepGates {
  available: Record<AuthorStep, boolean>;
  done: Record<AuthorStep, boolean>;
}

function sourceModeGates(state: AuthorFlowState, facts: DraftFacts): StepGates {
  const hasSource = state.source !== null;
  const changed = hasChanges(facts);
  const hasRepair = (facts.repairIssues ?? 0) > 0;
  return {
    available: {
      source: true,
      repair: hasSource && hasRepair,
      targets: hasSource,
      review: hasSource,
      visuals: false,
      standard: hasSource,
      // The editor lives in the mockup, so a source with anything to write is enough.
      mockup: hasSource && changed,
      publish: hasSource && changed && facts.canApply,
    },
    done: {
      source: hasSource,
      repair: hasRepair && Boolean(facts.repairsSettled) && state.visited.includes('repair'),
      targets: facts.hasTargets,
      review: facts.hasTargets && facts.canApply,
      visuals: false,
      standard: Boolean(facts.hasStandard),
      mockup: changed && facts.canApply && state.visited.includes('mockup'),
      publish: false,
    },
  };
}

/** From nothing: datasets first, then visuals; the mockup needs one complete visual. */
function newModeGates(state: AuthorFlowState, facts: DraftFacts): StepGates {
  const hasDatasets = state.fresh.datasets.length > 0;
  const hasVisuals = Boolean(facts.hasVisuals);
  return {
    available: {
      source: false,
      repair: false,
      targets: true,
      review: false,
      visuals: hasDatasets,
      standard: hasDatasets,
      mockup: hasDatasets && hasVisuals,
      publish: hasDatasets && hasVisuals && facts.canApply,
    },
    done: {
      source: false,
      repair: false,
      targets: hasDatasets,
      review: false,
      visuals: hasVisuals,
      standard: Boolean(facts.hasStandard),
      mockup: hasVisuals && facts.canApply && state.visited.includes('mockup'),
      publish: false,
    },
  };
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
