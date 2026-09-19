/**
 * The Author flow: five steps that turn "a dashboard like this one, on that
 * dataset" into a published asset, with a mockup before anything is written.
 *
 * This module is the pure part - which step is where, what a step needs
 * before it opens, what counts as done. The hook wires it to the server;
 * the rail and the panels only read `stepStatus`.
 */
import type { RebindMode, RebindSource } from '@/entities/definition';

export type AuthorStep = 'source' | 'targets' | 'review' | 'mockup' | 'publish';

export interface AuthorStepMeta {
  id: AuthorStep;
  label: string;
  hint: string;
}

export const AUTHOR_STEPS: readonly AuthorStepMeta[] = [
  { id: 'source', label: 'Source', hint: 'A dashboard or analysis to start from' },
  { id: 'targets', label: 'Datasets', hint: 'Where the copy should read from' },
  { id: 'review', label: 'Describe & review', hint: 'Say what you want, check the columns' },
  { id: 'mockup', label: 'Mockup', hint: 'See the result before it exists' },
  { id: 'publish', label: 'Publish', hint: 'Create the copy or apply in place' },
];

export interface AuthorResult {
  assetType: RebindSource['type'];
  assetId: string;
  name: string;
  mode: RebindMode;
  versionNumber?: number;
}

export interface AuthorFlowState {
  step: AuthorStep;
  source: RebindSource | null;
  result: AuthorResult | null;
  /** Steps the person has opened at least once. */
  visited: AuthorStep[];
}

export type AuthorFlowAction =
  | { type: 'selectSource'; source: RebindSource | null }
  | { type: 'goTo'; step: AuthorStep }
  | { type: 'published'; result: AuthorResult }
  | { type: 'reset' };

export const initialAuthorFlowState: AuthorFlowState = {
  step: 'source',
  source: null,
  result: null,
  visited: ['source'],
};

function visit(visited: AuthorStep[], step: AuthorStep): AuthorStep[] {
  return visited.includes(step) ? visited : [...visited, step];
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
}

export type StepStatus = 'locked' | 'available' | 'current' | 'done';

export function stepStatus(
  state: AuthorFlowState,
  facts: DraftFacts
): Record<AuthorStep, StepStatus> {
  const hasSource = state.source !== null;
  const published = state.result !== null;

  const available: Record<AuthorStep, boolean> = {
    source: true,
    targets: hasSource,
    review: hasSource,
    mockup: hasSource && facts.hasTargets,
    publish: hasSource && facts.hasTargets && facts.canApply,
  };
  const done: Record<AuthorStep, boolean> = {
    source: hasSource,
    targets: facts.hasTargets,
    review: facts.hasTargets && facts.canApply,
    mockup: facts.hasTargets && facts.canApply && state.visited.includes('mockup'),
    publish: published,
  };

  const out = {} as Record<AuthorStep, StepStatus>;
  for (const { id } of AUTHOR_STEPS) {
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

export function nextStep(step: AuthorStep): AuthorStep | null {
  const index = AUTHOR_STEPS.findIndex((s) => s.id === step);
  return AUTHOR_STEPS[index + 1]?.id ?? null;
}

export function previousStep(step: AuthorStep): AuthorStep | null {
  const index = AUTHOR_STEPS.findIndex((s) => s.id === step);
  return index > 0 ? (AUTHOR_STEPS[index - 1]?.id ?? null) : null;
}
