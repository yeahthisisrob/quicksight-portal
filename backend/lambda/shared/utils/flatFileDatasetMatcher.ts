/**
 * Utility for matching flat file datasets to their datasources
 *
 * QuickSight creates a datasource when you upload a file (CSV/Excel),
 * but the dataset doesn't have a reference to it in PhysicalTableMap.
 * This utility matches them based on name and creation time.
 *
 * LIMITATIONS:
 * - QuickSight API cannot describe single flat file datasets
 * - Composite datasets don't show flat file sources in PhysicalTableMap
 * - Matching relies on dataset names not changing
 * - Old datasources from file updates will appear unused (expected behavior)
 * - For composite datasets, we may miss some flat file datasources
 */

import { TIME_UNITS } from '../constants';
import { logger } from './logger';

export interface FlatFileMatchOptions {
  datasetName: string;
  datasetCreatedTime: Date;
  datasetUpdatedTime: Date;
  datasources: Array<{
    id: string;
    name: string;
    type: string;
    createdTime: Date;
  }>;
  maxTimeDiffMs?: number; // Default 2 minutes
}

export interface FlatFileMatchResult {
  datasourceId: string;
  timeDiffMs: number;
  matchedBy: 'creation' | 'update';
}

/**
 * Find the best matching datasource for a flat file dataset
 */
export function findMatchingFlatFileDatasource(
  options: FlatFileMatchOptions
): FlatFileMatchResult | null {
  const {
    datasetName,
    datasetCreatedTime,
    datasetUpdatedTime,
    datasources,
    maxTimeDiffMs = 120000, // 2 minutes default
  } = options;

  // Filter to FILE type datasources with matching name
  const matchingDatasources = datasources.filter(
    (ds) => ds.name === datasetName && ds.type === 'FILE'
  );

  if (matchingDatasources.length === 0) {
    logger.debug(`No FILE datasources found with name: ${datasetName}`);
    return null;
  }

  let bestMatch: FlatFileMatchResult | null = null;
  let smallestTimeDiff = Infinity;

  for (const datasource of matchingDatasources) {
    const dsCreatedTime = datasource.createdTime.getTime();
    const datasetCreatedMs = datasetCreatedTime.getTime();
    const datasetUpdatedMs = datasetUpdatedTime.getTime();

    // Check time difference from dataset creation
    const creationDiff = Math.abs(datasetCreatedMs - dsCreatedTime);
    // Check time difference from dataset update
    const updateDiff = Math.abs(datasetUpdatedMs - dsCreatedTime);

    // Use the smaller difference
    const minDiff = Math.min(creationDiff, updateDiff);
    const matchedBy = creationDiff < updateDiff ? 'creation' : 'update';

    // If within time window and smaller than current best
    if (minDiff < maxTimeDiffMs && minDiff < smallestTimeDiff) {
      smallestTimeDiff = minDiff;
      bestMatch = {
        datasourceId: datasource.id,
        timeDiffMs: minDiff,
        matchedBy,
      };
    }
  }

  if (bestMatch) {
    logger.debug(
      `Matched flat file dataset to datasource ${bestMatch.datasourceId} ` +
        `(time diff: ${Math.round(bestMatch.timeDiffMs / TIME_UNITS.SECOND)}s, matched by: ${bestMatch.matchedBy})`
    );
  }

  return bestMatch;
}

/**
 * Get revision number for a flat file datasource
 * based on creation time order among datasources with the same name
 */
export function getFlatFileDatasourceRevision(
  datasourceName: string,
  datasourceCreatedTime: Date,
  allDatasources: Array<{ name: string; createdTime: Date }>
): number {
  // Find all datasources with the same name
  const sameName = allDatasources
    .filter((ds) => ds.name === datasourceName)
    .sort((a, b) => a.createdTime.getTime() - b.createdTime.getTime());

  // Find the position of this datasource
  const index = sameName.findIndex(
    (ds) => ds.createdTime.getTime() === datasourceCreatedTime.getTime()
  );

  return index + 1; // 1-based revision number
}
