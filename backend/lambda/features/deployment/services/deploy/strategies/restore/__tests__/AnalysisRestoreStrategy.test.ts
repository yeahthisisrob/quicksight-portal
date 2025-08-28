import { vi, type Mocked } from 'vitest';

import type { AssetExportData } from '../../../../../../../shared/models/asset-export.model';
import type { QuickSightService } from '../../../../../../../shared/services/aws/QuickSightService';
import type { S3Service } from '../../../../../../../shared/services/aws/S3Service';
import { logger } from '../../../../../../../shared/utils/logger';
import { AnalysisRestoreStrategy } from '../AnalysisRestoreStrategy';

vi.mock('../../../../../../../shared/utils/logger');

const PERMISSIONS_COUNT = 1;
const TAGS_COUNT = 1;
const DATASETS_COUNT = 2;
const FILTERS_COUNT = 2;
const CALCULATED_FIELDS_COUNT = 2;
const PARAMETERS_COUNT = 2;
const STATIC_VALUE_100 = 100;
const STATIC_VALUE_1000 = 1000;

// Test setup utilities
let strategy: AnalysisRestoreStrategy;
let mockQuickSightService: Mocked<QuickSightService>;
let mockS3Service: Mocked<S3Service>;
const mockAwsAccountId = '123456789012';
const mockBucketName = 'test-bucket';

function setupTestEnvironment() {
  vi.clearAllMocks();

  mockQuickSightService = {
    deleteAnalysis: vi.fn(),
    createAnalysis: vi.fn(),
    describeDataset: vi.fn(),
  } as any;

  mockS3Service = {
    objectExists: vi.fn(),
  } as any;

  strategy = new AnalysisRestoreStrategy(
    mockQuickSightService,
    mockS3Service,
    mockAwsAccountId,
    'analysis',
    mockBucketName
  );
}

describe('AnalysisRestoreStrategy - restore basics', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('restore - basic functionality', () => {
    const mockAnalysisData: AssetExportData = {
      apiResponses: {
        describe: {
          timestamp: new Date().toISOString(),
          data: {
            analysisId: 'test-analysis',
            Name: 'Test Analysis',
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/test-analysis',
          },
        },
        definition: {
          timestamp: new Date().toISOString(),
          data: {
            Definition: {
              DataSetIdentifierDeclarations: [
                {
                  Identifier: 'dataset1',
                  DataSetArn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/dataset1',
                },
              ],
              Sheets: [
                {
                  SheetId: 'sheet1',
                  Name: 'Sheet 1',
                  Visuals: [],
                },
              ],
            },
          },
        },
        permissions: {
          timestamp: new Date().toISOString(),
          data: [
            {
              Principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
              Actions: ['quicksight:DescribeAnalysis', 'quicksight:UpdateAnalysis'],
            },
          ],
        },
        tags: {
          timestamp: new Date().toISOString(),
          data: [{ Key: 'Environment', Value: 'Development' }],
        },
      },
    } as unknown as AssetExportData;

    it('should successfully restore an analysis', async () => {
      const expectedArn = 'arn:aws:quicksight:us-east-1:123456789012:analysis/test-analysis';
      mockQuickSightService.createAnalysis.mockResolvedValue({
        arn: expectedArn,
        analysisId: 'test-analysis',
        creationStatus: 'CREATION_SUCCESSFUL',
      });

      const result = await strategy.restore('test-analysis', mockAnalysisData);

      expect(result.arn).toBe(expectedArn);
      expect(mockQuickSightService.createAnalysis).toHaveBeenCalledWith({
        analysisId: 'test-analysis',
        name: 'Test Analysis',
        definition: mockAnalysisData.apiResponses.definition!.data.Definition,
        permissions: mockAnalysisData.apiResponses.permissions!.data,
        tags: [{ key: 'Environment', value: 'Development' }],
        sourceEntity: undefined,
        themeArn: undefined,
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Restoring analysis',
        expect.objectContaining({
          assetId: 'test-analysis',
          assetType: 'analysis',
          name: 'Test Analysis',
          hasDefinition: true,
          permissionCount: PERMISSIONS_COUNT,
          tagCount: TAGS_COUNT,
        })
      );
    });

    it('should throw error when definition is missing', async () => {
      const dataWithoutDefinition: AssetExportData = {
        apiResponses: {
          describe: {
            timestamp: new Date().toISOString(),
            data: {
              Name: 'Test Analysis',
            },
          },
        },
      };

      await expect(strategy.restore('test-analysis', dataWithoutDefinition)).rejects.toThrow(
        'No analysis definition found for analysis test-analysis'
      );

      expect(mockQuickSightService.createAnalysis).not.toHaveBeenCalled();
    });
  });
});

