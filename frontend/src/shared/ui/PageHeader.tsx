import { Box, Chip, Typography } from '@mui/material';

import { spacing } from '@/shared/design-system/theme';

interface PageHeaderProps {
  title: string;
  totalRows?: number;
  extraActions?: React.ReactNode;
}

export function PageHeader({
  title,
  totalRows,
  extraActions,
}: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: spacing.sm / 8,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          {title}
        </Typography>
        {totalRows !== undefined && (
          <Chip
            label={totalRows.toLocaleString()}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 500, fontSize: '0.75rem' }}
          />
        )}
      </Box>

      {extraActions && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {extraActions}
        </Box>
      )}
    </Box>
  );
}

export default PageHeader;
