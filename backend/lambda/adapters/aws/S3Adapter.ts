import {
  type S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
  PutBucketVersioningCommand,
} from '@aws-sdk/client-s3';

import { withRetry } from '../../shared/utils/awsRetry';
import { s3RateLimiter } from '../../shared/utils/rateLimiter';

/**
 * S3 adapter for interfacing with AWS S3 API
 * Handles direct S3 SDK operations and parameter mapping
 */
export class S3Adapter {
  private readonly awsAccountId: string;
  private readonly client: S3Client;

  constructor(client: S3Client, awsAccountId: string) {
    this.client = client;
    this.awsAccountId = awsAccountId;
  }

  public async createBucket(bucket: string, region?: string): Promise<unknown> {
    const params: any = {
      Bucket: bucket,
    };
    if (region && region !== 'us-east-1') {
      params.CreateBucketConfiguration = { LocationConstraint: region };
    }
    return await this.sendWithRateLimit(new CreateBucketCommand(params));
  }

  public async deleteObject(bucket: string, key: string): Promise<unknown> {
    return await this.sendWithRateLimit(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
  }

  // =============================================================================
  // CORE S3 OPERATIONS
  // =============================================================================

  /**
   * Get the AWS account ID for this adapter instance
   */
  public getAccountId(): string {
    return this.awsAccountId;
  }

  public async getObject(bucket: string, key: string): Promise<unknown> {
    return await this.sendWithRateLimit(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
  }

  public async headBucket(bucket: string): Promise<unknown> {
    const result = await this.sendWithRateLimit(new HeadBucketCommand({ Bucket: bucket }));
    return result;
  }

  public async headObject(bucket: string, key: string): Promise<unknown> {
    return await this.sendWithRateLimit(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
  }

  public async listObjects(
    bucket: string,
    prefix?: string,
    maxKeys?: number,
    continuationToken?: string
  ): Promise<unknown> {
    return await this.sendWithRateLimit(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken,
      })
    );
  }

  // =============================================================================
  // BUCKET OPERATIONS
  // =============================================================================

  public async putBucketCors(bucket: string, corsConfiguration: unknown): Promise<unknown> {
    return await this.sendWithRateLimit(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: corsConfiguration as any,
      })
    );
  }

  public async putBucketLifecycleConfiguration(
    bucket: string,
    lifecycleConfiguration: unknown
  ): Promise<unknown> {
    return await this.sendWithRateLimit(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: bucket,
        LifecycleConfiguration: lifecycleConfiguration as any,
      })
    );
  }

  public async putBucketVersioning(
    bucket: string,
    versioningConfiguration: unknown
  ): Promise<unknown> {
    return await this.sendWithRateLimit(
      new PutBucketVersioningCommand({
        Bucket: bucket,
        VersioningConfiguration: versioningConfiguration as any,
      })
    );
  }

  public async putObject(
    bucket: string,
    key: string,
    body: string,
    contentType?: string
  ): Promise<unknown> {
    return await this.sendWithRateLimit(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  /**
   * Send command with rate limiting and retry logic
   */
  private async sendWithRateLimit<T>(command: any): Promise<T> {
    const commandName = command.constructor.name;

    return await withRetry<T>(
      async () => {
        await s3RateLimiter.waitForToken();
        const response = await this.client.send(command);
        return response as T;
      },
      `S3.${commandName}`,
      {
        maxRetries: 5,
        baseDelay: 1000,
        maxDelay: 30000,
      }
    );
  }
}
