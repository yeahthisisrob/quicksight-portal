import { createPhysicalColumns } from '../columns/physicalColumns';
import { CatalogDataGrid } from '../components';

interface PhysicalViewProps {
  data: any[];
  terms: any[];
  mappings: any[];
  loading: boolean;
  totalItems: number;
  page: number;
  pageSize: number;
  sortModel: any[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortModelChange: (model: any[]) => void;
  onMapField: (field: any) => void;
  onShowDetails: (field: any) => void;
  onShowVariants: (field: any) => void;
  onShowAssets: (field: any, assetType: string, assets: any[]) => void;
}

export default function PhysicalView({
  data,
  terms,
  mappings: _mappings,
  loading,
  totalItems,
  page,
  pageSize,
  sortModel,
  onPageChange,
  onPageSizeChange,
  onSortModelChange,
  onMapField,
  onShowDetails,
  onShowVariants,
  onShowAssets: _onShowAssets,
}: PhysicalViewProps) {
  const columns = createPhysicalColumns({
    terms,
    onMapField,
    onShowDetails,
    onShowVariants,
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
      disableColumnFilter={false}
      disableColumnSelector={false}
      disableDensitySelector={false}
    />
  );
}