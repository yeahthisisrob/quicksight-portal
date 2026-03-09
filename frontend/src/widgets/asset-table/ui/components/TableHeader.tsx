import { Box, Typography, alpha } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';

interface TableHeaderProps {
  title: string;
  subtitle: string;
  extraToolbarActions?: React.ReactNode;
}

export function TableHeader({
  title,
  subtitle,
  extraToolbarActions,
}: TableHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        mb: spacing.lg / 8,
        p: spacing.lg / 8,
        borderRadius: `${spacing.sm / 8}px`,
        background: `linear-gradient(135deg, ${alpha(colors.primary.light, 0.05)} 0%, ${alpha(colors.primary.main, 0.05)} 100%)`,
        backdropFilter: 'blur(10px)',
        border: `1px solid ${alpha(colors.primary.main, 0.1)}`,
      }}
    >
      <Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.primary.dark} 100%)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 0.5,
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: colors.neutral[600],
            fontWeight: 400,
          }}
        >
          {subtitle}
        </Typography>
      </Box>

      {extraToolbarActions && (
        <Box sx={{ display: 'flex', gap: spacing.sm / 8, alignItems: 'center' }}>
          {extraToolbarActions}
        </Box>
      )}
    </Box>
  );
}