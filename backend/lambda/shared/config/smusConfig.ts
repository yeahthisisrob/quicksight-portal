/**
 * SageMaker Unified Studio (SMUS) integration config.
 *
 * SMUS is built on Amazon DataZone — SMUS_DOMAIN_ID is the DataZone domain
 * identifier (dzd_xxxx) that scopes all catalog API calls. The portal URL is
 * derived from the domain id + region by default; set SMUS_PORTAL_URL to
 * override for custom domains.
 *
 * The integration is disabled (and invisible in the UI) when SMUS_DOMAIN_ID
 * is unset.
 */
import { settingsStore } from '../services/settings/SettingsStore';

export interface SmusConfig {
  enabled: boolean;
  domainId: string;
  region: string;
  portalUrl: string;
  /** Owning project ids the catalog sweep is limited to; empty means all. */
  projectIds: string[];
  /** Glob patterns a listing's Glue database must match; empty means any. */
  databasePatterns: string[];
}

/**
 * Stored settings win over env vars (see shared/services/settings). The
 * store is warmed per request by the API handler, so this stays synchronous.
 */
export function getSmusConfig(): SmusConfig {
  const domainId = settingsStore.getString('smus.domainId');
  const region = settingsStore.getString('smus.region') || process.env.AWS_REGION || 'us-east-1';
  const portalUrl =
    settingsStore.getString('smus.portalUrl') ||
    (domainId ? `https://${domainId}.sagemaker.${region}.on.aws` : '');
  const databasePatterns = settingsStore
    .getString('smus.databasePatterns')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    enabled: Boolean(domainId),
    domainId,
    region,
    portalUrl: portalUrl.replace(/\/$/, ''),
    projectIds: settingsStore.getList('smus.projectIds'),
    databasePatterns,
  };
}
