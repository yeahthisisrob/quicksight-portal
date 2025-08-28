import { type APIGatewayProxyEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STATUS_CODES } from '../../../../shared/constants';
import { TagHandler } from '../TagHandler';

vi.mock('../../../../shared/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'test-user', email: 'test@example.com' }),
}));

vi.mock('../../services/TagService', () => ({
  TagService: vi.fn().mockImplementation(() => ({
    tagResource: vi.fn().mockResolvedValue(undefined),
    getResourceTags: vi.fn().mockResolvedValue([
      { key: 'Environment', value: 'Production' },
      { key: 'Owner', value: 'Team A' },
    ]),
    updateResourceTags: vi.fn().mockResolvedValue(undefined),
    removeResourceTags: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../../../shared/services/bulk/BulkOperationsService', () => ({
  BulkOperationsService: vi.fn().mockImplementation(() => ({
    bulkUpdateTags: vi.fn().mockResolvedValue({
      jobId: 'job-123',
      status: 'pending',
      message: 'Bulk tag update started',
      estimatedOperations: 10,
    }),
  })),
}));

vi.mock('../../../../shared/services/cache/CacheService', () => ({
  CacheService: {
    getInstance: vi.fn().mockReturnValue({
      clearMemoryCache: vi.fn().mockResolvedValue(undefined),
      updateAssetTags: vi.fn().mockResolvedValue(undefined),
    }),
  },
  cacheService: {
    clearMemoryCache: vi.fn().mockResolvedValue(undefined),
    updateAssetTags: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../../shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('TagHandler', () => {
  let handler: TagHandler;
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new TagHandler();
    mockEvent = {
      body: '',
      headers: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/tags/dashboard/dash-123',
      pathParameters: {
        assetType: 'dashboard',
        assetId: 'dash-123',
      },
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      multiValueHeaders: {},
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };
  });

  describe('getTags', () => {
    it('should get resource tags successfully', async () => {
      const result = await handler.getTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].key).toBe('Environment');
      expect(body.data[0].value).toBe('Production');
    });

    it('should return error when asset type or ID is missing', async () => {
      mockEvent.pathParameters = { assetType: 'dashboard' };
      const result = await handler.getTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Asset type and ID are required');
    });
  });

  describe('addTags', () => {
    it('should add tags successfully', async () => {
      mockEvent.body = JSON.stringify({
        tags: [
          { key: 'Project', value: 'Alpha' },
          { key: 'CostCenter', value: '12345' },
        ],
      });

      const result = await handler.addTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Tags added successfully');
    });

    it('should return error when tags array is missing', async () => {
      mockEvent.body = JSON.stringify({});
      const result = await handler.addTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Tags array is required');
    });

    it('should return error when tags is not an array', async () => {
      mockEvent.body = JSON.stringify({ tags: 'not-an-array' });
      const result = await handler.addTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Tags array is required');
    });
  });

  describe('updateTags', () => {
    it('should update tags successfully with Key/Value format', async () => {
      mockEvent.body = JSON.stringify({
        tags: [
          { Key: 'Environment', Value: 'Staging' },
          { Key: 'Owner', Value: 'Team B' },
        ],
      });

      const result = await handler.updateTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Tags updated successfully');
    });

    it('should update tags successfully with key/value format', async () => {
      mockEvent.body = JSON.stringify({
        tags: [
          { key: 'Environment', value: 'Development' },
          { key: 'Owner', value: 'Team C' },
        ],
      });

      const result = await handler.updateTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Tags updated successfully');
    });

    it('should return error when asset parameters are missing', async () => {
      mockEvent.pathParameters = {};
      mockEvent.body = JSON.stringify({ tags: [] });
      const result = await handler.updateTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Asset type and ID are required');
    });
  });

  describe('removeTags', () => {
    it('should remove tags successfully', async () => {
      mockEvent.body = JSON.stringify({
        tagKeys: ['Environment', 'Owner'],
      });

      const result = await handler.removeTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Tags removed successfully');
    });

    it('should return error when tag keys array is missing', async () => {
      mockEvent.body = JSON.stringify({});
      const result = await handler.removeTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Tag keys array is required');
    });
  });
});

describe('TagHandler - Batch Operations', () => {
  let handler: TagHandler;
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new TagHandler();
    mockEvent = {
      body: '',
      headers: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/tags/batch',
      pathParameters: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      multiValueHeaders: {},
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };
  });

  describe('getBatchTags', () => {
    it('should get batch tags successfully', async () => {
      mockEvent.body = JSON.stringify({
        assets: [
          { type: 'dashboard', id: 'dash-1' },
          { type: 'dataset', id: 'data-1' },
        ],
      });

      const result = await handler.getBatchTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].success).toBe(true);
      expect(body.data[0].tags).toHaveLength(2);
    });

    it('should return error when assets array is missing', async () => {
      mockEvent.body = JSON.stringify({});
      const result = await handler.getBatchTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Assets array is required');
    });
  });

  describe('bulkUpdateTags', () => {
    it('should bulk update tags for add operation', async () => {
      mockEvent.body = JSON.stringify({
        assetType: 'dashboard',
        assetIds: ['dash-1', 'dash-2', 'dash-3'],
        operation: 'add',
        tags: [{ key: 'BulkTag', value: 'BulkValue' }],
      });

      const result = await handler.bulkUpdateTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.ACCEPTED);
      expect(body.success).toBe(true);
      expect(body.jobId).toBe('job-123');
      expect(body.status).toBe('pending');
    });

    it('should bulk update tags for remove operation', async () => {
      mockEvent.body = JSON.stringify({
        assetType: 'dataset',
        assetIds: ['data-1', 'data-2'],
        operation: 'remove',
        tagKeys: ['OldTag1', 'OldTag2'],
      });

      const result = await handler.bulkUpdateTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.ACCEPTED);
      expect(body.success).toBe(true);
      expect(body.jobId).toBe('job-123');
    });

    it('should return error when required fields are missing', async () => {
      mockEvent.body = JSON.stringify({
        assetType: 'dashboard',
        operation: 'add',
      });

      const result = await handler.bulkUpdateTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Asset type, assetIds array, and operation are required');
    });

    it('should return error when tags missing for add operation', async () => {
      mockEvent.body = JSON.stringify({
        assetType: 'dashboard',
        assetIds: ['dash-1'],
        operation: 'add',
      });

      const result = await handler.bulkUpdateTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Tags array is required for add operation');
    });
  });

  describe('refreshTags', () => {
    it('should refresh tags successfully', async () => {
      mockEvent.body = JSON.stringify({
        assetType: 'dashboards',
        assetIds: ['dash-1', 'dash-2', 'dash-3'],
      });

      const result = await handler.refreshTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      const expectedCount = 3;
      expect(body.data.successful).toBe(expectedCount);
      expect(body.data.failed).toBe(0);
      expect(body.data.total).toBe(expectedCount);
    });

    it('should handle plural asset types correctly', async () => {
      mockEvent.body = JSON.stringify({
        assetType: 'analyses',
        assetIds: ['analysis-1'],
      });

      const result = await handler.refreshTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.successful).toBe(1);
    });

    it('should return error when required fields are missing', async () => {
      mockEvent.body = JSON.stringify({
        assetType: 'dashboard',
      });

      const result = await handler.refreshTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('assetType and assetIds are required');
    });

    it('should return error when assetIds is not an array', async () => {
      mockEvent.body = JSON.stringify({
        assetType: 'dashboard',
        assetIds: 'not-an-array',
      });

      const result = await handler.refreshTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('assetType and assetIds are required');
    });
  });
});
