/**
 * Normalize a permissions payload to a plain array.
 *
 * Some stored describe*Permissions responses (notably dashboards) keep the full
 * response object `{ Permissions: [...], LinkSharingConfiguration?: ... }`
 * instead of the bare permissions array. This always returns the array, used for
 * both display and restore.
 */
export function normalizePermissionsArray(raw: any): any[] {
  let p = raw;
  if (p && !Array.isArray(p)) {
    p = p.Permissions || p.permissions || [];
  }
  return Array.isArray(p) ? p : [];
}
