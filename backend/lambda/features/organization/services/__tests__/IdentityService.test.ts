import { type Mock, type Mocked, vi } from 'vitest';

import { ClientFactory } from '../../../../shared/services/aws/ClientFactory';
import type { QuickSightService } from '../../../../shared/services/aws/QuickSightService';
import { logger } from '../../../../shared/utils/logger';
import { IdentityService } from '../IdentityService';

vi.mock('../../../../shared/services/aws/ClientFactory');
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
        UserId: 'user-id',
        UserName: 'testuser',
        Email: 'test@example.com',
        Role: 'AUTHOR',
        Active: true,
        PrincipalId: 'principal-123',
        Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
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
        UserName: 'testuser',
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
  });
});
