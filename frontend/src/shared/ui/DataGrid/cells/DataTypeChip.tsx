import { Warning as WarningIcon } from '@mui/icons-material';
import { Box, Button, Chip, Tooltip, Typography } from '@mui/material';
import React from 'react';

export interface DataTypeVariant {
  dataType: string;
  count: number;
}

export interface DataTypeChipProps {
  /** Primary data type to display */
  dataType: string | null | undefined;
  /** Array of variants when field has different data types */
  variants?: DataTypeVariant[];
  /** Callback when variants button is clicked */
  onVariantsClick?: () => void;
  /** Whether to show as calculated field chip */
  isCalculated?: boolean;
  /** Number of expression variants for calculated fields */
  expressionVariantCount?: number;
}

/**
 * Reusable cell component for displaying data type information.
 * Supports single type, multiple type variants, and calculated field states.
 */
export const DataTypeChip: React.FC<DataTypeChipProps> = ({
  dataType,
  variants,
  onVariantsClick,
  isCalculated,
  expressionVariantCount,
}) => {
  // Get unique data types, excluding Unknown
  const uniqueDataTypes = variants
    ? [...new Set(variants.map((v) => v.dataType))].filter(
        (dt) => dt && dt !== 'Unknown'
      )
    : [];
  const hasRealVariants = uniqueDataTypes.length > 1;

  // Show variant button when multiple data types exist
  if (hasRealVariants && variants) {
    return (
      <Tooltip
        title={
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Data Type Variants ({variants.length}):
            </Typography>
            {variants.map((variant, idx) => (
              <Box key={idx} sx={{ mb: 0.5 }}>
                <Typography variant="caption">
                  {variant.dataType}: {variant.count} source
                  {variant.count > 1 ? 's' : ''}
                </Typography>
              </Box>
            ))}
          </Box>
        }
        arrow
      >
        <Button
          size="small"
          variant="outlined"
          color="warning"
          onClick={onVariantsClick}
          sx={{
            minWidth: 0,
            textTransform: 'none',
            fontSize: '0.75rem',
            py: 0.25,
            px: 1,
          }}
        >
          <WarningIcon sx={{ fontSize: 14, mr: 0.5 }} />
          {variants.length} types
        </Button>
      </Tooltip>
    );
  }

  // Show calculated field chip with expression variants
  if (isCalculated && expressionVariantCount && expressionVariantCount > 1) {
    return (
      <Tooltip
        title={`Calculated field with ${expressionVariantCount} different expressions`}
      >
        <Chip
          label="Calculated"
          size="small"
          variant="outlined"
          color="primary"
          icon={<WarningIcon sx={{ fontSize: 14 }} />}
        />
      </Tooltip>
    );
  }

  // Show simple data type chip
  if (!dataType || dataType === 'Unknown') {
    return null;
  }

  return <Chip label={dataType} size="small" variant="outlined" color="primary" />;
};

export default DataTypeChip;
