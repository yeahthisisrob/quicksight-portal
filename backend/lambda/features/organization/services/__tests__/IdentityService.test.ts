import { vi, type Mock, type Mocked } from 'vitest';

import { ClientFactory } from '../../../../shared/services/aws/ClientFactory';
import { type QuickSightService } from '../../../../shared/services/aws/QuickSightService';
import { cacheService } from '../../../../shared/services/cache/CacheService';
import { AssetStatusFilter } from '../../../../shared/types/assetFilterTypes';
import { logger } from '../../../../shared/utils/logger';
import { IdentityService } from '../IdentityService';

vi.mock('../../../../shared/services/aws/ClientFactory');
vi.mock('../../../../shared/services/cache/CacheService');
vi.mock('../../../../shared/utils/logger');

describe('IdentityService', () => {
  let identityService: IdentityService;
  let mockQuickSightService: Mocked<QuickSightService>;
  const TEST_ACCOUNT_ID = '123456789012';

  beforeEach(() => {
    vi.clearAllMocks();

    mockQuickSightService = {
      createGroupMembership: vi.fn(),
      deleteGroupMembership: vi.fn(),
      describeGroup: vi.fn(),
      describeUser: vi.fn(),
      listGroupMemberships: vi.fn(),
    } as any;

    (ClientFactory.getQuickSightService as Mock).mockReturnValue(mockQuickSightService);

    identityService = new IdentityService(TEST_ACCOUNT_ID);
  });

  describe('constructor', () => {
    it('should initialize with QuickSight service', () => {
      expect(ClientFactory.getQuickSightService).toHaveBeenCalledWith(TEST_ACCOUNT_ID);
    });
  });

  describe('addUserToGroup', () => {
    it('should add user to group successfully', async () => {
      mockQuickSightService.createGroupMembership.mockResolvedValue({});

      await identityService.addUserToGroup('testuser', 'testgroup');

      expect(mockQuickSightService.createGroupMembership).toHaveBeenCalledWith(
        'testgroup',
        'testuser'
      );
    });

    it('should throw error when adding user to group fails', async () => {
      const error = new Error('Permission denied');
      mockQuickSightService.createGroupMembership.mockRejectedValue(error);

      await expect(identityService.addUserToGroup('testuser', 'testgroup')).rejects.toThrow(
        'Permission denied'
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('addUsersToGroup', () => {
    it('should add multiple users to group successfully', async () => {
      mockQuickSightService.createGroupMembership.mockResolvedValue({});

      const result = await identityService.addUsersToGroup('testgroup', [
        'user1',
        'user2',
        'user3',
      ]);

      expect(result.successful).toEqual(['user1', 'user2', 'user3']);
      expect(result.failed).toEqual([]);
      const EXPECTED_CALLS = 3;
      expect(mockQuickSightService.createGroupMembership).toHaveBeenCalledTimes(EXPECTED_CALLS);
    });

    it('should handle partial failures when adding users', async () => {
      mockQuickSightService.createGroupMembership
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('User not found'))
        .mockResolvedValueOnce({});

      const result = await identityService.addUsersToGroup('testgroup', [
        'user1',
        'user2',
        'user3',
      ]);

      expect(result.successful).toEqual(['user1', 'user3']);
      expect(result.failed).toEqual([{ userName: 'user2', error: 'User not found' }]);
    });
  });
});

describe('IdentityService - Group Membership', () => {
  let identityService: IdentityService;
  let mockQuickSightService: Mocked<QuickSightService>;
  const TEST_ACCOUNT_ID = '123456789012';

  beforeEach(() => {
    vi.clearAllMocks();

    mockQuickSightService = {
      createGroupMembership: vi.fn(),
      deleteGroupMembership: vi.fn(),
      describeGroup: vi.fn(),
      describeUser: vi.fn(),
      listGroupMemberships: vi.fn(),
    } as any;

    (ClientFactory.getQuickSightService as Mock).mockReturnValue(mockQuickSightService);

    identityService = new IdentityService(TEST_ACCOUNT_ID);
  });

  describe('removeUserFromGroup', () => {
    it('should remove user from group successfully', async () => {
      mockQuickSightService.deleteGroupMembership.mockResolvedValue({});

      await identityService.removeUserFromGroup('testuser', 'testgroup');

      expect(mockQuickSightService.deleteGroupMembership).toHaveBeenCalledWith(
        'testgroup',
        'testuser'
      );
    });

    it('should throw error when removing user from group fails', async () => {
      const error = new Error('Group not found');
      mockQuickSightService.deleteGroupMembership.mockRejectedValue(error);

      await expect(identityService.removeUserFromGroup('testuser', 'testgroup')).rejects.toThrow(
        'Group not found'
      );
    });
  });

  describe('removeUsersFromGroup', () => {
    it('should remove multiple users from group successfully', async () => {
      mockQuickSightService.deleteGroupMembership.mockResolvedValue({});

      const result = await identityService.removeUsersFromGroup('testgroup', ['user1', 'user2']);

      expect(result.successful).toEqual(['user1', 'user2']);
      expect(result.failed).toEqual([]);
    });

    it('should handle partial failures when removing users', async () => {
      mockQuickSightService.deleteGroupMembership
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Not a member'));

      const result = await identityService.removeUsersFromGroup('testgroup', ['user1', 'user2']);

      expect(result.successful).toEqual(['user1']);
      expect(result.failed).toEqual([{ userName: 'user2', error: 'Not a member' }]);
    });
  });
});

describe('IdentityService - User Operations', () => {
  let identityService: IdentityService;
  let mockQuickSightService: Mocked<QuickSightService>;
  const TEST_ACCOUNT_ID = '123456789012';

  beforeEach(() => {
    vi.clearAllMocks();

    mockQuickSightService = {
      createGroupMembership: vi.fn(),
      deleteGroupMembership: vi.fn(),
      describeGroup: vi.fn(),
      describeUser: vi.fn(),
      listGroupMemberships: vi.fn(),
      listUsers: vi.fn(),
      listUserGroups: vi.fn(),
    } as any;

    (ClientFactory.getQuickSightService as Mock).mockReturnValue(mockQuickSightService);

    identityService = new IdentityService(TEST_ACCOUNT_ID);
  });

  describe('getUser', () => {
    it('should get user details successfully', async () => {
      mockQuickSightService.describeUser.mockResolvedValue({
        User: {
          UserId: 'user-id',
          UserName: 'testuser',
          Email: 'test@example.com',
          Role: 'AUTHOR',
          Active: true,
          PrincipalId: 'principal-123',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
        },
      });

      const user = await identityService.getUser('testuser');

      expect(user).toEqual({
        userId: 'user-id',
        userName: 'testuser',
        email: 'test@example.com',
        role: 'AUTHOR',
        active: true,
        principalId: 'principal-123',
        arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
      });
    });

    it('should handle missing fields in user response', async () => {
      mockQuickSightService.describeUser.mockResolvedValue({
        User: {
          UserName: 'testuser',
        },
      });

      const user = await identityService.getUser('testuser');

      expect(user).toEqual({
        userId: 'testuser',
        userName: 'testuser',
        email: undefined,
        role: undefined,
        active: false,
        principalId: undefined,
        arn: '',
      });
    });
  });

  describe('getUserFromCache', () => {
    it('should get user from cache successfully', async () => {
      const cachedUser = {
        id: 'testuser',
        name: 'testuser',
        arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
        groups: ['Admins', 'Developers'],
        metadata: {
          email: 'test@example.com',
          role: 'AUTHOR',
          active: true,
          principalId: 'principal-123',
        },
      };

      (cacheService.getAsset as Mock).mockResolvedValue(cachedUser);

      const user = await identityService.getUserFromCache('testuser');

      expect(user).toEqual({
        userId: 'testuser',
        userName: 'testuser',
        email: 'test@example.com',
        role: 'AUTHOR',
        active: true,
        principalId: 'principal-123',
        arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
        groups: ['Admins', 'Developers'],
      });
    });

    it('should return null when user not in cache', async () => {
      (cacheService.getAsset as Mock).mockResolvedValue(null);

      const user = await identityService.getUserFromCache('nonexistent');

      expect(user).toBeNull();
    });

    it('should handle cache errors gracefully', async () => {
      (cacheService.getAsset as Mock).mockRejectedValue(new Error('Cache error'));

      const user = await identityService.getUserFromCache('testuser');

      expect(user).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    // POTENTIAL BUG: This test shows that stale groups in cache would be returned
    it('should return cached groups even if they are stale', async () => {
      const cachedUser = {
        id: 'testuser',
        name: 'testuser',
        groups: ['DeletedGroup', 'OldGroup'], // These might be stale!
        metadata: {},
      };

      (cacheService.getAsset as Mock).mockResolvedValue(cachedUser);

      const user = await identityService.getUserFromCache('testuser');

      expect(user?.groups).toEqual(['DeletedGroup', 'OldGroup']);
      // BUG: These groups might no longer exist but are still returned from cache
    });
  });
});

describe('IdentityService - Group Queries', () => {
  let identityService: IdentityService;
  let mockQuickSightService: Mocked<QuickSightService>;
  const TEST_ACCOUNT_ID = '123456789012';

  beforeEach(() => {
    vi.clearAllMocks();

    mockQuickSightService = {
      createGroupMembership: vi.fn(),
      deleteGroupMembership: vi.fn(),
      describeGroup: vi.fn(),
      describeUser: vi.fn(),
      listGroupMemberships: vi.fn(),
      listUsers: vi.fn(),
      listUserGroups: vi.fn(),
    } as any;

    (ClientFactory.getQuickSightService as Mock).mockReturnValue(mockQuickSightService);

    identityService = new IdentityService(TEST_ACCOUNT_ID);
  });

  describe('getGroup', () => {
    it('should get group details successfully', async () => {
      mockQuickSightService.describeGroup.mockResolvedValue({
        Group: {
          GroupName: 'testgroup',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/testgroup',
          PrincipalId: 'principal-456',
          Description: 'Test group',
        },
      });

      const group = await identityService.getGroup('testgroup');

      expect(group).toEqual({
        groupName: 'testgroup',
        arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/testgroup',
        principalId: 'principal-456',
        description: 'Test group',
      });
    });
  });

  describe('getGroupMembers', () => {
    it('should get group members successfully', async () => {
      mockQuickSightService.listGroupMemberships.mockResolvedValue([
        {
          MemberName: 'user1',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
        },
        {
          MemberName: 'user2',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user2',
        },
      ]);

      const members = await identityService.getGroupMembers('testgroup');

      expect(members).toEqual([
        {
          memberName: 'user1',
          memberArn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
        },
        {
          memberName: 'user2',
          memberArn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user2',
        },
      ]);
    });

    it('should filter out members without name or arn', async () => {
      mockQuickSightService.listGroupMemberships.mockResolvedValue([
        {
          MemberName: 'user1',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
        },
        { MemberName: null, Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user2' },
        { MemberName: 'user3', Arn: null },
        {
          MemberName: 'user4',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user4',
        },
      ]);

      const members = await identityService.getGroupMembers('testgroup');

      expect(members).toEqual([
        {
          memberName: 'user1',
          memberArn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
        },
        {
          memberName: 'user4',
          memberArn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user4',
        },
      ]);
    });
  });
});

describe('IdentityService - List and Export Operations', () => {
  let identityService: IdentityService;
  let mockQuickSightService: Mocked<QuickSightService>;
  const TEST_ACCOUNT_ID = '123456789012';

  beforeEach(() => {
    vi.clearAllMocks();

    mockQuickSightService = {
      createGroupMembership: vi.fn(),
      deleteGroupMembership: vi.fn(),
      describeGroup: vi.fn(),
      describeUser: vi.fn(),
      listGroupMemberships: vi.fn(),
      listUsers: vi.fn(),
      listUserGroups: vi.fn(),
      listGroups: vi.fn(),
    } as any;

    (ClientFactory.getQuickSightService as Mock).mockReturnValue(mockQuickSightService);

    identityService = new IdentityService(TEST_ACCOUNT_ID);
  });

  describe('listGroups', () => {
    it('should list groups with members from cache', async () => {
      const mockCache = {
        entries: {
          group: [
            {
              assetName: 'Group1',
              arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/Group1',
              metadata: {
                principalId: 'principal-1',
                description: 'First group',
                memberCount: 2,
              },
            },
          ],
        },
      };

      const mockExportData = {
        Group1: {
          apiResponses: {
            members: {
              data: [
                { MemberName: 'user1', Arn: 'arn1' },
                { memberName: 'user2', memberArn: 'arn2' },
              ],
            },
          },
        },
      };

      (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);
      (cacheService.get as Mock).mockResolvedValue(mockExportData);

      const groups = await identityService.listGroups();

      expect(groups).toEqual([
        {
          groupName: 'Group1',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/Group1',
          principalId: 'principal-1',
          description: 'First group',
          memberCount: 2,
          members: [
            { memberName: 'user1', memberArn: 'arn1' },
            { memberName: 'user2', memberArn: 'arn2' },
          ],
        },
      ]);
    });

    it('should exclude archived groups', async () => {
      const mockCache = {
        entries: {
          group: [
            { assetName: 'ActiveGroup', status: 'active' },
            { assetName: 'ArchivedGroup', status: 'archived' },
          ],
        },
      };

      (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);
      (cacheService.get as Mock).mockResolvedValue({});

      await identityService.listGroups();

      expect(cacheService.getMasterCache).toHaveBeenCalledWith({
        statusFilter: AssetStatusFilter.ACTIVE,
      });
    });

    it('should handle missing export data gracefully', async () => {
      const mockCache = {
        entries: {
          group: [
            {
              assetName: 'Group1',
              arn: 'arn',
              metadata: { memberCount: 0 },
            },
          ],
        },
      };

      (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);
      (cacheService.get as Mock).mockRejectedValue(new Error('Export not found'));

      const groups = await identityService.listGroups();

      expect(groups[0]?.members).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Could not load members'),
        expect.any(Object)
      );
    });
  });
});

describe('IdentityService - Export and Refresh', () => {
  let identityService: IdentityService;
  let mockQuickSightService: Mocked<QuickSightService>;
  const TEST_ACCOUNT_ID = '123456789012';

  beforeEach(() => {
    vi.clearAllMocks();

    mockQuickSightService = {
      createGroupMembership: vi.fn(),
      deleteGroupMembership: vi.fn(),
      describeGroup: vi.fn(),
      describeUser: vi.fn(),
      listGroupMemberships: vi.fn(),
      listUsers: vi.fn(),
      listUserGroups: vi.fn(),
      listGroups: vi.fn(),
    } as any;

    (ClientFactory.getQuickSightService as Mock).mockReturnValue(mockQuickSightService);

    identityService = new IdentityService(TEST_ACCOUNT_ID);
  });

  describe('exportUsersAndGroups', () => {
    it('should export users and groups successfully', async () => {
      const mockUsers = [
        {
          id: 'user1',
          name: 'user1',
          arn: 'arn1',
          groups: ['Group1', 'Group2'],
          metadata: {
            email: 'user1@example.com',
            role: 'AUTHOR',
            active: true,
          },
        },
      ];

      const mockGroups = [
        {
          name: 'Group1',
          arn: 'arn1',
          metadata: {},
        },
      ];

      const mockCache = {
        entries: {
          user: mockUsers,
          group: mockGroups,
        },
      };

      (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);
      mockQuickSightService.listGroupMemberships.mockResolvedValue([]);

      const result = await identityService.exportUsersAndGroups();

      expect(result.users).toHaveLength(1);
      expect(result.groups).toHaveLength(1);
      expect(result.exportTime).toBeDefined();
    });

    // POTENTIAL BUG: This test demonstrates the issue with stale groups
    it('should export users with potentially stale group data from cache', async () => {
      const mockUsers = [
        {
          id: 'user1',
          name: 'user1',
          groups: ['DeletedGroup', 'StaleGroup'], // These might be outdated!
          metadata: {},
        },
      ];

      const mockGroups = [
        {
          name: 'ActiveGroup', // Note: DeletedGroup and StaleGroup are not here
          metadata: {},
        },
      ];

      const mockCache = {
        entries: {
          user: mockUsers,
          group: mockGroups,
        },
      };

      (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);
      mockQuickSightService.listGroupMemberships.mockResolvedValue([]);

      const result = await identityService.exportUsersAndGroups();

      // BUG: User still shows deleted groups
      expect(result.users[0]?.groups).toEqual(['DeletedGroup', 'StaleGroup']);
      expect(result.groups.map((g) => g.groupName)).toEqual(['ActiveGroup']);
      // This mismatch shows that users can have groups that don't exist!
    });

    it('should handle export errors gracefully', async () => {
      (cacheService.getMasterCache as Mock)
        .mockRejectedValueOnce(new Error('Cache error'))
        .mockRejectedValueOnce(new Error('Cache error'));

      // The method catches errors and returns empty arrays
      const result = await identityService.exportUsersAndGroups();

      expect(result.users).toEqual([]);
      expect(result.groups).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get users for export:',
        expect.any(Error)
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get groups for export:',
        expect.any(Error)
      );
    });
  });

  describe('refreshUserActivity', () => {
    it('should refresh user activity (placeholder)', async () => {
      const mockCache = {
        entries: {
          user: [{ id: 'user1' }, { id: 'user2' }],
        },
      };

      (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);

      const result = await identityService.refreshUserActivity();

      expect(result.totalUsers).toBe(2);
      expect(result.usersUpdated).toBe(2); // Placeholder implementation
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.errors).toEqual([]);
    });

    it('should handle refresh errors', async () => {
      (cacheService.getMasterCache as Mock).mockRejectedValue(new Error('Refresh failed'));

      const result = await identityService.refreshUserActivity();

      expect(result.errors).toContain('Refresh failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });
});

describe('IdentityService - Edge cases', () => {
  let identityService: IdentityService;
  let mockQuickSightService: Mocked<QuickSightService>;
  const TEST_ACCOUNT_ID = '123456789012';

  beforeEach(() => {
    vi.clearAllMocks();

    mockQuickSightService = {
      createGroupMembership: vi.fn(),
      deleteGroupMembership: vi.fn(),
      describeGroup: vi.fn(),
      describeUser: vi.fn(),
      listGroupMemberships: vi.fn(),
      listUsers: vi.fn(),
      listUserGroups: vi.fn(),
      listGroups: vi.fn(),
    } as any;

    (ClientFactory.getQuickSightService as Mock).mockReturnValue(mockQuickSightService);

    identityService = new IdentityService(TEST_ACCOUNT_ID);
  });

  describe('Edge cases and bug scenarios', () => {
    it('should handle SSO user names correctly', async () => {
      mockQuickSightService.createGroupMembership.mockResolvedValue({});

      await identityService.addUserToGroup('AWSReservedSSO_Admin_1234567890abcdef/user', 'group');

      expect(mockQuickSightService.createGroupMembership).toHaveBeenCalledWith(
        'group',
        'AWSReservedSSO_Admin_1234567890abcdef/user'
      );
    });

    it('should handle empty user lists', async () => {
      const result = await identityService.addUsersToGroup('group', []);

      expect(result.successful).toEqual([]);
      expect(result.failed).toEqual([]);
    });

    it('should handle very long group names', async () => {
      const NAME_LENGTH = 256;
      const longGroupName = 'a'.repeat(NAME_LENGTH);
      mockQuickSightService.describeGroup.mockResolvedValue({
        Group: { GroupName: longGroupName },
      });

      const group = await identityService.getGroup(longGroupName);

      expect(group.groupName).toBe(longGroupName);
    });

    // This test highlights the core issue
    it('CRITICAL BUG: getAllUsersForExport uses cached groups without validation', async () => {
      // Simulate a user with stale group data in cache
      const mockCache = {
        entries: {
          user: [
            {
              id: 'user1',
              name: 'user1',
              groups: ['Group1', 'DeletedGroup', 'Group2'], // DeletedGroup no longer exists!
              metadata: {},
            },
          ],
          group: [
            { name: 'Group1' },
            { name: 'Group2' },
            // Note: DeletedGroup is NOT in the active groups list
          ],
        },
      };

      (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);

      const users = await identityService['getAllUsersForExport']();

      // BUG CONFIRMED: User still shows DeletedGroup even though it's not in active groups
      expect(users[0]?.groups).toContain('DeletedGroup');

      // The fix would be to filter user.groups against active groups
      // or to refresh user group membership from QuickSight API
    });
  });
});
