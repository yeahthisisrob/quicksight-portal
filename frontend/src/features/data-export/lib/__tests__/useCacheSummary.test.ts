/**
 * Tests for useCacheSummary hook
 */
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { exportApi } from '@/shared/api';

import { useCacheSummary } from '../useCacheSummary';

// Mock dependencies
const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  useSnackbar: () => ({
    enqueueSnackbar: mockEnqueueSnackbar,
  }),
}));

vi.mock('@/shared/api', () => ({
  exportApi: {
    getExportSummary: vi.fn(),
  },
}));

describe('useCacheSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // unmount any stray renders (RTL normally does this, but we're explicit)
    cleanup();
  });

  describe('initialization', () => {
    it('should initialize with correct default state', async () => {
      // Mock API to prevent actual calls during initialization
      vi.mocked(exportApi.getExportSummary).mockRejectedValue(new Error('Test error'));
      
      const { result, unmount } = renderHook(() => useCacheSummary());
      
      // Initial state before any async operations
      expect(result.current.cacheSummary).toBeNull();
      expect(result.current.cacheSummaryLoading).toBe(true);
      expect(result.current.showInitialExportPrompt).toBe(false);
      
      // Wait for the initial load attempt to complete
      await waitFor(() => {
        expect(result.current.cacheSummaryLoading).toBe(false);
      });
      
      unmount();
    });

    it('should load cache summary on mount', async () => {
      const mockSummary = {
        totalAssets: 100,
        exportedAssets: 80,
        lastExportDate: '2024-01-01T00:00:00Z',
        exportInProgress: false,
        needsInitialExport: false,
        assetTypeCounts: {
          dashboards: 10,
          datasets: 20,
          analyses: 15,
          datasources: 10,
          folders: 5,
        },
        fieldStatistics: {
          totalFields: 200,
          totalCalculatedFields: 20,
          totalUniqueFields: 180,
        },
      };
      
      vi.mocked(exportApi.getExportSummary).mockResolvedValue(mockSummary);
      
      const { result, unmount } = renderHook(() => useCacheSummary());
      
      await waitFor(() => {
        expect(result.current.cacheSummaryLoading).toBe(false);
      });
      
      expect(result.current.cacheSummary).toEqual(mockSummary);
      expect(result.current.showInitialExportPrompt).toBe(false);
      expect(exportApi.getExportSummary).toHaveBeenCalledOnce();
      
      unmount();
    });
  });

  describe('initial export prompt', () => {
    it('should show initial export prompt when needed', async () => {
      const mockSummary = {
        totalAssets: 0,
        exportedAssets: 0,
        lastExportDate: null,
        exportInProgress: false,
        needsInitialExport: true,
        message: 'No cache data found. Please run an initial export.',
        assetTypeCounts: {
          dashboards: 0,
          datasets: 0,
          analyses: 0,
          datasources: 0,
          folders: 0,
        },
        fieldStatistics: null,
      };
      
      vi.mocked(exportApi.getExportSummary).mockResolvedValue(mockSummary);
      
      const { result, unmount } = renderHook(() => useCacheSummary());
      
      await waitFor(() => {
        expect(result.current.cacheSummaryLoading).toBe(false);
      });
      
      expect(result.current.showInitialExportPrompt).toBe(true);
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        'No cache data found. Please run an initial export.',
        { variant: 'info' }
      );
      
      unmount();
    });

    it('should not show prompt when initial export is not needed', async () => {
      const mockSummary = {
        totalAssets: 50,
        exportedAssets: 40,
        lastExportDate: '2024-01-01T00:00:00Z',
        exportInProgress: false,
        needsInitialExport: false,
        assetTypeCounts: {
          dashboards: 15,
          datasets: 10,
          analyses: 8,
          datasources: 7,
          folders: 10,
        },
        fieldStatistics: {
          totalFields: 150,
          totalCalculatedFields: 15,
          totalUniqueFields: 135,
        },
      };
      
      vi.mocked(exportApi.getExportSummary).mockResolvedValue(mockSummary);
      
      const { result, unmount } = renderHook(() => useCacheSummary());
      
      await waitFor(() => {
        expect(result.current.cacheSummaryLoading).toBe(false);
      });
      
      expect(result.current.showInitialExportPrompt).toBe(false);
      expect(mockEnqueueSnackbar).not.toHaveBeenCalled();
      
      unmount();
    });

    it('should handle initial export prompt with no message', async () => {
      const mockSummary = {
        totalAssets: 0,
        exportedAssets: 0,
        lastExportDate: null,
        exportInProgress: false,
        needsInitialExport: true,
        assetTypeCounts: {
          dashboards: 0,
          datasets: 0,
          analyses: 0,
          datasources: 0,
          folders: 0,
        },
        fieldStatistics: null,
      };
      
      vi.mocked(exportApi.getExportSummary).mockResolvedValue(mockSummary);
      
      const { result, unmount } = renderHook(() => useCacheSummary());
      
      await waitFor(() => {
        expect(result.current.cacheSummaryLoading).toBe(false);
      });
      
      expect(result.current.showInitialExportPrompt).toBe(true);
      expect(mockEnqueueSnackbar).not.toHaveBeenCalled();
      
      unmount();
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const error = new Error('Network error');
      vi.mocked(exportApi.getExportSummary).mockRejectedValue(error);
      
      const { result, unmount } = renderHook(() => useCacheSummary());
      
      await waitFor(() => {
        expect(result.current.cacheSummaryLoading).toBe(false);
      });
      
      expect(result.current.cacheSummary).toBeNull();
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        'Failed to load cache summary',
        { variant: 'error' }
      );
      
      unmount();
    });
  });

  describe('manual refresh', () => {
    it('should allow manual cache summary refresh', async () => {
      const initialSummary = {
        totalAssets: 50,
        exportedAssets: 40,
        lastExportDate: '2024-01-01T00:00:00Z',
        exportInProgress: false,
        needsInitialExport: false,
        assetTypeCounts: {
          dashboards: 15,
          datasets: 10,
          analyses: 8,
          datasources: 7,
          folders: 10,
        },
        fieldStatistics: {
          totalFields: 150,
          totalCalculatedFields: 15,
          totalUniqueFields: 135,
        },
      };
      
      const updatedSummary = {
        totalAssets: 75,
        exportedAssets: 65,
        lastExportDate: '2024-01-02T00:00:00Z',
        exportInProgress: false,
        needsInitialExport: false,
        assetTypeCounts: {
          dashboards: 20,
          datasets: 15,
          analyses: 12,
          datasources: 10,
          folders: 18,
        },
        fieldStatistics: {
          totalFields: 200,
          totalCalculatedFields: 20,
          totalUniqueFields: 180,
        },
      };
      
      vi.mocked(exportApi.getExportSummary)
        .mockResolvedValueOnce(initialSummary)
        .mockResolvedValueOnce(updatedSummary);
      
      const { result, unmount } = renderHook(() => useCacheSummary());
      
      // Wait for initial load
      await waitFor(() => {
        expect(result.current.cacheSummaryLoading).toBe(false);
      });
      
      expect(result.current.cacheSummary).toEqual(initialSummary);
      
      // Manually refresh
      await act(async () => {
        await result.current.loadCacheSummary();
      });
      
      expect(result.current.cacheSummary).toEqual(updatedSummary);
      expect(exportApi.getExportSummary).toHaveBeenCalledTimes(2);
      
      unmount();
    });

    it('should handle loading state during manual refresh', async () => {
      const mockSummary = {
        totalAssets: 50,
        exportedAssets: 40,
        lastExportDate: '2024-01-01T00:00:00Z',
        exportInProgress: false,
        needsInitialExport: false,
        assetTypeCounts: {
          dashboards: 15,
          datasets: 10,
          analyses: 8,
          datasources: 7,
          folders: 10,
        },
        fieldStatistics: {
          totalFields: 150,
          totalCalculatedFields: 15,
          totalUniqueFields: 135,
        },
      };
      
      vi.mocked(exportApi.getExportSummary).mockResolvedValue(mockSummary);
      
      const { result, unmount } = renderHook(() => useCacheSummary());
      
      // Wait for initial load
      await waitFor(() => {
        expect(result.current.cacheSummaryLoading).toBe(false);
      });
      
      // Start manual refresh
      act(() => {
        result.current.loadCacheSummary();
      });
      
      // Should show loading state
      expect(result.current.cacheSummaryLoading).toBe(true);
      
      await waitFor(() => {
        expect(result.current.cacheSummaryLoading).toBe(false);
      });
      
      unmount();
    });
  });

  describe('prompt management', () => {
    it('should allow manual control of initial export prompt', async () => {
      const mockSummary = {
        totalAssets: 0,
        exportedAssets: 0,
        lastExportDate: null,
        exportInProgress: false,
        needsInitialExport: true,
        message: 'Initial export needed',
        assetTypeCounts: {
          dashboards: 0,
          datasets: 0,
          analyses: 0,
          datasources: 0,
          folders: 0,
        },
        fieldStatistics: null,
      };
      
      vi.mocked(exportApi.getExportSummary).mockResolvedValue(mockSummary);
      
      const { result, unmount } = renderHook(() => useCacheSummary());
      
      await waitFor(() => {
        expect(result.current.showInitialExportPrompt).toBe(true);
      });
      
      // Manually dismiss the prompt
      act(() => {
        result.current.setShowInitialExportPrompt(false);
      });
      
      expect(result.current.showInitialExportPrompt).toBe(false);
      
      // Manually show the prompt again
      act(() => {
        result.current.setShowInitialExportPrompt(true);
      });
      
      expect(result.current.showInitialExportPrompt).toBe(true);
      
      unmount();
    });
  });

  describe('edge cases', () => {
    it('should handle null response from API', async () => {
      vi.mocked(exportApi.getExportSummary).mockResolvedValue(null as any);
      
      const { result, unmount } = renderHook(() => useCacheSummary());
      
      await waitFor(() => {
        expect(result.current.cacheSummaryLoading).toBe(false);
      });
      
      expect(result.current.cacheSummary).toBeNull();
      expect(result.current.showInitialExportPrompt).toBe(false);
      
      unmount();
    });

    it('should handle undefined response from API', async () => {
      vi.mocked(exportApi.getExportSummary).mockResolvedValue(undefined as any);
      
      const { result, unmount } = renderHook(() => useCacheSummary());
      
      await waitFor(() => {
        expect(result.current.cacheSummaryLoading).toBe(false);
      });
      
      expect(result.current.cacheSummary).toBeNull();
      expect(result.current.showInitialExportPrompt).toBe(false);
      
      unmount();
    });

    it('should handle empty summary object', async () => {
      const emptySummary = {
        totalAssets: 0,
        exportedAssets: 0,
        lastExportDate: null,
        exportInProgress: false,
        assetTypeCounts: {
          dashboards: 0,
          datasets: 0,
          analyses: 0,
          datasources: 0,
          folders: 0,
        },
        fieldStatistics: null,
      };
      vi.mocked(exportApi.getExportSummary).mockResolvedValue(emptySummary);
      
      const { result, unmount } = renderHook(() => useCacheSummary());
      
      await waitFor(() => {
        expect(result.current.cacheSummaryLoading).toBe(false);
      });
      
      expect(result.current.cacheSummary).toEqual(emptySummary);
      expect(result.current.showInitialExportPrompt).toBe(false);
      
      unmount();
    });
  });
});