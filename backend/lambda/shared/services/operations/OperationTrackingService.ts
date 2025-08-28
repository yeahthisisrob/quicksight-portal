/**
 * Service for tracking operations across the application
 * Can be connected to JobStateService or used standalone
 */

import {
  OperationName,
  type OperationContext,
  type OperationTracker,
} from '../../models/operations.model';
import { type JobStateService } from '../jobs/JobStateService';

export class OperationTrackingService implements OperationTracker {
  private jobId?: string;
  private jobStateService?: JobStateService;
  private operationStats: Record<string, number> = {};

  /**
   * Connect to a JobStateService for real-time tracking
   */
  public connectToJob(jobStateService: JobStateService, jobId: string): void {
    this.jobStateService = jobStateService;
    this.jobId = jobId;
  }

  /**
   * Disconnect from job tracking
   */
  public disconnectFromJob(): void {
    this.jobStateService = undefined;
    this.jobId = undefined;
  }

  /**
   * Get stats for a specific namespace (e.g., 'api')
   */
  public getNamespaceStats(namespace: string): Record<string, number> {
    const prefix = `${namespace}.`;
    const stats: Record<string, number> = {};

    for (const [key, value] of Object.entries(this.operationStats)) {
      if (key.startsWith(prefix)) {
        stats[key] = value;
      }
    }

    return stats;
  }

  /**
   * Get operation statistics
   */
  public getOperationStats(): Record<string, number> {
    return { ...this.operationStats };
  }

  /**
   * Get stats for a specific resource (e.g., 'dashboard')
   */
  public getResourceStats(resource: string, namespace?: string): number {
    const prefix = namespace ? `${namespace}.${resource}` : resource;
    return OperationName.aggregateByPrefix(this.operationStats, prefix);
  }

  /**
   * Get stats grouped by a component
   */
  public getStatsGroupedBy(component: 'namespace' | 'resource' | 'action'): Record<string, number> {
    return OperationName.groupBy(this.operationStats, component);
  }

  /**
   * Get total count for a specific namespace (e.g., all API calls)
   */
  public getTotalForNamespace(namespace: string): number {
    return OperationName.aggregateByPrefix(this.operationStats, `${namespace}.`);
  }

  /**
   * Get total count of all operations
   */
  public getTotalOperations(): number {
    return Object.values(this.operationStats).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Reset operation statistics
   */
  public resetOperationStats(): void {
    this.operationStats = {};
  }

  /**
   * Track an operation
   * @param operation - Either a string operation name or an OperationContext
   * @param count - Number of operations (default: 1)
   */
  public async trackOperation(
    operation: string | OperationContext,
    count: number = 1
  ): Promise<void> {
    // Build operation name from context or use string directly
    const operationName =
      typeof operation === 'string' ? operation : OperationName.build(operation);

    // Use count from context if available
    const opCount = typeof operation === 'object' && operation.count ? operation.count : count;

    // Update local stats
    this.operationStats[operationName] = (this.operationStats[operationName] || 0) + opCount;

    // If connected to a job, track there too
    if (this.jobStateService && this.jobId) {
      await this.jobStateService.incrementOperation(this.jobId, operationName, opCount);
    }
  }
}
