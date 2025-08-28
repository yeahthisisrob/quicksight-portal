import { QuickSightService } from './QuickSightService';
import { S3Service } from './S3Service';

/**
 * Factory for creating AWS service clients with consistent configuration
 * Implements singleton pattern for efficiency in Lambda environments
 */
export class ClientFactory {
  private static quickSightService: QuickSightService | null = null;
  private static s3Service: S3Service | null = null;

  /**
   * Create a new instance with custom configuration (bypasses singleton)
   */
  public static createCustomQuickSightService(awsAccountId: string): QuickSightService {
    return new QuickSightService(awsAccountId);
  }

  /**
   * Create a new S3Service instance
   */
  public static createS3Service(awsAccountId: string): S3Service {
    return new S3Service(awsAccountId);
  }

  /**
   * Get or create QuickSight service
   */
  public static getQuickSightService(awsAccountId: string): QuickSightService {
    if (!this.quickSightService) {
      this.quickSightService = new QuickSightService(awsAccountId);
    }
    return this.quickSightService;
  }

  /**
   * Get or create S3 service
   */
  public static getS3Service(): S3Service {
    if (!this.s3Service) {
      const accountId = process.env.AWS_ACCOUNT_ID || '';
      this.s3Service = new S3Service(accountId);
    }
    return this.s3Service;
  }

  /**
   * Reset all cached services (useful for testing or configuration changes)
   */
  public static reset(): void {
    this.quickSightService = null;
    this.s3Service = null;
  }
}
