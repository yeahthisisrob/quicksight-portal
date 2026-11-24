/**
 * Metadata sync config. Off unless Settings turns it on: it is the one part
 * of the portal that writes outside QuickSight, into Glue and SageMaker
 * Unified Studio, so a deployment opts in. It reads the SMUS snapshot, so it
 * also needs SMUS configured.
 */
import { settingsStore } from '../services/settings/SettingsStore';
import { getSmusConfig } from './smusConfig';

export interface MetadataSyncConfig {
  /** On in Settings and SMUS configured: a pass can run. */
  enabled: boolean;
  /** What Settings says, whether or not SMUS is there to read. */
  turnedOn: boolean;
  smusConfigured: boolean;
  /** Projects whose own assets are synced, published or not, beside the published listings. */
  projectIds: string[];
}

export function getMetadataSyncConfig(): MetadataSyncConfig {
  const turnedOn = settingsStore.get('metadataSync.enabled') === true;
  const smusConfigured = getSmusConfig().enabled;
  return {
    enabled: turnedOn && smusConfigured,
    turnedOn,
    smusConfigured,
    projectIds: settingsStore.getList('metadataSync.projectIds'),
  };
}
