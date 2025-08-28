import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import { semanticApi } from '@/shared/api';

export function useDataCatalogHandlers() {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const handleImportTerms = async () => {
    // TODO: Implement file upload dialog
    enqueueSnackbar('Import functionality coming soon', { variant: 'info' });
  };

  const handleExportTerms = async () => {
    try {
      const data = await semanticApi.exportTerms();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `semantic-terms-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      enqueueSnackbar('Terms exported successfully', { variant: 'success' });
    } catch (_error) {
      enqueueSnackbar('Failed to export terms', { variant: 'error' });
    }
  };

  const deleteTerm = async (termId: string) => {
    try {
      await semanticApi.deleteTerm(termId);
      queryClient.invalidateQueries({ queryKey: ['semantic-terms'] });
      queryClient.invalidateQueries({ queryKey: ['semantic-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['semantic-stats'] });
      enqueueSnackbar('Term deleted successfully', { variant: 'success' });
    } catch (_error) {
      enqueueSnackbar('Failed to delete term', { variant: 'error' });
    }
  };

  const deleteMapping = async (mappingId: string) => {
    if (!mappingId || mappingId === 'undefined') {
      enqueueSnackbar('Cannot delete mapping: missing ID', { variant: 'error' });
      return;
    }
    
    try {
      await semanticApi.deleteMapping(mappingId);
      queryClient.invalidateQueries({ queryKey: ['semantic-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['semantic-stats'] });
      queryClient.invalidateQueries({ queryKey: ['semantic-terms'] });
      enqueueSnackbar('Mapping deleted successfully', { variant: 'success' });
    } catch (_error) {
      enqueueSnackbar('Failed to delete mapping', { variant: 'error' });
    }
  };

  const invalidateCatalogQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['data-catalog-paginated'] });
  };

  const invalidateSemanticQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['semantic-terms'] });
    queryClient.invalidateQueries({ queryKey: ['semantic-mappings'] });
    queryClient.invalidateQueries({ queryKey: ['semantic-stats'] });
  };

  return {
    handleImportTerms,
    handleExportTerms,
    deleteTerm,
    deleteMapping,
    invalidateCatalogQueries,
    invalidateSemanticQueries,
  };
}