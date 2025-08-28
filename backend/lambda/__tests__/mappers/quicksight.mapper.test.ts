/**
 * Unit tests for QuickSight mappers
 */

/* eslint-disable max-lines-per-function */
/* eslint-disable max-nested-callbacks */

import {
  mapSDKDashboardSummaryToDomain,
  mapSDKDashboardToDomain,
  mapSDKAnalysisSummaryToDomain,
  mapSDKAnalysisToDomain,
  mapSDKDataSetSummaryToDomain,
  mapSDKDataSetToDomain,
  mapSDKDataSourceSummaryToDomain,
  mapSDKDataSourceToDomain,
  mapSDKFolderSummaryToDomain,
  mapSDKFolderToDomain,
  mapSDKFolderMemberToDomain,
  mapSDKUserToDomain,
  mapSDKGroupToDomain,
  mapSDKResourcePermissionToDomain,
  mapSDKTagToDomain,
  mapSDKDashboardListToDomain,
  mapSDKUserListToDomain,
  mapSDKGroupListToDomain,
} from '../../shared/mappers/quicksight.mapper';
import type {
  DashboardSummary as SDKDashboardSummary,
  Dashboard as SDKDashboard,
  AnalysisSummary as SDKAnalysisSummary,
  Analysis as SDKAnalysis,
  DataSetSummary as SDKDataSetSummary,
  DataSet as SDKDataSet,
  DataSourceSummary as SDKDataSourceSummary,
  DataSource as SDKDataSource,
  FolderSummary as SDKFolderSummary,
  Folder as SDKFolder,
  FolderMember as SDKFolderMember,
  User as SDKUser,
  Group as SDKGroup,
  ResourcePermission as SDKResourcePermission,
  Tag as SDKTag,
} from '../../shared/types/aws-sdk-types';

