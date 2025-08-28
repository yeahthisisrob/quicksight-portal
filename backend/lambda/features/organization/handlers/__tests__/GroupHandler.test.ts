import { type APIGatewayProxyEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STATUS_CODES } from '../../../../shared/constants';
import { GroupHandler } from '../GroupHandler';

vi.mock('../../../../shared/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'test-user', email: 'test@example.com' }),
}));

vi.mock('../../services/GroupService', () => ({
  GroupService: vi.fn().mockImplementation(() => ({
    createGroup: vi.fn().mockResolvedValue({
      success: true,
      data: { groupId: 'group-123', groupName: 'New Group' },
    }),
    updateGroup: vi.fn().mockResolvedValue({
      success: true,
      data: { groupId: 'group-123', groupName: 'Updated Group' },
    }),
    deleteGroup: vi.fn().mockResolvedValue({
      success: true,
      data: { message: 'Group deleted successfully' },
    }),
    getGroupAssets: vi.fn().mockResolvedValue({
      success: true,
      data: {
        dashboards: [{ id: 'dash-1', name: 'Dashboard 1' }],
        datasets: [{ id: 'data-1', name: 'Dataset 1' }],
      },
    }),
  })),
}));

vi.mock('../../../../shared/services/cache/CacheService', () => ({
  CacheService: {
    getInstance: vi.fn().mockReturnValue({
      clearMemoryCache: vi.fn().mockResolvedValue(undefined),
      invalidateGroupCache: vi.fn().mockResolvedValue(undefined),
    }),
  },
  cacheService: {
    clearMemoryCache: vi.fn().mockResolvedValue(undefined),
    invalidateGroupCache: vi.fn().mockResolvedValue(undefined),
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

describe('GroupHandler', () => {
  let handler: GroupHandler;
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new GroupHandler();
    mockEvent = {
      body: '',
      headers: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/groups',
      pathParameters: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      multiValueHeaders: {},
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };
  });

  describe('createGroup', () => {
    it('should create group successfully', async () => {
      mockEvent.body = JSON.stringify({
        groupName: 'Test Group',
        description: 'Test Description',
      });

      const result = await handler.createGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.groupId).toBe('group-123');
      expect(body.data.groupName).toBe('New Group');
    });

    it('should return error when group name is missing', async () => {
      mockEvent.body = JSON.stringify({ description: 'No name' });
      const result = await handler.createGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Group name is required');
    });

    it('should handle creation errors', async () => {
      const { GroupService } = await import('../../services/GroupService');
      (GroupService as any).mockImplementationOnce(() => ({
        createGroup: vi.fn().mockRejectedValue(new Error('Creation failed')),
      }));

      mockEvent.body = JSON.stringify({ groupName: 'Test Group' });
      const newHandler = new GroupHandler();
      const result = await newHandler.createGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.INTERNAL_SERVER_ERROR);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Creation failed');
    });
  });

  describe('updateGroup', () => {
    it('should update group successfully', async () => {
      mockEvent.path = '/groups/test-group';
      mockEvent.body = JSON.stringify({
        description: 'Updated Description',
      });

      const result = await handler.updateGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.groupName).toBe('Updated Group');
    });

    it('should return error when group name is missing', async () => {
      mockEvent.path = '/groups/';
      mockEvent.body = JSON.stringify({ description: 'Updated' });
      const result = await handler.updateGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Group name is required');
    });

    it('should return error when description is missing', async () => {
      mockEvent.path = '/groups/test-group';
      mockEvent.body = JSON.stringify({});
      const result = await handler.updateGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Description is required');
    });
  });

  describe('deleteGroup', () => {
    it('should delete group successfully', async () => {
      mockEvent.path = '/groups/test-group';
      mockEvent.body = JSON.stringify({ reason: 'No longer needed' });

      const result = await handler.deleteGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Group deleted successfully');
    });

    it('should return error when group name is missing', async () => {
      mockEvent.path = '/groups/';
      const result = await handler.deleteGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Group name is required');
    });
  });

  describe('getGroupAssets', () => {
    it('should get group assets successfully', async () => {
      mockEvent.path = '/groups/test-group/assets';

      const result = await handler.getGroupAssets(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.dashboards).toHaveLength(1);
      expect(body.data.datasets).toHaveLength(1);
    });

    it('should return error when group name is missing', async () => {
      mockEvent.path = '/groups//assets';
      const result = await handler.getGroupAssets(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Group name is required');
    });
  });
});
