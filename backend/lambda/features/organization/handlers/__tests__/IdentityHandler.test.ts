import { type APIGatewayProxyEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STATUS_CODES } from '../../../../shared/constants';
import { IdentityHandler } from '../IdentityHandler';

vi.mock('../../../../shared/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'test-user', email: 'test@example.com' }),
}));

vi.mock('../../services/IdentityService', () => ({
  IdentityService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../../../shared/services/bulk/BulkOperationsService', () => ({
  BulkOperationsService: vi.fn().mockImplementation(() => ({
    bulkAddUsersToGroups: vi.fn().mockResolvedValue({
      jobId: 'job-123',
      status: 'pending',
      message: 'Bulk add users to groups started',
      estimatedOperations: 2,
    }),
    bulkRemoveUsersFromGroups: vi.fn().mockResolvedValue({
      jobId: 'job-456',
      status: 'pending',
      message: 'Bulk remove users from groups started',
      estimatedOperations: 1,
    }),
  })),
}));

vi.mock('../../../../shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('IdentityHandler', () => {
  let handler: IdentityHandler;
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new IdentityHandler();
    mockEvent = {
      body: '',
      headers: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/groups/test-group/members',
      pathParameters: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      multiValueHeaders: {},
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };
  });

  describe('addUsersToGroup', () => {
    it('should add users to group successfully', async () => {
      mockEvent.body = JSON.stringify({
        userNames: ['user1', 'user2'],
      });

      const result = await handler.addUsersToGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.ACCEPTED);
      expect(body.success).toBe(true);
      expect(body.jobId).toBe('job-123');
      expect(body.status).toBe('pending');
    });

    it('should return error when userNames array is missing', async () => {
      mockEvent.body = JSON.stringify({});

      const result = await handler.addUsersToGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Group name and user names array are required');
    });

    it('should return error when group name is missing from path', async () => {
      mockEvent.path = '/groups//members';
      mockEvent.body = JSON.stringify({
        userNames: ['user1'],
      });

      const result = await handler.addUsersToGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Group name and user names array are required');
    });

    it('should return error when userNames is not an array', async () => {
      mockEvent.body = JSON.stringify({
        userNames: 'not-an-array',
      });

      const result = await handler.addUsersToGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Group name and user names array are required');
    });
  });

  describe('removeUsersFromGroup', () => {
    it('should remove users from group successfully', async () => {
      mockEvent.body = JSON.stringify({
        userNames: ['user2'],
      });

      const result = await handler.removeUsersFromGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.ACCEPTED);
      expect(body.success).toBe(true);
      expect(body.jobId).toBe('job-456');
      expect(body.status).toBe('pending');
    });

    it('should return error when userNames array is missing', async () => {
      mockEvent.body = JSON.stringify({});

      const result = await handler.removeUsersFromGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Group name and user names array are required');
    });

    it('should return error when group name is missing from path', async () => {
      mockEvent.path = '/invalid/path';
      mockEvent.body = JSON.stringify({
        userNames: ['user1'],
      });

      const result = await handler.removeUsersFromGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Group name and user names array are required');
    });

    it('should handle group names with special characters', async () => {
      mockEvent.path = '/groups/test%20group%20with%20spaces/members';
      mockEvent.body = JSON.stringify({
        userNames: ['user1'],
      });

      const result = await handler.removeUsersFromGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.ACCEPTED);
      expect(body.success).toBe(true);
    });
  });
});
