export interface Ingestion {
  id: string;
  datasetId: string;
  datasetName?: string;
  datasetArn?: string;
  datasourceType?: string;
  ingestionArn?: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'INITIALIZED' | 'QUEUED';
  createdTime: string;
  ingestionTimeInSeconds?: number;
  ingestionSizeInBytes?: number;
  rowsIngested?: number;
  rowsDropped?: number;
  errorType?: string;
  errorMessage?: string;
  requestType?: 'INITIAL_INGESTION' | 'INCREMENTAL_REFRESH' | 'FULL_REFRESH' | 'EDIT';
  queueInfo?: {
    waitingOnIngestion?: string;
    queuedIngestion?: string;
  };
}

export interface IngestionMetadata {
  totalIngestions: number;
  runningIngestions: number;
  failedIngestions: number;
  lastUpdated: string;
}

export interface IngestionListResponse {
  ingestions: Ingestion[];
  metadata: IngestionMetadata;
  nextToken?: string;
}
