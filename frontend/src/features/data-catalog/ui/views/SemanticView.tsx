import { createSemanticColumns } from '../columns/semanticColumns';
import { CatalogDataGrid } from '../components';

import type { GridSortModel } from '@mui/x-data-grid';

interface SemanticViewProps {
  data: any[];
  visualFieldCatalog: any;
  loading: boolean;
  page: number;
  pageSize: number;
  sortModel: GridSortModel;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortModelChange: (model: GridSortModel) => void;
  onEditTerm: (term: any) => void;
  onDeleteTerm: (term: any) => void;
  onShowMappedFields: (term: any) => void;
}

export default function SemanticView({
  data,
  visualFieldCatalog,
  loading,
  page,
  pageSize,
  sortModel,
  onPageChange,
  onPageSizeChange,
  onSortModelChange,
  onEditTerm,
  onDeleteTerm,
  onShowMappedFields,
}: SemanticViewProps) {
  const columns = createSemanticColumns({
    visualFieldCatalog,
    onEditTerm,
    onDeleteTerm,
    onShowMappedFields,
  });

  return (
    <CatalogDataGrid
      data={data}
      columns={columns}
      loading={loading}
      totalRows={data.length}
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