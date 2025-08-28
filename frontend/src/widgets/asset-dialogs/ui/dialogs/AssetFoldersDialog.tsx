import {
  Close as CloseIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Chip,
  Paper,
  alpha,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import React from 'react';

import { borderRadius, typography, colors, spacing } from '@/shared/design-system/theme';
import { TypedChip } from '@/shared/ui';

interface Folder {
  id: string;
  name: string;
  path: string;
}

interface AssetFoldersDialogProps {
  open: boolean;
  onClose: () => void;
  assetName: string;
  assetType: string;
  folders: Folder[];
}

export default function AssetFoldersDialog({
  open,
  onClose,
  assetName,
  assetType,
  folders,
}: AssetFoldersDialogProps) {
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: `${borderRadius.lg}px`,
          maxHeight: '80vh',
        }
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" fontWeight={typography.fontWeight.semibold} gutterBottom>
              Folder Memberships
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={assetType}
                size="small"
                sx={{ 
                  fontWeight: typography.fontWeight.medium,
                  textTransform: 'capitalize',
                }}
              />
              <Typography variant="body1" color="text.secondary">
                {assetName}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3, pt: 0 }}>
        <Paper
          variant="outlined"
          sx={{ 
            borderRadius: `${borderRadius.md}px`,
            backgroundColor: folders.length > 0 ? alpha(colors.primary.light, 0.05) : 'transparent',
            border: `1px solid ${folders.length > 0 ? alpha(colors.primary.main, 0.2) : 'transparent'}`,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            px: spacing.md / 8,
            py: 1.5,
            backgroundColor: folders.length > 0 ? alpha(colors.primary.main, 0.05) : 'transparent',
            borderBottom: folders.length > 0 ? `1px solid ${alpha(colors.primary.main, 0.1)}` : 'none',
          }}>
            <FolderOpenIcon sx={{ fontSize: 20, color: folders.length > 0 ? colors.primary.main : 'text.disabled' }} />
            <Typography 
              variant="subtitle1" 
              fontWeight={typography.fontWeight.semibold}
              color={folders.length > 0 ? 'text.primary' : 'text.disabled'}
            >
              Folders
            </Typography>
            {folders.length > 0 && (
              <TypedChip 
                type="FOLDER"
                count={folders.length}
                showIcon={false}
                size="small"
              />
            )}
          </Box>
          
          {folders.length === 0 ? (
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                textAlign: 'center', 
                py: 4,
                px: 2,
              }}
            >
              This {assetType.toLowerCase()} is not in any folders
            </Typography>
          ) : (
            <List disablePadding>
              {folders.map((folder, index) => (
                <React.Fragment key={folder.id}>
                  <ListItem
                    sx={{
                      py: 1.5,
                      px: spacing.md / 8,
                      '&:hover': {
                        backgroundColor: alpha(colors.neutral[100], 0.5),
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <FolderIcon sx={{ color: colors.primary.main }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body1" fontWeight={typography.fontWeight.medium}>
                          {folder.name}
                        </Typography>
                      }
                      secondary={
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                          }}
                        >
                          {folder.path}
                        </Typography>
                      }
                    />
                  </ListItem>
                  {index < folders.length - 1 && (
                    <Divider sx={{ mx: spacing.md / 8 }} />
                  )}
                </React.Fragment>
              ))}
            </List>
          )}
        </Paper>
        
        {folders.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'center' }}
            >
              {assetType === 'dashboard' ? 'Dashboards' : 
               assetType === 'analysis' ? 'Analyses' :
               assetType === 'dataset' ? 'Datasets' :
               assetType === 'datasource' ? 'Data sources' :
               'Assets'} can be organized into folders for better management
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}