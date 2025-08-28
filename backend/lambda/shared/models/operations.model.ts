/**
 * Shared model for operation tracking across services
 * Uses a flexible, scalable approach without hardcoding operation types
 */

// Operation parsing constants
const OPERATION_CONSTANTS = {
  EXPECTED_PARTS: 3,
} as const;

/**
 * Operation context for tracking any type of operation
 */
export interface OperationContext {
  namespace?: string; // e.g., 'api', 'db', 'cache'
  resource?: string; // e.g., 'dashboard', 'dataset', 'user'
  action?: string; // e.g., 'list', 'describe', 'create', 'update'
  count?: number; // Number of operations (default: 1)
}

/**
 * Interface for services that track operations
 */
export interface OperationTracker {
  trackOperation(operation: string | OperationContext, count?: number): Promise<void>;
  getOperationStats(): Record<string, number>;
  resetOperationStats(): void;
}

/**
 * Helper to build operation names consistently
 * Uses a flexible dot-notation that can scale to any operation type
 */
export class OperationName {
  /**
   * Aggregate operations by prefix
   * Useful for getting all operations for a resource or namespace
   * @example
   * aggregateByPrefix({ 'api.dashboard.list': 5, 'api.dashboard.describe': 3 }, 'api.dashboard')
   * => 8
   */
  public static aggregateByPrefix(stats: Record<string, number>, prefix: string): number {
    return Object.entries(stats)
      .filter(([key]) => key.startsWith(prefix))
      .reduce((sum, [, count]) => sum + count, 0);
  }

  /**
   * Build an operation name from components
   * @example
   * build({ namespace: 'api', resource: 'dashboard', action: 'list' }) => 'api.dashboard.list'
   * build({ resource: 'cache', action: 'hit' }) => 'cache.hit'
   * build({ namespace: 'api', resource: 'dashboard' }) => 'api.dashboard'
   */
  public static build(context: OperationContext): string {
    const parts = [];
    if (context.namespace) {
      parts.push(context.namespace);
    }
    if (context.resource) {
      parts.push(context.resource);
    }
    if (context.action) {
      parts.push(context.action);
    }
    return parts.join('.');
  }

  /**
   * Group operations by a component (namespace, resource, or action)
   * @example
   * groupBy({ 'api.dashboard.list': 5, 'api.dataset.list': 3 }, 'resource')
   * => { dashboard: 5, dataset: 3 }
   */
  public static groupBy(
    stats: Record<string, number>,
    component: 'namespace' | 'resource' | 'action'
  ): Record<string, number> {
    const grouped: Record<string, number> = {};

    for (const [key, count] of Object.entries(stats)) {
      const parsed = OperationName.parse(key);
      const value = parsed[component];
      if (value) {
        grouped[value] = (grouped[value] || 0) + count;
      }
    }

    return grouped;
  }

  /**
   * Parse an operation name to extract components
   * @example
   * parse('api.dashboard.list') => { namespace: 'api', resource: 'dashboard', action: 'list' }
   * parse('cache.hit') => { resource: 'cache', action: 'hit' }
   */
  public static parse(operationName: string): OperationContext {
    const parts = operationName.split('.');
    const context: OperationContext = {};

    // Common patterns:
    // api.{resource}.{action} - API operations
    // cache.{action} - Cache operations
    // db.{table}.{action} - Database operations

    if (parts.length === OPERATION_CONSTANTS.EXPECTED_PARTS) {
      context.namespace = parts[0];
      context.resource = parts[1];
      context.action = parts[2];
    } else if (parts.length === 2) {
      // Could be namespace.resource or resource.action
      // Use convention: if first part is a known namespace, treat as namespace.resource
      if (parts[0] && ['api', 'db', 'cache', 'queue', 's3'].includes(parts[0])) {
        context.namespace = parts[0];
        context.resource = parts[1];
      } else {
        context.resource = parts[0];
        context.action = parts[1];
      }
    } else if (parts.length === 1) {
      context.resource = parts[0];
    }

    return context;
  }
}
