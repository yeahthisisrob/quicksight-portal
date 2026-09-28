import { metadataBucketName } from '../../../shared/config/metadataBucket';
import { STATUS_CODES } from '../../../shared/constants';
import { ArchiveService } from '../../../shared/services/archive/ArchiveService';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { PermissionsService } from '../../../shared/services/organization/PermissionsService';
import { ASSET_TYPES } from '../../../shared/types/assetTypes';
import type {
  BulkUserGroupResult,
  Group,
  GroupMember,
  User,
} from '../../../shared/types/organization';
import { errorMessage } from '../../../shared/utils/errorMessage';
import { logger } from '../../../shared/utils/logger';
import { type ArchivedUser, UserArchive } from './UserArchive';

export interface UserRestoreResult {
  userName: string;
  groups: { restored: string[]; missing: string[] };
  permissions: { restored: number; failed: Array<{ asset: string; error: string }> };
}

/** QuickSight (or the lookup) says the user does not exist. */
function isNotFound(error: any): boolean {
  return (
    error?.name === 'ResourceNotFoundException' ||
    error?.statusCode === STATUS_CODES.NOT_FOUND ||
    error?.$metadata?.httpStatusCode === STATUS_CODES.NOT_FOUND ||
    /not found|does not exist/i.test(String(error?.message ?? ''))
  );
}

export class IdentityService {
  private readonly quickSightService: QuickSightService;
  private readonly archive: UserArchive;
  private readonly permissions: PermissionsService;

  public constructor(accountId: string) {
    this.quickSightService = ClientFactory.getQuickSightService(accountId);
    this.archive = new UserArchive(accountId);
    this.permissions = new PermissionsService(accountId);
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
        failed.push({ userName, error: errorMessage(error) || 'Unknown error' });
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

  public async deleteUser(
    userName: string,
    deletedBy?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get user details before deleting for validation and logging
      let user: User;
      try {
        user = await this.getUser(userName);
      } catch (error) {
        if (!isNotFound(error)) throw error;
        // Already gone from QuickSight (an earlier delete got that far): finish
        // recording it, so the portal agrees instead of failing on every retry.
        await this.recordDeleted(userName, deletedBy);
        return {
          success: true,
          message: `User "${userName}" was already deleted in QuickSight; the portal now agrees`,
        };
      }

      // Only allow deletion of READER and READER_PRO roles
      const allowedRoles = ['READER', 'READER_PRO'];
      if (!allowedRoles.includes(user.role)) {
        const error: any = new Error(
          `Cannot delete user with role "${user.role}". Only READER and READER_PRO users can be deleted.`
        );
        error.statusCode = STATUS_CODES.FORBIDDEN;
        throw error;
      }

      // Keep what they had before it is gone, or do not delete at all.
      await this.archive.save(await this.snapshot(user, deletedBy));

      // Delete user from QuickSight
      await this.quickSightService.deleteUser(userName);

      logger.info(`Deleted user ${userName} from QuickSight`, {
        userName,
        role: user.role,
        deletedBy,
      });

      await this.recordDeleted(userName, deletedBy);

      return {
        success: true,
        message: `User "${userName}" deleted successfully`,
      };
    } catch (error: any) {
      logger.error(`Failed to delete user ${userName}:`, error);
      throw error;
    }
  }

  /**
   * Archive a deleted user the way an export would: the record moves to the
   * archived collection and the cache follows. A failure is thrown, never
   * swallowed: a user gone from QuickSight but still listed is the state
   * that made every retry fail.
   */
  private async recordDeleted(userName: string, deletedBy?: string): Promise<void> {
    const result = await new ArchiveService(metadataBucketName()).archiveAsset(
      ASSET_TYPES.user,
      userName,
      'Deleted via portal',
      deletedBy
    );
    if (!result.success) {
      const error: any = new Error(
        `User "${userName}" is deleted in QuickSight, but the portal could not record it: ${result.error ?? 'unknown error'}. Deleting it again finishes it.`
      );
      error.statusCode = STATUS_CODES.INTERNAL_SERVER_ERROR;
      throw error;
    }
  }

