import {
  Calculate as CalculateIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { Box, Tooltip, Typography, TypographyProps } from '@mui/material';
import React from 'react';

export interface FieldNameCellProps {
  /** The field name to display */
  name: string;
  /** Whether this is a calculated field */
  isCalculated?: boolean;
  /** Whether this field has variants (different expressions or data types) */
  hasVariants?: boolean;
  /** Custom tooltip for the calculated icon */
  calculatedTooltip?: string;
  /** Custom tooltip for the variants warning icon */
  variantsTooltip?: string;
  /** Callback when the field name is clicked */
  onClick?: () => void;
  /** Custom typography props */
  typographyProps?: Omit<TypographyProps, 'onClick'>;
}

/**
 * Reusable cell component for displaying field names with optional icons.
 * Shows calculated icon for calculated fields and warning icon for variants.
 */
export const FieldNameCell: React.FC<FieldNameCellProps> = ({
  name,
  isCalculated,
  hasVariants,
  calculatedTooltip = 'Calculated field',
  variantsTooltip = 'This field has different expressions across assets',
  onClick,
  typographyProps,
}) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {isCalculated && (
        <Tooltip title={calculatedTooltip}>
          <CalculateIcon fontSize="small" color="primary" />
        </Tooltip>
      )}
      {hasVariants && (
        <Tooltip title={variantsTooltip}>
          <WarningIcon fontSize="small" color="warning" />
        </Tooltip>
      )}
      <Typography
        variant="body2"
        sx={{
          cursor: onClick ? 'pointer' : 'default',
          ...(onClick && {
            '&:hover': { textDecoration: 'underline' },
          }),
        }}
        onClick={onClick}
        {...typographyProps}
      >
        {name}
      </Typography>
    </Box>
  );
};

export default FieldNameCell;
