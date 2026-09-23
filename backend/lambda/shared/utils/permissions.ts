/**
 * Shared helpers for QuickSight permission payloads.
 */

export type PrincipalType = 'USER' | 'GROUP' | 'NAMESPACE' | 'PUBLIC';

/**
 * Infer the QuickSight principal type from a principal ARN.
 * Uses precise ARN segment checks so a user/group name that merely contains the
 * word "group"/"namespace" is not misclassified.
 */
export function determinePrincipalType(principal: string): PrincipalType {
  if (!principal) {
    return 'USER';
  }
  // Wildcard from LinkSharingConfiguration => public
  if (principal === '*') {
    return 'PUBLIC';
  }
  if (principal.includes(':namespace/')) {
    return 'NAMESPACE';
  }
  if (principal.includes(':group/')) {
    return 'GROUP';
  }
  return 'USER';
}

/**
 * Normalize a permissions payload to a plain array.
 *
 * Some stored describe*Permissions responses (notably dashboards) keep the full
 * response object `{ Permissions: [...], LinkSharingConfiguration?: ... }`
 * instead of the bare permissions array. This always returns the array.
 */
export function normalizePermissionsArray(raw: unknown): any[] {
  let p: any = raw;
  if (p && !Array.isArray(p)) {
    p = p.Permissions || p.permissions || [];
  }
  return Array.isArray(p) ? p : [];
}

/** What QuickSight's console grants a dataset viewer. */
export const DATASET_VIEWER_ACTIONS = [
  'quicksight:DescribeDataSet',
  'quicksight:DescribeDataSetPermissions',
  'quicksight:PassDataSet',
  'quicksight:DescribeIngestion',
  'quicksight:ListIngestions',
];

/** What QuickSight's console grants a dataset owner. */
export const DATASET_OWNER_ACTIONS = [
  ...DATASET_VIEWER_ACTIONS,
  'quicksight:UpdateDataSet',
  'quicksight:DeleteDataSet',
  'quicksight:CreateIngestion',
  'quicksight:CancelIngestion',
  'quicksight:UpdateDataSetPermissions',
];

export interface ResourcePermissionEntry {
  Principal: string;
  Actions: string[];
}

/**
 * The same audience on a dataset as on a dashboard or analysis: whoever can
 * change the asset owns the dataset, everyone else can read it. Link
 * sharing (`*`) and malformed entries are left out; a dataset has no public
 * link.
 */
export function datasetPermissionsFor(assetPermissions: unknown): ResourcePermissionEntry[] {
  return normalizePermissionsArray(assetPermissions)
    .filter(
      (p): p is { Principal: string; Actions?: unknown } =>
        typeof p?.Principal === 'string' && p.Principal !== '' && p.Principal !== '*'
    )
    .map((p) => {
      const actions = Array.isArray(p.Actions)
        ? p.Actions.filter((a) => typeof a === 'string')
        : [];
      const owner = actions.some((a: string) => /^quicksight:(Update|Delete)/.test(a));
      return {
        Principal: p.Principal,
        Actions: owner ? [...DATASET_OWNER_ACTIONS] : [...DATASET_VIEWER_ACTIONS],
      };
    });
}
