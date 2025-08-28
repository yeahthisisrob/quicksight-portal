import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { FieldMetadataService } from '../FieldMetadataService';

// Test constants
const EXPECTED_TAG_COUNT = 3;
const EXPECTED_UPDATED_FIELD_COUNT = 2;

// Move mockS3Service outside of vi.mock
const mockS3Service = {
  getObject: vi.fn(),
  putObject: vi.fn(),
  objectExists: vi.fn(),
};

vi.mock('../../../../shared/services/aws/ClientFactory', () => {
  return {
    ClientFactory: {
      getS3Service: () => mockS3Service,
    },
  };
});

vi.mock('../../../../shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('FieldMetadataService - Constructor', () => {
  let service: FieldMetadataService;
  const mockBucketName = 'test-bucket';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUCKET_NAME = mockBucketName;
    mockS3Service.objectExists.mockResolvedValue(true);
    mockS3Service.getObject.mockResolvedValue({
      fields: {},
      lastUpdated: '2024-01-01T00:00:00Z',
    });
    mockS3Service.putObject.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.BUCKET_NAME;
  });

  it('should throw error when BUCKET_NAME is not set', () => {
    delete process.env.BUCKET_NAME;

    expect(() => new FieldMetadataService()).toThrow('BUCKET_NAME environment variable is not set');
  });

  it('should initialize with bucket name', () => {
    service = new FieldMetadataService();
    expect(service).toBeDefined();
    expect((service as any).bucketName).toBe(mockBucketName);
  });
});

describe('FieldMetadataService - Core Operations', () => {
  let service: FieldMetadataService;
  const mockBucketName = 'test-bucket';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUCKET_NAME = mockBucketName;

    // Setup default S3 mock responses
    mockS3Service.objectExists.mockResolvedValue(true);
    mockS3Service.getObject.mockResolvedValue({
      fields: {
        'dataset::ds-1::field1': {
          sourceType: 'dataset',
          sourceId: 'ds-1',
          fieldName: 'field1',
          description: 'Test field 1',
          tags: ['tag1', 'tag2'],
          category: 'dimension',
          sensitivity: 'public',
          lastUpdated: '2024-01-01T00:00:00Z',
        },
        'dataset::ds-1::field2': {
          sourceType: 'dataset',
          sourceId: 'ds-1',
          fieldName: 'field2',
          description: 'Test field 2',
          tags: ['tag3'],
          category: 'measure',
          sensitivity: 'internal',
          lastUpdated: '2024-01-01T00:00:00Z',
        },
      },
      lastUpdated: '2024-01-01T00:00:00Z',
    });
    mockS3Service.putObject.mockResolvedValue(undefined);

    service = new FieldMetadataService();
  });

  afterEach(() => {
    delete process.env.BUCKET_NAME;
  });

  describe('getFieldMetadata', () => {
    it('should get field metadata successfully', async () => {
      mockS3Service.getObject.mockResolvedValueOnce({
        fields: {
          'dataset::ds-1::field1': {
            sourceType: 'dataset',
            sourceId: 'ds-1',
            fieldName: 'field1',
            description: 'Test field 1',
            tags: ['tag1', 'tag2'],
            category: 'dimension',
            sensitivity: 'public',
            lastUpdated: '2024-01-01T00:00:00Z',
          },
        },
        lastUpdated: '2024-01-01T00:00:00Z',
      });

      const metadata = await service.getFieldMetadata('dataset', 'ds-1', 'field1');

      expect(metadata).toBeDefined();
      expect(metadata?.fieldName).toBe('field1');
      expect(metadata?.description).toBe('Test field 1');
      expect(metadata?.tags).toEqual(['tag1', 'tag2']);
      expect(metadata?.sensitivity).toBe('public');
    });

    it('should return undefined for non-existent field', async () => {
      const metadata = await service.getFieldMetadata('dataset', 'ds-999', 'nonexistent');

      expect(metadata).toBeUndefined();
    });

    it('should handle S3 errors gracefully', async () => {
      mockS3Service.getObject.mockRejectedValueOnce(new Error('S3 error'));

      const metadata = await service.getFieldMetadata('dataset', 'ds-1', 'field1');

      expect(metadata).toBeUndefined();
    });

    it('should handle non-existent metadata file', async () => {
      // Simulate NoSuchKey error when metadata file doesn't exist
      mockS3Service.getObject.mockRejectedValueOnce({ name: 'NoSuchKey' });

      // Create a new service instance to trigger cache loading with the error
      const newService = new FieldMetadataService();
      const metadata = await newService.getFieldMetadata('dataset', 'ds-1', 'field1');

      expect(metadata).toBeUndefined();
    });
  });

  describe('updateFieldMetadata', () => {
    it('should update field metadata successfully', async () => {
      const updates = {
        description: 'Updated description',
        tags: ['newTag1', 'newTag2'],
        sensitivity: 'confidential' as const,
      };

      const result = await service.updateFieldMetadata('dataset', 'ds-1', 'field1', updates);

      expect(result).toBeDefined();
      expect(result.description).toBe('Updated description');
      expect(result.tags).toEqual(['newTag1', 'newTag2']);
      expect(result.sensitivity).toBe('confidential');
      expect(mockS3Service.putObject).toHaveBeenCalled();
    });

    it('should create new metadata for non-existent field', async () => {
      const updates = {
        description: 'New field description',
        category: 'dimension',
      };

      const result = await service.updateFieldMetadata('dataset', 'ds-new', 'newField', updates);

      expect(result).toBeDefined();
      expect(result.description).toBe('New field description');
      expect(result.category).toBe('dimension');
      expect(result.sourceType).toBe('dataset');
      expect(result.sourceId).toBe('ds-new');
      expect(result.fieldName).toBe('newField');
    });

    it('should preserve existing values when updating partial fields', async () => {
      const updates = {
        description: 'Updated description only',
      };

      const result = await service.updateFieldMetadata('dataset', 'ds-1', 'field1', updates);

      expect(result.description).toBe('Updated description only');
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.category).toBe('dimension');
      expect(result.sensitivity).toBe('public');
    });
  });
});

