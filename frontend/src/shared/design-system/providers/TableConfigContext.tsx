import { createContext, useContext } from 'react';

import { TABLE_CONFIG, TableDensity } from '../constants/table';

export interface TableConfigContextValue {
  defaultDensity: TableDensity;
  defaultPageSize: number;
  enableVirtualization: boolean;
  enableColumnReorder: boolean;
  enableColumnResize: boolean;
  persistSettings: boolean;
}

export const TableConfigContext = createContext<TableConfigContextValue>({
  defaultDensity: 'comfortable',
  defaultPageSize: TABLE_CONFIG.pagination.defaultPageSize,
  enableVirtualization: true,
  enableColumnReorder: true,
  enableColumnResize: true,
  persistSettings: true,
});

/**
 * Hook to access table configuration
 */
export const useTableConfig = () => {
  const context = useContext(TableConfigContext);
  if (!context) {
    throw new Error('useTableConfig must be used within a TableConfigProvider');
  }
  return context;
};