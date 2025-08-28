import {
  Box,
  Button,
  Chip,
  Stack,
  Fade,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';
import { assetIcons, actionIcons } from '@/shared/ui/icons';

const FolderIcon = assetIcons.folder;
const TagIcon = actionIcons.tag;
const CloseIcon = actionIcons.close;
const DeleteIcon = actionIcons.delete;

interface BulkActionsToolbarProps {
  selectedCount: number;
  onAddToFolder?: () => void;
  onBulkTag: () => void;
  onBulkDelete?: () => void;
  onClearSelection: () => void;
  customActions?: Array<{ label: string; icon: React.ReactNode; onClick: () => void }>;
  folderActionLabel?: string;
  showDeleteAction?: boolean;
}

export default function BulkActionsToolbar({
  selectedCount,
  onAddToFolder,
  onBulkTag,
  onBulkDelete,
  onClearSelection,
  customActions,
  folderActionLabel = 'Add to Folder',
  showDeleteAction = false,
}: BulkActionsToolbarProps) {
  const theme = useTheme();
  
  const buttonStyles = {
    bgcolor: alpha(theme.palette.common.white, 0.15),
    color: 'white',
    border: `1px solid ${alpha(theme.palette.common.white, 0.2)}`,
    backdropFilter: 'blur(10px)',
    borderRadius: spacing.sm / 8,
    transition: 'all 0.2s ease',
    textTransform: 'none',
    fontWeight: 500,
    '&:hover': {
      bgcolor: alpha(theme.palette.common.white, 0.25),
      transform: 'translateY(-1px)',
      boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.15)}`,
    },
    '&:active': {
      transform: 'translateY(0)',
    },
  };
  
  return (
    <Fade in={selectedCount > 0}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: `linear-gradient(135deg, ${colors.assetTypes.dashboard.main} 0%, ${colors.assetTypes.analysis.main} 100%)`,
          color: 'white',
          p: spacing.md / 8,
          borderRadius: spacing.sm / 8,
          mb: spacing.md / 8,
          boxShadow: theme.shadows[4],
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: theme.shadows[8],
            transform: 'translateY(-1px)',
          },
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Chip
            label={`${selectedCount} selected`}
            sx={{ 
              bgcolor: alpha(theme.palette.common.white, 0.2),
              color: 'white',
              fontWeight: 600,
              border: `1px solid ${alpha(theme.palette.common.white, 0.3)}`,
              backdropFilter: 'blur(10px)',
              '& .MuiChip-label': {
                px: spacing.md / 8,
              },
            }}
          />
          
          {customActions ? (
            // Use custom actions if provided
            customActions.map((action, index) => (
              <Button
                key={index}
                variant="contained"
                startIcon={action.icon}
                onClick={action.onClick}
                sx={buttonStyles}
              >
                {action.label}
              </Button>
            ))
          ) : (
            // Default actions
            <>
              {onAddToFolder && (
                <Button
                  variant="contained"
                  startIcon={<FolderIcon />}
                  onClick={onAddToFolder}
                  sx={buttonStyles}
                >
                  {folderActionLabel}
                </Button>
              )}
              
              <Button
                variant="contained"
                startIcon={<TagIcon />}
                onClick={onBulkTag}
                sx={buttonStyles}
              >
                Bulk Tag
              </Button>

              {showDeleteAction && onBulkDelete && (
                <Button
                  variant="contained"
                  startIcon={<DeleteIcon />}
                  onClick={onBulkDelete}
                  sx={{
                    ...buttonStyles,
                    bgcolor: alpha(theme.palette.error.main, 0.15),
                    color: theme.palette.error.contrastText,
                    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.error.main, 0.25),
                      transform: 'translateY(-1px)',
                      boxShadow: `0 4px 12px ${alpha(theme.palette.error.main, 0.25)}`,
                    },
                  }}
                >
                  Delete Selected
                </Button>
              )}
            </>
          )}
          
          <Box sx={{ flexGrow: 1 }} />
          
          <Tooltip title="Clear selection">
            <IconButton
              onClick={onClearSelection}
              sx={{ 
                color: 'white',
                bgcolor: alpha(theme.palette.common.white, 0.1),
                border: `1px solid ${alpha(theme.palette.common.white, 0.2)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: alpha(theme.palette.common.white, 0.2),
                  transform: 'rotate(90deg)',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Fade>
  );
}