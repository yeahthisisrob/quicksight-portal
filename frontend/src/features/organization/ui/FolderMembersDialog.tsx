import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
  OpenInNew as OpenInNewIcon,
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
  CircularProgress,
  Alert,
  Tooltip,
  alpha,
} from '@mui/material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useFolders } from '@/entities/folder';

import { foldersApi } from '@/shared/api';
import { colors, spacing, borderRadius, typography } from '@/shared/design-system/theme';
import TypedChip, { ChipType } from '@/shared/ui/TypedChip';

interface FolderMembersDialogProps {
  open: boolean;
  onClose: () => void;
  folder: any;
}

const assetTypeConfig = {
  DASHBOARD: { 
    path: '/assets/dashboards',
    pluralLabel: 'Dashboards'
  },
  ANALYSIS: { 
    path: '/assets/analyses',
    pluralLabel: 'Analyses'
  },
  DATASET: { 
    path: '/assets/datasets',
    pluralLabel: 'Datasets'
  },
  DATASOURCE: { 
    path: '/assets/datasources',
    pluralLabel: 'Data Sources'
  },
} as const;

export default function FolderMembersDialog({
  open,
  onClose,
  folder,
}: FolderMembersDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { invalidateFolderMembers, invalidateFolders } = useFolders();
  const [removingMembers, setRemovingMembers] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['DASHBOARD', 'ANALYSIS', 'DATASET', 'DATASOURCE']));

  const folderId = folder?.FolderId || folder?.id;
  const folderName = folder?.Name || folder?.name;
  
  const { data: members = [], isLoading, error, refetch } = useQuery({
    queryKey: ['folder-members', folderId],
    queryFn: () => foldersApi.getMembers(folderId),
    enabled: open && !!folderId,
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ memberId, memberType }: { memberId: string; memberType: string }) => {
      return foldersApi.removeMember(folderId, memberId, memberType);
    },
    onMutate: async ({ memberId }) => {
      setRemovingMembers(prev => new Set(prev).add(memberId));
    },
    onSuccess: async () => {
      enqueueSnackbar('Asset removed from folder', { variant: 'success' });
      // Refetch the members list
      refetch();
      // Use context methods to properly invalidate queries
      await invalidateFolderMembers(folderId);
      await invalidateFolders();
    },
    onError: (error: any) => {
      enqueueSnackbar(error.message || 'Failed to remove asset from folder', { variant: 'error' });
    },
    onSettled: (_, __, { memberId }) => {
      setRemovingMembers(prev => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    },
  });

  const handleRemoveMember = (member: any) => {
    removeMemberMutation.mutate({
      memberId: member.MemberId,
      memberType: member.MemberType,
    });
  };

  const handleAssetClick = (member: any) => {
    const config = assetTypeConfig[member.MemberType as keyof typeof assetTypeConfig];
    if (config) {
      // Navigate to the list page with the asset name as a search query
      navigate(`${config.path}?search=${encodeURIComponent(member.MemberName || member.MemberId)}`);
      onClose();
    }
  };

  // Group members by type
  const membersByType = members.reduce((acc: Record<string, any[]>, member: any) => {
    const type = member.MemberType || 'UNKNOWN';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(member);
    return acc;
  }, {});

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: `${borderRadius.lg}px`,
          maxHeight: '90vh',
          backgroundColor: 'background.paper',
          backgroundImage: 'none',
        }
      }}
    >
      <DialogTitle sx={{ 
        pb: spacing.md / 8,
        borderBottom: `1px solid ${alpha(colors.neutral[200], 0.5)}`,
        backgroundColor: alpha(colors.assetTypes.folder.light, 0.3),
        backgroundImage: `linear-gradient(to right, ${alpha(colors.assetTypes.folder.light, 0.1)}, transparent)`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm / 8 }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: `${borderRadius.sm}px`,
              backgroundColor: alpha(colors.assetTypes.folder.main, 0.1),
              border: `1px solid ${alpha(colors.assetTypes.folder.main, 0.2)}`,
            }}>
              <FolderIcon sx={{ 
                color: colors.assetTypes.folder.main,
                fontSize: 20,
              }} />
            </Box>
            <Box>
              <Typography 
                variant="h6" 
                fontWeight={typography.fontWeight.semibold}
                color="text.primary"
              >
                Folder Members
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.xs / 8 }}>
                <Typography variant="caption" color="text.secondary">
                  {folderName}
                </Typography>
                <Chip 
                  label={members.length} 
                  size="small" 
                  sx={{ 
                    fontWeight: typography.fontWeight.semibold,
                    backgroundColor: alpha(colors.assetTypes.folder.main, 0.1),
                    color: colors.assetTypes.folder.main,
                    border: `1px solid ${alpha(colors.assetTypes.folder.main, 0.2)}`,
                  }}
                />
              </Box>
            </Box>
          </Box>
          <IconButton 
            onClick={onClose} 
            sx={{
              color: 'action.active',
              transition: 'all 0.2s',
              '&:hover': {
                color: 'error.main',
                backgroundColor: alpha(colors.status.error, 0.1),
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ px: 0, py: 2 }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mx: 3, mb: 2 }}>
            Failed to load folder members
          </Alert>
        )}
        
        {!isLoading && !error && members.length === 0 && (
          <Box sx={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 8,
          }}>
            <FolderIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              This folder is empty
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Add dashboards, analyses, datasets, or data sources to organize them
            </Typography>
          </Box>
        )}
        
        {!isLoading && !error && members.length > 0 && (
          <Box sx={{ px: 3 }}>
            <Box sx={{ mb: spacing.md / 8 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: spacing.sm / 8 }}>
                Click on an asset to navigate to it. Use the delete button to remove it from this folder.
              </Typography>
              
              {/* Type Filter Chips */}
              <Box sx={{ display: 'flex', gap: spacing.xs / 8, flexWrap: 'wrap' }}>
                {(['DASHBOARD', 'ANALYSIS', 'DATASET', 'DATASOURCE'] as const).map((type) => {
                  const config = assetTypeConfig[type];
                  const typeMembers = membersByType[type] || [];
                  const isSelected = selectedTypes.has(type);
                  const assetColorKey = type.toLowerCase() as 'dashboard' | 'analysis' | 'dataset' | 'datasource';
                  const colorConfig = colors.assetTypes[assetColorKey];
                  
                  return (
                    <Chip
                      key={type}
                      label={`${config.pluralLabel} (${typeMembers.length})`}
                      size="small"
                      onClick={() => {
                        const newTypes = new Set(selectedTypes);
                        if (isSelected) {
                          newTypes.delete(type);
                        } else {
                          newTypes.add(type);
                        }
                        setSelectedTypes(newTypes);
                      }}
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: typography.fontWeight.medium,
                        backgroundColor: isSelected ? alpha(colorConfig.main, 0.1) : 'transparent',
                        color: isSelected ? colorConfig.main : 'text.secondary',
                        border: `1px solid ${isSelected ? alpha(colorConfig.main, 0.3) : alpha(colors.neutral[300], 0.5)}`,
                        '&:hover': {
                          backgroundColor: alpha(colorConfig.main, isSelected ? 0.15 : 0.05),
                          borderColor: alpha(colorConfig.main, 0.4),
                        },
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.md / 8 }}>
              {(['DASHBOARD', 'ANALYSIS', 'DATASET', 'DATASOURCE'] as const).filter(type => selectedTypes.has(type)).map((type) => {
                const typeMembers = membersByType[type] || [];
                const config = assetTypeConfig[type];
                const assetColorKey = type.toLowerCase() as 'dashboard' | 'analysis' | 'dataset' | 'datasource';
                const colorConfig = colors.assetTypes[assetColorKey];

                if (typeMembers.length === 0) return null;

                return (
                  <Paper
                    key={type}
                    variant="outlined"
                    sx={{ 
                      p: spacing.md / 8,
                      border: `1px solid ${alpha(colorConfig.main, 0.2)}`,
                      backgroundColor: alpha(colorConfig.light, 0.3),
                      borderRadius: `${borderRadius.md}px`,
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: alpha(colorConfig.main, 0.3),
                        backgroundColor: alpha(colorConfig.light, 0.4),
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.xs / 8, mb: spacing.sm / 8 }}>
                      <Typography 
                        variant="subtitle2" 
                        fontWeight={typography.fontWeight.semibold}
                        color="text.primary"
                      >
                        {config.pluralLabel}
                      </Typography>
                      <TypedChip 
                        type={type as ChipType} 
                        count={typeMembers.length}
                        showIcon={false}
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.xs / 8 }}>
                      {typeMembers.map((member: any, index: number) => {
                          const isRemoving = removingMembers.has(member.MemberId);
                          
                          return (
                            <Box
                              key={`${type}-${index}`}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                p: spacing.sm / 8,
                                backgroundColor: 'background.paper',
                                borderRadius: `${borderRadius.sm}px`,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                opacity: isRemoving ? 0.5 : 1,
                                border: `1px solid ${alpha(colors.neutral[200], 0.5)}`,
                                '&:hover': {
                                  backgroundColor: alpha(colorConfig.main, 0.05),
                                  borderColor: alpha(colorConfig.main, 0.2),
                                  transform: isRemoving ? 'none' : 'translateX(2px)',
                                }
                              }}
                              onClick={() => !isRemoving && handleAssetClick(member)}
                            >
                              <Box sx={{ overflow: 'hidden', flex: 1 }}>
                                <Typography variant="body2" fontWeight={typography.fontWeight.medium} noWrap>
                                  {member.MemberName || member.MemberId || 'Unknown'}
                                </Typography>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    color: 'text.secondary',
                                    fontFamily: typography.fontFamily.monospace,
                                    fontSize: typography.fontSize.xs,
                                    display: 'block',
                                  }}
                                  noWrap
                                >
                                  {member.MemberId}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                                <OpenInNewIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Tooltip title="Remove from folder">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveMember(member);
                                    }}
                                    disabled={isRemoving}
                                    sx={{ 
                                      ml: 0.5,
                                      '&:hover': {
                                        color: 'error.main',
                                        backgroundColor: alpha('#f44336', 0.08),
                                      }
                                    }}
                                  >
                                    {isRemoving ? (
                                      <CircularProgress size={16} />
                                    ) : (
                                      <DeleteIcon sx={{ fontSize: 18 }} />
                                    )}
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                  </Paper>
                );
              })}
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}