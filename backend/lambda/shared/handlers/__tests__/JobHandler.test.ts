import { type APIGatewayProxyEvent } from 'aws-lambda';
import { vi, type Mock, type Mocked, type MockedClass } from 'vitest';

import * as auth from '../../auth';
import { JobRepository } from '../../services/jobs/JobRepository';
import { JobHandler } from '../JobHandler';

// Test constants
const TEST_CONSTANTS = {
  HTTP_OK: 200,
  HTTP_BAD_REQUEST: 400,
  HTTP_NOT_FOUND: 404,
  HTTP_SERVER_ERROR: 500,
} as const;

// Mock dependencies
vi.mock('../../auth');
vi.mock('../../services/jobs/JobRepository');
vi.mock('../../services/aws/S3Service');
vi.mock('../../services/cache/CacheService');
vi.mock('../../utils/logger');

// Test data factories
const createMockJob = (overrides = {}) => ({
  jobId: 'export-123',
  jobType: 'export' as const,
  status: 'completed' as const,
  progress: 100,
  message: 'Export completed',
  startTime: '2025-01-01T00:00:00.000Z',
  endTime: '2025-01-01T00:01:00.000Z',
  duration: 60000,
  stats: {
    totalAssets: 10,
    processedAssets: 10,
    failedAssets: 0,
    apiCalls: 30,
  },
  ...overrides,
});

const createMockEvent = (overrides = {}): APIGatewayProxyEvent => ({
  body: null,
  headers: {},
  multiValueHeaders: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  path: '/jobs',
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {} as any,
  resource: '',
  ...overrides,
});

describe('JobHandler', () => {
  let handler: JobHandler;
  let mockRepository: Mocked<JobRepository>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock auth
    (auth.requireAuth as Mock).mockResolvedValue({
      userId: 'test-user',
      accountId: 'test-account',
    });

    // Create handler instance
    handler = new JobHandler();

    // Get the mocked repository instance
    mockRepository = (JobRepository as MockedClass<typeof JobRepository>).mock
      .instances[0] as Mocked<JobRepository>;
  });

  describe('listJobs', () => {
    it('should return jobs from repository', async () => {
      // Arrange
      const mockJobs = [
        createMockJob(),
        createMockJob({
          jobId: 'export-456',
          status: 'processing' as const,
          progress: 50,
          message: 'Processing...',
          startTime: '2025-01-01T00:02:00.000Z',
          endTime: undefined,
          duration: undefined,
        }),
      ];

      mockRepository.listJobs.mockResolvedValue(mockJobs);

      const event = createMockEvent({
        queryStringParameters: {
          type: 'export',
          limit: '50',
        },
      });

      // Act
      const response = await handler.listJobs(event as APIGatewayProxyEvent);
      const body = JSON.parse(response.body);

      // Assert
      expect(response.statusCode).toBe(TEST_CONSTANTS.HTTP_OK);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockJobs);
      expect(mockRepository.listJobs).toHaveBeenCalledWith({
        jobType: 'export',
        status: undefined,
        limit: 50,
      });
    });

    it('should handle empty job list', async () => {
      // Arrange
      mockRepository.listJobs.mockResolvedValue([]);

      const event = createMockEvent({
        queryStringParameters: {
          type: 'export',
        },
      });

      // Act
      const response = await handler.listJobs(event as APIGatewayProxyEvent);
      const body = JSON.parse(response.body);

      // Assert
      expect(response.statusCode).toBe(TEST_CONSTANTS.HTTP_OK);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.data).toHaveLength(0);
    });

    it('should filter by status when provided', async () => {
      // Arrange
      mockRepository.listJobs.mockResolvedValue([]);

      const event = createMockEvent({
        queryStringParameters: {
          type: 'export',
          status: 'completed',
        },
      });

      // Act
      await handler.listJobs(event as APIGatewayProxyEvent);

      // Assert
      expect(mockRepository.listJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
        })
      );
    });

    it('should parse date filters correctly', async () => {
      // Arrange
      mockRepository.listJobs.mockResolvedValue([]);

      const event = createMockEvent({
        queryStringParameters: {
          type: 'export',
          afterDate: '2025-01-01',
          beforeDate: '2025-01-31',
        },
      });

      // Act
      await handler.listJobs(event as APIGatewayProxyEvent);

      // Assert
      expect(mockRepository.listJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          afterDate: new Date('2025-01-01'),
          beforeDate: new Date('2025-01-31'),
        })
      );
    });

    it('should handle repository errors', async () => {
      // Arrange
      mockRepository.listJobs.mockRejectedValue(new Error('Database connection failed'));

      const event: Partial<APIGatewayProxyEvent> = {
        queryStringParameters: {
          type: 'export',
        },
        headers: {},
      };

      // Act
      const response = await handler.listJobs(event as APIGatewayProxyEvent);
      const body = JSON.parse(response.body);

      // Assert
      expect(response.statusCode).toBe(TEST_CONSTANTS.HTTP_SERVER_ERROR);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Database connection failed');
    });

    it('should handle missing query parameters', async () => {
      // Arrange
      mockRepository.listJobs.mockResolvedValue([]);

      const event = createMockEvent({
        queryStringParameters: null,
      });

      // Act
      const response = await handler.listJobs(event as APIGatewayProxyEvent);
      const body = JSON.parse(response.body);

      // Assert
      expect(response.statusCode).toBe(TEST_CONSTANTS.HTTP_OK);
      expect(body.success).toBe(true);
      expect(mockRepository.listJobs).toHaveBeenCalledWith({
        jobType: undefined,
        status: undefined,
        limit: 50,
      });
    });
  });
});

describe('JobHandler - getJob', () => {
  let handler: JobHandler;
  let mockRepository: Mocked<JobRepository>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock auth
    (auth.requireAuth as Mock).mockResolvedValue({
      userId: 'test-user',
      accountId: 'test-account',
    });

    // Create handler instance
    handler = new JobHandler();

    // Get the mocked repository instance
    mockRepository = (JobRepository as MockedClass<typeof JobRepository>).mock
      .instances[0] as Mocked<JobRepository>;
  });

  describe('getJob', () => {
    it('should return a specific job', async () => {
      // Arrange
      const mockJob = createMockJob();

      mockRepository.getJob.mockResolvedValue(mockJob);

      const event = createMockEvent({
        pathParameters: {
          jobId: 'export-123',
        },
      });

      // Act
      const response = await handler.getJob(event as APIGatewayProxyEvent);
      const body = JSON.parse(response.body);

      // Assert
      expect(response.statusCode).toBe(TEST_CONSTANTS.HTTP_OK);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockJob);
      expect(mockRepository.getJob).toHaveBeenCalledWith('export-123');
    });

    it('should return 404 when job not found', async () => {
      // Arrange
      mockRepository.getJob.mockResolvedValue(null);

      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: {
          jobId: 'non-existent',
        },
        headers: {},
      };

      // Act
      const response = await handler.getJob(event as APIGatewayProxyEvent);
      const body = JSON.parse(response.body);

      // Assert
      expect(response.statusCode).toBe(TEST_CONSTANTS.HTTP_NOT_FOUND);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Job not found');
    });

    it('should return 400 when jobId is missing', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: {},
        headers: {},
      };

      // Act
      const response = await handler.getJob(event as APIGatewayProxyEvent);
      const body = JSON.parse(response.body);

      // Assert
      expect(response.statusCode).toBe(TEST_CONSTANTS.HTTP_BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Job ID is required');
    });
  });
});
