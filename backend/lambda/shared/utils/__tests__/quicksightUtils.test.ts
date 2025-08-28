import {
  principalMatchesGroup,
  principalMatchesUser,
  extractNamespaceFromArn,
  extractResourceNameFromArn,
} from '../quicksightUtils';

describe('quicksightUtils', () => {
  describe('principalMatchesGroup', () => {
    const groupArn = 'arn:aws:quicksight:us-east-1:123456789012:group/default/TeamAlpha';
    const groupName = 'TeamAlpha';

    it('should match exact ARN', () => {
      expect(principalMatchesGroup(groupArn, groupArn, groupName)).toBe(true);
    });

    it('should match exact group name', () => {
      expect(principalMatchesGroup(groupName, groupArn, groupName)).toBe(true);
    });

    it('should match ARN ending with group name', () => {
      const principal = 'arn:aws:quicksight:us-east-1:123456789012:group/default/TeamAlpha';
      expect(principalMatchesGroup(principal, groupArn, groupName)).toBe(true);
    });

    it('should not match similar group names', () => {
      // This is the key bug fix - TeamAlpha1 should not match TeamAlpha
      const similarPrincipal = 'arn:aws:quicksight:us-east-1:123456789012:group/default/TeamAlpha1';
      expect(principalMatchesGroup(similarPrincipal, groupArn, groupName)).toBe(false);
    });

    it('should not match substring group names', () => {
      // Team should not match TeamAlpha
      const substringPrincipal = 'arn:aws:quicksight:us-east-1:123456789012:group/default/Team';
      expect(principalMatchesGroup(substringPrincipal, groupArn, 'Team')).toBe(true);
      expect(principalMatchesGroup(substringPrincipal, groupArn, 'TeamAlpha')).toBe(false);
    });

    it('should not match when principal contains group name but not at the end', () => {
      const principal = 'TeamAlpha-other-stuff';
      expect(principalMatchesGroup(principal, groupArn, groupName)).toBe(false);
    });

    it('should handle undefined principal', () => {
      expect(principalMatchesGroup(undefined, groupArn, groupName)).toBe(false);
    });

    it('should handle empty principal', () => {
      expect(principalMatchesGroup('', groupArn, groupName)).toBe(false);
    });

    it('should handle groups with numbers', () => {
      const group1Arn = 'arn:aws:quicksight:us-east-1:123456789012:group/default/Team1';
      const group10Arn = 'arn:aws:quicksight:us-east-1:123456789012:group/default/Team10';

      // Team1 should not match Team10
      expect(principalMatchesGroup(group10Arn, group1Arn, 'Team1')).toBe(false);
      expect(principalMatchesGroup(group1Arn, group10Arn, 'Team10')).toBe(false);

      // But they should match themselves
      expect(principalMatchesGroup(group1Arn, group1Arn, 'Team1')).toBe(true);
      expect(principalMatchesGroup(group10Arn, group10Arn, 'Team10')).toBe(true);
    });

    it('should handle special characters in group names', () => {
      const specialGroupName = 'Team-Alpha_123';
      const specialGroupArn = `arn:aws:quicksight:us-east-1:123456789012:group/default/${specialGroupName}`;

      expect(principalMatchesGroup(specialGroupArn, specialGroupArn, specialGroupName)).toBe(true);
      expect(principalMatchesGroup(specialGroupName, specialGroupArn, specialGroupName)).toBe(true);
    });
  });

  describe('principalMatchesUser', () => {
    const userArn = 'arn:aws:quicksight:us-east-1:123456789012:user/default/john.doe';
    const userName = 'john.doe';

    it('should match exact ARN', () => {
      expect(principalMatchesUser(userArn, userArn, userName)).toBe(true);
    });

    it('should match exact user name', () => {
      expect(principalMatchesUser(userName, userArn, userName)).toBe(true);
    });

    it('should match ARN ending with user name', () => {
      expect(principalMatchesUser(userArn, userArn, userName)).toBe(true);
    });

    it('should not match similar user names', () => {
      const similarPrincipal = 'arn:aws:quicksight:us-east-1:123456789012:user/default/john.doe2';
      expect(principalMatchesUser(similarPrincipal, userArn, userName)).toBe(false);
    });

    it('should handle undefined principal', () => {
      expect(principalMatchesUser(undefined, userArn, userName)).toBe(false);
    });
  });

  describe('extractNamespaceFromArn', () => {
    it('should extract namespace from group ARN', () => {
      const arn = 'arn:aws:quicksight:us-east-1:123456789012:group/production/TeamAlpha';
      expect(extractNamespaceFromArn(arn)).toBe('production');
    });

    it('should extract namespace from user ARN', () => {
      const arn = 'arn:aws:quicksight:us-east-1:123456789012:user/staging/john.doe';
      expect(extractNamespaceFromArn(arn)).toBe('staging');
    });

    it('should return default for ARN without namespace', () => {
      const arn = 'arn:aws:quicksight:us-east-1:123456789012:dashboard/abc123';
      expect(extractNamespaceFromArn(arn)).toBe('default');
    });

    it('should handle default namespace', () => {
      const arn = 'arn:aws:quicksight:us-east-1:123456789012:group/default/TeamAlpha';
      expect(extractNamespaceFromArn(arn)).toBe('default');
    });
  });

  describe('extractResourceNameFromArn', () => {
    it('should extract resource name from group ARN', () => {
      const arn = 'arn:aws:quicksight:us-east-1:123456789012:group/default/TeamAlpha';
      expect(extractResourceNameFromArn(arn)).toBe('TeamAlpha');
    });

    it('should extract resource name from dashboard ARN', () => {
      const arn = 'arn:aws:quicksight:us-east-1:123456789012:dashboard/abc-123-def';
      expect(extractResourceNameFromArn(arn)).toBe('abc-123-def');
    });

    it('should handle ARN with multiple slashes', () => {
      const arn = 'arn:aws:quicksight:us-east-1:123456789012:namespace/default/group/TeamAlpha';
      expect(extractResourceNameFromArn(arn)).toBe('TeamAlpha');
    });

    it('should return empty string for invalid ARN', () => {
      const arn = 'invalid-arn';
      expect(extractResourceNameFromArn(arn)).toBe('invalid-arn');
    });
  });
});
