import { type APIGatewayProxyEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STATUS_CODES } from '../../../../shared/constants';
import { DataCatalogHandler } from '../DataCatalogHandler';

// Test constants
const EXPECTED_TOTAL_FIELDS = 100;
const EXPECTED_TOTAL_SOURCES = 10;
const EXPECTED_STRING_FIELDS = 50;
const EXPECTED_INTEGER_FIELDS = 30;
const EXPECTED_DECIMAL_FIELDS = 20;
const EXPECTED_DATASETS = 5;
const EXPECTED_DATA_SOURCES = 3;
const EXPECTED_TOTAL_PAGES = 10;
const DEFAULT_PAGE_SIZE = 10;

vi.mock('../../../../shared/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'test-user', email: 'test@example.com' }),
}));

vi.mock('../../services/CatalogService', () => ({
  CatalogService: vi.fn().mockImplementation(() => ({
    getDataCatalog: vi.fn().mockResolvedValue({
      fields: [
        { fieldName: 'field1', sourceType: 'dataset', sourceId: 'ds-1', dataType: 'STRING' },
        { fieldName: 'field2', sourceType: 'dataset', sourceId: 'ds-2', dataType: 'INTEGER' },
      ],
      fieldsBySource: new Map(),
      summary: { totalFields: 2, totalSources: 2 },
    }),
    getCatalogSummary: vi.fn().mockResolvedValue({
      totalFields: EXPECTED_TOTAL_FIELDS,
      totalSources: EXPECTED_TOTAL_SOURCES,
      fieldsByType: {
        STRING: EXPECTED_STRING_FIELDS,
        INTEGER: EXPECTED_INTEGER_FIELDS,
        DECIMAL: EXPECTED_DECIMAL_FIELDS,
      },
    }),
    getCatalogStats: vi.fn().mockResolvedValue({
      totalFields: EXPECTED_TOTAL_FIELDS,
      totalDatasets: EXPECTED_DATASETS,
      totalDataSources: EXPECTED_DATA_SOURCES,
      lastUpdated: '2024-01-01T00:00:00Z',
    }),
    getAvailableTags: vi.fn().mockResolvedValue(['finance', 'sales', 'marketing']),
    getFieldsPaginated: vi.fn().mockResolvedValue({
      fields: [
        { fieldName: 'field1', dataType: 'STRING' },
        { fieldName: 'field2', dataType: 'INTEGER' },
      ],
      pagination: {
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        totalItems: EXPECTED_TOTAL_FIELDS,
        totalPages: EXPECTED_TOTAL_PAGES,
        hasMore: false,
      },
    }),
    buildVisualFieldCatalog: vi.fn().mockResolvedValue({
      visualFields: [],
      summary: {
        totalVisualFields: 0,
        totalVisuals: 0,
        totalSheets: 0,
        totalDashboards: 0,
        lastUpdated: new Date(),
        processingTimeMs: 10,
      },
    }),
  })),
}));

vi.mock('../../services/FieldMetadataService', () => ({
  FieldMetadataService: vi.fn().mockImplementation(() => {
    let currentTags = ['tag1', 'tag2'];
    return {
      getFieldMetadata: vi.fn().mockImplementation(() =>
        Promise.resolve({
          fieldName: 'testField',
          description: 'Test field description',
          tags: currentTags,
          lastUpdated: '2024-01-01T00:00:00Z',
        })
      ),
      updateFieldMetadata: vi.fn().mockResolvedValue({
        fieldName: 'testField',
        description: 'Updated description',
        businessName: 'Business Field Name',
      }),
      addFieldTags: vi.fn().mockImplementation((...args) => {
        const tags = args[3];
        currentTags = [...new Set([...currentTags, ...tags])];
        return Promise.resolve(undefined);
      }),
      removeFieldTags: vi.fn().mockImplementation((...args) => {
        const tags = args[3];
        currentTags = currentTags.filter((t) => !tags.includes(t));
        return Promise.resolve(undefined);
      }),
      searchFieldsByTags: vi.fn().mockResolvedValue([]),
    };
  }),
}));

