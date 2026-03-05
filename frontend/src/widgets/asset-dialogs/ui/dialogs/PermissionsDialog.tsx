import {
  Close as CloseIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  People as PeopleIcon,
  Public as PublicIcon,
  Language as NamespaceIcon,
  Folder as FolderIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Chip,
  CircularProgress,
  TextField,
  InputAdornment,
  Tooltip,
  alpha,
} from '@mui/material';
import { useState, useEffect, useCallback, useMemo } from 'react';

import { Permission } from '@/entities/asset';

import { assetsApi } from '@/shared/api';
import { borderRadius, typography, colors, spacing } from '@/shared/design-system/theme';

import { PermissionsDialogProps } from '../../model';

import type { components } from '@shared/generated/types';

type UserAccessInfo = components['schemas']['UserAccessInfo'];
type GroupAccessInfo = components['schemas']['GroupAccessInfo'];
type AccessSource = components['schemas']['AccessSource'];

// Unified entry combining a permission principal with its resolved access sources
interface PermissionEntry {
  principal: string;
  principalName: string;
  principalType: 'USER' | 'GROUP' | 'NAMESPACE' | 'PUBLIC';
  actions: string[];
  accessSources: AccessSource[];
}

type PrincipalFilter = 'ALL' | 'USER' | 'GROUP' | 'NAMESPACE' | 'PUBLIC';
type AccessFilter = 'ALL' | 'DIRECT' | 'INHERITED';

const PRINCIPAL_CONFIG: Record<string, {
  icon: typeof PersonIcon;
  color: string;
  lightColor: string;
  label: string;
}> = {
  USER: {
    icon: PersonIcon,
    color: colors.assetTypes.user.main,
    lightColor: colors.assetTypes.user.light,
    label: 'User',
  },
  GROUP: {
    icon: PeopleIcon,
    color: colors.assetTypes.group.main,
    lightColor: colors.assetTypes.group.light,
    label: 'Group',
  },
  NAMESPACE: {
    icon: NamespaceIcon,
    color: '#9c27b0',
    lightColor: '#e1bee7',
    label: 'Namespace',
  },
  PUBLIC: {
    icon: PublicIcon,
    color: '#2196f3',
    lightColor: '#bbdefb',
    label: 'Public',
  },
};

const ACCESS_SOURCE_CONFIG: Record<string, {
  label: string;
  color: string;
  icon: typeof PersonIcon;
}> = {
  direct: { label: 'Direct', color: colors.assetTypes.user.main, icon: PersonIcon },
  group: { label: 'Via Group', color: colors.assetTypes.group.main, icon: PeopleIcon },
  folder: { label: 'Via Folder', color: '#ed6c02', icon: FolderIcon },
};

const AccessSourceChip = ({ source }: { source: AccessSource }) => {
  const config = ACCESS_SOURCE_CONFIG[source.type];
  const Icon = config.icon;

  const label = source.type === 'group' && source.groupName
    ? source.groupName
    : source.type === 'folder' && source.folderName
      ? source.folderName
      : config.label;

  const tooltip = source.type === 'folder' && source.groupName
    ? `Via folder "${source.folderPath}" (through group ${source.groupName})`
    : source.type === 'folder'
      ? `Via folder "${source.folderPath}"`
      : source.type === 'group'
        ? `Member of group "${source.groupName}"`
        : 'Direct permission on this asset';

  return (
    <Tooltip title={tooltip}>
      <Chip
        icon={<Icon sx={{ fontSize: 12 }} />}
        label={label}
        size="small"
        variant="outlined"
        sx={{
          borderColor: alpha(config.color, 0.3),
          color: config.color,
          fontWeight: typography.fontWeight.medium,
          fontSize: 11,
          height: 20,
          '& .MuiChip-label': { px: 0.75 },
          '& .MuiChip-icon': { color: config.color, ml: 0.5 },
        }}
      />
    </Tooltip>
  );
};