describe('FieldMetadataService - Tag Operations', () => {
  let service: FieldMetadataService;
  const mockBucketName = 'test-bucket';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUCKET_NAME = mockBucketName;

    mockS3Service.objectExists.mockResolvedValue(true);
    mockS3Service.getObject.mockResolvedValue({
      fields: {
        'dataset::ds-1::field1': {
          sourceType: 'dataset',
          sourceId: 'ds-1',
          fieldName: 'field1',
          description: 'Test field 1',
          tags: ['tag1', 'tag2'],
          category: 'dimension',
          sensitivity: 'public',
          lastUpdated: '2024-01-01T00:00:00Z',
        },
        'dataset::ds-1::field2': {
          sourceType: 'dataset',
          sourceId: 'ds-1',
          fieldName: 'field2',
          description: 'Test field 2',
          tags: ['tag3'],
          category: 'measure',
          sensitivity: 'internal',
          lastUpdated: '2024-01-01T00:00:00Z',
        },
      },
      lastUpdated: '2024-01-01T00:00:00Z',
    });
    mockS3Service.putObject.mockResolvedValue(undefined);

    service = new FieldMetadataService();
  });

  afterEach(() => {
    delete process.env.BUCKET_NAME;
  });

  describe('addFieldTags', () => {
    it('should add tags to existing field', async () => {
      await service.addFieldTags('dataset', 'ds-1', 'field1', ['newTag3', 'newTag4']);

      expect(mockS3Service.putObject).toHaveBeenCalled();
      const putCall = mockS3Service.putObject.mock.calls[0];
      const savedData = JSON.parse(putCall?.[2] ?? '{}');
      const updatedField = savedData.fields['dataset::ds-1::field1'];

      expect(updatedField.tags).toContain('tag1');
      expect(updatedField.tags).toContain('tag2');
      expect(updatedField.tags).toContain('newTag3');
      expect(updatedField.tags).toContain('newTag4');
    });

    it('should add tags to field without existing tags', async () => {
      await service.addFieldTags('dataset', 'ds-new', 'newField', ['tag1', 'tag2']);

      expect(mockS3Service.putObject).toHaveBeenCalled();
      const putCall = mockS3Service.putObject.mock.calls[0];
      const savedData = JSON.parse(putCall?.[2] ?? '{}');
      const updatedField = savedData.fields['dataset::ds-new::newField'];

      expect(updatedField.tags).toEqual(['tag1', 'tag2']);
    });

    it('should deduplicate tags', async () => {
      await service.addFieldTags('dataset', 'ds-1', 'field1', ['tag1', 'tag2', 'newTag']);

      const putCall = mockS3Service.putObject.mock.calls[0];
      const savedData = JSON.parse(putCall?.[2] ?? '{}');
      const updatedField = savedData.fields['dataset::ds-1::field1'];

      expect(updatedField.tags).toEqual(['tag1', 'tag2', 'newTag']);
      expect(updatedField.tags).toHaveLength(EXPECTED_TAG_COUNT);
    });
  });

  describe('removeFieldTags', () => {
    it('should remove specified tags from field', async () => {
      await service.removeFieldTags('dataset', 'ds-1', 'field1', ['tag1']);

      const putCall = mockS3Service.putObject.mock.calls[0];
      const savedData = JSON.parse(putCall?.[2] ?? '{}');
      const updatedField = savedData.fields['dataset::ds-1::field1'];

      expect(updatedField.tags).toEqual(['tag2']);
      expect(updatedField.tags).not.toContain('tag1');
    });

    it('should handle removing non-existent tags gracefully', async () => {
      await service.removeFieldTags('dataset', 'ds-1', 'field1', ['nonexistent']);

      const putCall = mockS3Service.putObject.mock.calls[0];
      const savedData = JSON.parse(putCall?.[2] ?? '{}');
      const updatedField = savedData.fields['dataset::ds-1::field1'];

      expect(updatedField.tags).toEqual(['tag1', 'tag2']);
    });

    it('should handle field without tags', async () => {
      await service.removeFieldTags('dataset', 'ds-new', 'newField', ['tag1']);

      expect(mockS3Service.putObject).not.toHaveBeenCalled();
    });
  });
});

