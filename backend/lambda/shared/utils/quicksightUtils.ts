/**
 * Utility functions for QuickSight operations
 */

/**
 * Check if a principal (from permissions) matches a specific group.
 * This handles various formats:
 * - Exact ARN match
 * - Exact group name match
 * - ARN ending with group name (e.g., "arn:aws:quicksight:us-east-1:123456789012:group/default/GroupName")
 *
 * @param principal The principal string from permissions
 * @param groupArn The full ARN of the group
 * @param groupName The name of the group
 * @returns true if the principal matches the group
 */
export function principalMatchesGroup(
  principal: string | undefined,
  groupArn: string,
  groupName: string
): boolean {
  if (!principal) {
    return false;
  }

  // Check exact match with ARN
  if (principal === groupArn) {
    return true;
  }

  // Check exact match with group name
  if (principal === groupName) {
    return true;
  }

  // Check if principal ends with the group name (for ARN format)
  // e.g., "arn:aws:quicksight:us-east-1:123456789012:group/default/GroupName"
  if (principal.endsWith(`/${groupName}`)) {
    return true;
  }

  return false;
}

/**
 * Check if a principal matches a specific user.
 * Similar to group matching but for users.
 *
 * @param principal The principal string from permissions
 * @param userArn The full ARN of the user
 * @param userName The name of the user
 * @returns true if the principal matches the user
 */
export function principalMatchesUser(
  principal: string | undefined,
  userArn: string,
  userName: string
): boolean {
  if (!principal) {
    return false;
  }

  // Check exact match with ARN
  if (principal === userArn) {
    return true;
  }

  // Check exact match with user name
  if (principal === userName) {
    return true;
  }

  // Check if principal ends with the user name (for ARN format)
  // e.g., "arn:aws:quicksight:us-east-1:123456789012:user/default/UserName"
  if (principal.endsWith(`/${userName}`)) {
    return true;
  }

  return false;
}

/**
 * Extract the namespace from a QuickSight ARN
 * @param arn The QuickSight ARN
 * @returns The namespace or 'default' if not found
 */
export function extractNamespaceFromArn(arn: string): string {
  // Format: arn:aws:quicksight:region:account:type/namespace/name
  const match = arn.match(/:(group|user|namespace)\/([^/]+)\//);
  return match?.[2] || 'default';
}

/**
 * Extract the resource name from a QuickSight ARN
 * @param arn The QuickSight ARN
 * @returns The resource name or empty string if not found
 */
export function extractResourceNameFromArn(arn: string): string {
  // Get the last part after the final slash
  const parts = arn.split('/');
  return parts[parts.length - 1] || '';
}
