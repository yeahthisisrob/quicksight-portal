/**
 * The Studio's editing state: the asset open, the edits made on its mockup,
 * the card selected and the side panel showing. Pure: the hook wires it to
 * the server, the panels only read it.
 *
 * The Studio edits what exists. Making something new, rebinding onto other
 * datasets or migrating onto a standard is the Assistant's job.
 */
import type { RebindMode, RebindSource } from '@/entities/definition';

import type { DefinitionChange, DefinitionOp } from '@/shared/api/modules/authoring';

/** The side panels, one per thing the Studio does. */
export type StudioPanel = 'issues' | 'inspect' | 'changes' | 'data';

/** The card the inspector is showing. */
export interface SelectedElement {
  sheetId: string;
  elementId: string;
}

/** A QuickSight folder a copy can be saved into. */
export interface StudioFolder {
  id: string;
  name: string;
  path?: string;
}

/** What a save wrote. */
export interface StudioResult {
  assetType: RebindSource['type'];
  assetId: string;
  name: string;
  /** Saved in place, or as a copy. */
  mode: RebindMode;
  versionNumber?: number;
  /** The folders a copy was filed in: the one chosen and the defaults from Settings. */
  folderIds: string[];
  /** What the server wrote, in plain language. */
  changes?: DefinitionChange[];
}

export interface StudioState {
  source: RebindSource | null;
  /** Edits made on the mockup, in order. */
  ops: DefinitionOp[];
  selectedElement: SelectedElement | null;
  panel: StudioPanel;
  /** The last save, until the person moves on. */
  result: StudioResult | null;
}

type StudioAction =
  | { type: 'open'; source: RebindSource | null }
  | { type: 'addOps'; ops: DefinitionOp[] }
  | { type: 'removeOp'; index: number }
  | { type: 'undoOp' }
  | { type: 'clearOps' }
  | { type: 'selectElement'; element: SelectedElement | null }
  | { type: 'setPanel'; panel: StudioPanel }
  | { type: 'saved'; result: StudioResult }
  | { type: 'dismissResult' };

export const initialStudioState: StudioState = {
  source: null,
  ops: [],
  selectedElement: null,
  panel: 'issues',
  result: null,
};

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

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case 'open': {
      const same =
        state.source?.id === action.source?.id && state.source?.type === action.source?.type;
      // The same asset again only picks up a better name; another one starts clean.
      return same
        ? { ...state, source: action.source }
        : { ...initialStudioState, source: action.source };
    }
    case 'addOps': {
      if (action.ops.length === 0) {
        return state;
      }
      const ops = [...state.ops, ...action.ops];
      return { ...state, ops, selectedElement: selectionAfter(ops, state.selectedElement) };
    }
    case 'removeOp':
      return action.index < 0 || action.index >= state.ops.length
        ? state
        : { ...state, ops: state.ops.filter((_, i) => i !== action.index) };
    case 'undoOp':
      return state.ops.length === 0 ? state : { ...state, ops: state.ops.slice(0, -1) };
    case 'clearOps':
      return state.ops.length === 0 ? state : { ...state, ops: [] };
    case 'selectElement':
      // Clicking a card is asking to edit it: the inspector comes forward.
      return {
        ...state,
        selectedElement: action.element,
        panel: action.element ? 'inspect' : state.panel,
      };
    case 'setPanel':
      return { ...state, panel: action.panel };
    case 'saved':
      // What was written is in the asset now; the edits start over from it.
      return { ...state, result: action.result, ops: [], selectedElement: null };
    case 'dismissResult':
      return { ...state, result: null };
    default:
      return state;
  }
}
