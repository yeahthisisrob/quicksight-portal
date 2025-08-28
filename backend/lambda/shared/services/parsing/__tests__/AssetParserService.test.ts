import { beforeEach, describe, expect, it } from 'vitest';

import { type AssetExportData } from '../../../models/asset-export.model';
import { AssetParserService } from '../AssetParserService';

describe('AssetParserService - metadata updates', () => {
  let assetParser: AssetParserService;

  beforeEach(() => {
    assetParser = new AssetParserService();
  });

  it('should return "metadata-update" for permissions-only updates', () => {
    const assetData: AssetExportData = {
      apiResponses: {
        permissions: {
          data: {
            permissions: [
              {
                principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
                actions: ['VIEW'],
              },
            ],
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
      },
    } as any;

    const result = assetParser.determineEnrichmentStatus(assetData);
    expect(result).toBe('metadata-update');
  });

  it('should return "metadata-update" for tags-only updates', () => {
    const assetData: AssetExportData = {
      apiResponses: {
        tags: {
          data: [
            { key: 'Environment', value: 'Production' },
            { key: 'Owner', value: 'TeamA' },
          ],
          timestamp: '2024-02-01T00:00:00Z',
        },
      },
    } as any;

    const result = assetParser.determineEnrichmentStatus(assetData);
    expect(result).toBe('metadata-update');
  });

  it('should return "metadata-update" for both permissions and tags without describe/definition', () => {
    const assetData: AssetExportData = {
      apiResponses: {
        permissions: {
          data: {
            permissions: [
              {
                principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
                actions: ['VIEW'],
              },
            ],
            linkSharingConfiguration: {
              permissions: [
                {
                  principal: 'arn:aws:quicksight:us-east-1:123456789012:namespace/default',
                  actions: ['VIEW'],
                },
              ],
            },
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
        tags: {
          data: [{ key: 'Environment', value: 'Production' }],
          timestamp: '2024-02-01T00:00:00Z',
        },
      },
    } as any;

    const result = assetParser.determineEnrichmentStatus(assetData);
    expect(result).toBe('metadata-update');
  });

  it('should handle permissions with linkSharingConfiguration correctly', () => {
    const assetData: AssetExportData = {
      apiResponses: {
        permissions: {
          data: {
            permissions: [
              {
                principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
                actions: ['VIEW', 'EDIT'],
              },
            ],
            linkSharingConfiguration: {
              permissions: [
                {
                  principal: 'arn:aws:quicksight:us-east-1:123456789012:namespace/default',
                  actions: ['VIEW'],
                },
                {
                  principal: '*',
                  actions: ['VIEW'],
                },
              ],
            },
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
      },
    } as any;

    const result = assetParser.determineEnrichmentStatus(assetData);
    expect(result).toBe('metadata-update');
  });
});

describe('AssetParserService - dashboards and analyses', () => {
  let assetParser: AssetParserService;

  beforeEach(() => {
    assetParser = new AssetParserService();
  });

  it('should return "enriched" for dashboard with definition', () => {
    const assetData: AssetExportData = {
      assetType: 'dashboard',
      apiResponses: {
        definition: {
          data: {
            DashboardId: 'dashboard-123',
            Name: 'Test Dashboard',
            Definition: {
              DataSetIdentifierDeclarations: [],
              Sheets: [],
            },
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
        describe: {
          data: {
            Dashboard: {
              DashboardId: 'dashboard-123',
              Name: 'Test Dashboard',
            },
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
      },
    } as any;

    const result = assetParser.determineEnrichmentStatus(assetData);
    expect(result).toBe('enriched');
  });

  it('should return "partial" for dashboard with describe but no definition', () => {
    const assetData: AssetExportData = {
      assetType: 'dashboard',
      apiResponses: {
        list: {
          data: {
            DashboardId: 'dashboard-123',
            Name: 'Test Dashboard',
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
        describe: {
          data: {
            Dashboard: {
              DashboardId: 'dashboard-123',
              Name: 'Test Dashboard',
            },
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
      },
    } as any;

    const result = assetParser.determineEnrichmentStatus(assetData);
    expect(result).toBe('partial');
  });

  it('should return "enriched" for analysis with definition', () => {
    const assetData: AssetExportData = {
      assetType: 'analysis',
      apiResponses: {
        list: {
          data: {
            AnalysisId: 'analysis-123',
            Name: 'Test Analysis',
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
        definition: {
          data: {
            AnalysisId: 'analysis-123',
            Name: 'Test Analysis',
            Definition: {
              DataSetIdentifierDeclarations: [],
              Sheets: [],
            },
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
      },
    } as any;

    const result = assetParser.determineEnrichmentStatus(assetData);
    expect(result).toBe('enriched');
  });
});

describe('AssetParserService - other asset types', () => {
  let assetParser: AssetParserService;

  beforeEach(() => {
    assetParser = new AssetParserService();
  });

  it('should return "enriched" for dataset with describe', () => {
    const assetData: AssetExportData = {
      assetType: 'dataset',
      apiResponses: {
        describe: {
          data: {
            DataSet: {
              DataSetId: 'dataset-123',
              Name: 'Test Dataset',
            },
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
      },
    } as any;

    const result = assetParser.determineEnrichmentStatus(assetData);
    expect(result).toBe('enriched');
  });

  it('should return "enriched" for folder with list data', () => {
    const assetData: AssetExportData = {
      assetType: 'folder',
      apiResponses: {
        list: {
          data: {
            FolderId: 'folder-123',
            Name: 'Test Folder',
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
      },
    } as any;

    const result = assetParser.determineEnrichmentStatus(assetData);
    expect(result).toBe('enriched');
  });

  it('should return "skeleton" for empty asset data', () => {
    const assetData: AssetExportData = {
      apiResponses: {},
    } as any;

    const result = assetParser.determineEnrichmentStatus(assetData);
    expect(result).toBe('skeleton');
  });

  it('should return "skeleton" when no relevant data is present', () => {
    const assetData: AssetExportData = {
      assetType: 'dashboard',
      apiResponses: {
        // Empty responses
      },
    } as any;

    const result = assetParser.determineEnrichmentStatus(assetData);
    expect(result).toBe('skeleton');
  });
});

describe('AssetParserService - mixed data', () => {
  let assetParser: AssetParserService;

  beforeEach(() => {
    assetParser = new AssetParserService();
  });

  it('should not return metadata-update when describe data is present', () => {
    const assetData: AssetExportData = {
      apiResponses: {
        permissions: {
          data: {
            permissions: [],
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
        describe: {
          data: {
            Dashboard: {
              DashboardId: 'dashboard-123',
            },
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
      },
    } as any;

    const result = assetParser.determineEnrichmentStatus(assetData);
    expect(result).not.toBe('metadata-update');
  });

  it('should not return metadata-update when definition data is present', () => {
    const assetData: AssetExportData = {
      assetType: 'dashboard',
      apiResponses: {
        list: {
          data: {
            DashboardId: 'dashboard-123',
            Name: 'Test Dashboard',
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
        tags: {
          data: [{ key: 'Test', value: 'Value' }],
          timestamp: '2024-02-01T00:00:00Z',
        },
        definition: {
          data: {
            DashboardId: 'dashboard-123',
            Definition: {},
          },
          timestamp: '2024-02-01T00:00:00Z',
        },
      },
    } as any;

    const result = assetParser.determineEnrichmentStatus(assetData);
    expect(result).toBe('enriched');
  });
});