const PermissionEntryRow = ({ entry }: { entry: PermissionEntry }) => {
  const config = PRINCIPAL_CONFIG[entry.principalType];
  const Icon = config.icon;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        p: 1.25,
        borderRadius: `${borderRadius.sm}px`,
        transition: 'background-color 0.15s',
        '&:hover': {
          backgroundColor: alpha(config.color, 0.04),
        },
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          backgroundColor: alpha(config.color, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.125,
        }}
      >
        <Icon sx={{ fontSize: 16, color: config.color }} />
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="body2"
            fontWeight={typography.fontWeight.medium}
            noWrap
            sx={{ flex: 1, minWidth: 0 }}
          >
            {entry.principalName}
          </Typography>
          <Chip
            label={config.label}
            size="small"
            sx={{
              height: 18,
              fontSize: 10,
              fontWeight: typography.fontWeight.semibold,
              backgroundColor: alpha(config.color, 0.08),
              color: config.color,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Box>

        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontSize: 11 }}
        >
          {entry.actions.length} permission{entry.actions.length !== 1 ? 's' : ''}
        </Typography>

        {/* Access source chips - always shown */}
        {entry.accessSources.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {entry.accessSources.map((source, idx) => (
              <AccessSourceChip key={idx} source={source} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

const parseActions = (permission: Permission): string[] => {
  if (Array.isArray(permission.actions)) return permission.actions;
  if (typeof permission.actions === 'string') {
    return (permission.actions as string).split(',').map(a => a.trim()).filter(Boolean);
  }
  const capitalizedActions = (permission as any).Actions;
  if (capitalizedActions) {
    if (Array.isArray(capitalizedActions)) return capitalizedActions;
    if (typeof capitalizedActions === 'string') {
      return capitalizedActions.split(',').map((a: string) => a.trim()).filter(Boolean);
    }
  }
  return [];
};

export default function PermissionsDialog({
  open,
  onClose,
  assetId,
  assetName,
  assetType,
  permissions = [],
}: PermissionsDialogProps) {
  const [userAccessSources, setUserAccessSources] = useState<UserAccessInfo[]>([]);
  const [groupAccessSources, setGroupAccessSources] = useState<GroupAccessInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [activeFilter, setActiveFilter] = useState<PrincipalFilter>('ALL');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('ALL');

  const fetchPermissionSources = useCallback(async () => {
    if (!assetId || !assetType) return;
    const supportedTypes = ['dashboard', 'analysis', 'dataset', 'datasource', 'folder'];
    if (!supportedTypes.includes(assetType.toLowerCase())) return;

    setLoading(true);
    try {
      const result = await assetsApi.getPermissionSources(assetType.toLowerCase(), assetId);
      setUserAccessSources(result.userAccessSources || []);
      setGroupAccessSources(result.groupAccessSources || []);
    } catch (err) {
      console.error('Failed to fetch permission sources:', err);
    } finally {
      setLoading(false);
    }
  }, [assetId, assetType]);

  useEffect(() => {
    if (open && assetId) {
      fetchPermissionSources();
    } else if (!open) {
      setUserAccessSources([]);
      setGroupAccessSources([]);
      setFilterText('');
      setActiveFilter('ALL');
      setAccessFilter('ALL');
    }
  }, [open, assetId, fetchPermissionSources]);

  // Build unified entries
  const allEntries = useMemo((): PermissionEntry[] => {
    const entries: PermissionEntry[] = [];
    const seenUserNames = new Set<string>();
    const seenGroupNames = new Set<string>();

    const typeOrder: Array<'PUBLIC' | 'NAMESPACE' | 'GROUP' | 'USER'> = [
      'PUBLIC', 'NAMESPACE', 'GROUP', 'USER',
    ];

    for (const type of typeOrder) {
      const typePerms = permissions.filter(p => p.principalType === type);
      for (const perm of typePerms) {
        const fallbackName = perm.principal?.split('/').pop() || perm.principal || 'Unknown';
        const actions = parseActions(perm);

        let sources: AccessSource[] = [];
        let principalName = fallbackName;

        if (type === 'USER') {
          // Find canonical name from access sources (resolves QuickSight-reader/email correctly)
          const userInfo = userAccessSources.find(u =>
            u.userArn === perm.principal || u.userName === fallbackName
          );
          if (userInfo) {
            principalName = userInfo.userName;
            sources = userInfo.sources;
          }
          seenUserNames.add(principalName);
        } else if (type === 'GROUP') {
          const groupInfo = groupAccessSources.find(g =>
            g.groupArn === perm.principal || g.groupName === fallbackName
          );
          if (groupInfo) {
            principalName = groupInfo.groupName;
            sources = groupInfo.sources;
          }
          seenGroupNames.add(principalName);
        }

        entries.push({
          principal: perm.principal,
          principalName,
          principalType: type,
          actions,
          accessSources: sources,
        });
      }
    }

    // Add users who ONLY have access via folder (not in direct permissions)
    for (const user of userAccessSources) {
      if (seenUserNames.has(user.userName)) continue;
      const hasFolderAccess = user.sources.some(s => s.type === 'folder');
      if (!hasFolderAccess) continue;

      entries.push({
        principal: user.userArn,
        principalName: user.userName,
        principalType: 'USER',
        actions: [],
        accessSources: user.sources,
      });
    }

    // Add groups who ONLY have access via folder (not in direct permissions)
    for (const group of groupAccessSources) {
      if (seenGroupNames.has(group.groupName)) continue;
      const hasFolderAccess = group.sources.some(s => s.type === 'folder');
      if (!hasFolderAccess) continue;

      entries.push({
        principal: group.groupArn,
        principalName: group.groupName,
        principalType: 'GROUP',
        actions: [],
        accessSources: group.sources,
      });
    }

    return entries;
  }, [permissions, userAccessSources, groupAccessSources]);

  // Counts per type
  const counts = useMemo(() => {
    const c = { ALL: 0, USER: 0, GROUP: 0, NAMESPACE: 0, PUBLIC: 0 };
    for (const entry of allEntries) {
      c[entry.principalType]++;
      c.ALL++;
    }
    return c;
  }, [allEntries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let result = allEntries;

    // Principal type filter
    if (activeFilter !== 'ALL') {
      result = result.filter(e => e.principalType === activeFilter);
    }

    // Access mode filter
    if (accessFilter === 'DIRECT') {
      result = result.filter(e =>
        e.accessSources.some(s => s.type === 'direct') || e.actions.length > 0
      );
    } else if (accessFilter === 'INHERITED') {
      result = result.filter(e =>
        e.accessSources.some(s => s.type !== 'direct')
      );
    }

    // Text search
    if (filterText) {
      const term = filterText.toLowerCase();
      result = result.filter(e =>
        e.principalName.toLowerCase().includes(term) ||
        e.accessSources.some(s =>
          s.groupName?.toLowerCase().includes(term) ||
          s.folderName?.toLowerCase().includes(term)
        )
      );
    }
    return result;
  }, [allEntries, activeFilter, accessFilter, filterText]);

  const filterChips: Array<{ key: PrincipalFilter; label: string; color: string }> = [
    { key: 'ALL', label: 'All', color: colors.primary.main },
    { key: 'USER', label: 'Users', color: PRINCIPAL_CONFIG.USER.color },
    { key: 'GROUP', label: 'Groups', color: PRINCIPAL_CONFIG.GROUP.color },
    ...(counts.NAMESPACE > 0 ? [{ key: 'NAMESPACE' as PrincipalFilter, label: 'Namespace', color: PRINCIPAL_CONFIG.NAMESPACE.color }] : []),
    ...(counts.PUBLIC > 0 ? [{ key: 'PUBLIC' as PrincipalFilter, label: 'Public', color: PRINCIPAL_CONFIG.PUBLIC.color }] : []),
  ];

  const accessChips: Array<{ key: AccessFilter; label: string; color: string }> = [
    { key: 'ALL', label: 'All Access', color: colors.primary.main },
    { key: 'DIRECT', label: 'Direct', color: colors.assetTypes.user.main },
    { key: 'INHERITED', label: 'Inherited', color: '#ed6c02' },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: `${borderRadius.lg}px`,
          maxHeight: '85vh',
        }
      }}
    >
      {/* Header */}
      <DialogTitle sx={{
        pb: spacing.md / 8,
        borderBottom: `1px solid ${alpha(colors.neutral[200], 0.5)}`,
        backgroundColor: alpha(colors.primary.light, 0.08),
        backgroundImage: `linear-gradient(to right, ${alpha(colors.primary.light, 0.06)}, transparent)`,
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
              backgroundColor: alpha(colors.primary.main, 0.1),
              border: `1px solid ${alpha(colors.primary.main, 0.2)}`,
            }}>
              <SecurityIcon sx={{ color: colors.primary.main, fontSize: 20 }} />
            </Box>
            <Box>
              <Typography
                variant="h6"
                fontWeight={typography.fontWeight.semibold}
                color="text.primary"
              >
                Permissions
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.xs / 8 }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                  {assetType}
                </Typography>
                <Typography variant="caption" color="text.secondary">·</Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 250 }}>
                  {assetName}
                </Typography>
                <Chip
                  label={counts.ALL}
                  size="small"
                  sx={{
                    fontWeight: typography.fontWeight.semibold,
                    backgroundColor: alpha(colors.primary.main, 0.1),
                    color: colors.primary.main,
                    border: `1px solid ${alpha(colors.primary.main, 0.2)}`,
                    height: 20,
                    fontSize: 11,
                    '& .MuiChip-label': { px: 0.75 },
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

      <DialogContent sx={{ px: 0, py: 0 }}>
        {permissions.length === 0 && !loading ? (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 8,
          }}>
            <SecurityIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              No permissions found
            </Typography>
          </Box>
        ) : (
          <>
            {/* Filter toggles + search */}
            <Box sx={{
              px: 2.5,
              pt: 2,
              pb: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              position: 'sticky',
              top: 0,
              backgroundColor: 'background.paper',
              zIndex: 1,
            }}>
              {/* Type filter chips */}
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {filterChips.map(({ key, label, color }) => {
                  const isActive = activeFilter === key;
                  const count = counts[key];
                  return (
                    <Chip
                      key={key}
                      label={`${label} (${count})`}
                      size="small"
                      variant={isActive ? 'filled' : 'outlined'}
                      onClick={() => setActiveFilter(key)}
                      sx={{
                        fontWeight: typography.fontWeight.medium,
                        fontSize: 12,
                        height: 28,
                        ...(isActive
                          ? {
                            backgroundColor: alpha(color, 0.15),
                            color: color,
                            border: `1px solid ${alpha(color, 0.3)}`,
                            '&:hover': { backgroundColor: alpha(color, 0.2) },
                          }
                          : {
                            borderColor: alpha(colors.neutral[400], 0.3),
                            color: 'text.secondary',
                            '&:hover': {
                              backgroundColor: alpha(color, 0.05),
                              borderColor: alpha(color, 0.3),
                              color: color,
                            },
                          }
                        ),
                      }}
                    />
                  );
                })}
              </Box>

              {/* Access mode filter chips */}
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {accessChips.map(({ key, label, color }) => {
                  const isActive = accessFilter === key;
                  return (
                    <Chip
                      key={key}
                      label={label}
                      size="small"
                      variant={isActive ? 'filled' : 'outlined'}
                      onClick={() => setAccessFilter(key)}
                      sx={{
                        fontWeight: typography.fontWeight.medium,
                        fontSize: 11,
                        height: 24,
                        ...(isActive
                          ? {
                            backgroundColor: alpha(color, 0.15),
                            color: color,
                            border: `1px solid ${alpha(color, 0.3)}`,
                            '&:hover': { backgroundColor: alpha(color, 0.2) },
                          }
                          : {
                            borderColor: alpha(colors.neutral[400], 0.3),
                            color: 'text.secondary',
                            '&:hover': {
                              backgroundColor: alpha(color, 0.05),
                              borderColor: alpha(color, 0.3),
                              color: color,
                            },
                          }
                        ),
                      }}
                    />
                  );
                })}
              </Box>

              {/* Search */}
              <TextField
                fullWidth
                size="small"
                placeholder="Search principals..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: 13,
                    height: 34,
                  },
                }}
              />
            </Box>

            {/* Loading indicator for access sources */}
            {loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, pb: 1 }}>
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">
                  Resolving access sources...
                </Typography>
              </Box>
            )}

            {/* Entries list */}
            <Box sx={{
              px: 1.5,
              pb: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.25,
              maxHeight: 450,
              overflowY: 'auto',
            }}>
              {filteredEntries.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {filterText
                      ? `No principals match "${filterText}"`
                      : 'No permissions in this category'}
                  </Typography>
                </Box>
              ) : (
                filteredEntries.map((entry, idx) => (
                  <PermissionEntryRow key={`${entry.principalType}-${entry.principalName}-${idx}`} entry={entry} />
                ))
              )}
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
