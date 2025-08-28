import { Box, Button, alpha } from '@mui/material';
import { utils, writeFile } from 'xlsx';

import { colors, spacing } from '@/shared/design-system/theme';
import { actionIcons } from '@/shared/ui/icons';

import { createCalculatedColumns } from '../columns/calculatedColumns';
import { CatalogDataGrid } from '../components';

interface CalculatedViewProps {
  data: any[];
  loading: boolean;
  totalItems: number;
  page: number;
  pageSize: number;
  sortModel: any[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortModelChange: (model: any[]) => void;
  onShowExpression: (field: any) => void;
  onShowDetails: (field: any) => void;
  onShowVariants: (field: any) => void;
}

export default function CalculatedView({
  data,
  loading,
  totalItems,
  page,
  pageSize,
  sortModel,
  onPageChange,
  onPageSizeChange,
  onSortModelChange,
  onShowExpression,
  onShowDetails,
  onShowVariants,
}: CalculatedViewProps) {
  const ExportIcon = actionIcons.download;
  
  const columns = createCalculatedColumns({
    onShowExpression,
    onShowDetails,
    onShowVariants,
  });

  const handleExportCSV = () => {
    // Prepare data for export
    const exportData = data.map(field => ({
      'Field Name': field.fieldName,
      'Expression': field.expression || '',
      'Usage Count': field.usageCount || 0,
      'Datasets': field.sources?.filter((s: any) => s.assetType === 'dataset').length || 0,
      'Analyses': field.sources?.filter((s: any) => s.assetType === 'analysis').length || 0,
      'Dashboards': field.sources?.filter((s: any) => s.assetType === 'dashboard').length || 0,
      'Has Variants': field.hasVariants ? 'Yes' : 'No',
      'Variant Count': field.expressions?.length || 1,
      'Dependencies': field.fieldReferences?.join(', ') || 'None',
    }));

    // Create worksheet
    const ws = utils.json_to_sheet(exportData);
    
    // Create workbook
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Calculated Fields');
    
    // Save file
    const fileName = `calculated-fields-${new Date().toISOString().split('T')[0]}.csv`;
    writeFile(wb, fileName, { bookType: 'csv' });
  };

  return (
    <Box>
      <Box sx={{ mb: spacing.md / 8, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<ExportIcon />}
          onClick={handleExportCSV}
          disabled={data.length === 0}
          sx={{
            borderColor: colors.neutral[200],
            color: colors.neutral[700],
            fontWeight: 500,
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: colors.primary.main,
              backgroundColor: alpha(colors.primary.main, 0.08),
              transform: 'translateY(-1px)',
              boxShadow: `0 2px 8px ${alpha(colors.primary.main, 0.15)}`,
            },
            '&.Mui-disabled': {
              borderColor: colors.neutral[200],
              color: colors.neutral[400],
            },
          }}
        >
          Export CSV
        </Button>
      </Box>
      
      <CatalogDataGrid
        data={data}
        columns={columns}
        loading={loading}
        totalRows={totalItems}
        page={page}
        pageSize={pageSize}
        sortModel={sortModel}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onSortModelChange={onSortModelChange}
        pageSizeOptions={[25, 50, 100]}
        showToolbar={true}
      />
    </Box>
  );
}