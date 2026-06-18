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
