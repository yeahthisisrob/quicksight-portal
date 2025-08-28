import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import { type QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import { logger } from '../../../shared/utils/logger';
import {
  type User,
  type Group,
  type GroupMember,
  type BulkUserGroupResult,
  type UserActivityRefreshResult,
  type UsersAndGroupsExport,
} from '../types';

export class IdentityService {
  private readonly quickSightService: QuickSightService;

  constructor(accountId: string) {
    this.quickSightService = ClientFactory.getQuickSightService(accountId);
  }

  // Bulk operations from old users.service
  public async addUsersToGroup(
    groupName: string,
    userNames: string[]
  ): Promise<BulkUserGroupResult> {
    const successful: string[] = [];
    const failed: Array<{ userName: string; error: string }> = [];

    logger.info(`Adding ${userNames.length} users to group ${groupName}`);

    for (const userName of userNames) {
      try {
        await this.quickSightService.createGroupMembership(groupName, userName);
        successful.push(userName);
        logger.debug(`Successfully added user ${userName} to group ${groupName}`);
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        failed.push({ userName, error: errorMessage });
        logger.error(`Failed to add user ${userName} to group ${groupName}:`, error);
      }
    }

    logger.info(
      `Bulk add to group ${groupName} completed: ${successful.length} successful, ${failed.length} failed`
    );
    return { successful, failed };
  }

  public async addUserToGroup(userName: string, groupName: string): Promise<void> {
    try {
      await this.quickSightService.createGroupMembership(groupName, userName);
    } catch (error) {
      logger.error('Failed to add user to group', { userName, groupName, error });
      throw error;
    }
  }

  public async exportUsersAndGroups(): Promise<UsersAndGroupsExport> {
    try {
      logger.info('Starting export of users and groups');

      const [users, groups] = await Promise.all([
        this.getAllUsersForExport(),
        this.getAllGroupsForExport(),
      ]);

      logger.info(`Export completed: ${users.length} users, ${groups.length} groups`);
      return {
        users,
        groups,
        exportTime: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to export users and groups:', error);
      throw error;
    }
  }

  public async getGroup(groupName: string): Promise<Group> {
    try {
      const response = await this.quickSightService.describeGroup(groupName);
      return {
        groupName: response.Group.GroupName || groupName,
        arn: response.Group.Arn || '',
        principalId: response.Group.PrincipalId,
        description: response.Group.Description,
      };
    } catch (error) {
      logger.error('Failed to get group', { groupName, error });
      throw error;
    }
  }

  public async getGroupMembers(groupName: string): Promise<GroupMember[]> {
    try {
      const members = await this.quickSightService.listGroupMemberships(groupName);
      return members
        .filter((member: any) => member.MemberName && member.Arn)
        .map((member: any) => ({
          memberName: member.MemberName,
          memberArn: member.Arn,
        }));
    } catch (error) {
      logger.error('Failed to get group members', { groupName, error });
      throw error;
    }
  }

  public async getUser(userName: string): Promise<User> {
    try {
      const user = await this.quickSightService.describeUser(userName);
      return {
        userId: user.User.UserId || userName,
        userName: user.User.UserName || userName,
        email: user.User.Email,
        role: user.User.Role,
        active: user.User.Active || false,
        principalId: user.User.PrincipalId,
        arn: user.User.Arn || '',
      };
    } catch (error) {
      logger.error('Failed to get user', { userName, error });
      throw error;
    }
  }

  public async getUserFromCache(userName: string): Promise<User | null> {
    try {
      const userAsset = await cacheService.getAsset('user', userName);
      if (!userAsset) {
        return null;
      }

      return {
        userId: userAsset.id,
        userName: userAsset.name,
        email: userAsset.metadata?.email || '',
        role: userAsset.metadata?.role || 'READER',
        active: userAsset.metadata?.active !== false,
        principalId: userAsset.metadata?.principalId,
        arn: userAsset.arn || '',
        groups: userAsset.groups || [],
      };
    } catch (error) {
      logger.error('Failed to get user from cache', { userName, error });
      return null;
    }
  }

  // Note: Group listing for UI display is handled by AssetService through /assets/groups/paginated
  // This method is kept for internal use and group member management
  public async listGroups(): Promise<Group[]> {
    try {
      // Get groups from master cache (fast) - exclude archived groups
      const cache = await cacheService.getMasterCache({ statusFilter: AssetStatusFilter.ACTIVE });

      if (!cache?.entries?.group) {
        return [];
      }

      const allGroups = cache.entries.group || [];

      // For each group, get the members from the export data
      const groupsWithMembers = await Promise.all(
        allGroups.map(async (group: any) => {
          let members: GroupMember[] = [];

          try {
            // Try to get members from the export file
            const exportData = await cacheService.get(`exports/organization/groups.json`);
            if (exportData && exportData[group.assetName]?.apiResponses?.members?.data) {
              members = exportData[group.assetName].apiResponses.members.data.map(
                (member: any) => ({
                  memberName: member.MemberName || member.memberName,
                  memberArn: member.Arn || member.memberArn,
                })
              );
            }
          } catch (error) {
            logger.debug(`Could not load members for group ${group.assetName}`, { error });
          }

          return {
            groupName: group.assetName,
            arn: group.arn,
            principalId: group.metadata?.principalId,
            description: group.metadata?.description,
            memberCount: group.metadata?.memberCount || 0,
            members: members,
          };
        })
      );

      return groupsWithMembers;
    } catch (error) {
      logger.error('Failed to list groups', { error });
      throw error;
    }
  }

  public async refreshUserActivity(): Promise<UserActivityRefreshResult> {
    const startTime = Date.now();
    let usersUpdated = 0;
    let totalUsers = 0;
    const errors: Array<{ userName: string; error: string }> = [];

    try {
      logger.info('Starting user activity refresh');

      // Get all users from index - exclude archived users
      const cache = await cacheService.getMasterCache({ statusFilter: AssetStatusFilter.ACTIVE });
      const users = cache?.entries?.user || [];
      totalUsers = users.length;

      // For now, this is a placeholder implementation
      // In a full implementation, this would:
      // 1. Query CloudTrail for user activity
      // 2. Update user metadata with activity data
      // 3. Update the index with new activity data

      logger.info('User activity refresh completed (placeholder implementation)');
      usersUpdated = totalUsers; // Placeholder
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      errors.push(errorMessage);
      logger.error('Failed to refresh user activity:', error);
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      usersUpdated,
      totalUsers,
      processingTimeMs,
      errors,
    };
  }

  public async removeUserFromGroup(userName: string, groupName: string): Promise<void> {
    try {
      await this.quickSightService.deleteGroupMembership(groupName, userName);
    } catch (error) {
      logger.error('Failed to remove user from group', { userName, groupName, error });
      throw error;
    }
  }

  public async removeUsersFromGroup(
    groupName: string,
    userNames: string[]
  ): Promise<BulkUserGroupResult> {
    const successful: string[] = [];
    const failed: Array<{ userName: string; error: string }> = [];

    logger.info(`Removing ${userNames.length} users from group ${groupName}`);

    for (const userName of userNames) {
      try {
        await this.quickSightService.deleteGroupMembership(groupName, userName);
        successful.push(userName);
        logger.debug(`Successfully removed user ${userName} from group ${groupName}`);
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        failed.push({ userName, error: errorMessage });
        logger.error(`Failed to remove user ${userName} from group ${groupName}:`, error);
      }
    }

    logger.info(
      `Bulk remove from group ${groupName} completed: ${successful.length} successful, ${failed.length} failed`
    );
    return { successful, failed };
  }

  private async getAllGroupsForExport(): Promise<Group[]> {
    try {
      // Get groups from index - exclude archived for export
      const cache = await cacheService.getMasterCache({ statusFilter: AssetStatusFilter.ACTIVE });
      const indexGroups = cache?.entries?.group || [];

      // Get member details for each group
      const groups = await Promise.all(
        indexGroups.map(async (group: any) => {
          try {
            const members = await this.getGroupMembers(group.name);
            return {
              groupName: group.name,
              arn: group.arn,
              principalId: group.metadata?.principalId,
              description: group.metadata?.description,
              memberCount: members.length,
              members,
            };
          } catch (error) {
            logger.warn(`Failed to get members for group ${group.name}:`, error);
            return {
              groupName: group.name,
              arn: group.arn,
              principalId: group.metadata?.principalId,
              description: group.metadata?.description,
              memberCount: 0,
              members: [],
            };
          }
        })
      );

      return groups;
    } catch (error) {
      logger.error('Failed to get groups for export:', error);
      return [];
    }
  }

  private async getAllUsersForExport(): Promise<User[]> {
    try {
      const cache = await cacheService.getMasterCache({ statusFilter: AssetStatusFilter.ACTIVE });
      const indexUsers = cache?.entries?.user || [];

      return indexUsers.map((user: any) => ({
        userId: user.id,
        userName: user.name,
        email: user.metadata?.email || '',
        role: user.metadata?.role || 'READER',
        active: user.metadata?.active !== false,
        principalId: user.metadata?.principalId,
        arn: user.arn,
        lastActivityTime: user.metadata?.lastActivityTime,
        activityCount: user.metadata?.activityCount || 0,
        activityByType: user.metadata?.activityByType || {},
        groups: user.groups || [],
      }));
    } catch (error) {
      logger.error('Failed to get users for export:', error);
      return [];
    }
  }
}
