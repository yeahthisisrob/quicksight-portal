import { Box, Paper } from '@mui/material';
import { ReactNode } from 'react';

import { useAvailableHeight } from '../hooks/useAvailableHeight';
import { useTableStyles, TableStyleOptions } from '../hooks/useTableStyles';

export interface TableContainerProps extends TableStyleOptions {
  children: ReactNode;
  className?: string;
  searchBar?: ReactNode;
  useMaxHeight?: boolean; // Use dynamic height calculation
  bottomOffset?: number; // Pixels to leave at bottom
}

/**
 * Reusable table container component that applies consistent design system styles
 */
export const TableContainer = ({
  children,
  className,
  searchBar,
  useMaxHeight = false,
  bottomOffset = 20,
  ...styleOptions
}: TableContainerProps) => {
  const styles = useTableStyles(styleOptions);
  const { containerRef, availableHeight } = useAvailableHeight(bottomOffset);

  const containerStyles = useMaxHeight 
    ? {
        ...styles.container,
        height: availableHeight,
        maxHeight: availableHeight,
      }
    : styles.container;

  return (
    <Paper 
      ref={useMaxHeight ? containerRef : undefined}
      className={className} 
      sx={containerStyles}
    >
      {searchBar}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {children}
      </Box>
    </Paper>
  );
};