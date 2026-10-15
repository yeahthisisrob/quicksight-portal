/**
 * The authoring defaults an admin sets in Settings, read where a request
 * leaves the choice open. One home each, so the planner, the assistant and
 * the dataset builder cannot disagree about what "unsaid" means.
 */
import { settingsStore } from './SettingsStore';

/** How a new dataset holds its data when the request does not say (`authoring.datasetImportMode`). */
export function defaultImportMode(): 'DIRECT_QUERY' | 'SPICE' {
  return settingsStore.get('authoring.datasetImportMode') === 'DIRECT_QUERY'
    ? 'DIRECT_QUERY'
    : 'SPICE';
}

/**
 * Whether a change to an existing analysis or dashboard is made on a copy
 * (`clone`, the safe default) or to the asset itself (`update`), when the
 * ask does not say (`authoring.editMode`).
 */
export function defaultApplyMode(): 'clone' | 'update' {
  return settingsStore.get('authoring.editMode') === 'inPlace' ? 'update' : 'clone';
}
