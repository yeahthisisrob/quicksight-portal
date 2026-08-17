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
export interface SmusConfig {
  enabled: boolean;
  domainId: string;
  region: string;
  portalUrl: string;
}

export function getSmusConfig(): SmusConfig {
  const domainId = process.env.SMUS_DOMAIN_ID || '';
  const region = process.env.SMUS_DOMAIN_REGION || process.env.AWS_REGION || 'us-east-1';
  const portalUrl =
    process.env.SMUS_PORTAL_URL ||
    (domainId ? `https://${domainId}.sagemaker.${region}.on.aws` : '');

  return {
    enabled: Boolean(domainId),
    domainId,
    region,
    portalUrl: portalUrl.replace(/\/$/, ''),
  };
}
