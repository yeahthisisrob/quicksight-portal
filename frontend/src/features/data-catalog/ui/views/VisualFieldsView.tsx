import { createVisualFieldColumns } from '../columns/visualFieldColumns';
import { CatalogDataGrid } from '../components';

interface VisualFieldsViewProps {
  data: any[];
  loading: boolean;
  totalItems: number;
  page: number;
  pageSize: number;
  sortModel: any[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortModelChange: (model: any[]) => void;
  onShowDetails: (field: any) => void;
}

export default function VisualFieldsView({
  data,
  loading,
  totalItems,
  page,
  pageSize,
  sortModel,
  onPageChange,
  onPageSizeChange,
  onSortModelChange,
  onShowDetails,
}: VisualFieldsViewProps) {
  const columns = createVisualFieldColumns({
    onShowDetails,
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