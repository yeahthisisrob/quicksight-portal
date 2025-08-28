/**
 * Route utilities for parameter extraction and route matching
 * Following VSA pattern - utilities only, no business logic or route definitions
 */

/**
 * Extracts path parameters from a regex match based on the route pattern
 */
export function extractPathParams(
  path: string,
  pattern: RegExp,
  paramNames?: string[]
): Record<string, string> {
  const match = path.match(pattern);
  if (!match || match.length <= 1) {
    return {};
  }

  const params: Record<string, string> = {};

  // If param names are provided, use them
  if (paramNames && paramNames.length > 0) {
    paramNames.forEach((name, index) => {
      const value = match[index + 1];
      if (value !== undefined) {
        params[name] = value;
      }
    });
    return params;
  }

  // Otherwise, infer param names based on common route patterns
  return inferParamNames(path, match);
}

/**
 * Route pattern configuration type
 */
interface RoutePattern {
  readonly prefix: string;
  readonly excludes: readonly string[];
  readonly params: readonly string[];
  readonly minMatchLength?: number;
}

/**
 * Route pattern configurations for parameter inference
 */
const ROUTE_PATTERNS: readonly RoutePattern[] = [
  {
    prefix: '/folders/',
    excludes: [],
    params: ['id', 'memberId'],
  },
  {
    prefix: '/users/',
    excludes: [],
    params: ['id'],
  },
  {
    prefix: '/groups/',
    excludes: [],
    params: ['id'],
  },
  {
    prefix: '/tags/',
    excludes: ['/batch', '/bulk'],
    params: ['assetType', 'assetId'],
  },
  {
    prefix: '/assets/',
    excludes: [],
    params: ['assetType', 'assetId'],
    minMatchLength: 3,
  },
  {
    prefix: '/jobs/',
    excludes: [],
    params: ['jobId'],
  },
  {
    prefix: '/export/',
    excludes: [],
    params: ['assetType'],
  },
  {
    prefix: '/activity/',
    excludes: [],
    params: ['assetType', 'assetId'],
    minMatchLength: 3,
  },
  {
    prefix: '/data-catalog/field/',
    excludes: [],
    params: ['sourceType', 'sourceId', 'fieldName'],
  },
] as const;

/**
 * Infers parameter names based on common route patterns
 */
function inferParamNames(path: string, match: RegExpMatchArray): Record<string, string> {
  // Find matching route pattern
  const routePattern = findMatchingRoutePattern(path, match);

  if (routePattern) {
    return mapMatchToParams(match, routePattern.params);
  }

  // Default: numbered parameters
  return createDefaultParams(match);
}

/**
 * Find the matching route pattern for a given path
 */
function findMatchingRoutePattern(path: string, match: RegExpMatchArray): RoutePattern | undefined {
  return ROUTE_PATTERNS.find(
    (pattern) =>
      path.startsWith(pattern.prefix) &&
      !pattern.excludes.some((exclude) => path.includes(exclude)) &&
      (!pattern.minMatchLength || match.length >= pattern.minMatchLength)
  );
}

/**
 * Map regex match results to parameter names
 */
function mapMatchToParams(
  match: RegExpMatchArray,
  paramNames: readonly string[]
): Record<string, string> {
  const params: Record<string, string> = {};

  paramNames.forEach((name, index) => {
    const value = match[index + 1];
    if (value !== undefined) {
      params[name] = value;
    }
  });

  return params;
}

/**
 * Create default numbered parameters
 */
function createDefaultParams(match: RegExpMatchArray): Record<string, string> {
  const params: Record<string, string> = {};

  for (let i = 1; i < match.length; i++) {
    const value = match[i];
    if (value !== undefined) {
      params[`param${i}`] = value;
    }
  }

  return params;
}

/**
 * Helper to create a regex pattern from a path template
 * @example createPattern('/users/:id') => /^\/users\/([^\/]+)$/
 */
export function createPattern(template: string): RegExp {
  const pattern = template
    .replace(/:[^/]+/g, '([^/]+)') // Replace :param with capture group
    .replace(/\*/g, '.*'); // Support wildcards

  return new RegExp(`^${pattern}$`);
}

/**
 * Extracts parameter names from a route template
 * @example extractParamNames('/users/:id/posts/:postId') => ['id', 'postId']
 */
export function extractParamNames(template: string): string[] {
  const matches = template.match(new RegExp(':[^/]+', 'g')) || [];
  return matches.map((match) => match.substring(1));
}
