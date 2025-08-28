import { Box, Typography, IconButton, Tooltip, CircularProgress, alpha } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';
import { actionIcons } from '@/shared/ui/icons';

const RefreshIcon = actionIcons.refresh;
const TagIcon = actionIcons.tag;

interface TableHeaderProps {
  title: string;
  subtitle: string;
  onRefreshAssets: () => Promise<void>;
  onRefreshTags?: () => Promise<void>;
  refreshing: boolean;
  refreshingTags: boolean;
  extraToolbarActions?: React.ReactNode;
}

export function TableHeader({
  title,
  subtitle,
  onRefreshAssets,
  onRefreshTags,
  refreshing,
  refreshingTags,
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
      
      <Box sx={{ display: 'flex', gap: spacing.sm / 8, alignItems: 'center' }}>
        {extraToolbarActions}
        
        {onRefreshTags && (
          <Tooltip title="Refresh Tags" arrow placement="top">
            <IconButton
              onClick={onRefreshTags}
              disabled={refreshingTags}
              sx={{
                bgcolor: alpha(colors.status.info, 0.08),
                border: `1px solid ${alpha(colors.status.info, 0.2)}`,
                color: colors.status.info,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: alpha(colors.status.info, 0.15),
                  borderColor: colors.status.info,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 4px 12px ${alpha(colors.status.info, 0.2)}`,
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
                '&.Mui-disabled': {
                  bgcolor: colors.neutral[100],
                  borderColor: colors.neutral[200],
                },
              }}
            >
              {refreshingTags ? <CircularProgress size={20} /> : <TagIcon />}
            </IconButton>
          </Tooltip>
        )}
        
        <Tooltip title="Refresh" arrow placement="top">
          <IconButton
            onClick={onRefreshAssets}
            disabled={refreshing}
            sx={{
              bgcolor: alpha(colors.primary.main, 0.08),
              border: `1px solid ${alpha(colors.primary.main, 0.2)}`,
              color: colors.primary.main,
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: alpha(colors.primary.main, 0.15),
                borderColor: colors.primary.main,
                transform: 'translateY(-2px)',
                boxShadow: `0 4px 12px ${alpha(colors.primary.main, 0.2)}`,
                '& svg': {
                  transform: 'rotate(180deg)',
                },
              },
              '&:active': {
                transform: 'translateY(0)',
              },
              '&.Mui-disabled': {
                bgcolor: colors.neutral[100],
                borderColor: colors.neutral[200],
              },
              '& svg': {
                transition: 'transform 0.3s ease',
              },
            }}
          >
            {refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}