describe('FieldMetadataService - Bulk Operations', () => {
  let service: FieldMetadataService;
  const mockBucketName = 'test-bucket';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUCKET_NAME = mockBucketName;

    mockS3Service.objectExists.mockResolvedValue(true);
    mockS3Service.getObject.mockResolvedValue({
      fields: {
        'dataset::ds-1::field1': {
          sourceType: 'dataset',
          sourceId: 'ds-1',
          fieldName: 'field1',
          description: 'Test field 1',
          tags: ['tag1', 'tag2'],
          category: 'dimension',
          sensitivity: 'public',
          lastUpdated: '2024-01-01T00:00:00Z',
        },
        'dataset::ds-1::field2': {
          sourceType: 'dataset',
          sourceId: 'ds-1',
          fieldName: 'field2',
          description: 'Test field 2',
          tags: ['tag3'],
          category: 'measure',
          sensitivity: 'internal',
          lastUpdated: '2024-01-01T00:00:00Z',
        },
      },
      lastUpdated: '2024-01-01T00:00:00Z',
    });
    mockS3Service.putObject.mockResolvedValue(undefined);

    service = new FieldMetadataService();
  });

  afterEach(() => {
    delete process.env.BUCKET_NAME;
  });

  describe('bulkUpdateFieldMetadata', () => {
    it('should bulk update multiple fields successfully', async () => {
      const updates = [
        {
          sourceType: 'dataset',
          sourceId: 'ds-1',
          fieldName: 'field1',
          updates: { description: 'Updated field 1' },
        },
        {
          sourceType: 'dataset',
          sourceId: 'ds-1',
          fieldName: 'field2',
          updates: { description: 'Updated field 2' },
        },
      ];

      const result = await service.bulkUpdateFieldMetadata(updates);

      expect(result.success).toBe(true);
      expect(result.totalFields).toBe(2);
      expect(result.updatedFields).toBe(EXPECTED_UPDATED_FIELD_COUNT);
      expect(result.errors).toHaveLength(0);
      expect(mockS3Service.putObject).toHaveBeenCalledTimes(1);
    });

    it('should handle partial failures in bulk update', async () => {
      const updates = [
        {
          sourceType: 'dataset',
          sourceId: 'ds-1',
          fieldName: 'field1',
          updates: { description: 'Updated field 1' },
        },
        {
          sourceType: 'invalid' as any,
          sourceId: '',
          fieldName: '',
          updates: { description: 'This will fail' },
        },
      ];

      const result = await service.bulkUpdateFieldMetadata(updates);

      expect(result.success).toBe(false);
      expect(result.totalFields).toBe(2);
      expect(result.updatedFields).toBeLessThan(2);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should create new fields during bulk update', async () => {
      const updates = [
        {
          sourceType: 'dataset',
          sourceId: 'ds-new',
          fieldName: 'newField1',
          updates: { description: 'New field 1', category: 'dimension' },
        },
        {
          sourceType: 'dataset',
          sourceId: 'ds-new',
          fieldName: 'newField2',
          updates: { description: 'New field 2', category: 'measure' },
        },
      ];

      const result = await service.bulkUpdateFieldMetadata(updates);

      expect(result.success).toBe(true);
      expect(result.totalFields).toBe(2);
      expect(result.updatedFields).toBe(EXPECTED_UPDATED_FIELD_COUNT);
      expect(mockS3Service.putObject).toHaveBeenCalled();
    });
  });
});

