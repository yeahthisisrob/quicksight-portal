/**
 * "These kinds of asset changed" - said once by whatever changed them (a
 * dialog, a bulk job finishing, an assistant action), heard by the asset
 * lists, which re-fetch with their own filters and invalidate what is built
 * from them. A mutation site names what it touched instead of guessing the
 * query keys of every view that shows it; both sides of a membership change
 * are named (a folder and its members, a group and its users).
 */
export type ChangedAssetType =
  | 'dashboard'
  | 'analysis'
  | 'dataset'
  | 'datasource'
  | 'folder'
  | 'user'
  | 'group';

export const ALL_ASSET_TYPES: readonly ChangedAssetType[] = [
  'dashboard',
  'analysis',
  'dataset',
  'datasource',
  'folder',
  'user',
  'group',
];

type Listener = (types: readonly ChangedAssetType[]) => void;

const listeners = new Set<Listener>();

export function announceAssetChanges(types: readonly ChangedAssetType[] = ALL_ASSET_TYPES): void {
  const unique = [...new Set(types)];
  if (unique.length === 0) return;
  for (const listener of listeners) {
    listener(unique);
  }
}

/** Subscribe; returns the unsubscribe. */
export function onAssetChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
