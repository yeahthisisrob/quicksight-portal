/**
 * Batch processing models and types
 */

import { type EnhancedProcessingResult } from '../../features/data-export/processors/BaseAssetProcessor';

/**
 * Context for processing a single batch
 */
export interface BatchContext<T = any> {
  batch: T[];
  batchIndex: number;
  totalBatches: number;
  assetType: string;
}

/**
 * Options for batch processing
 */
export interface BatchProcessingOptions {
  batchSize: number;
  maxConcurrency?: number;
  stopOnError?: boolean;
  shouldStop?: () => Promise<boolean>; // Callback to check if processing should stop
}

/**
 * Result of batch processing
 */
export interface BatchProcessingResult {
  results: EnhancedProcessingResult[];
  errors: BatchError[];
  stopped?: boolean; // Indicates if processing was stopped early
}

/**
 * Error that occurred during batch processing
 */
export interface BatchError {
  assetId: string;
  assetName: string;
  error: string;
  timestamp: string;
  batchIndex?: number;
}

/**
 * Progress callback for batch processing
 */
export interface BatchProgressCallback {
  onBatchStart?: (batchIndex: number, totalBatches: number, batchSize: number) => void;
  onBatchComplete?: (
    batchIndex: number,
    totalBatches: number,
    results: EnhancedProcessingResult[]
  ) => void;
  onItemComplete?: (result: EnhancedProcessingResult) => void;
  onItemError?: (error: Error, itemId: string) => void;
}
