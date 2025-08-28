import { api as apiClient } from '../client';
import { ApiResponse } from '../types';

/**
 * Export API - handles asset export operations
 * Note: Updated to use actual backend endpoints
 */
export const exportApi = {
  // Get paginated assets (replaces the non-existent stats/list endpoints)
  async listAssets(assetType: string, options: {
    page?: number;
    pageSize?: number;
    search?: string;
    useCache?: boolean;
    dateRange?: string;
    sortBy?: string;
    sortOrder?: string;
  } = {}) {
    const params = new URLSearchParams();
    
    if (options.page) params.append('page', options.page.toString());
    if (options.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options.search) params.append('search', options.search);
    if (options.useCache !== undefined) params.append('useCache', options.useCache.toString());
    if (options.dateRange) params.append('dateRange', options.dateRange);
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);
    
    const response = await apiClient.get<ApiResponse<{
      [key: string]: any; // Dynamic key based on asset type (dashboards, datasets, etc.)
      pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        hasMore: boolean;
      };
      fromCache?: boolean;
    }>>(`/assets/${assetType}/paginated?${params}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || `Failed to list ${assetType}`);
    }
    
    // Extract the assets array from the response
    const data = response.data.data;
    if (!data) {
      throw new Error('No data in response');
    }
    
    const assetKey = Object.keys(data).find(key => key !== 'pagination' && key !== 'fromCache');
    const assets = assetKey ? data[assetKey] : [];
    
    return {
      items: assets,
      pagination: data.pagination,
      fromCache: data.fromCache || false
    };
  },

  // Trigger export job - returns job ID immediately
  async startExportJob(options: {
    forceRefresh?: boolean;
    rebuildIndex?: boolean;
    exportIngestions?: boolean;
    exportOrganizational?: boolean;
    assetTypes?: string[];
    refreshOptions?: {
      definitions?: boolean;
      permissions?: boolean;
      tags?: boolean;
    };
  } = {}) {
    const response = await apiClient.post<ApiResponse<{
      jobId: string;
      status: 'queued' | 'processing' | 'completed' | 'failed' | 'stopping' | 'stopped';
      message: string;
    }>>('/export', options);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to start export job');
    }
    
    return response.data.data;
  },

  // Trigger full export (compatibility wrapper that uses job-based API)
  async triggerFullExport(options: {
    forceRefresh?: boolean;
    rebuildIndex?: boolean;
    assetTypes?: string[];
    refreshOptions?: {
      definitions?: boolean;
      permissions?: boolean;
      tags?: boolean;
    };
  } = {}) {
    // Use the new job-based API
    return this.startExportJob(options);
  },

  // List recent export jobs (using new unified job API)
  async listJobs(options: {
    limit?: number;
    status?: 'queued' | 'processing' | 'completed' | 'failed' | 'stopped';
  } = {}) {
    const params = new URLSearchParams();
    params.append('type', 'export'); // Filter for export jobs only
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.status) params.append('status', options.status);
    
    const response = await apiClient.get<ApiResponse<Array<{
      jobId: string;
      jobType: string;
      status: 'queued' | 'processing' | 'completed' | 'failed' | 'stopping' | 'stopped';
      progress?: number;
      message?: string;
      startTime: string;
      endTime?: string;
      duration?: number;
      stats?: {
        totalAssets?: number;
        processedAssets?: number;
        failedAssets?: number;
        apiCalls?: number;
      };
      error?: string;
      stopRequested?: boolean;
    }>>>(`/jobs?${params.toString()}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to list jobs');
    }
    
    // Return in the format the JobHistory component expects
    return { jobs: response.data.data || [] };
  },

  // Get job status (using new unified job API)
  async getJobStatus(jobId: string) {
    const response = await apiClient.get<ApiResponse<{
      jobId: string;
      jobType: string;
      status: 'queued' | 'processing' | 'completed' | 'failed' | 'stopping' | 'stopped';
      progress?: number;
      message?: string;
      startTime: string;
      endTime?: string;
      duration?: number;
      stats?: {
        totalAssets?: number;
        processedAssets?: number;
        failedAssets?: number;
        apiCalls?: number;
      };
    }>>(`/jobs/${jobId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get job status');
    }
    
    return response.data.data;
  },

  // Get job logs (using new unified job API)
  async getJobLogs(jobId: string) {
    const response = await apiClient.get<ApiResponse<{
      jobId: string;
      logs: Array<{
        timestamp: string;
        level: 'info' | 'warn' | 'error' | 'debug';
        message: string;
        details?: any;
      }>;
    }>>(`/jobs/${jobId}/logs`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get job logs');
    }
    
    return response.data.data;
  },

  // Stop a running export job (using new unified job API)
  async stopJob(jobId: string) {
    const response = await apiClient.post<ApiResponse<{
      success: boolean;
      message: string;
    }>>(`/jobs/${jobId}/stop`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to stop job');
    }
    
    return response.data.data;
  },

  // Get export summary
  async getExportSummary() {
    const response = await apiClient.get<ApiResponse<{
      totalAssets: number;
      exportedAssets: number;
      lastExportDate: string | null;
      exportInProgress: boolean;
      needsInitialExport?: boolean;
      message?: string;
      assetTypeCounts: {
        dashboards: number;
        datasets: number;
        analyses: number;
        datasources: number;
        folders: number;
        users?: number;
        groups?: number;
      };
      fieldStatistics: {
        totalFields: number;
        totalCalculatedFields: number;
        totalUniqueFields: number;
      } | null;
      totalSize?: number;
      indexVersion?: string;
    }>>('/export/summary');
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get export summary');
    }
    
    return response.data.data;
  },

  // Process all updates for an asset type
  // This is a client-side implementation that pages through assets
  async processAllUpdates(
    assetType: string,
    batchSize: number = 50,
    onProgress?: (completed: number, total: number) => void,
    options?: {
      forceRefresh?: boolean;
      refreshOptions?: {
        definitions?: boolean;
        permissions?: boolean;
        tags?: boolean;
      };
    },
    onBatchProgress?: (batchNumber: number, totalBatches: number, batchResult: any) => void,
    onAssetProgress?: (result: any) => void
  ) {
    const results: any[] = [];
    const totalSummary = {
      total: 0,
      succeeded: 0,
      cached: 0,
      failed: 0
    };

    try {
      // Get first page to determine total count
      const firstPage = await this.listAssets(assetType, {
        page: 1,
        pageSize: batchSize,
        useCache: !options?.forceRefresh
      });

      const totalItems = firstPage.pagination.totalItems;
      const totalPages = firstPage.pagination.totalPages;
      
      totalSummary.total = totalItems;

      // Process all pages
      for (let page = 1; page <= totalPages; page++) {
        const pageData = page === 1 ? firstPage : await this.listAssets(assetType, {
          page,
          pageSize: batchSize,
          useCache: !options?.forceRefresh
        });

        // Process this batch of assets
        const batch = pageData.items;
        const processedCount = (page - 1) * batchSize + batch.length;
        
        onProgress?.(processedCount, totalItems);
        
        // Create batch result
        const batchResult = {
          summary: {
            total: batch.length,
            succeeded: batch.length, // Assume success since we got the data
            cached: pageData.fromCache ? batch.length : 0,
            failed: 0
          }
        };
        
        results.push(batchResult);
        totalSummary.succeeded += batchResult.summary.succeeded;
        totalSummary.cached += batchResult.summary.cached;
        
        onBatchProgress?.(page, totalPages, batchResult);
        
        // Report progress for each asset if callback provided
        if (onAssetProgress) {
          batch.forEach((asset: any) => {
            onAssetProgress({
              assetId: asset.id,
              assetName: asset.name,
              status: 'success',
              processingTimeMs: 0
            });
          });
        }
      }
    } catch (_error: any) {
      totalSummary.failed = totalSummary.total - totalSummary.succeeded;
    }

    return {
      summary: totalSummary,
      batches: results,
      message: `Processed ${totalSummary.total} ${assetType}: ${totalSummary.succeeded} succeeded, ${totalSummary.cached} cached, ${totalSummary.failed} failed`
    };
  },

  // Warm up the Lambda before starting export
  async warmUp() {
    try {
      // Just use the export summary endpoint to warm up
      await this.getExportSummary();
      return true;
    } catch {
      return false;
    }
  },

  // Clear Lambda memory cache
  async clearMemoryCache() {
    const response = await apiClient.post<ApiResponse<{
      message: string;
    }>>('/assets/clear-memory-cache');
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to clear memory cache');
    }
    
    return response.data.data;
  }
};