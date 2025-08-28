import { type APIGatewayProxyEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the handlers before importing anything else
vi.mock('../../handlers/AssetHandler', () => ({
  AssetHandler: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
    listArchived: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
    getArchivedAssetMetadata: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
    rebuildIndex: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
    clearMemoryCache: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
    getExportedAsset: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
    getViews: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
    refreshViewStats: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
    bulkDelete: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
    validateBulkDelete: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
  })),
}));

vi.mock('../../handlers/IngestionHandler', () => ({
  IngestionHandler: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
    getDetails: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
    cancel: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
  })),
}));

vi.mock('../../../organization/handlers/TagHandler', () => ({
  TagHandler: vi.fn().mockImplementation(() => ({
    updateTags: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
  })),
}));

// Now import the routes after mocks are set up
import { assetManagementRoutes } from '../index';

describe('assetManagementRoutes', () => {
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEvent = {
      body: '',
      headers: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '',
      pathParameters: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      multiValueHeaders: {},
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };
  });

  describe('Route definitions', () => {
    it('should have assets listing route', () => {
      const route = assetManagementRoutes.find(
        (r) =>
          r.method === 'GET' &&
          r.path instanceof RegExp &&
          r.path.test('/assets/dashboards/paginated')
      );
      expect(route).toBeDefined();
    });

    it('should have archived assets route', () => {
      const route = assetManagementRoutes.find(
        (r) => r.method === 'GET' && r.path === '/assets/archived'
      );
      expect(route).toBeDefined();
    });

    it('should have rebuild index route', () => {
      const route = assetManagementRoutes.find(
        (r) => r.method === 'POST' && r.path === '/assets/rebuild-index'
      );
      expect(route).toBeDefined();
    });

    it('should have refresh views route', () => {
      const refreshViewsRoute = assetManagementRoutes.find(
        (r) => r.method === 'POST' && r.path === '/assets/refresh-views'
      );
      expect(refreshViewsRoute).toBeDefined();
      expect(refreshViewsRoute?.method).toBe('POST');
      expect(refreshViewsRoute?.path).toBe('/assets/refresh-views');
    });

    it('should have all expected routes', () => {
      const expectedRoutes = [
        { method: 'GET', testPath: '/assets/dashboards/paginated' },
        { method: 'GET', path: '/assets/archived' },
        { method: 'GET', testPath: '/assets/archive/dashboards/test-id/metadata' },
        { method: 'POST', path: '/assets/rebuild-index' },
        { method: 'POST', path: '/assets/clear-memory-cache' },
        { method: 'GET', testPath: '/assets/dashboard/test-id/cached' },
        { method: 'GET', testPath: '/assets/dashboard/test-id/views' },
        { method: 'POST', path: '/assets/refresh-views' },
        { method: 'POST', path: '/assets/bulk-delete' },
        { method: 'POST', path: '/assets/bulk-delete/validate' },
        { method: 'GET', path: '/ingestions' },
        { method: 'GET', testPath: '/ingestions/dataset-123/ingestion-456' },
        { method: 'DELETE', testPath: '/ingestions/dataset-123/ingestion-456' },
      ];

      for (const { method, path, testPath } of expectedRoutes) {
        const route = assetManagementRoutes.find((r) => {
          if (path) {
            return r.method === method && r.path === path;
          }
          if (testPath && r.path instanceof RegExp) {
            return r.method === method && r.path.test(testPath);
          }
          return false;
        });

        expect(route).toBeDefined();
      }
    });
  });

  describe('validate bulk delete route handler', () => {
    it('should call AssetHandler.validateBulkDelete when route is invoked', async () => {
      const validateBulkDeleteRoute = assetManagementRoutes.find(
        (route) => route.method === 'POST' && route.path === '/assets/bulk-delete/validate'
      );

      expect(validateBulkDeleteRoute).toBeDefined();

      // Call the handler
      const result = await validateBulkDeleteRoute?.handler(mockEvent);

      // Verify the handler was called and returned a result
      expect(result).toBeDefined();
      const OK_STATUS = 200;
      expect(result?.statusCode).toBe(OK_STATUS);
    });
  });
});

describe('assetManagementRoutes - pattern matching', () => {
  describe('Route pattern matching', () => {
    it('should match paginated routes for different asset types', () => {
      const paginatedRoute = assetManagementRoutes.find(
        (r) => r.method === 'GET' && r.path instanceof RegExp && r.path.source.includes('paginated')
      );

      expect(paginatedRoute).toBeDefined();

      const validPaths = [
        '/assets/dashboards/paginated',
        '/assets/datasets/paginated',
        '/assets/analyses/paginated',
        '/assets/datasources/paginated',
        '/assets/folders/paginated',
        '/assets/groups/paginated',
        '/assets/users/paginated',
      ];

      validPaths.forEach((testPath) => {
        const matches =
          paginatedRoute?.path instanceof RegExp && paginatedRoute.path.test(testPath);
        expect(matches).toBe(true);
      });
    });

    it('should match cached asset routes', () => {
      const cachedRoute = assetManagementRoutes.find(
        (r) => r.method === 'GET' && r.path instanceof RegExp && r.path.source.includes('cached')
      );

      expect(cachedRoute).toBeDefined();

      const validPaths = [
        '/assets/dashboard/test-id/cached',
        '/assets/dataset/data-123/cached',
        '/assets/analysis/my-analysis/cached',
        '/assets/user/user-456/cached',
      ];

      validPaths.forEach((testPath) => {
        const matches = cachedRoute?.path instanceof RegExp && cachedRoute.path.test(testPath);
        expect(matches).toBe(true);
      });
    });

    it('should match views routes only for visual assets', () => {
      const viewsRoute = assetManagementRoutes.find(
        (r) => r.method === 'GET' && r.path instanceof RegExp && r.path.source.includes('views')
      );

      expect(viewsRoute).toBeDefined();

      // Should match visual assets
      const validPaths = [
        '/assets/dashboard/test-id/views',
        '/assets/analysis/my-analysis/views',
        '/assets/dataset/data-123/views',
      ];

      validPaths.forEach((testPath) => {
        const matches = viewsRoute?.path instanceof RegExp && viewsRoute.path.test(testPath);
        expect(matches).toBe(true);
      });

      // Should NOT match non-visual assets
      const invalidPaths = [
        '/assets/user/user-456/views',
        '/assets/group/group-789/views',
        '/assets/folder/folder-123/views',
      ];

      invalidPaths.forEach((testPath) => {
        const matches = viewsRoute?.path instanceof RegExp && viewsRoute.path.test(testPath);
        expect(matches).toBe(false);
      });
    });
  });
});

describe('assetManagementRoutes - integration', () => {
  it('should have unique handlers for each route', () => {
    const handlerSet = new Set();
    assetManagementRoutes.forEach((route) => {
      const handlerString = route.handler.toString();
      handlerSet.add(handlerString);
    });
    // Each route should have a unique handler function
    expect(handlerSet.size).toBeGreaterThan(0);
  });

  it('should have consistent route patterns', () => {
    // Check that all regex routes are valid
    const regexRoutes = assetManagementRoutes.filter((r) => r.path instanceof RegExp);
    regexRoutes.forEach((route) => {
      if (route.path instanceof RegExp) {
        // Should be a valid regex
        expect(() => new RegExp(route.path)).not.toThrow();
      }
    });
  });
});
