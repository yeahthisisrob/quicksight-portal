import { Tooltip, Typography, TypographyProps } from '@mui/material';
import React from 'react';

export interface CountCellProps {
  /** The numeric value to display */
  value: number;
  /** Optional tooltip content shown on hover */
  tooltipContent?: React.ReactNode;
  /** Whether the count is clickable */
  onClick?: () => void;
  /** Custom typography props */
  typographyProps?: Omit<TypographyProps, 'onClick'>;
}

/**
 * Reusable cell component for displaying numeric counts in DataGrid.
 * Shows enabled styling when count > 0, disabled styling otherwise.
 */
export const CountCell: React.FC<CountCellProps> = ({
  value,
  tooltipContent,
  onClick,
  typographyProps,
}) => {
  const content = (
    <Typography
      variant="body2"
      fontWeight={value > 0 ? 'medium' : 'normal'}
      color={value > 0 ? 'text.primary' : 'text.disabled'}
      sx={{
        cursor: tooltipContent ? 'help' : onClick ? 'pointer' : 'default',
        ...(onClick && {
          '&:hover': { textDecoration: 'underline' },
        }),
      }}
      onClick={onClick}
      {...typographyProps}
    >
      {value}
    </Typography>
  );

  if (tooltipContent) {
    return (
      <Tooltip title={tooltipContent} arrow>
        {content}
      </Tooltip>
    );
  }

  return content;
};

export default CountCell;
