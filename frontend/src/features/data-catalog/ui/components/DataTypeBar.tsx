/**
 * DataTypeBar component for displaying data type distribution
 */
import { Box, Typography, LinearProgress, alpha } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';

interface DataTypeBarProps {
  dataType: string;
  count: number;
  total: number;
  color: string;
}

export function DataTypeBar({ dataType, count, total, color }: DataTypeBarProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <Box sx={{ mb: spacing.md / 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: spacing.xs / 8 }}>
        <Typography 
          variant="caption" 
          sx={{ 
            fontWeight: 600,
            color: colors.neutral[700],
          }}
        >
          {dataType}
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            color: colors.neutral[500],
            fontWeight: 500,
          }}
        >
          {count} ({percentage.toFixed(1)}%)
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 8,
          borderRadius: spacing.xs / 16,
          backgroundColor: alpha(color, 0.15),
          '& .MuiLinearProgress-bar': {
            backgroundColor: color,
            borderRadius: spacing.xs / 16,
            background: `linear-gradient(90deg, ${color} 0%, ${alpha(color, 0.8)} 100%)`,
          },
        }}
      />
    </Box>
  );
}