describe('QuickSight Mappers', () => {
  describe('Dashboard Mappers', () => {
    describe('mapSDKDashboardSummaryToDomain', () => {
      it('should map SDK DashboardSummary to domain model', () => {
        const sdkDashboard: SDKDashboardSummary = {
          DashboardId: 'dash-123',
          Name: 'Test Dashboard',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash-123',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
          PublishedVersionNumber: 5,
          LastPublishedTime: new Date('2023-05-15'),
        };

        const result = mapSDKDashboardSummaryToDomain(sdkDashboard);

        expect(result).toEqual({
          dashboardId: 'dash-123',
          name: 'Test Dashboard',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash-123',
          createdTime: new Date('2023-01-01'),
          lastUpdatedTime: new Date('2023-06-01'),
          publishedVersionNumber: 5,
          lastPublishedTime: new Date('2023-05-15'),
        });
      });

      it('should handle optional fields', () => {
        const sdkDashboard: SDKDashboardSummary = {
          DashboardId: 'dash-123',
          Name: 'Test Dashboard',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash-123',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
        };

        const result = mapSDKDashboardSummaryToDomain(sdkDashboard);

        expect(result.publishedVersionNumber).toBeUndefined();
        expect(result.lastPublishedTime).toBeUndefined();
      });

      it('should throw error when required fields are missing', () => {
        const sdkDashboard = {
          DashboardId: 'dash-123',
          Name: 'Test Dashboard',
          // Missing Arn, CreatedTime, LastUpdatedTime
        } as SDKDashboardSummary;

        expect(() => mapSDKDashboardSummaryToDomain(sdkDashboard)).toThrow(
          'Missing required fields in DashboardSummary'
        );
      });
    });

    describe('mapSDKDashboardToDomain', () => {
      it('should map SDK Dashboard to domain model with version', () => {
        const sdkDashboard: SDKDashboard = {
          DashboardId: 'dash-123',
          Name: 'Test Dashboard',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash-123',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
          LastPublishedTime: new Date('2023-05-15'),
          Version: {
            VersionNumber: 5,
            Status: 'CREATION_SUCCESSFUL',
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash-123/version/5',
            SourceEntityArn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/analysis-123',
            DataSetArns: ['arn:aws:quicksight:us-east-1:123456789012:dataset/ds-123'],
            Description: 'Version 5',
            CreatedTime: new Date('2023-05-15'),
          },
        };

        const result = mapSDKDashboardToDomain(sdkDashboard);

        expect(result).toEqual({
          dashboardId: 'dash-123',
          name: 'Test Dashboard',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash-123',
          createdTime: new Date('2023-01-01'),
          lastUpdatedTime: new Date('2023-06-01'),
          lastPublishedTime: new Date('2023-05-15'),
          version: {
            versionNumber: 5,
            status: 'CREATION_SUCCESSFUL',
            arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash-123/version/5',
            sourceEntityArn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/analysis-123',
            dataSetArns: ['arn:aws:quicksight:us-east-1:123456789012:dataset/ds-123'],
            description: 'Version 5',
            createdTime: new Date('2023-05-15'),
          },
        });
      });

      it('should handle missing version', () => {
        const sdkDashboard: SDKDashboard = {
          DashboardId: 'dash-123',
          Name: 'Test Dashboard',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash-123',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
        };

        const result = mapSDKDashboardToDomain(sdkDashboard);

        expect(result.version).toBeUndefined();
      });
    });
  });

  describe('Analysis Mappers', () => {
    describe('mapSDKAnalysisSummaryToDomain', () => {
      it('should map SDK AnalysisSummary to domain model', () => {
        const sdkAnalysis: SDKAnalysisSummary = {
          AnalysisId: 'analysis-123',
          Name: 'Test Analysis',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/analysis-123',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
          Status: 'CREATION_SUCCESSFUL',
        };

        const result = mapSDKAnalysisSummaryToDomain(sdkAnalysis);

        expect(result).toEqual({
          analysisId: 'analysis-123',
          name: 'Test Analysis',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/analysis-123',
          createdTime: new Date('2023-01-01'),
          lastUpdatedTime: new Date('2023-06-01'),
          status: 'CREATION_SUCCESSFUL',
        });
      });

      it('should throw error when required fields are missing', () => {
        const sdkAnalysis = {
          AnalysisId: 'analysis-123',
          // Missing other required fields
        } as SDKAnalysisSummary;

        expect(() => mapSDKAnalysisSummaryToDomain(sdkAnalysis)).toThrow(
          'Missing required fields in AnalysisSummary'
        );
      });
    });

    describe('mapSDKAnalysisToDomain', () => {
      it('should map SDK Analysis to domain model with errors', () => {
        const sdkAnalysis: SDKAnalysis = {
          AnalysisId: 'analysis-123',
          Name: 'Test Analysis',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/analysis-123',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
          Status: 'CREATION_FAILED',
          Errors: [
            {
              Type: 'VALIDATION_ERROR' as any,
              Message: 'Invalid dataset reference',
            },
          ],
          DataSetArns: ['arn:aws:quicksight:us-east-1:123456789012:dataset/ds-123'],
          ThemeArn: 'arn:aws:quicksight:us-east-1:123456789012:theme/theme-123',
        };

        const result = mapSDKAnalysisToDomain(sdkAnalysis);

        expect(result).toEqual({
          analysisId: 'analysis-123',
          name: 'Test Analysis',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/analysis-123',
          createdTime: new Date('2023-01-01'),
          lastUpdatedTime: new Date('2023-06-01'),
          status: 'CREATION_FAILED',
          errors: [
            {
              type: 'VALIDATION_ERROR',
              message: 'Invalid dataset reference',
            },
          ],
          dataSetArns: ['arn:aws:quicksight:us-east-1:123456789012:dataset/ds-123'],
          themeArn: 'arn:aws:quicksight:us-east-1:123456789012:theme/theme-123',
        });
      });

      it('should handle missing optional fields', () => {
        const sdkAnalysis: SDKAnalysis = {
          AnalysisId: 'analysis-123',
          Name: 'Test Analysis',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/analysis-123',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
        };

        const result = mapSDKAnalysisToDomain(sdkAnalysis);

        expect(result.status).toBeUndefined();
        expect(result.errors).toBeUndefined();
        expect(result.dataSetArns).toBeUndefined();
        expect(result.themeArn).toBeUndefined();
      });

      it('should throw error when error item is missing required fields', () => {
        const sdkAnalysis: SDKAnalysis = {
          AnalysisId: 'analysis-123',
          Name: 'Test Analysis',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/analysis-123',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
          Errors: [
            {
              Type: 'VALIDATION_ERROR',
              // Missing Message
            } as any,
          ],
        };

        expect(() => mapSDKAnalysisToDomain(sdkAnalysis)).toThrow(
          'Missing required fields in AnalysisError'
        );
      });
    });
  });

  describe('Dataset Mappers', () => {
    describe('mapSDKDataSetSummaryToDomain', () => {
      it('should map SDK DataSetSummary to domain model', () => {
        const sdkDataSet: SDKDataSetSummary = {
          DataSetId: 'ds-123',
          Name: 'Test Dataset',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/ds-123',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
          ImportMode: 'SPICE',
          RowLevelPermissionDataSet: {
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/perm-ds',
            PermissionPolicy: 'GRANT_ACCESS',
            FormatVersion: 'VERSION_1',
          },
          RowLevelPermissionTagConfigurationApplied: true,
          ColumnLevelPermissionRulesApplied: false,
        };

        const result = mapSDKDataSetSummaryToDomain(sdkDataSet);

        expect(result).toEqual({
          dataSetId: 'ds-123',
          name: 'Test Dataset',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/ds-123',
          createdTime: new Date('2023-01-01'),
          lastUpdatedTime: new Date('2023-06-01'),
          importMode: 'SPICE',
          rowLevelPermissionDataSet: {
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/perm-ds',
            PermissionPolicy: 'GRANT_ACCESS',
            FormatVersion: 'VERSION_1',
          },
          rowLevelPermissionTagConfigurationApplied: true,
          columnLevelPermissionRulesApplied: false,
        });
      });

      it('should handle DIRECT_QUERY import mode', () => {
        const sdkDataSet: SDKDataSetSummary = {
          DataSetId: 'ds-123',
          Name: 'Test Dataset',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/ds-123',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
          ImportMode: 'DIRECT_QUERY',
        };

        const result = mapSDKDataSetSummaryToDomain(sdkDataSet);

        expect(result.importMode).toBe('DIRECT_QUERY');
      });
    });

    describe('mapSDKDataSetToDomain', () => {
      it('should map SDK DataSet to domain model with output columns', () => {
        const sdkDataSet: SDKDataSet = {
          DataSetId: 'ds-123',
          Name: 'Test Dataset',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/ds-123',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
          ImportMode: 'SPICE',
          PhysicalTableMap: {
            table1: {
              S3Source: {
                DataSourceArn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/s3-source',
                InputColumns: [],
              },
            },
          },
          LogicalTableMap: {
            logical1: {
              Alias: 'Logical Table 1',
              Source: {
                PhysicalTableId: 'table1',
              },
            },
          },
          OutputColumns: [
            {
              Name: 'column1',
              Type: 'STRING',
              Description: 'First column',
            },
            {
              Name: 'column2',
              Type: 'INTEGER',
            },
          ],
          FieldFolders: {
            folder1: {
              columns: ['column1'],
              description: 'Folder 1',
            },
          },
        };

        const result = mapSDKDataSetToDomain(sdkDataSet);

        expect(result).toEqual({
          dataSetId: 'ds-123',
          name: 'Test Dataset',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/ds-123',
          createdTime: new Date('2023-01-01'),
          lastUpdatedTime: new Date('2023-06-01'),
          importMode: 'SPICE',
          physicalTableMap: sdkDataSet.PhysicalTableMap,
          logicalTableMap: sdkDataSet.LogicalTableMap,
          outputColumns: [
            {
              name: 'column1',
              type: 'STRING',
              description: 'First column',
            },
            {
              name: 'column2',
              type: 'INTEGER',
              description: undefined,
            },
          ],
          fieldFolders: sdkDataSet.FieldFolders,
          consumedSpiceCapacityInBytes: undefined,
          columnGroups: undefined,
          rowLevelPermissionDataSet: undefined,
          rowLevelPermissionTagConfiguration: undefined,
          columnLevelPermissionRules: undefined,
          dataSetUsageConfiguration: undefined,
        });
      });

      it('should throw error when output column is missing required fields', () => {
        const sdkDataSet: SDKDataSet = {
          DataSetId: 'ds-123',
          Name: 'Test Dataset',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/ds-123',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
          OutputColumns: [
            {
              Name: 'column1',
              // Missing Type
            } as any,
          ],
        };

        expect(() => mapSDKDataSetToDomain(sdkDataSet)).toThrow(
          'Missing required fields in OutputColumn'
        );
      });
    });
  });

  describe('Datasource Mappers', () => {
    describe('mapSDKDataSourceSummaryToDomain', () => {
      it('should map SDK DataSourceSummary to domain model', () => {
        const sdkDataSource: SDKDataSourceSummary = {
          DataSourceId: 'source-123',
          Name: 'Test DataSource',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/source-123',
          Type: 'S3',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
        };

        const result = mapSDKDataSourceSummaryToDomain(sdkDataSource);

        expect(result).toEqual({
          dataSourceId: 'source-123',
          name: 'Test DataSource',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/source-123',
          type: 'S3',
          createdTime: new Date('2023-01-01'),
          lastUpdatedTime: new Date('2023-06-01'),
        });
      });
    });

    describe('mapSDKDataSourceToDomain', () => {
      it('should map SDK DataSource to domain model with error info', () => {
        const sdkDataSource: SDKDataSource = {
          DataSourceId: 'source-123',
          Name: 'Test DataSource',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/source-123',
          Type: 'REDSHIFT',
          Status: 'CREATION_FAILED',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
          ErrorInfo: {
            Type: 'CONNECTION_FAILURE' as any,
            Message: 'Unable to connect to database',
          },
          SecretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:db-password',
        };

        const result = mapSDKDataSourceToDomain(sdkDataSource);

        expect(result).toEqual({
          dataSourceId: 'source-123',
          name: 'Test DataSource',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/source-123',
          type: 'REDSHIFT',
          status: 'CREATION_FAILED',
          createdTime: new Date('2023-01-01'),
          lastUpdatedTime: new Date('2023-06-01'),
          errorInfo: {
            type: 'CONNECTION_FAILURE',
            message: 'Unable to connect to database',
          },
          secretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:db-password',
          dataSourceParameters: undefined,
          alternateDataSourceParameters: undefined,
          vpcConnectionProperties: undefined,
          sslProperties: undefined,
        });
      });

      it('should handle missing error info fields with defaults', () => {
        const sdkDataSource: SDKDataSource = {
          DataSourceId: 'source-123',
          Name: 'Test DataSource',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/source-123',
          Type: 'S3',
          Status: 'CREATION_FAILED',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
          ErrorInfo: {
            // Missing Type and Message
          },
        };

        const result = mapSDKDataSourceToDomain(sdkDataSource);

        expect(result.errorInfo).toEqual({
          type: '',
          message: '',
        });
      });
    });
  });

  describe('Folder Mappers', () => {
    describe('mapSDKFolderSummaryToDomain', () => {
      it('should map SDK FolderSummary to domain model', () => {
        const sdkFolder: SDKFolderSummary = {
          FolderId: 'folder-123',
          Name: 'Test Folder',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:folder/folder-123',
          FolderType: 'SHARED',
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
          SharingModel: 'ACCOUNT',
        };

        const result = mapSDKFolderSummaryToDomain(sdkFolder);

        expect(result).toEqual({
          folderId: 'folder-123',
          name: 'Test Folder',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:folder/folder-123',
          folderType: 'SHARED',
          createdTime: new Date('2023-01-01'),
          lastUpdatedTime: new Date('2023-06-01'),
          sharingModel: 'ACCOUNT',
        });
      });
    });

    describe('mapSDKFolderToDomain', () => {
      it('should map SDK Folder to domain model with folder path', () => {
        const sdkFolder: SDKFolder = {
          FolderId: 'folder-123',
          Name: 'Test Folder',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:folder/folder-123',
          FolderType: 'SHARED',
          FolderPath: ['/root', '/parent', '/Test Folder'],
          CreatedTime: new Date('2023-01-01'),
          LastUpdatedTime: new Date('2023-06-01'),
          SharingModel: 'ACCOUNT',
        };

        const result = mapSDKFolderToDomain(sdkFolder);

        expect(result).toEqual({
          folderId: 'folder-123',
          name: 'Test Folder',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:folder/folder-123',
          folderType: 'SHARED',
          folderPath: ['/root', '/parent', '/Test Folder'],
          createdTime: new Date('2023-01-01'),
          lastUpdatedTime: new Date('2023-06-01'),
          sharingModel: 'ACCOUNT',
        });
      });
    });

    describe('mapSDKFolderMemberToDomain', () => {
      it('should map SDK FolderMember to domain model', () => {
        const sdkFolderMember: SDKFolderMember = {
          MemberId: 'dash-123',
          MemberType: 'DASHBOARD',
        };

        const result = mapSDKFolderMemberToDomain(sdkFolderMember);

        expect(result).toEqual({
          memberId: 'dash-123',
          memberType: 'DASHBOARD',
        });
      });

      it('should handle all member types', () => {
        const memberTypes = ['DASHBOARD', 'ANALYSIS', 'DATASET', 'DATASOURCE'] as const;

        memberTypes.forEach((type) => {
          const sdkFolderMember: SDKFolderMember = {
            MemberId: 'member-123',
            MemberType: type,
          };

          const result = mapSDKFolderMemberToDomain(sdkFolderMember);

          expect(result.memberType).toBe(type);
        });
      });
    });
  });

  describe('User/Group Mappers', () => {
    describe('mapSDKUserToDomain', () => {
      it('should map SDK User to domain model', () => {
        const sdkUser: SDKUser = {
          UserName: 'testuser',
          Email: 'test@example.com',
          Role: 'AUTHOR',
          IdentityType: 'IAM',
          Active: true,
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
          PrincipalId: 'principal-123',
          CustomPermissionsName: 'CustomPerms',
        };

        const result = mapSDKUserToDomain(sdkUser);

        expect(result).toEqual({
          userName: 'testuser',
          email: 'test@example.com',
          role: 'AUTHOR',
          identityType: 'IAM',
          active: true,
          arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
          principalId: 'principal-123',
          customPermissionsName: 'CustomPerms',
          createdTime: expect.any(Date),
          lastUpdatedTime: expect.any(Date),
        });
      });

      it('should handle missing optional fields', () => {
        const sdkUser: SDKUser = {
          UserName: 'testuser',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
        };

        const result = mapSDKUserToDomain(sdkUser);

        expect(result).toEqual({
          userName: 'testuser',
          email: undefined,
          role: undefined,
          identityType: undefined,
          active: undefined,
          arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
          principalId: undefined,
          customPermissionsName: undefined,
          createdTime: expect.any(Date),
          lastUpdatedTime: expect.any(Date),
        });
      });
    });

    describe('mapSDKGroupToDomain', () => {
      it('should map SDK Group to domain model', () => {
        const sdkGroup: SDKGroup = {
          GroupName: 'testgroup',
          Description: 'Test Group Description',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/testgroup',
          PrincipalId: 'principal-456',
        };

        const result = mapSDKGroupToDomain(sdkGroup);

        expect(result).toEqual({
          groupName: 'testgroup',
          description: 'Test Group Description',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/testgroup',
          principalId: 'principal-456',
          createdTime: expect.any(Date),
          lastUpdatedTime: expect.any(Date),
        });
      });
    });
  });

  describe('Common Mappers', () => {
    describe('mapSDKResourcePermissionToDomain', () => {
      it('should map SDK ResourcePermission to domain model', () => {
        const sdkPermission: SDKResourcePermission = {
          Principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
          Actions: ['quicksight:UpdateDashboard', 'quicksight:DeleteDashboard'],
        };

        const result = mapSDKResourcePermissionToDomain(sdkPermission);

        expect(result).toEqual({
          principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
          actions: ['quicksight:UpdateDashboard', 'quicksight:DeleteDashboard'],
        });
      });

      it('should throw error when required fields are missing', () => {
        const sdkPermission = {
          Principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
          // Missing Actions
        } as SDKResourcePermission;

        expect(() => mapSDKResourcePermissionToDomain(sdkPermission)).toThrow(
          'Missing required fields in ResourcePermission'
        );
      });
    });

    describe('mapSDKTagToDomain', () => {
      it('should map SDK Tag to domain model', () => {
        const sdkTag: SDKTag = {
          Key: 'Environment',
          Value: 'Production',
        };

        const result = mapSDKTagToDomain(sdkTag);

        expect(result).toEqual({
          key: 'Environment',
          value: 'Production',
        });
      });

      it('should throw error when required fields are missing', () => {
        const sdkTag = {
          Key: 'Environment',
          // Missing Value
        } as SDKTag;

        expect(() => mapSDKTagToDomain(sdkTag)).toThrow('Missing required fields in Tag');
      });
    });
  });

  describe('List Result Mappers', () => {
    describe('mapSDKDashboardListToDomain', () => {
      it('should map list of SDK DashboardSummary items to domain model', () => {
        const sdkItems: SDKDashboardSummary[] = [
          {
            DashboardId: 'dash-1',
            Name: 'Dashboard 1',
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash-1',
            CreatedTime: new Date('2023-01-01'),
            LastUpdatedTime: new Date('2023-06-01'),
          },
          {
            DashboardId: 'dash-2',
            Name: 'Dashboard 2',
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash-2',
            CreatedTime: new Date('2023-02-01'),
            LastUpdatedTime: new Date('2023-07-01'),
          },
        ];

        const result = mapSDKDashboardListToDomain(sdkItems, 'next-token-123');

        expect(result).toEqual({
          items: [
            {
              dashboardId: 'dash-1',
              name: 'Dashboard 1',
              arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash-1',
              createdTime: new Date('2023-01-01'),
              lastUpdatedTime: new Date('2023-06-01'),
              publishedVersionNumber: undefined,
              lastPublishedTime: undefined,
            },
            {
              dashboardId: 'dash-2',
              name: 'Dashboard 2',
              arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash-2',
              createdTime: new Date('2023-02-01'),
              lastUpdatedTime: new Date('2023-07-01'),
              publishedVersionNumber: undefined,
              lastPublishedTime: undefined,
            },
          ],
          nextToken: 'next-token-123',
        });
      });

      it('should handle empty list', () => {
        const result = mapSDKDashboardListToDomain([]);

        expect(result).toEqual({
          items: [],
          nextToken: undefined,
        });
      });
    });

    describe('mapSDKUserListToDomain', () => {
      it('should map list of SDK User items to domain model', () => {
        const sdkItems: SDKUser[] = [
          {
            UserName: 'user1',
            Email: 'user1@example.com',
            Role: 'AUTHOR',
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
          },
          {
            UserName: 'user2',
            Email: 'user2@example.com',
            Role: 'READER',
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user2',
          },
        ];

        const result = mapSDKUserListToDomain(sdkItems, 'next-token-456');

        expect(result).toEqual({
          items: [
            {
              userName: 'user1',
              email: 'user1@example.com',
              role: 'AUTHOR',
              arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
              identityType: undefined,
              active: undefined,
              principalId: undefined,
              customPermissionsName: undefined,
              createdTime: expect.any(Date),
              lastUpdatedTime: expect.any(Date),
            },
            {
              userName: 'user2',
              email: 'user2@example.com',
              role: 'READER',
              arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user2',
              identityType: undefined,
              active: undefined,
              principalId: undefined,
              customPermissionsName: undefined,
              createdTime: expect.any(Date),
              lastUpdatedTime: expect.any(Date),
            },
          ],
          nextToken: 'next-token-456',
        });
      });
    });

    describe('mapSDKGroupListToDomain', () => {
      it('should map list of SDK Group items to domain model', () => {
        const sdkItems: SDKGroup[] = [
          {
            GroupName: 'group1',
            Description: 'Group 1',
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/group1',
          },
          {
            GroupName: 'group2',
            Description: 'Group 2',
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/group2',
          },
        ];

        const result = mapSDKGroupListToDomain(sdkItems);

        expect(result).toEqual({
          items: [
            {
              groupName: 'group1',
              description: 'Group 1',
              arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/group1',
              principalId: undefined,
              createdTime: expect.any(Date),
              lastUpdatedTime: expect.any(Date),
            },
            {
              groupName: 'group2',
              description: 'Group 2',
              arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/group2',
              principalId: undefined,
              createdTime: expect.any(Date),
              lastUpdatedTime: expect.any(Date),
            },
          ],
          nextToken: undefined,
        });
      });
    });
  });
});
