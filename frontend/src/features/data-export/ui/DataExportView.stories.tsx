import { SnackbarProvider } from 'notistack';

import { exportApi } from '@/shared/api';

import DataExportView from './DataExportView';

import type { Meta, StoryObj } from '@storybook/react-vite';

// Mock the API
const mockExportApi = {
  getExportSummary: async () => ({
    totalAssets: 1250,
    exportedAssets: 1250,
    lastExportDate: new Date().toISOString(),
    exportInProgress: false,
    assetTypeCounts: {
      dashboards: 125,
      datasets: 89,
      analyses: 234,
      datasources: 12,
      folders: 45,
      users: 156,
      groups: 23,
    },
    fieldStatistics: {
      totalFields: 3456,
      totalCalculatedFields: 789,
      totalUniqueFields: 2667,
    },
    totalSize: 125000000,
    cacheVersion: '1.0',
  }),
  getExportStatus: async () => ({
    inventoryComplete: true,
    enrichmentInProgress: false,
    totalAssets: 1250,
    enrichedAssets: 1250,
    skeletonAssets: 0,
    percentEnriched: 100,
    assetsByType: {
      dashboard: 125,
      dataset: 89,
      analysis: 234,
      datasource: 12,
      folder: 45,
      user: 156,
      group: 23,
    },
    lastUpdated: new Date().toISOString(),
    nextSteps: {
      phase: 'complete' as const,
      action: 'Export complete',
      description: 'All assets have been inventoried and enriched',
    },
    logs: [
      {
        ts: Date.now() - 60000,
        msg: 'Export process started',
        level: 'info' as const,
      },
      {
        ts: Date.now() - 50000,
        msg: 'Listed 125 dashboard assets',
        level: 'info' as const,
        assetType: 'dashboard',
      },
      {
        ts: Date.now() - 40000,
        msg: 'Completed export for dashboard: 125 successful, 0 failed',
        level: 'info' as const,
        assetType: 'dashboard',
      },
      {
        ts: Date.now() - 30000,
        msg: 'Export completed successfully in 45.0s',
        level: 'info' as const,
      },
    ],
  }),
  triggerFullExport: async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
      duration: 45000,
      totals: {
        listed: 684,
        successful: 650,
        cached: 30,
        failed: 4,
        apiCalls: 1250,
      },
      assetTypes: [
        {
          assetType: 'dashboards',
          totalListed: 125,
          successful: 120,
          cached: 5,
          failed: 0,
          timing: { totalMs: 12000 },
          apiCalls: { total: 250 },
        },
        {
          assetType: 'datasets',
          totalListed: 89,
          successful: 85,
          cached: 4,
          failed: 0,
          timing: { totalMs: 8000 },
          apiCalls: { total: 180 },
        },
      ],
    };
  },
  refreshViewStats: async () => ({
    refreshed: 359,
  }),
};

Object.assign(exportApi, mockExportApi);

