import { type AssetExportData } from '../../../../models/asset-export.model';
import { ASSET_TYPES } from '../../../../types/assetTypes';
import { UserParser } from '../UserParser';

describe('UserParser', () => {
  let parser: UserParser;

  beforeEach(() => {
    parser = new UserParser();
  });

  describe('constructor', () => {
    it('should initialize with correct asset type', () => {
      expect(parser.assetType).toBe(ASSET_TYPES.user);
    });

    it('should initialize with correct capabilities', () => {
      expect(parser.capabilities).toEqual({
        hasDataSets: false,
        hasCalculatedFields: false,
        hasParameters: false,
        hasFilters: false,
        hasSheets: false,
        hasVisuals: false,
        hasFields: false,
        hasDatasourceInfo: false,
      });
    });
  });

  describe('extractDefinition', () => {
    it('should return user definition as-is', () => {
      const userDefinition = { test: 'data' };
      const result = parser['extractDefinition'](userDefinition);
      expect(result).toBe(userDefinition);
    });

    it('should handle null definition', () => {
      const result = parser['extractDefinition'](null);
      expect(result).toBeNull();
    });

    it('should handle undefined definition', () => {
      const result = parser['extractDefinition'](undefined);
      expect(result).toBeUndefined();
    });
  });

  describe('extractMetadata', () => {
    it('should extract metadata from complete asset data', () => {
      const assetData: AssetExportData = {
        apiResponses: {
          list: {
            timestamp: '2025-01-15T10:00:00Z',
            data: {
              UserName: 'testuser',
              Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
              Email: 'test@example.com',
              Role: 'AUTHOR',
              Active: true,
              PrincipalId: 'principal-123',
            },
          },
          describe: {
            timestamp: '2025-01-15T10:00:00Z',
            data: {
              User: {
                UserName: 'testuser',
                Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
              },
            },
          },
          groups: {
            timestamp: '2025-01-15T10:00:00Z',
            data: [{ GroupName: 'Admins' }, { GroupName: 'Developers' }],
          },
        },
      };

      const result = parser.extractMetadata(assetData);

      expect(result).toEqual({
        assetId: 'testuser',
        name: 'testuser',
        arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
        email: 'test@example.com',
        role: 'AUTHOR',
        active: true,
        principalId: 'principal-123',
      });
    });

    it('should handle empty apiResponses', () => {
      const assetData: AssetExportData = {
        apiResponses: {},
      };

      const result = parser.extractMetadata(assetData);

      expect(result).toEqual({
        assetId: undefined,
        name: undefined,
        arn: undefined,
        email: undefined,
        role: undefined,
        active: true,
        principalId: undefined,
      });
    });

    it('should handle null apiResponses', () => {
      const assetData: AssetExportData = {
        apiResponses: null as any,
      };

      const result = parser.extractMetadata(assetData);

      expect(result).toEqual({
        assetId: undefined,
        name: undefined,
        arn: undefined,
        email: undefined,
        role: undefined,
        active: true,
        principalId: undefined,
      });
    });
  });
});

// Test data shared across multiple describe blocks
const completeListData = {
  UserName: 'testuser',
  Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
  Email: 'test@example.com',
  Role: 'AUTHOR',
  Active: true,
  PrincipalId: 'principal-123',
};

const completeDescribeData = {
  User: {
    UserName: 'testuser-describe',
    Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser-describe',
    Email: 'describe@example.com',
    Role: 'ADMIN',
    Active: false,
    PrincipalId: 'principal-456',
  },
};

describe('UserParser.extractUserMetadata-basic', () => {
  let parser: UserParser;

  beforeEach(() => {
    parser = new UserParser();
  });

  describe('extractUserMetadata - basic functionality', () => {
    it('should extract metadata from list data', () => {
      const result = parser.extractUserMetadata(completeListData, null);

      expect(result).toEqual({
        assetId: 'testuser',
        name: 'testuser',
        arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser',
        email: 'test@example.com',
        role: 'AUTHOR',
        active: true,
        principalId: 'principal-123',
      });
    });

    it('should prefer list data over describe data', () => {
      const result = parser.extractUserMetadata(completeListData, completeDescribeData);

      expect(result.assetId).toBe('testuser');
      expect(result.email).toBe('test@example.com');
      expect(result.role).toBe('AUTHOR');
    });

    it('should fall back to describe data when list data is missing fields', () => {
      const partialListData = {
        UserName: 'testuser',
      };

      const result = parser.extractUserMetadata(partialListData, completeDescribeData);

      expect(result).toEqual({
        assetId: 'testuser',
        name: 'testuser',
        arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser-describe',
        email: 'describe@example.com',
        role: 'ADMIN',
        active: false,
        principalId: 'principal-456',
      });
    });
  });
});

