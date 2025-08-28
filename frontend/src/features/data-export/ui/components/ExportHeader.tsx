import { Refresh, CloudDownload, Analytics } from '@mui/icons-material';
import { Box, Typography, Button, Stack, alpha } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';

interface ExportHeaderProps {
  lastExportDate: string | null;
  onRefreshSummary: () => void;
  loading?: boolean;
}

export default function ExportHeader({ 
  lastExportDate, 
  onRefreshSummary,
  loading = false 
}: ExportHeaderProps) {

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: spacing.lg / 8,
        p: spacing.md / 8,
        borderRadius: `${spacing.sm / 8}px`,
        background: `linear-gradient(135deg, ${alpha(colors.primary.light, 0.03)} 0%, ${alpha(colors.primary.main, 0.03)} 100%)`,
        border: `1px solid ${alpha(colors.primary.main, 0.08)}`,
      }}
    >
      <Box>
        <Stack direction="row" alignItems="center" spacing={spacing.sm / 8}>
          <CloudDownload sx={{ fontSize: 32, color: colors.primary.main }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, color: colors.primary.main }}>
              Export Center
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Synchronize QuickSight assets with advanced controls
            </Typography>
          </Box>
        </Stack>
        
        {lastExportDate && (
          <Stack direction="row" alignItems="center" spacing={spacing.xs / 8} sx={{ mt: spacing.xs / 8 }}>
            <Analytics sx={{ fontSize: 14, color: colors.neutral[500] }} />
            <Typography variant="caption" color="text.secondary">
              Last sync: {new Date(lastExportDate).toLocaleString()}
            </Typography>
          </Stack>
        )}
      </Box>

      <Button
        variant="outlined"
        size="small"
        startIcon={<Refresh />}
        onClick={onRefreshSummary}
        disabled={loading}
        sx={{
          borderColor: alpha(colors.primary.main, 0.3),
          color: colors.primary.main,
          '&:hover': {
            borderColor: colors.primary.main,
            background: alpha(colors.primary.main, 0.05),
          },
        }}
      >
        Refresh Status
      </Button>
    </Box>
  );
}