describe('FieldMetadataService - Search and Utility', () => {
  let service: FieldMetadataService;
  const mockBucketName = 'test-bucket';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUCKET_NAME = mockBucketName;

    mockS3Service.objectExists.mockResolvedValue(true);
    mockS3Service.getObject.mockResolvedValue({
      fields: {
        'dataset::ds-1::field1': {
          sourceType: 'dataset',
          sourceId: 'ds-1',
          fieldName: 'field1',
          description: 'Test field 1',
          tags: ['tag1', 'tag2'],
          category: 'dimension',
          sensitivity: 'public',
          lastUpdated: '2024-01-01T00:00:00Z',
        },
        'dataset::ds-1::field2': {
          sourceType: 'dataset',
          sourceId: 'ds-1',
          fieldName: 'field2',
          description: 'Test field 2',
          tags: ['tag3'],
          category: 'measure',
          sensitivity: 'internal',
          lastUpdated: '2024-01-01T00:00:00Z',
        },
      },
      lastUpdated: '2024-01-01T00:00:00Z',
    });
    mockS3Service.putObject.mockResolvedValue(undefined);

    service = new FieldMetadataService();
  });

  afterEach(() => {
    delete process.env.BUCKET_NAME;
  });

  describe('searchFieldsByTags', () => {
    it('should search fields by tags', async () => {
      const results = await service.searchFieldsByTags(['tag1']);

      expect(results).toHaveLength(1);
      expect(results[0]?.fieldName).toBe('field1');
      expect(results[0]?.tags).toContain('tag1');
    });

    it('should return empty array when no matches found', async () => {
      const results = await service.searchFieldsByTags(['nonexistent']);

      expect(results).toHaveLength(0);
    });
  });

  describe('getAllFieldMetadata', () => {
    it('should get all field metadata', async () => {
      const allMetadata = await service.getAllFieldMetadata();

      expect(allMetadata).toHaveLength(2);
      expect(allMetadata[0]?.fieldName).toBe('field1');
      expect(allMetadata[1]?.fieldName).toBe('field2');
    });

    it('should return empty array when no metadata exists', async () => {
      // Simulate NoSuchKey error when metadata file doesn't exist
      mockS3Service.getObject.mockRejectedValueOnce({ name: 'NoSuchKey' });

      // Create a new service instance to trigger cache loading with the error
      const newService = new FieldMetadataService();
      const allMetadata = await newService.getAllFieldMetadata();

      expect(allMetadata).toHaveLength(0);
    });
  });
});

describe('FieldMetadataService - Private Methods', () => {
  let service: FieldMetadataService;
  const mockBucketName = 'test-bucket';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUCKET_NAME = mockBucketName;

    mockS3Service.objectExists.mockResolvedValue(true);
    mockS3Service.getObject.mockResolvedValue({
      metadata: {},
      lastUpdated: '2024-01-01T00:00:00Z',
    });
    mockS3Service.putObject.mockResolvedValue(undefined);

    service = new FieldMetadataService();
  });

  afterEach(() => {
    delete process.env.BUCKET_NAME;
  });

  it('should generate correct field ID', () => {
    const fieldId = (service as any).getFieldId('dataset', 'ds-1', 'field1');

    expect(fieldId).toBe('dataset::ds-1::field1');
  });

  it('should load cache when expired', async () => {
    (service as any).cacheTimestamp = 0;

    await (service as any).ensureCacheLoaded();

    expect(mockS3Service.getObject).toHaveBeenCalled();
    expect((service as any).metadataCache).toBeDefined();
  });

  it('should not reload cache when still valid', async () => {
    await (service as any).ensureCacheLoaded();
    mockS3Service.getObject.mockClear();

    await (service as any).ensureCacheLoaded();

    expect(mockS3Service.getObject).not.toHaveBeenCalled();
  });

  it('should save metadata to S3', async () => {
    await (service as any).ensureCacheLoaded();
    await (service as any).saveMetadataToS3();

    expect(mockS3Service.putObject).toHaveBeenCalled();
    const putCall = mockS3Service.putObject.mock.calls[0];

    expect(putCall?.[0]).toBe(mockBucketName);
    expect(putCall?.[1]).toBe('catalog/field-metadata-bulk.json');
    expect(JSON.parse(putCall?.[2] ?? '{}')).toHaveProperty('fields');
    expect(JSON.parse(putCall?.[2] ?? '{}')).toHaveProperty('lastUpdated');
  });
});