describe('UserParser.extractUserMetadata-special-cases', () => {
  let parser: UserParser;

  beforeEach(() => {
    parser = new UserParser();
  });

  describe('extractUserMetadata - special cases', () => {
    it('should handle SSO user format', () => {
      const ssoListData = {
        UserName: 'AWSReservedSSO_Admin_1234567890abcdef/testuser',
        Arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/AWSReservedSSO_Admin/testuser',
        Email: 'sso@example.com',
        Role: 'ADMIN',
        Active: true,
        PrincipalId: 'AWSReservedSSO_Admin_1234567890abcdef',
      };

      const result = parser.extractUserMetadata(ssoListData, null);

      expect(result.assetId).toBe('AWSReservedSSO_Admin_1234567890abcdef/testuser');
      expect(result.principalId).toBe('AWSReservedSSO_Admin_1234567890abcdef');
    });

    it('should handle inactive users', () => {
      const inactiveUserData = {
        UserName: 'inactiveuser',
        Active: false,
      };

      const result = parser.extractUserMetadata(inactiveUserData, null);

      expect(result.active).toBe(false);
    });

    it('should default active to true when not specified', () => {
      const noActiveFieldData = {
        UserName: 'user',
      };

      const result = parser.extractUserMetadata(noActiveFieldData, null);

      expect(result.active).toBe(true);
    });

    it('should handle null and undefined data gracefully', () => {
      const result = parser.extractUserMetadata(null, undefined);

      expect(result).toEqual({
        assetId: undefined,
        name: undefined,
        arn: undefined,
        email: undefined,
        role: undefined,
        active: true,
        principalId: undefined,
      });
    });

    it('should extract user from describe data when list data is null', () => {
      const result = parser.extractUserMetadata(null, completeDescribeData);

      expect(result).toEqual({
        assetId: 'testuser-describe',
        name: 'testuser-describe',
        arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/testuser-describe',
        email: 'describe@example.com',
        role: 'ADMIN',
        active: false,
        principalId: 'principal-456',
      });
    });

    it('should handle describe data without User wrapper', () => {
      const flatDescribeData = {
        UserName: 'flatuser',
        Email: 'flat@example.com',
      };

      const result = parser.extractUserMetadata(null, flatDescribeData);

      expect(result.assetId).toBeUndefined();
      expect(result.email).toBeUndefined();
    });
  });
});

describe('UserParser.extractUserMetadata-groups', () => {
  let parser: UserParser;

  beforeEach(() => {
    parser = new UserParser();
  });

  describe('extractUserMetadata - group handling', () => {
    it('should handle READER_PRO role', () => {
      const readerProData = {
        UserName: 'reader',
        Role: 'READER_PRO',
      };

      const result = parser.extractUserMetadata(readerProData, null);

      expect(result.role).toBe('READER_PRO');
    });

    it('should handle all QuickSight roles', () => {
      const roles = [
        'ADMIN',
        'AUTHOR',
        'READER',
        'READER_PRO',
        'RESTRICTED_AUTHOR',
        'RESTRICTED_READER',
      ];

      roles.forEach((role) => {
        const userData = {
          UserName: `user-${role.toLowerCase()}`,
          Role: role,
        };

        const result = parser.extractUserMetadata(userData, null);
        expect(result.role).toBe(role);
      });
    });
  });
});

describe('UserParser.edge-cases', () => {
  let parser: UserParser;

  beforeEach(() => {
    parser = new UserParser();
  });

  describe('edge cases', () => {
    it('should handle deeply nested or malformed data', () => {
      const malformedData = {
        nested: {
          UserName: 'shouldnotwork',
        },
      };

      const result = parser.extractUserMetadata(malformedData, null);

      expect(result.assetId).toBeUndefined();
    });

    it('should handle very long user names', () => {
      const NAME_LENGTH = 1000;
      const longName = 'a'.repeat(NAME_LENGTH);
      const userData = {
        UserName: longName,
      };

      const result = parser.extractUserMetadata(userData, null);

      expect(result.assetId).toBe(longName);
      expect(result.name).toBe(longName);
    });

    it('should handle special characters in user names', () => {
      const specialCharsData = {
        UserName: 'user@example.com',
        Email: 'user@example.com',
      };

      const result = parser.extractUserMetadata(specialCharsData, null);

      expect(result.assetId).toBe('user@example.com');
      expect(result.email).toBe('user@example.com');
    });

    it('should handle numeric values in unexpected fields', () => {
      const NUMERIC_ID = 12345;
      const numericData = {
        UserName: NUMERIC_ID, // Number instead of string
        Active: 1, // Number instead of boolean
      } as any;

      const result = parser.extractUserMetadata(numericData, null);

      expect(result.assetId).toBe(NUMERIC_ID);
      expect(result.active).toBe(1); // Will be truthy
    });
  });
});