describe('AnalysisRestoreStrategy - restore edge cases', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('restore - edge cases', () => {
    it('should handle missing permissions and tags', async () => {
      const minimalData: AssetExportData = {
        apiResponses: {
          describe: {
            timestamp: new Date().toISOString(),
            data: {
              Name: 'Minimal Analysis',
            },
          },
          definition: {
            timestamp: new Date().toISOString(),
            data: {
              Definition: {
                DataSetIdentifierDeclarations: [],
                Sheets: [],
              },
            },
          },
        },
      };

      mockQuickSightService.createAnalysis.mockResolvedValue({
        arn: 'test-arn',
        analysisId: 'test-analysis',
        creationStatus: 'CREATION_SUCCESSFUL',
      });

      await strategy.restore('test-analysis', minimalData);

      expect(mockQuickSightService.createAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: [],
          // No tags property when there are no tags
        })
      );
    });
  });
});

describe('AnalysisRestoreStrategy - date handling', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('restore - date handling', () => {
    it('should include TODO comment about AWS SDK date issue', async () => {
      const dataWithTimeRange: AssetExportData = {
        apiResponses: {
          describe: {
            data: {
              Name: 'Analysis with Time Range',
            },
          },
          definition: {
            data: {
              Definition: {
                DataSetIdentifierDeclarations: [],
                Sheets: [
                  {
                    SheetId: 'sheet1',
                    Visuals: [
                      {
                        LineChartVisual: {
                          ChartConfiguration: {
                            FieldWells: {
                              LineChartAggregatedFieldWells: {
                                Category: [],
                                Values: [],
                              },
                            },
                          },
                        },
                      },
                    ],
                    FilterControls: [
                      {
                        DateTimePicker: {
                          FilterControlId: 'date-control',
                          Title: 'Date Range',
                          Type: 'DATE_RANGE',
                        },
                      },
                    ],
                  },
                ],
                FilterGroups: [
                  {
                    FilterGroupId: 'filter-group-1',
                    Filters: [
                      {
                        TimeRangeFilter: {
                          FilterId: 'time-filter',
                          Column: {
                            DataSetIdentifier: 'dataset1',
                            ColumnName: 'date_column',
                          },
                          RangeMinimumValue: {
                            StaticValue: '2025-01-01T00:00:00.000Z',
                          },
                          RangeMaximumValue: {
                            StaticValue: '2025-01-31T23:59:59.999Z',
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      } as AssetExportData;

      mockQuickSightService.createAnalysis.mockResolvedValue({
        arn: 'test-arn',
        analysisId: 'test-analysis',
        creationStatus: 'CREATION_SUCCESSFUL',
      });

      await strategy.restore('test-analysis', dataWithTimeRange);

      // The analysis should be restored with the date strings as-is
      // The TODO comment in the code warns about potential AWS SDK issue
      const callArgs = mockQuickSightService.createAnalysis.mock.calls[0]![0];
      const timeFilter = callArgs.definition?.FilterGroups?.[0]?.Filters?.[0]?.TimeRangeFilter;
      expect(timeFilter?.RangeMinimumValue?.StaticValue).toBe('2025-01-01T00:00:00.000Z');
      expect(timeFilter?.RangeMaximumValue?.StaticValue).toBe('2025-01-31T23:59:59.999Z');
    });
  });
});

describe('AnalysisRestoreStrategy - deleteExisting', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('deleteExisting', () => {
    it('should delete existing analysis successfully', async () => {
      mockQuickSightService.deleteAnalysis.mockResolvedValue(undefined);

      await strategy.deleteExisting('test-analysis');

      expect(mockQuickSightService.deleteAnalysis).toHaveBeenCalledWith('test-analysis');
      expect(logger.info).toHaveBeenCalledWith(
        'Deleted existing analysis test-analysis before restore'
      );
    });

    it('should handle ResourceNotFoundException gracefully', async () => {
      const notFoundError = new Error('Analysis not found');
      (notFoundError as any).name = 'ResourceNotFoundException';
      mockQuickSightService.deleteAnalysis.mockRejectedValue(notFoundError);

      await expect(strategy.deleteExisting('test-analysis')).resolves.not.toThrow();

      expect(mockQuickSightService.deleteAnalysis).toHaveBeenCalledWith('test-analysis');
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should throw other errors', async () => {
      const otherError = new Error('Permission denied');
      mockQuickSightService.deleteAnalysis.mockRejectedValue(otherError);

      await expect(strategy.deleteExisting('test-analysis')).rejects.toThrow('Permission denied');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to delete existing analysis test-analysis before restore',
        expect.objectContaining({
          error: 'Permission denied',
        })
      );
    });
  });
});

describe('AnalysisRestoreStrategy - validateDependencies', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('validateDependencies', () => {
    const mockAnalysisData: AssetExportData = {
      apiResponses: {
        describe: {
          data: {
            Definition: {
              DataSetIdentifierDeclarations: [
                {
                  Identifier: 'dataset1',
                  DataSetArn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/dataset1',
                },
                {
                  Identifier: 'dataset2',
                  DataSetArn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/dataset2',
                },
              ],
            },
          },
        },
      },
    } as AssetExportData;

    it('should validate all datasets exist', async () => {
      mockS3Service.objectExists.mockResolvedValue(true);

      const results = await (strategy as any).validateDependencies(
        'test-analysis',
        mockAnalysisData
      );

      expect(results).toHaveLength(0);
      expect(mockS3Service.objectExists).toHaveBeenCalledTimes(DATASETS_COUNT);
      expect(mockS3Service.objectExists).toHaveBeenCalledWith(
        mockBucketName,
        'assets/datasets/dataset1.json'
      );
      expect(mockS3Service.objectExists).toHaveBeenCalledWith(
        mockBucketName,
        'assets/datasets/dataset2.json'
      );
    });

    it('should report missing datasets', async () => {
      mockS3Service.objectExists
        .mockResolvedValueOnce(true) // dataset1 exists
        .mockResolvedValueOnce(false); // dataset2 doesn't exist

      const results = await (strategy as any).validateDependencies(
        'test-analysis',
        mockAnalysisData
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        validator: 'dependencies',
        passed: false,
        message: 'Required dataset dataset2 not found',
        severity: 'warning',
        details: {
          assetId: 'test-analysis',
          datasetId: 'dataset2',
        },
      });
    });

    it('should handle analyses with no datasets', async () => {
      const dataWithoutDatasets: AssetExportData = {
        apiResponses: {
          describe: {
            data: {
              Definition: {
                DataSetIdentifierDeclarations: [],
              },
            },
          },
        },
      } as AssetExportData;

      const results = await (strategy as any).validateDependencies(
        'test-analysis',
        dataWithoutDatasets
      );

      expect(results).toHaveLength(0);
      expect(mockS3Service.objectExists).not.toHaveBeenCalled();
    });
  });
});

describe('AnalysisRestoreStrategy - edge cases', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('analysis with theme', () => {
    it('should handle analysis with theme', async () => {
      const dataWithTheme: AssetExportData = {
        apiResponses: {
          describe: {
            data: {
              Name: 'Themed Analysis',
            },
          },
          definition: {
            data: {
              Definition: {
                DataSetIdentifierDeclarations: [],
                Sheets: [],
              },
              ThemeArn: 'arn:aws:quicksight:us-east-1:123456789012:theme/custom-theme',
            },
          },
        },
      } as AssetExportData;

      mockQuickSightService.createAnalysis.mockResolvedValue({
        arn: 'test-arn',
        analysisId: 'test-analysis',
        creationStatus: 'CREATION_SUCCESSFUL',
      });

      await strategy.restore('test-analysis', dataWithTheme);

      expect(mockQuickSightService.createAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          themeArn: 'arn:aws:quicksight:us-east-1:123456789012:theme/custom-theme',
        })
      );
    });
  });

  describe('complex filter structures', () => {
    it('should handle complex filter structures', async () => {
      const complexFilters: AssetExportData = {
        apiResponses: {
          describe: {
            data: {
              Name: 'Analysis with Complex Filters',
            },
          },
          definition: {
            data: {
              Definition: {
                DataSetIdentifierDeclarations: [],
                Sheets: [],
                FilterGroups: [
                  {
                    FilterGroupId: 'group1',
                    Filters: [
                      {
                        CategoryFilter: {
                          FilterId: 'cat-filter',
                          Column: {
                            DataSetIdentifier: 'dataset1',
                            ColumnName: 'category',
                          },
                          Configuration: {
                            FilterListConfiguration: {
                              MatchOperator: 'CONTAINS',
                              CategoryValues: ['value1', 'value2'],
                            },
                          },
                        },
                      },
                      {
                        NumericRangeFilter: {
                          FilterId: 'num-filter',
                          Column: {
                            DataSetIdentifier: 'dataset1',
                            ColumnName: 'amount',
                          },
                          RangeMinimum: {
                            StaticValue: STATIC_VALUE_100,
                          },
                          RangeMaximum: {
                            StaticValue: STATIC_VALUE_1000,
                          },
                        },
                      },
                    ],
                    ScopeConfiguration: {
                      SelectedSheets: {
                        SheetVisualScopingConfigurations: [
                          {
                            SheetId: 'sheet1',
                            Scope: 'ALL_VISUALS',
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      } as AssetExportData;

      mockQuickSightService.createAnalysis.mockResolvedValue({
        arn: 'test-arn',
        analysisId: 'test-analysis',
        creationStatus: 'CREATION_SUCCESSFUL',
      });

      await strategy.restore('test-analysis', complexFilters);

      const callArgs = mockQuickSightService.createAnalysis.mock.calls[0]![0];
      expect(callArgs.definition?.FilterGroups).toHaveLength(1);
      expect(callArgs.definition?.FilterGroups?.[0]?.Filters).toHaveLength(FILTERS_COUNT);
    });
  });
});

describe('AnalysisRestoreStrategy - calculated fields', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('calculated fields and parameters', () => {
    it('should handle calculated fields', async () => {
      const dataWithCalculatedFields: AssetExportData = {
        apiResponses: {
          describe: {
            data: {
              Name: 'Analysis with Calculated Fields',
            },
          },
          definition: {
            data: {
              Definition: {
                DataSetIdentifierDeclarations: [
                  {
                    Identifier: 'dataset1',
                    DataSetArn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/dataset1',
                  },
                ],
                CalculatedFields: [
                  {
                    DataSetIdentifier: 'dataset1',
                    Name: 'Profit Margin',
                    Expression: '{revenue} - {cost}',
                  },
                  {
                    DataSetIdentifier: 'dataset1',
                    Name: 'Year Month',
                    Expression: 'formatDate({date}, "yyyy-MM")',
                  },
                ],
                Sheets: [],
              },
            },
          },
        },
      } as AssetExportData;

      mockQuickSightService.createAnalysis.mockResolvedValue({
        arn: 'test-arn',
        analysisId: 'test-analysis',
        creationStatus: 'CREATION_SUCCESSFUL',
      });

      await strategy.restore('test-analysis', dataWithCalculatedFields);

      const callArgs = mockQuickSightService.createAnalysis.mock.calls[0]![0];
      expect(callArgs.definition?.CalculatedFields).toHaveLength(CALCULATED_FIELDS_COUNT);
      expect(callArgs.definition?.CalculatedFields?.[0]?.Name).toBe('Profit Margin');
      expect(callArgs.definition?.CalculatedFields?.[1]?.Name).toBe('Year Month');
    });

    it('should handle parameter declarations', async () => {
      const dataWithParameters: AssetExportData = {
        apiResponses: {
          describe: {
            data: {
              Name: 'Analysis with Parameters',
            },
          },
          definition: {
            data: {
              Definition: {
                DataSetIdentifierDeclarations: [],
                ParameterDeclarations: [
                  {
                    StringParameterDeclaration: {
                      Name: 'Region',
                      ParameterValueType: 'SINGLE_VALUED',
                      DefaultValues: {
                        StaticValues: ['us-east-1'],
                      },
                      ValueWhenUnset: {
                        ValueWhenUnsetOption: 'NULL',
                      },
                    },
                  },
                  {
                    IntegerParameterDeclaration: {
                      Name: 'Limit',
                      ParameterValueType: 'SINGLE_VALUED',
                      DefaultValues: {
                        StaticValues: [STATIC_VALUE_100],
                      },
                    },
                  },
                ],
                Sheets: [],
              },
            },
          },
        },
      } as AssetExportData;

      mockQuickSightService.createAnalysis.mockResolvedValue({
        arn: 'test-arn',
        analysisId: 'test-analysis',
        creationStatus: 'CREATION_SUCCESSFUL',
      });

      await strategy.restore('test-analysis', dataWithParameters);

      const callArgs = mockQuickSightService.createAnalysis.mock.calls[0]![0];
      expect(callArgs.definition?.ParameterDeclarations).toHaveLength(PARAMETERS_COUNT);
      expect(
        callArgs.definition?.ParameterDeclarations?.[0]?.StringParameterDeclaration?.Name
      ).toBe('Region');
      expect(
        callArgs.definition?.ParameterDeclarations?.[1]?.IntegerParameterDeclaration?.Name
      ).toBe('Limit');
    });
  });
});
