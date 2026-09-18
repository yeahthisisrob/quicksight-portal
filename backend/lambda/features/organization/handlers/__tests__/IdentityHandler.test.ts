import { type APIGatewayProxyEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STATUS_CODES } from '../../../../shared/constants';
import { ValidationError } from '../../../../shared/errors/ValidationError';
import { IdentityHandler } from '../IdentityHandler';

/** Reach the mocked bulk service instance a handler was constructed with */
const bulkServiceOf = (handler: IdentityHandler) =>
  (handler as any).bulkOperationsService as {
    bulkAddUsersToGroups: ReturnType<typeof vi.fn>;
    bulkRemoveUsersFromGroups: ReturnType<typeof vi.fn>;
  };

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

    it('should surface validation failures from the bulk service as 400 with their message', async () => {
      const validationMessage =
        'Each user name must be a non-empty string (received null at index 0)';
      bulkServiceOf(handler).bulkAddUsersToGroups.mockRejectedValueOnce(
        new ValidationError(validationMessage)
      );
      mockEvent.body = JSON.stringify({ userNames: [null] });

      const result = await handler.addUsersToGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body).toEqual({ success: false, error: validationMessage });
    });

    it('should keep infrastructure failures generic (500)', async () => {
      bulkServiceOf(handler).bulkAddUsersToGroups.mockRejectedValueOnce(
        new Error('DynamoDB is on fire')
      );
      mockEvent.body = JSON.stringify({ userNames: ['user1'] });

      const result = await handler.addUsersToGroup(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.INTERNAL_SERVER_ERROR);
      expect(body).toEqual({ success: false, error: 'Failed to add users to group' });
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
