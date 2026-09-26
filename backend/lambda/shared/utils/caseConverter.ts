/**
 * Utility functions for converting between PascalCase (AWS SDK) and camelCase (API/Frontend)
 */

/**
 * Recursively convert object keys from PascalCase to camelCase
 */
export function pascalToCamel(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(pascalToCamel);
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
      converted[camelKey] = pascalToCamel(value);
    }
    return converted;
  }

  return obj;
}
