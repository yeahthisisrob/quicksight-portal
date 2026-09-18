import { type ReactNode, useMemo } from 'react';

import { TABLE_CONFIG } from '../constants/table';
import { TableConfigContext, type TableConfigContextValue } from './TableConfigContext';

export interface TableConfigProviderProps {
  children: ReactNode;
  config?: Partial<TableConfigContextValue>;
}

/**
 * Provider for table configuration that can be used app-wide
 * This allows for consistent table behavior and user preferences
 */
export const TableConfigProvider = ({ children, config = {} }: TableConfigProviderProps) => {
  const value = useMemo(
    () => ({
      defaultDensity: config.defaultDensity ?? 'comfortable',
      defaultPageSize: config.defaultPageSize ?? TABLE_CONFIG.pagination.defaultPageSize,
      enableVirtualization: config.enableVirtualization ?? true,
      enableColumnReorder: config.enableColumnReorder ?? true,
      enableColumnResize: config.enableColumnResize ?? true,
      persistSettings: config.persistSettings ?? true,
    }),
    [config]
  );

  return <TableConfigContext.Provider value={value}>{children}</TableConfigContext.Provider>;
};
