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

/**
 * Recursively convert object keys from camelCase to PascalCase
 */
export function camelToPascal(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(camelToPascal);
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
      converted[pascalKey] = camelToPascal(value);
    }
    return converted;
  }

  return obj;
}

/**
 * Convert AWS SDK response to API response format
 * Preserves special fields like @metadata
 */
export function convertSdkToApi(sdkResponse: any): any {
  if (!sdkResponse) {
    return sdkResponse;
  }

  const converted: any = {};

  for (const [key, value] of Object.entries(sdkResponse)) {
    // Preserve special fields as-is
    if (key.startsWith('@') || key === '_isUploadedFile') {
      converted[key] = value;
    } else {
      // Convert PascalCase to camelCase
      const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
      converted[camelKey] = pascalToCamel(value);
    }
  }

  return converted;
}

/**
 * Convert API request to AWS SDK format
 */
export function convertApiToSdk(apiRequest: any): any {
  if (!apiRequest) {
    return apiRequest;
  }

  const converted: any = {};

  for (const [key, value] of Object.entries(apiRequest)) {
    // Skip special fields
    if (key.startsWith('@') || key === '_isUploadedFile') {
      continue;
    }

    // Convert camelCase to PascalCase
    const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
    converted[pascalKey] = camelToPascal(value);
  }

  return converted;
}
