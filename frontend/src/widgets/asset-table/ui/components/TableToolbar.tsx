import { Button, CircularProgress, alpha } from '@mui/material';
import {
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarDensitySelector,
} from '@mui/x-data-grid';

import { colors, spacing } from '@/shared/design-system/theme';
import { actionIcons } from '@/shared/ui/icons';

const DownloadIcon = actionIcons.download;

interface TableToolbarProps {
  onExportCSV?: () => Promise<void>;
  exportLabel: string;
  exporting: boolean;
}

export function TableToolbar({ onExportCSV, exportLabel, exporting }: TableToolbarProps) {
  return (
    <GridToolbarContainer
      sx={{
        p: spacing.sm / 8,
        borderBottom: `1px solid ${colors.neutral[200]}`,
        gap: spacing.sm / 8,
      }}
    >
      <GridToolbarColumnsButton
        sx={{
          color: colors.neutral[700],
          '&:hover': {
            bgcolor: alpha(colors.primary.main, 0.08),
            color: colors.primary.main,
          },
        }}
      />
      <GridToolbarDensitySelector
        sx={{
          color: colors.neutral[700],
          '&:hover': {
            bgcolor: alpha(colors.primary.main, 0.08),
            color: colors.primary.main,
          },
        }}
      />
      
      {onExportCSV && (
        <Button
          onClick={onExportCSV}
          size="small"
          disabled={exporting}
          variant="outlined"
          sx={{
            ml: 'auto',
            textTransform: 'none',
            borderColor: colors.neutral[300],
            color: colors.neutral[700],
            borderRadius: `${spacing.sm / 8}px`,
            '&:hover': {
              borderColor: colors.primary.main,
              bgcolor: alpha(colors.primary.main, 0.08),
              color: colors.primary.main,
            },
            '&.Mui-disabled': {
              borderColor: colors.neutral[200],
              color: colors.neutral[400],
            },
          }}
          startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
        >
          {exportLabel}
        </Button>
      )}
    </GridToolbarContainer>
  );
}