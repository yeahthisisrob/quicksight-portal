import { describe, it, expect, vi, beforeEach } from 'vitest';

import { requireAuth } from '../../../../shared/auth';
import { STATUS_CODES } from '../../../../shared/constants';
import { FolderService } from '../../services/FolderService';
import { FolderHandler } from '../FolderHandler';

// Mock dependencies
vi.mock('../../services/FolderService');
vi.mock('../../../../shared/auth');
vi.mock('../../../../shared/utils/logger');
vi.mock('../../../../shared/services/bulk/BulkOperationsService');

const SUCCESS_STATUS = 200;

describe('FolderHandler', () => {
  let folderHandler: FolderHandler;
  let mockFolderService: any;

  beforeEach(() => {
    // Setup mocks
    mockFolderService = {
      addAssetToFolder: vi.fn().mockResolvedValue({}),
      removeAssetFromFolder: vi.fn().mockResolvedValue({}),
      removeMember: vi.fn().mockResolvedValue({}),
      addMember: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue({}),
      getMembers: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockResolvedValue([]),
    };

    (FolderService as any).mockImplementation(() => mockFolderService);
    (requireAuth as any).mockResolvedValue({ userId: 'test-user' });

    folderHandler = new FolderHandler();
  });

  describe('removeMember - Assets', () => {
    it.each([
      ['DASHBOARD', 'dashboard-456'],
      ['ANALYSIS', 'analysis-789'],
      ['DATASET', 'dataset-abc'],
      ['DATASOURCE', 'datasource-xyz'],
    ])('should remove %s from folder', async (memberType, memberId) => {
      const event = {
        pathParameters: { id: 'folder-123', memberId },
        queryStringParameters: { type: memberType },
        headers: {},
      } as any;

      const result = await folderHandler.removeMember(event);

      expect(mockFolderService.removeAssetFromFolder).toHaveBeenCalledWith(
        'folder-123',
        memberId,
        memberType
      );

      const body = JSON.parse(result.body);
      expect(result.statusCode).toBe(SUCCESS_STATUS);
      expect(body.success).toBe(true);
    });
  });

  describe('removeMember - Principals', () => {
    it.each([
      ['USER', 'user-123'],
      ['GROUP', 'group-456'],
    ])('should remove %s permissions', async (memberType, memberId) => {
      const event = {
        pathParameters: { id: 'folder-123', memberId },
        queryStringParameters: { type: memberType },
        headers: {},
      } as any;

      const result = await folderHandler.removeMember(event);

      expect(mockFolderService.removeMember).toHaveBeenCalledWith(
        'folder-123',
        memberId,
        memberType
      );

      const body = JSON.parse(result.body);
      expect(result.statusCode).toBe(SUCCESS_STATUS);
      expect(body.success).toBe(true);
    });
  });

  describe('removeMember - Errors', () => {
    it('should return 400 when parameters missing', async () => {
      const event = {
        pathParameters: { memberId: 'test' },
        queryStringParameters: { type: 'DASHBOARD' },
        headers: {},
      } as any;

      const result = await folderHandler.removeMember(event);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Missing required parameters');
    });

    it('should handle service errors', async () => {
      mockFolderService.removeAssetFromFolder.mockRejectedValue(new Error('Service error'));

      const event = {
        pathParameters: { id: 'folder-123', memberId: 'dashboard-456' },
        queryStringParameters: { type: 'DASHBOARD' },
        headers: {},
      } as any;

      const result = await folderHandler.removeMember(event);

      expect(result.statusCode).toBe(STATUS_CODES.INTERNAL_SERVER_ERROR);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Service error');
    });
  });

  describe('addMember', () => {
    it('should add asset to folder', async () => {
      const event = {
        pathParameters: { id: 'folder-123' },
        body: JSON.stringify({
          memberId: 'dashboard-456',
          memberType: 'DASHBOARD',
        }),
        headers: {},
      } as any;

      const result = await folderHandler.addMember(event);

      expect(mockFolderService.addAssetToFolder).toHaveBeenCalledWith(
        'folder-123',
        'dashboard-456',
        'DASHBOARD'
      );

      const body = JSON.parse(result.body);
      expect(result.statusCode).toBe(SUCCESS_STATUS);
      expect(body.success).toBe(true);
    });

    it('should add USER with role', async () => {
      const event = {
        pathParameters: { id: 'folder-123' },
        body: JSON.stringify({
          memberId: 'user-123',
          memberType: 'USER',
          role: 'VIEWER',
        }),
        headers: {},
      } as any;

      const result = await folderHandler.addMember(event);

      expect(mockFolderService.addMember).toHaveBeenCalledWith(
        'folder-123',
        'user-123',
        'USER',
        'VIEWER'
      );

      const body = JSON.parse(result.body);
      expect(result.statusCode).toBe(SUCCESS_STATUS);
      expect(body.success).toBe(true);
    });

    it('should return 400 when role missing for USER', async () => {
      const event = {
        pathParameters: { id: 'folder-123' },
        body: JSON.stringify({
          memberId: 'user-123',
          memberType: 'USER',
        }),
        headers: {},
      } as any;

      const result = await folderHandler.addMember(event);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Missing required role for user/group');
    });
  });
});
