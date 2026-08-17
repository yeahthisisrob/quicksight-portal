import { createMappingColumns } from '../columns/mappingColumns';
import { CatalogDataGrid } from '../components';

import type { GridSortModel } from '@mui/x-data-grid';

interface MappingViewProps {
  data: any[];
  loading: boolean;
  totalItems: number;
  page: number;
  pageSize: number;
  sortModel: GridSortModel;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortModelChange: (model: GridSortModel) => void;
  onEditMapping: (mapping: any) => void;
  onDeleteMapping: (mapping: any) => void;
}

export default function MappingView({
  data,
  loading,
  totalItems,
  page,
  pageSize,
  sortModel,
  onPageChange,
  onPageSizeChange,
  onSortModelChange,
  onEditMapping,
  onDeleteMapping,
}: MappingViewProps) {
  const columns = createMappingColumns({
    onEditMapping,
    onDeleteMapping,
  });

  return (
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
  );
}