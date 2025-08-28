// Export-related types for better type safety

export interface ExportProgressState {
  status: 'idle' | 'running' | 'completed' | 'error';
  current: number;
  total: number;
  message: string;
  assetType?: string;
  startTime?: string;
  duration?: number;
  errors?: any[];
  stats?: {
    updated: number;
    cached: number;
    errors: number;
  };
}

export interface ExportSession {
  sessionId: string;
  startTime: string;
  endTime?: string;
  lastUpdated?: string;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  progress: Record<string, ExportProgressState>;
  summary?: any;
  error?: string;
}

export interface ExportRun {
  runId: string;
  sessionId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  duration?: number;
  totalAssets: number;
  processedAssets: number;
  totalApiCalls: number;
  successfulCalls: number;
  failedCalls: number;
  assetTypes: string[];
  errorSummary: Record<string, number>;
  performanceMetrics?: any;
  progress?: Record<string, ExportProgressState>;
  lastUpdated?: string;
}

export interface LambdaStatus {
  functionName: string;
  isExecuting: boolean;
  lastInvocation?: Date;
  currentRequestId?: string;
}

export interface ExportStatusResponse {
  isExporting: boolean;
  canStart: boolean;
  canStop: boolean;
  lambdaStatus?: LambdaStatus;
  activeRun?: {
    runId: string;
    sessionId: string;
    status: string;
    startTime: string;
    progress: Record<string, ExportProgressState>;
    lastUpdated?: string;
  };
  lastCompletedRun?: ExportRun;
}

export interface ExportRunsResponse {
  runs: ExportRun[];
  pagination: {
    limit: number;
    offset?: number;
    hasMore: boolean;
    lastRunId?: string;
  };
  summary: {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    runningRuns: number;
    avgDuration: number;
    successRate: number;
  };
}

export interface ExportOverviewStats {
  totalRuns: number;
  recentRuns: number;
  runsByStatus: {
    completed: number;
    failed: number;
    running: number;
    cancelled: number;
  };
  avgDuration: number;
  avgAssetsProcessed: number;
  totalApiCalls: number;
  avgSuccessRate: number;
  mostCommonErrors: Array<{
    error: string;
    count: number;
  }>;
  lastExportTime: string | null;
  totalAssets: number;
}

export interface StartExportRequest {
  forceRefresh?: boolean;
  assetTypes?: string[];
}

export interface StartExportResponse {
  message: string;
  sessionId: string;
  runId?: string;
  forceRefresh: boolean;
  assetTypes?: string[];
  usingLambda: boolean;
}

export interface ApiCallLog {
  operation: string;
  assetType: string;
  assetId: string;
  assetName: string;
  timestamp: string;
  duration: number;
  success: boolean;
  error?: string;
  httpStatusCode?: number;
  throttled?: boolean;
  responseSize?: number;
}

export interface ExportRunDetail extends ExportRun {
  apiCalls?: ApiCallLog[];
  timeline?: Array<{
    timestamp: string;
    event: string;
    details?: any;
  }>;
  apiCallsPagination?: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
  timelinePagination?: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
}

// Error types
export interface ExportError {
  message: string;
  details?: string;
  code?: string;
}

// Event types for real-time updates
export interface ExportEvent {
  type: 'status_change' | 'progress_update' | 'run_complete' | 'error';
  data: any;
  timestamp: string;
}