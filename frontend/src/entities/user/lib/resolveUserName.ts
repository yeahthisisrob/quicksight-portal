/**
 * The QuickSight user name for anything that represents a user in the UI.
 *
 * Users reach the group dialogs in two shapes: a users-grid row (generated
 * UserListItem: `name` / `id`) and the legacy `{ userName }` selection. Every
 * dialog used to pick its own field, and the bulk path picked the wrong one -
 * `[null]` went over the wire and died inside the SDK. Resolve it in one place.
 */
export interface UserLike {
  userName?: string | null;
  name?: string | null;
  id?: string | null;
  email?: string | null;
}

export function resolveUserName(user: UserLike | null | undefined): string {
  const candidate = user?.userName || user?.name || user?.id || '';
  return typeof candidate === 'string' ? candidate.trim() : '';
}

/** Resolved, de-duplicated, non-blank user names for a selection */
export function resolveUserNames(users: ReadonlyArray<UserLike | null | undefined>): string[] {
  return [...new Set(users.map(resolveUserName).filter(Boolean))];
}