vi.mock('../../../../shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../shared/services/cache/CacheService', () => ({
  cacheService: {
    rebuildCache: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../../shared/services/aws/ClientFactory', () => ({
  ClientFactory: {
    getS3Service: vi.fn().mockReturnValue({
      deleteObject: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

describe('DataCatalogHandler - Core Methods', () => {
  let handler: DataCatalogHandler;
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new DataCatalogHandler();
    mockEvent = {
      body: '',
      headers: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/catalog',
      pathParameters: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      multiValueHeaders: {},
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };
  });

  describe('getCatalogSummary', () => {
    it('should get catalog summary successfully', async () => {
      const result = await handler.getCatalogSummary(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.totalFields).toBe(EXPECTED_TOTAL_FIELDS);
      expect(body.data.totalSources).toBe(EXPECTED_TOTAL_SOURCES);
      expect(body.data.fieldsByType.STRING).toBe(EXPECTED_STRING_FIELDS);
    });

    it('should handle errors when getting catalog summary', async () => {
      const { CatalogService } = await import('../../services/CatalogService');
      (CatalogService as any).mockImplementationOnce(() => ({
        getCatalogSummary: vi.fn().mockRejectedValue(new Error('Database error')),
      }));

      const errorHandler = new DataCatalogHandler();
      const result = await errorHandler.getCatalogSummary(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.INTERNAL_SERVER_ERROR);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to get catalog summary');
    });
  });

  describe('getCatalogStats', () => {
    it('should get catalog stats successfully', async () => {
      const result = await handler.getCatalogStats(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.totalFields).toBe(EXPECTED_TOTAL_FIELDS);
      expect(body.data.totalDatasets).toBe(EXPECTED_DATASETS);
      expect(body.data.totalDataSources).toBe(EXPECTED_DATA_SOURCES);
    });
  });

  describe('getAvailableTags', () => {
    it('should get available tags successfully', async () => {
      const result = await handler.getAvailableTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(['finance', 'sales', 'marketing']);
    });
  });
});

describe('DataCatalogHandler - Field Operations', () => {
  let handler: DataCatalogHandler;
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new DataCatalogHandler();
    mockEvent = {
      body: '',
      headers: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/catalog',
      pathParameters: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      multiValueHeaders: {},
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };
  });

  describe('getFieldMetadata', () => {
    it('should get field metadata successfully', async () => {
      mockEvent.pathParameters = {
        sourceType: 'dataset',
        sourceId: 'ds-123',
        fieldName: 'testField',
      };

      const result = await handler.getFieldMetadata(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.fieldName).toBe('testField');
      expect(body.data.description).toBe('Test field description');
      expect(body.data.tags).toEqual(['tag1', 'tag2']);
    });

    it('should return error when required parameters are missing', async () => {
      mockEvent.pathParameters = { sourceType: 'dataset' };

      const result = await handler.getFieldMetadata(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Missing required parameters');
    });

    it('should handle field names with special characters', async () => {
      mockEvent.pathParameters = {
        sourceType: 'dataset',
        sourceId: 'ds-123',
        fieldName: 'field%20with%20spaces',
      };

      const result = await handler.getFieldMetadata(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
    });
  });

  describe('updateFieldMetadata', () => {
    it('should update field metadata successfully', async () => {
      mockEvent.httpMethod = 'PUT';
      mockEvent.pathParameters = {
        sourceType: 'dataset',
        sourceId: 'ds-123',
        fieldName: 'testField',
      };
      mockEvent.body = JSON.stringify({
        description: 'Updated description',
        businessName: 'Business Field Name',
      });

      const result = await handler.updateFieldMetadata(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.description).toBe('Updated description');
      expect(body.data.businessName).toBe('Business Field Name');
    });

    it('should return error when required parameters are missing', async () => {
      mockEvent.httpMethod = 'PUT';
      mockEvent.pathParameters = {};
      mockEvent.body = JSON.stringify({ description: 'Test' });

      const result = await handler.updateFieldMetadata(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Missing required parameters');
    });
  });

  describe('addFieldTags', () => {
    it('should add field tags successfully', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.pathParameters = {
        sourceType: 'dataset',
        sourceId: 'ds-123',
        fieldName: 'testField',
      };
      mockEvent.body = JSON.stringify({
        tags: ['newTag'],
      });

      const result = await handler.addFieldTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(['tag1', 'tag2', 'newTag']);
    });

    it('should return error when tags is not an array', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.pathParameters = {
        sourceType: 'dataset',
        sourceId: 'ds-123',
        fieldName: 'testField',
      };
      mockEvent.body = JSON.stringify({ tags: 'not-an-array' });

      const result = await handler.addFieldTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Missing required parameters or tags must be an array');
    });
  });

  describe('removeFieldTags', () => {
    it('should remove field tags successfully', async () => {
      mockEvent.httpMethod = 'DELETE';
      mockEvent.pathParameters = {
        sourceType: 'dataset',
        sourceId: 'ds-123',
        fieldName: 'testField',
      };
      mockEvent.body = JSON.stringify({
        tags: ['tag2'],
      });

      const result = await handler.removeFieldTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(['tag1']);
    });
  });
});

describe('DataCatalogHandler - Pagination', () => {
  let handler: DataCatalogHandler;
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new DataCatalogHandler();
    mockEvent = {
      body: '',
      headers: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/catalog',
      pathParameters: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      multiValueHeaders: {},
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };
  });

  describe('getFieldsPaginated', () => {
    it('should get paginated fields successfully', async () => {
      mockEvent.queryStringParameters = {
        page: '1',
        pageSize: '10',
        sourceType: 'dataset',
        dataType: 'STRING',
      };

      const result = await handler.getFieldsPaginated(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.fields).toHaveLength(2);
      expect(body.data.pagination.page).toBe(1);
      expect(body.data.pagination.totalPages).toBe(EXPECTED_TOTAL_PAGES);
    });

    it('should use default pagination when parameters not provided', async () => {
      const result = await handler.getFieldsPaginated(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.fields).toHaveLength(2);
    });
  });

  describe('getDataCatalogPaginated', () => {
    it('should get paginated data catalog successfully', async () => {
      mockEvent.queryStringParameters = {
        page: '1',
        pageSize: '10',
        viewMode: 'all',
      };

      const result = await handler.getDataCatalogPaginated(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.summary).toBeDefined();
      expect(body.data.summary.totalFields).toBe(2);
    });

    it('should handle empty catalog gracefully', async () => {
      const { CatalogService } = await import('../../services/CatalogService');
      (CatalogService as any).mockImplementationOnce(() => ({
        getDataCatalog: vi.fn().mockResolvedValue(null),
      }));

      const emptyHandler = new DataCatalogHandler();
      mockEvent.queryStringParameters = {
        page: '1',
        pageSize: '10',
      };

      const result = await emptyHandler.getDataCatalogPaginated(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.items).toEqual([]);
      expect(body.data.pagination.totalItems).toBe(0);
    });
  });

  describe('searchFieldsByTags', () => {
    it('should search fields by tags successfully', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        tags: ['finance', 'sales'],
        matchAll: true,
      });

      const result = await handler.searchFieldsByTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it('should return error when tags array is missing', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({ matchAll: true });

      const result = await handler.searchFieldsByTags(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Tags array is required');
    });
  });
});

describe('DataCatalogHandler - Semantic and Visual', () => {
  let handler: DataCatalogHandler;
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new DataCatalogHandler();
    mockEvent = {
      body: '',
      headers: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/catalog',
      pathParameters: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      multiValueHeaders: {},
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };
  });

  describe('getSemanticMappings', () => {
    it('should get semantic mappings successfully', async () => {
      mockEvent.queryStringParameters = {
        fieldId: 'field-123',
        status: 'mapped',
        type: 'automatic',
      };

      const result = await handler.getSemanticMappings(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('getSemanticStats', () => {
    it('should get semantic stats successfully', async () => {
      const result = await handler.getSemanticStats(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.totalFields).toBeDefined();
      expect(body.mappedFields).toBeDefined();
      expect(body.unmappedFields).toBeDefined();
    });
  });

  describe('getSemanticTerms', () => {
    it('should get semantic terms successfully', async () => {
      const result = await handler.getSemanticTerms(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('getVisualFieldsPaginated', () => {
    it('should get paginated visual fields successfully', async () => {
      mockEvent.queryStringParameters = {
        page: '1',
        pageSize: '20',
        visualType: 'LINE_CHART',
      };

      const result = await handler.getVisualFieldsPaginated(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });
  });

  describe('rebuildVisualFieldCatalog', () => {
    it('should rebuild visual field catalog successfully', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({ forceRebuild: true });

      const result = await handler.rebuildVisualFieldCatalog(mockEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(STATUS_CODES.OK);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Visual field catalog rebuilt successfully');
    });
  });
});
