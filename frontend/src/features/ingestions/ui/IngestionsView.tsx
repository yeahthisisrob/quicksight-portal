import { Box, Alert } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState, useEffect, useCallback } from 'react';

import { ingestionsApi } from '@/shared/api';
import { PageHeader } from '@/shared/ui';

import { IngestionsTable } from './IngestionsTable';

import type { components } from '@shared/generated/types';

type IngestionListData = components['schemas']['IngestionListResponse']['data'];

export default function IngestionsView() {
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState<IngestionListData | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState('createdTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const loadIngestions = useCallback(async () => {
    try {
      setLoading(true);
      const result = await ingestionsApi.list({
        page,
        pageSize,
        search,
        sortBy,
        sortOrder,
      });
      setData(result);
    } catch (error) {
      enqueueSnackbar('Failed to load ingestions', { variant: 'error' });
      console.error('Failed to load ingestions:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, sortBy, sortOrder, enqueueSnackbar]);

  useEffect(() => {
    loadIngestions();
  }, [loadIngestions, refreshKey]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when changing page size
  };

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1); // Reset to first page when sorting changes
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPage(1); // Reset to first page when searching
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleCancelIngestion = async (datasetId: string, ingestionId: string) => {
    try {
      await ingestionsApi.cancel(datasetId, ingestionId);
      enqueueSnackbar('Ingestion cancelled successfully', { variant: 'success' });
      handleRefresh(); // Refresh the list
    } catch (error) {
      enqueueSnackbar('Failed to cancel ingestion', { variant: 'error' });
      console.error('Failed to cancel ingestion:', error);
    }
  };

  const handleViewDetails = async (datasetId: string, ingestionId: string) => {
    try {
      const details = await ingestionsApi.getDetails(datasetId, ingestionId);
      // For now, just show the status in a snackbar
      // In a real implementation, you might open a modal or navigate to a details page
      enqueueSnackbar(
        `Ingestion ${ingestionId}: ${details.status}${details.errorMessage ? ` - ${details.errorMessage}` : ''}`,
        { variant: 'info' }
      );
    } catch (error) {
      enqueueSnackbar('Failed to load ingestion details', { variant: 'error' });
      console.error('Failed to load ingestion details:', error);
    }
  };

  return (
    <Box>
      <PageHeader title="Ingestions" />

      {/* Show a message if no data is cached yet */}
      {!loading && data?.ingestions?.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No ingestions found. Run an ingestion export from the Export page to populate this data.
        </Alert>
      )}

      {/* Ingestions Table */}
      <IngestionsTable
        ingestions={data?.ingestions || []}
        metadata={data?.metadata || {
          totalIngestions: 0,
          runningIngestions: 0,
          failedIngestions: 0,
          lastUpdated: new Date().toISOString()
        }}
        pagination={data?.pagination || {
          page: 1,
          pageSize: 50,
          totalItems: 0,
          totalPages: 0,
          hasMore: false
        } as { page: number; pageSize: number; totalItems: number; totalPages: number; hasMore: boolean }}
        loading={loading}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onSortChange={handleSortChange}
        onSearchChange={handleSearchChange}
        onRefresh={handleRefresh}
        onCancelIngestion={handleCancelIngestion}
        onViewDetails={handleViewDetails}
        sortBy={sortBy}
        sortOrder={sortOrder}
        searchValue={search}
      />
    </Box>
  );
}