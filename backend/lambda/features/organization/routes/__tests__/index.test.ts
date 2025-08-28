import { describe, expect, it, vi } from 'vitest';

import { organizationRoutes } from '../index';

// Mock the handlers
vi.mock('../../handlers/FolderHandler');
vi.mock('../../handlers/GroupHandler');
vi.mock('../../handlers/IdentityHandler');
vi.mock('../../handlers/TagHandler');

describe('organizationRoutes', () => {
  describe('Route definitions', () => {
    it('should have refresh-tags route in organization', () => {
      // Verify that refresh-tags is in organization routes (moved from asset-management)
      const refreshTagsRoute = organizationRoutes.find((route) => route.path === '/tags/refresh');

      expect(refreshTagsRoute).toBeDefined();
      expect(refreshTagsRoute?.method).toBe('POST');
    });

    it('should have tag CRUD routes', () => {
      const tagRoutes = organizationRoutes.filter((route) => {
        if (typeof route.path === 'string') {
          return route.path.includes('tags');
        }
        if (route.path instanceof RegExp) {
          return route.path.source.includes('tags');
        }
        return false;
      });

      expect(tagRoutes.length).toBeGreaterThan(0);

      // Should have GET, PUT, POST, DELETE for individual tags
      const methods = tagRoutes.map((r) => r.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('PUT');
      expect(methods).toContain('POST');
      expect(methods).toContain('DELETE');
    });

    it('should have batch and bulk tag operations', () => {
      const batchRoute = organizationRoutes.find(
        (route) => route.method === 'POST' && route.path === '/tags/batch'
      );
      const bulkRoute = organizationRoutes.find(
        (route) => route.method === 'POST' && route.path === '/tags/bulk'
      );

      expect(batchRoute).toBeDefined();
      expect(bulkRoute).toBeDefined();
    });

    it('should have folder management routes', () => {
      const folderRoutes = organizationRoutes.filter((route) => {
        if (typeof route.path === 'string') {
          return route.path.includes('folders');
        }
        if (route.path instanceof RegExp) {
          return route.path.source.includes('folders');
        }
        return false;
      });

      expect(folderRoutes.length).toBeGreaterThan(0);

      // Check for specific folder operations
      const hasMembersRoute = folderRoutes.some(
        (r) => r.path instanceof RegExp && r.path.source.includes('members')
      );
      const hasBulkRoute = folderRoutes.some(
        (r) => r.path instanceof RegExp && r.path.source.includes('bulk')
      );

      expect(hasMembersRoute).toBe(true);
      expect(hasBulkRoute).toBe(true);
    });

    it('should have group management routes', () => {
      const groupRoutes = organizationRoutes.filter((route) => {
        if (typeof route.path === 'string') {
          return route.path.includes('groups');
        }
        if (route.path instanceof RegExp) {
          return route.path.source.includes('groups');
        }
        return false;
      });

      expect(groupRoutes.length).toBeGreaterThan(0);

      // Check for CRUD operations
      const methods = groupRoutes.map((r) => r.method);
      expect(methods).toContain('POST'); // Create
      expect(methods).toContain('PUT'); // Update
      expect(methods).toContain('DELETE'); // Delete
      expect(methods).toContain('GET'); // Get assets
    });
  });
});

describe('organizationRoutes - patterns', () => {
  describe('Tag routes patterns', () => {
    it('should match tag routes for all supported asset types', () => {
      const tagGetRoute = organizationRoutes.find(
        (r) => r.method === 'GET' && r.path instanceof RegExp && r.path.source.includes('tags')
      );

      expect(tagGetRoute).toBeDefined();

      const supportedAssetTypes = [
        '/tags/dashboard/123',
        '/tags/analysis/456',
        '/tags/dataset/789',
        '/tags/datasource/abc',
        '/tags/folder/def',
        '/tags/user/ghi',
        '/tags/group/jkl',
      ];

      supportedAssetTypes.forEach((path) => {
        const matches = tagGetRoute?.path instanceof RegExp && tagGetRoute.path.test(path);
        expect(matches).toBe(true);
      });
    });

    it('should NOT match tag routes for unsupported asset types', () => {
      const tagGetRoute = organizationRoutes.find(
        (r) => r.method === 'GET' && r.path instanceof RegExp && r.path.source.includes('tags')
      );

      // QuickSight supports tags on users and groups, so we only test invalid paths
      const unsupportedPaths = [
        '/tags/users/456', // plural form not supported (should be singular)
        '/tags/groups/abc', // plural form not supported (should be singular)
        '/tags/invalid/123', // invalid asset type
        '/tags/template/456', // templates not supported yet
      ];

      unsupportedPaths.forEach((path) => {
        const matches = tagGetRoute?.path instanceof RegExp && tagGetRoute.path.test(path);
        expect(matches).toBe(false);
      });
    });
  });

  describe('Folder routes patterns', () => {
    it('should match folder member operations', () => {
      const addMemberRoute = organizationRoutes.find(
        (r) =>
          r.method === 'POST' &&
          r.path instanceof RegExp &&
          r.path.source.includes('folders') &&
          r.path.source.includes('members')
      );
      const removeMemberRoute = organizationRoutes.find(
        (r) =>
          r.method === 'DELETE' &&
          r.path instanceof RegExp &&
          r.path.source.includes('folders') &&
          r.path.source.includes('members')
      );

      expect(addMemberRoute).toBeDefined();
      expect(removeMemberRoute).toBeDefined();

      // Test path matching
      const addPath = '/folders/folder-123/members';
      const removePath = '/folders/folder-123/members/asset-456';

      expect(addMemberRoute?.path instanceof RegExp && addMemberRoute.path.test(addPath)).toBe(
        true
      );
      expect(
        removeMemberRoute?.path instanceof RegExp && removeMemberRoute.path.test(removePath)
      ).toBe(true);
    });

    it('should match bulk folder operations', () => {
      const bulkAddRoute = organizationRoutes.find(
        (r) =>
          r.method === 'POST' &&
          r.path instanceof RegExp &&
          r.path.source.includes('assets') &&
          r.path.source.includes('bulk')
      );
      const bulkRemoveRoute = organizationRoutes.find(
        (r) =>
          r.method === 'DELETE' &&
          r.path instanceof RegExp &&
          r.path.source.includes('assets') &&
          r.path.source.includes('bulk')
      );

      expect(bulkAddRoute).toBeDefined();
      expect(bulkRemoveRoute).toBeDefined();

      const testPath = '/folders/folder-123/assets/bulk';

      expect(bulkAddRoute?.path instanceof RegExp && bulkAddRoute.path.test(testPath)).toBe(true);
      expect(bulkRemoveRoute?.path instanceof RegExp && bulkRemoveRoute.path.test(testPath)).toBe(
        true
      );
    });
  });
});

describe('organizationRoutes - organization', () => {
  describe('Route organization', () => {
    it('should have all routes properly grouped by feature', () => {
      // Count routes by feature area
      const folderRoutes = organizationRoutes.filter((r) => {
        const pathStr = r.path instanceof RegExp ? r.path.source : r.path;
        return pathStr.includes('folder');
      });

      const groupRoutes = organizationRoutes.filter((r) => {
        const pathStr = r.path instanceof RegExp ? r.path.source : r.path;
        // Exclude folder routes that contain 'group' in regex
        return pathStr.includes('group') && !pathStr.includes('folder');
      });

      const tagRoutes = organizationRoutes.filter((r) => {
        const pathStr = r.path instanceof RegExp ? r.path.source : r.path;
        return pathStr.includes('tag');
      });

      // Verify we have routes for each feature area
      expect(folderRoutes.length).toBeGreaterThan(0);
      expect(groupRoutes.length).toBeGreaterThan(0);
      expect(tagRoutes.length).toBeGreaterThan(0);

      // We have 19 total routes:
      // - 6 folder routes
      // - 6 group/identity routes
      // - 7 tag routes
      const TOTAL_ROUTES = 19;
      expect(organizationRoutes.length).toBe(TOTAL_ROUTES);
    });

    it('should not duplicate routes from asset-management', () => {
      // These routes should NOT be in organization routes
      const assetManagementRoutes = [
        '/assets/refresh-tags',
        '/assets/refresh-views',
        '/assets/bulk-delete',
        '/assets/rebuild-index',
      ];

      for (const path of assetManagementRoutes) {
        const route = organizationRoutes.find((r) => r.path === path);
        expect(route).toBeUndefined();
      }
    });
  });

  describe('Route HTTP methods', () => {
    it('should use appropriate HTTP methods for operations', () => {
      // GET for reading
      const getRoutes = organizationRoutes.filter((r) => r.method === 'GET');
      expect(getRoutes.length).toBeGreaterThan(0);
      getRoutes.forEach((route) => {
        const pathStr = route.path instanceof RegExp ? route.path.source : route.path;
        // GET should be for fetching data - folders, members, assets, or tags
        expect(pathStr).toMatch(/(folders|members|assets|tags|groups)/i);
      });

      // POST for creating
      const postRoutes = organizationRoutes.filter((r) => r.method === 'POST');
      expect(postRoutes.length).toBeGreaterThan(0);
      postRoutes.forEach((route) => {
        const pathStr = route.path instanceof RegExp ? route.path.source : route.path;
        // POST should be for creating or batch operations
        expect(pathStr).toMatch(/(batch|bulk|members|tags|groups|folders|assets)/i);
      });

      // DELETE for removing
      const deleteRoutes = organizationRoutes.filter((r) => r.method === 'DELETE');
      expect(deleteRoutes.length).toBeGreaterThan(0);
      deleteRoutes.forEach((route) => {
        const pathStr = route.path instanceof RegExp ? route.path.source : route.path;
        // DELETE should be for removing
        expect(pathStr).toMatch(/(members|tags|groups|folders|assets)/i);
      });
    });
  });
});
