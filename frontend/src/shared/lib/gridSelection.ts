import type { GridRowId, GridRowSelectionModel } from '@mui/x-data-grid';

/**
 * Adapters for the DataGrid selection model.
 *
 * x-data-grid v8 changed `GridRowSelectionModel` from a plain `GridRowId[]` to
 * a discriminated object:
 *
 *     { type: 'include' | 'exclude'; ids: Set<GridRowId> }
 *
 * `exclude` means "every row except these", which is what the header checkbox
 * produces when it selects across pages. Reading `.ids` directly is therefore
 * wrong for that case, so go through these helpers instead of touching the
 * shape at call sites.
 */

export const EMPTY_SELECTION: GridRowSelectionModel = {
  type: 'include',
  ids: new Set<GridRowId>(),
};

/** Is this row selected, in either mode? */
export function isRowSelected(model: GridRowSelectionModel, id: GridRowId): boolean {
  return model.type === 'exclude' ? !model.ids.has(id) : model.ids.has(id);
}

/**
 * How many rows are selected. `totalRows` is only consulted in exclude mode,
 * where the count is everything minus the exclusions.
 */
export function selectionCount(model: GridRowSelectionModel, totalRows = 0): number {
  return model.type === 'exclude' ? Math.max(0, totalRows - model.ids.size) : model.ids.size;
}

/** Build an include-mode model from explicit ids. */
export function selectionOf(ids: Iterable<GridRowId>): GridRowSelectionModel {
  return { type: 'include', ids: new Set(ids) };
}
