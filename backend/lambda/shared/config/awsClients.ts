/**
 * AWS Client Factory Functions
 * Centralized creation of AWS SDK clients with consistent configuration
 */

import { CloudTrailClient } from '@aws-sdk/client-cloudtrail';
import { QuickSightClient } from '@aws-sdk/client-quicksight';
import { S3Client } from '@aws-sdk/client-s3';

import { getOptimizedAwsConfig } from './httpConfig';

/**
 * Create a QuickSight client
 */
export function createQuickSightClient(): QuickSightClient {
  return new QuickSightClient(getOptimizedAwsConfig());
}

/**
 * Create an S3 client
 */
export function createS3Client(): S3Client {
  return new S3Client(getOptimizedAwsConfig());
}

/**
 * Create a CloudTrail client
 */
export function createCloudTrailClient(): CloudTrailClient {
  return new CloudTrailClient(getOptimizedAwsConfig());
}
