/**
 * Tests for useExportJob hook
 */
import { renderHook, act, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { exportApi } from '@/shared/api';

import { useExportJob } from '../useExportJob';

// ------- test helpers -------
const flush = async (ms = 0) => {
  await act(async () => {
    if (ms > 0) {
      await vi.advanceTimersByTimeAsync(ms);
    } else {
      await vi.advanceTimersByTimeAsync(0);
    }
    // allow any queued microtasks to resolve
    await Promise.resolve();
  });
};

// Mock dependencies
vi.mock('notistack', () => ({
  useSnackbar: () => ({
    enqueueSnackbar: vi.fn(),
  }),
}));

vi.mock('@/shared/api', () => ({
  exportApi: {
    getJobStatus: vi.fn(),
    getJobLogs: vi.fn(),
    startExportJob: vi.fn(),
    stopJob: vi.fn(),
    warmUp: vi.fn(),
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useExportJob', () => {
  const mockOnCacheSummaryUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    vi.useFakeTimers();
  });

  afterEach(async () => {
    // unmount any stray renders (RTL normally does this, but we’re explicit)
    cleanup();
    await vi.runOnlyPendingTimersAsync();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with correct default state', () => {
      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      expect(result.current.currentJobId).toBeNull();
      expect(result.current.jobStatus).toBeNull();
      expect(result.current.isRunning).toBe(false);
      expect(result.current.exportLogs).toEqual([]);
      expect(result.current.isRefreshing).toBe(false);

      unmount();
    });

    it('should load last job from localStorage on mount', async () => {
      const mockJobId = 'test-job-123';
      const mockStatus = {
        jobId: mockJobId,
        jobType: 'export',
        status: 'completed' as const,
        progress: 100,
        message: 'Export completed',
        startTime: '2024-01-01T00:00:00Z',
      };

      localStorageMock.getItem.mockReturnValue(mockJobId);
      vi.mocked(exportApi.getJobStatus).mockResolvedValue(mockStatus);
      vi.mocked(exportApi.getJobLogs).mockResolvedValue({ jobId: mockJobId, logs: [] });

      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      await flush();

      expect(result.current).toBeDefined();
      expect(localStorageMock.getItem).toHaveBeenCalledWith('lastExportJobId');

      unmount();
    });
  });

  describe('startExport', () => {
    it('should start export job successfully', async () => {
      const mockJobId = 'new-job-456';
      const mockResult = { jobId: mockJobId, status: 'queued' as const, message: 'Export job queued' };

      vi.mocked(exportApi.warmUp).mockResolvedValue(true);
      vi.mocked(exportApi.startExportJob).mockResolvedValue(mockResult);

      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      await act(async () => {
        await result.current.startExport(['dashboards', 'datasets'], 'smart');
      });
      await flush();

      expect(exportApi.warmUp).toHaveBeenCalled();
      expect(exportApi.startExportJob).toHaveBeenCalledWith({
        forceRefresh: false,
        rebuildIndex: false,
        assetTypes: ['dashboard', 'dataset'],
        refreshOptions: {
          definitions: true,
          permissions: true,
          tags: true,
        },
      });

      expect(result.current.currentJobId).toBe(mockJobId);
      expect(result.current.jobStatus).toEqual({
        status: 'queued',
        progress: 0,
        message: 'Export job queued...',
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('lastExportJobId', mockJobId);

      unmount();
    });

    it('should convert asset types correctly', async () => {
      const mockResult = { jobId: 'test-job', status: 'queued' as const, message: 'Export job queued' };
      vi.mocked(exportApi.warmUp).mockResolvedValue(true);
      vi.mocked(exportApi.startExportJob).mockResolvedValue(mockResult);

      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      await act(async () => {
        await result.current.startExport(
          ['dashboards', 'datasets', 'analyses', 'datasources', 'folders', 'groups', 'users', 'themes'],
          'smart'
        );
      });
      await flush();

      expect(exportApi.startExportJob).toHaveBeenCalledWith({
        forceRefresh: false,
        rebuildIndex: false,
        assetTypes: ['dashboard', 'dataset', 'analysis', 'datasource', 'folder', 'group', 'user', 'theme'],
        refreshOptions: {
          definitions: true,
          permissions: true,
          tags: true,
        },
      });

      unmount();
    });

    it('should handle force refresh mode', async () => {
      const mockResult = { jobId: 'test-job', status: 'queued' as const, message: 'Export job queued' };
      vi.mocked(exportApi.warmUp).mockResolvedValue(true);
      vi.mocked(exportApi.startExportJob).mockResolvedValue(mockResult);

      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      await act(async () => {
        await result.current.startExport(['dashboards'], 'force');
      });
      await flush();

      expect(exportApi.startExportJob).toHaveBeenCalledWith({
        forceRefresh: true,
        rebuildIndex: false,
        assetTypes: ['dashboard'],
      });

      unmount();
    });

    it('should handle permissions-only refresh mode correctly', async () => {
      const mockJobId = 'permissions-job-123';
      const mockResult = { jobId: mockJobId, status: 'queued' as const, message: 'Export job queued' };

      vi.mocked(exportApi.warmUp).mockResolvedValue(true);
      vi.mocked(exportApi.startExportJob).mockResolvedValue(mockResult);

      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      await act(async () => {
        await result.current.startExport(['dashboards', 'datasets'], 'permissions');
      });
      await flush();

      expect(exportApi.startExportJob).toHaveBeenCalledWith({
        forceRefresh: false,
        rebuildIndex: false,
        assetTypes: ['dashboard', 'dataset'],
        refreshOptions: {
          definitions: false,
          permissions: true,
          tags: false,
        },
      });

      expect(result.current.currentJobId).toBe(mockJobId);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('lastExportJobId', mockJobId);

      unmount();
    });

    it('should handle tags-only refresh mode correctly', async () => {
      const mockJobId = 'tags-job-456';
      const mockResult = { jobId: mockJobId, status: 'queued' as const, message: 'Export job queued' };

      vi.mocked(exportApi.warmUp).mockResolvedValue(true);
      vi.mocked(exportApi.startExportJob).mockResolvedValue(mockResult);

      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      await act(async () => {
        await result.current.startExport(['analyses', 'datasources'], 'tags');
      });
      await flush();

      expect(exportApi.startExportJob).toHaveBeenCalledWith({
        forceRefresh: false,
        rebuildIndex: false,
        assetTypes: ['analysis', 'datasource'],
        refreshOptions: {
          definitions: false,
          permissions: false,
          tags: true,
        },
      });

      expect(result.current.currentJobId).toBe(mockJobId);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('lastExportJobId', mockJobId);

      unmount();
    });

    it('should handle rebuild mode correctly', async () => {
      const mockResult = { jobId: 'test-job', status: 'queued' as const, message: 'Export job queued' };
      vi.mocked(exportApi.warmUp).mockResolvedValue(true);
      vi.mocked(exportApi.startExportJob).mockResolvedValue(mockResult);

      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      await act(async () => {
        await result.current.startExport(['dashboards'], 'rebuild');
      });
      await flush();

      expect(exportApi.startExportJob).toHaveBeenCalledWith({
        forceRefresh: false,
        rebuildIndex: true,
        assetTypes: undefined, // No asset types for rebuild
      });

      unmount();
    });

    it('should not start export if already running', async () => {
      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      vi.mocked(exportApi.warmUp).mockResolvedValue(true);
      vi.mocked(exportApi.startExportJob).mockResolvedValue({ jobId: 'job1', status: 'queued', message: 'Queued' });

      await act(async () => {
        await result.current.startExport(['dashboards'], 'smart');
      });
      await flush();

      // Clear the mocks and try to start another job
      vi.clearAllMocks();

      await act(async () => {
        await result.current.startExport(['datasets'], 'smart');
      });
      await flush();

      // Second call should not trigger API calls since job is running
      expect(exportApi.warmUp).not.toHaveBeenCalled();
      expect(exportApi.startExportJob).not.toHaveBeenCalled();

      unmount();
    });
  });

  describe('stopExport', () => {
    it('should stop running export job', async () => {
      vi.mocked(exportApi.stopJob).mockResolvedValue({ success: true, message: 'Job stopped' });

      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      // First start a job
      vi.mocked(exportApi.warmUp).mockResolvedValue(true);
      vi.mocked(exportApi.startExportJob).mockResolvedValue({ jobId: 'test-job', status: 'queued', message: 'Queued' });

      await act(async () => {
        await result.current.startExport(['dashboards'], 'smart');
      });
      await flush();

      // Then stop it
      await act(async () => {
        await result.current.stopExport();
      });
      await flush();

      expect(exportApi.stopJob).toHaveBeenCalledWith('test-job');
      expect(result.current.jobStatus?.status).toBe('stopping');

      unmount();
    });

    it('should not stop if no job is running', async () => {
      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      await act(async () => {
        await result.current.stopExport();
      });

      expect(exportApi.stopJob).not.toHaveBeenCalled();

      unmount();
    });
  });

  describe('job status polling', () => {
    it('should poll job status when running', async () => {
      const mockJobId = 'polling-job';
      const mockStatus = {
        jobId: mockJobId,
        jobType: 'export',
        status: 'processing' as const,
        progress: 50,
        message: 'Processing assets...',
        startTime: '2024-01-01T00:00:00Z',
      };

      vi.mocked(exportApi.warmUp).mockResolvedValue(true);
      vi.mocked(exportApi.startExportJob).mockResolvedValue({ jobId: mockJobId, status: 'queued', message: 'Queued' });
      vi.mocked(exportApi.getJobStatus).mockResolvedValue(mockStatus);
      vi.mocked(exportApi.getJobLogs).mockResolvedValue({ jobId: mockJobId, logs: [] });

      const { result, unmount } = renderHook(() => useExportJob(vi.fn()));

      // start the job (state update #1)
      await act(async () => {
        await result.current.startExport(['dashboards'], 'smart');
      });

      // let the effect that installs setInterval run
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // drive at least one polling tick inside act
      // (if your hook uses, say, POLL_MS = 1000, advance by that amount)
      await act(async () => {
        await vi.advanceTimersToNextTimerAsync();
      });

      expect(result.current.isRunning).toBe(true);
      expect(result.current.currentJobId).toBe(mockJobId);

      // IMPORTANT: unmount before the test ends so cleanup clears the interval
      unmount();

      // flush any straggler timers after unmount (still inside the test)
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
    });

    it('should handle job completion and update cache summary', async () => {
      const mockJobId = 'completed-job';

      vi.mocked(exportApi.warmUp).mockResolvedValue(true);
      vi.mocked(exportApi.startExportJob).mockResolvedValue({ jobId: mockJobId, status: 'queued', message: 'Queued' });

      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      await act(async () => {
        await result.current.startExport(['dashboards'], 'smart');
      });
      await flush();

      expect(result.current.isRunning).toBe(true);
      expect(result.current.currentJobId).toBe(mockJobId);

      // Simulate completion via historical load
      vi.mocked(exportApi.getJobStatus).mockResolvedValue({
        jobId: mockJobId,
        jobType: 'export',
        status: 'completed',
        progress: 100,
        message: 'Export completed successfully',
        startTime: '2024-01-01T00:00:00Z',
      });
      vi.mocked(exportApi.getJobLogs).mockResolvedValue({ jobId: mockJobId, logs: [] });

      await act(async () => {
        await result.current.loadHistoricalJob(mockJobId);
      });
      await flush();

      expect(result.current.isRunning).toBe(false);
      expect(result.current.jobStatus?.status).toBe('completed');

      unmount();
    });
  });

  describe('loadHistoricalJob', () => {
    it('should load historical job details', async () => {
      const mockJobId = 'historical-job';
      const mockStatus = {
        jobId: mockJobId,
        jobType: 'export',
        status: 'completed' as const,
        progress: 100,
        message: 'Historical job completed',
        startTime: '2024-01-01T00:00:00Z',
      };
      const mockLogs = [
        { timestamp: '2024-01-01T00:00:00Z', level: 'info' as const, message: 'Job started' },
      ];

      vi.mocked(exportApi.getJobStatus).mockResolvedValue(mockStatus);
      vi.mocked(exportApi.getJobLogs).mockResolvedValue({ jobId: mockJobId, logs: mockLogs });

      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      await act(async () => {
        await result.current.loadHistoricalJob(mockJobId);
      });

      expect(result.current.currentJobId).toBe(mockJobId);
      expect(result.current.jobStatus).toEqual({
        status: 'completed',
        progress: 100,
        message: 'Historical job completed',
        stats: undefined,
      });
      expect(result.current.exportLogs).toEqual(mockLogs);
      expect(result.current.isRunning).toBe(false);

      unmount();
    });
  });

  describe('refreshStatus', () => {
    it('should refresh job status manually', async () => {
      const mockJobId = 'refresh-job';
      const mockStatus = {
        jobId: mockJobId,
        jobType: 'export',
        status: 'processing' as const,
        progress: 75,
        message: 'Almost done...',
        startTime: '2024-01-01T00:00:00Z',
      };

      vi.mocked(exportApi.warmUp).mockResolvedValue(true);
      vi.mocked(exportApi.startExportJob).mockResolvedValue({ jobId: mockJobId, status: 'queued', message: 'Queued' });
      vi.mocked(exportApi.getJobStatus).mockResolvedValue(mockStatus);
      vi.mocked(exportApi.getJobLogs).mockResolvedValue({ jobId: mockJobId, logs: [] });

      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      await act(async () => {
        await result.current.startExport(['dashboards'], 'smart');
      });
      await flush();

      expect(result.current.currentJobId).toBe(mockJobId);

      // Clear mocks and set up refresh response
      vi.clearAllMocks();
      vi.mocked(exportApi.getJobStatus).mockResolvedValue({
        jobId: mockJobId,
        jobType: 'export',
        status: 'processing',
        progress: 90,
        message: 'Nearly finished...',
        startTime: '2024-01-01T00:00:00Z',
      });

      await act(async () => {
        await result.current.refreshStatus();
      });
      await flush();

      expect(result.current.isRefreshing).toBe(false);
      expect(exportApi.getJobStatus).toHaveBeenCalledWith(mockJobId);

      unmount();
    });

    it('should not refresh if no current job', async () => {
      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      await act(async () => {
        await result.current.refreshStatus();
      });

      expect(exportApi.getJobStatus).not.toHaveBeenCalled();

      unmount();
    });
  });

  describe('error handling', () => {
    it('should handle job not found errors', async () => {
      const mockJobId = 'missing-job';

      const notFoundError = { response: { status: 404 } };

      vi.mocked(exportApi.warmUp).mockResolvedValue(true);
      vi.mocked(exportApi.startExportJob).mockResolvedValue({ jobId: mockJobId, status: 'queued', message: 'Queued' });
      vi.mocked(exportApi.getJobStatus).mockResolvedValue({
        jobId: mockJobId,
        jobType: 'export',
        status: 'processing',
        progress: 50,
        message: 'Processing...',
        startTime: '2024-01-01T00:00:00Z',
      });
      vi.mocked(exportApi.getJobLogs).mockResolvedValue({ jobId: mockJobId, logs: [] });

      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      await act(async () => {
        await result.current.startExport(['dashboards'], 'smart');
      });

      expect(result.current.currentJobId).toBe(mockJobId);

      // Now simulate 404 error on refresh
      vi.mocked(exportApi.getJobStatus).mockRejectedValue(notFoundError);

      await act(async () => {
        await result.current.refreshStatus();
      });

      // Job should be cleared due to 404 error
      expect(result.current.currentJobId).toBeNull();
      expect(result.current.jobStatus).toBeNull();

      unmount();
    });

    it('should handle export start failures', async () => {
      const error = new Error('Network error');
      vi.mocked(exportApi.warmUp).mockRejectedValue(error);

      // Mock console.error to suppress expected error output
      const originalConsoleError = console.error;
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result, unmount } = renderHook(() => useExportJob(mockOnCacheSummaryUpdate));

      await act(async () => {
        await result.current.startExport(['dashboards'], 'smart');
      });

      expect(result.current.isRunning).toBe(false);
      
      // Verify the error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to start export:', error);
      
      // Restore console.error
      console.error = originalConsoleError;

      unmount();
    });
  });
});