  /** The groups a user is in and what is granted to them directly, for the archive. */
  private async snapshot(user: User, archivedBy?: string): Promise<ArchivedUser> {
    const [groups, access] = await Promise.all([
      this.quickSightService.listUserGroups(user.userName),
      this.permissions.getUserAssetAccess(user.userName).catch(() => ({ assets: [] })),
    ]);
    return {
      userName: user.userName,
      ...(user.email ? { email: user.email } : {}),
      role: user.role ?? 'READER',
      arn: user.arn ?? '',
      archivedAt: new Date().toISOString(),
      ...(archivedBy ? { archivedBy } : {}),
      groups: (groups ?? [])
        .map((g: { GroupName?: string }) => g.GroupName)
        .filter((name: string | undefined): name is string => Boolean(name)),
      permissions: access.assets.flatMap((asset) => {
        const direct = asset.sources.filter((source) => source.type === 'direct');
        return direct.length
          ? [
              {
                assetType: asset.assetType,
                assetId: asset.assetId,
                assetName: asset.assetName,
                actions: [...new Set(direct.flatMap((source) => source.actions))],
              },
            ]
          : [];
      }),
    };
  }

  /** What a deleted user had, as archived; null when nothing was kept. */
  public archivedUser(userName: string): Promise<ArchivedUser | null> {
    return this.archive.get(userName);
  }

  /**
   * Give a user back what they had: their groups and their direct
   * permissions. They must exist in QuickSight again first (a reader does
   * once they sign in through the identity provider). A group that no
   * longer exists, or an asset that is gone, is reported and skipped.
   */
  public async restoreUser(userName: string, restoredBy?: string): Promise<UserRestoreResult> {
    const archived = await this.archive.get(userName);
    if (!archived) {
      throw Object.assign(new Error(`Nothing was archived for "${userName}"`), {
        statusCode: STATUS_CODES.NOT_FOUND,
      });
    }
    let user: User;
    try {
      user = await this.getUser(userName);
    } catch {
      throw Object.assign(
        new Error(
          `"${userName}" is not in QuickSight yet. A reader comes back when they sign in; restore their access then.`
        ),
        { statusCode: STATUS_CODES.CONFLICT }
      );
    }

    const groups = { restored: [] as string[], missing: [] as string[] };
    for (const group of archived.groups) {
      try {
        await this.quickSightService.createGroupMembership(group, userName);
        groups.restored.push(group);
      } catch (error) {
        logger.warn('Group not restored', { userName, group, error });
        groups.missing.push(group);
      }
    }
    const permissions = { restored: 0, failed: [] as Array<{ asset: string; error: string }> };
    for (const grant of archived.permissions) {
      try {
        await this.quickSightService.updatePermissions(grant.assetType, grant.assetId, [
          { Principal: user.arn, Actions: grant.actions },
        ]);
        permissions.restored += 1;
      } catch (error) {
        permissions.failed.push({
          asset: `${grant.assetType} ${grant.assetName}`,
          error: errorMessage(error),
        });
      }
    }
    await this.archive.save({
      ...archived,
      restoredAt: new Date().toISOString(),
      ...(restoredBy ? { restoredBy } : {}),
    });
    logger.info('Restored user access', { userName, groups, restored: permissions.restored });
    return { userName, groups, permissions };
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
      if (!user) {
        throw new Error(`User "${userName}" not found`);
      }
      return {
        userId: user.UserId || userName,
        userName: user.UserName || userName,
        email: user.Email,
        role: user.Role,
        active: user.Active || false,
        principalId: user.PrincipalId,
        arn: user.Arn || '',
      };
    } catch (error) {
      logger.error('Failed to get user', { userName, error });
      throw error;
    }
  }

  // Note: Group listing for UI display is handled by AssetService through /assets/groups/paginated
  // This method is kept for internal use and group member management
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
        failed.push({ userName, error: errorMessage(error) || 'Unknown error' });
        logger.error(`Failed to remove user ${userName} from group ${groupName}:`, error);
      }
    }

    logger.info(
      `Bulk remove from group ${groupName} completed: ${successful.length} successful, ${failed.length} failed`
    );
    return { successful, failed };
  }
}
