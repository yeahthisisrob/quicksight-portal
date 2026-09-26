import type { PaginatedListParams } from '@/shared/api/modules/assets';

export interface ColumnConfig {
  id: string;
  label: string;
  field?: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  flex?: number;
  sortable?: boolean;
  filterable?: boolean;
  hideable?: boolean;
  required?: boolean;
  visible?: boolean;
  align?: 'left' | 'center' | 'right';
  headerAlign?: 'left' | 'center' | 'right';
  type?: 'string' | 'number' | 'date' | 'dateTime' | 'boolean' | 'singleSelect' | 'actions';
  valueGetter?: (params: any) => any;
  valueFormatter?: (params: any) => string;
  renderCell?: (params: any) => React.ReactNode;
  renderHeader?: (params: any) => React.ReactNode;
  getActions?: (params: any) => any[];
  /** When set, this column appears as an option in the date filter dropdown. Value is the backend field name. */
  dateFilterField?: NonNullable<PaginatedListParams['dateField']>;
}
