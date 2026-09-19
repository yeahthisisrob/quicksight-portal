/**
 * Definition entity - a QuickSight dashboard/analysis Definition, projected
 * into a wireframe model and drawn without data.
 */

/** Synthetic definitions for stories and tests; tree-shaken out of the app. */
export * as definitionFixtures from './lib/__fixtures__/definitions';
export {
  type DatasetOption,
  type RebindDraft,
  type RebindMode,
  type RebindSource,
  useRebindDraft,
} from './lib/useRebindDraft';
export {
  diffWireframeModels,
  elementRenames,
  type FieldRename,
  fieldKey,
  type WireframeDiff,
} from './lib/wireframeDiff';
export { buildWireframeModel } from './lib/wireframeModel';
export type * from './model/types';
export * from './ui';