const meta = {
  title: 'Features/DataExport/DataExportView',
  component: DataExportView,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <SnackbarProvider maxSnack={3}>
        <div style={{ padding: '24px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
          <Story />
        </div>
      </SnackbarProvider>
    ),
  ],
} satisfies Meta<typeof DataExportView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ExportInProgress: Story = {
  decorators: [
    (Story) => {
      // Override the mock to show export in progress
      const inProgressMock = {
        ...mockExportApi,
        getExportStatus: async () => ({
          inventoryComplete: true,
          enrichmentInProgress: true,
          totalAssets: 1250,
          enrichedAssets: 650,
          skeletonAssets: 600,
          percentEnriched: 52,
          assetsByType: {
            dashboard: 125,
            dataset: 89,
            analysis: 234,
            datasource: 12,
            folder: 45,
            user: 156,
            group: 23,
          },
          lastUpdated: new Date().toISOString(),
          nextSteps: {
            phase: 'enrichment' as const,
            action: 'Enrich assets',
            description: '600 assets need enrichment with definitions, permissions, and tags',
          },
          exportState: {
            status: 'running' as const,
            currentStage: 'Enriching dataset',
            startedAt: Date.now() - 120000,
            totalAssets: 1250,
            enrichedAssets: 650,
            failedAssets: 5,
            assetProgress: {
              dashboard: { listed: 125, enriched: 125, failed: 0 },
              dataset: { listed: 89, enriched: 45, failed: 2 },
              analysis: { listed: 234, enriched: 180, failed: 3 },
              datasource: { listed: 12, enriched: 12, failed: 0 },
              folder: { listed: 45, enriched: 45, failed: 0 },
              user: { listed: 156, enriched: 156, failed: 0 },
              group: { listed: 23, enriched: 23, failed: 0 },
            },
          },
          logs: [
            {
              ts: Date.now() - 10000,
              msg: 'Processing batch 3/5 for dataset',
              level: 'info' as const,
              assetType: 'dataset',
            },
            {
              ts: Date.now() - 8000,
              msg: 'Failed to process dataset dataset-456: Permission denied',
              level: 'error' as const,
              assetType: 'dataset',
              assetId: 'dataset-456',
            },
            {
              ts: Date.now() - 5000,
              msg: 'Batch 3/5 for dataset: 18 successful, 1 failed',
              level: 'warn' as const,
              assetType: 'dataset',
            },
            {
              ts: Date.now() - 2000,
              msg: 'Starting batch 4/5 for dataset',
              level: 'info' as const,
              assetType: 'dataset',
            },
          ],
        }),
      };
      
      Object.assign(exportApi, inProgressMock);
      
      return (
        <SnackbarProvider maxSnack={3}>
          <div style={{ padding: '24px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
            <Story />
          </div>
        </SnackbarProvider>
      );
    },
  ],
};

export const ExportWithErrors: Story = {
  decorators: [
    (Story) => {
      // Override the mock to show export with errors
      const errorMock = {
        ...mockExportApi,
        getExportStatus: async () => ({
          inventoryComplete: true,
          enrichmentInProgress: false,
          totalAssets: 1250,
          enrichedAssets: 1200,
          skeletonAssets: 0,
          percentEnriched: 96,
          assetsByType: {
            dashboard: 125,
            dataset: 89,
            analysis: 234,
            datasource: 12,
            folder: 45,
            user: 156,
            group: 23,
          },
          lastUpdated: new Date().toISOString(),
          nextSteps: {
            phase: 'complete' as const,
            action: 'Export complete',
            description: 'All assets have been inventoried and enriched',
          },
          exportState: {
            status: 'completed' as const,
            currentStage: 'Export completed',
            startedAt: Date.now() - 300000,
            completedAt: Date.now() - 60000,
            totalAssets: 1250,
            enrichedAssets: 1200,
            failedAssets: 50,
            assetProgress: {
              dashboard: { listed: 125, enriched: 120, failed: 5 },
              dataset: { listed: 89, enriched: 80, failed: 9 },
              analysis: { listed: 234, enriched: 200, failed: 34 },
              datasource: { listed: 12, enriched: 10, failed: 2 },
              folder: { listed: 45, enriched: 45, failed: 0 },
              user: { listed: 156, enriched: 156, failed: 0 },
              group: { listed: 23, enriched: 23, failed: 0 },
            },
          },
          logs: [
            {
              ts: Date.now() - 120000,
              msg: 'Export process started',
              level: 'info' as const,
            },
            {
              ts: Date.now() - 90000,
              msg: 'Multiple failures detected for analysis assets',
              level: 'error' as const,
              assetType: 'analysis',
            },
            {
              ts: Date.now() - 75000,
              msg: 'Failed to process 34 analysis assets due to API rate limits',
              level: 'error' as const,
              assetType: 'analysis',
            },
            {
              ts: Date.now() - 60000,
              msg: 'Export completed with 50 errors in 240.0s',
              level: 'error' as const,
            },
          ],
        }),
      };
      
      Object.assign(exportApi, errorMock);
      
      return (
        <SnackbarProvider maxSnack={3}>
          <div style={{ padding: '24px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
            <Story />
          </div>
        </SnackbarProvider>
      );
    },
  ],
};