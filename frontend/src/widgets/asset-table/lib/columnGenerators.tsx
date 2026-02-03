/**
 * Column generators for different asset types
 */
import { ErrorOutline as ErrorOutlineIcon } from '@mui/icons-material';
import { alpha, Box, Chip, Tooltip, Typography } from '@mui/material';

import { DatasourceTypeBadge } from '@/entities/field';

import { colors } from '@/shared/design-system/theme';
import { TypedChip } from '@/shared/ui';
import { SearchMatchChipGroup } from '@/shared/ui/SearchMatchChip';

import { formatBytes, formatRelativeDate, type AssetRow } from './createAssetColumns';

import type { ColumnConfig } from '@/features/asset-management';

type Handlers = {
  onRefreshScheduleClick?: (dataset: any) => void;
  onDefinitionErrorsClick?: (asset: any) => void;
  onActivityClick?: (asset: any) => void;
  onFolderMembersClick?: (folder: any) => void;
  onUserGroupsClick?: (user: any) => void;
  onGroupMembersClick?: (group: any) => void;
  onGroupAssetsClick?: (group: any) => void;
  onRelatedAssetsClick?: (asset: any, relatedAssets: any[]) => void;
};

// Type guards
const isDataset = (_row: AssetRow): _row is AssetRow & { sourceType?: string; importMode?: string; sizeInBytes?: number } => {
  return true; // This is used only when assetType is 'dataset'
};

const isDatasource = (_row: AssetRow): _row is AssetRow & { sourceType?: string } => {
  return true; // This is used only when assetType is 'datasource'
};

const isFolder = (_row: AssetRow): _row is AssetRow & { path?: string } => {
  return true; // This is used only when assetType is 'folder'
};

const isUser = (_row: AssetRow): _row is AssetRow & { activity?: any; groupCount?: number } => {
  return true; // This is used only when assetType is 'user'
};

const isDashboard = (_row: AssetRow): _row is AssetRow & { activity?: any } => {
  return true; // This is used only when assetType is 'dashboard'
};

const isAnalysis = (_row: AssetRow): _row is AssetRow & { activity?: any } => {
  return true; // This is used only when assetType is 'analysis'
};

/**
 * Generate dataset-specific columns
 */
export function generateDatasetColumns(handlers: Handlers): ColumnConfig[] {
  return [
    {
      id: 'sourceType',
      label: 'Source Type',
      width: 200,
      visible: true,
      renderCell: (params: { row: AssetRow; value: any }) => {
        const sourceType = isDataset(params.row) ? params.row.sourceType : 'UNKNOWN';
        const importMode = isDataset(params.row) ? params.row.importMode : undefined;
        
        return (
          <DatasourceTypeBadge
            datasourceType={sourceType || 'UNKNOWN'}
            importMode={importMode as "SPICE" | "DIRECT_QUERY" | undefined}
          />
        );
      },
      valueGetter: (params) => isDataset(params.row) ? (params.row.sourceType || 'UNKNOWN') : 'UNKNOWN',
    },
    {
      id: 'spiceCapacity',
      label: 'SPICE Size',
      width: 100,
      visible: true,
      renderCell: (params: { row: AssetRow; value: any }) => {
        if (!isDataset(params.row)) {
          return <Typography variant="body2" color="text.secondary">-</Typography>;
        }
        
        const capacity = params.row.sizeInBytes;
        const importMode = params.row.importMode;
        
        if (importMode !== 'SPICE' || !capacity) {
          return <Typography variant="body2" color="text.secondary">-</Typography>;
        }
        
        return (
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {formatBytes(capacity)}
          </Typography>
        );
      },
      valueGetter: (params) => isDataset(params.row) ? (params.row.sizeInBytes || 0) : 0,
    },
    {
      id: 'refreshAlerts',
      label: 'Alerts',
      width: 80,
      visible: true,
      renderCell: (params: { row: AssetRow; value: any }) => {
        if (!isDataset(params.row)) {
          return <Typography variant="body2" color="text.secondary">-</Typography>;
        }

        const refreshProps = params.row.dataSetRefreshProperties || (params.row as any)['DataSetRefreshProperties'];
        
        if (!refreshProps) {
          return <Typography variant="body2" color="text.secondary">-</Typography>;
        }

        // Check for email alerts in failure configuration
        const failureConfig = refreshProps.failureConfiguration || refreshProps['FailureConfiguration'];
        const emailAlert = failureConfig?.emailAlert || failureConfig?.['EmailAlert'];
        const alertStatus = emailAlert?.alertStatus || emailAlert?.['AlertStatus'];
        
        const hasAlerts = alertStatus === 'ENABLED';
        
        return (
          <Chip 
            label={hasAlerts ? 'Yes' : 'No'} 
            size="small" 
            color={hasAlerts ? 'success' : 'default'}
            variant={hasAlerts ? 'filled' : 'outlined'}
          />
        );
      },
      valueGetter: (params) => {
        if (!isDataset(params.row)) return '';
        const refreshProps = params.row.dataSetRefreshProperties || (params.row as any)['DataSetRefreshProperties'];
        const failureConfig = refreshProps?.failureConfiguration || refreshProps?.['FailureConfiguration'];
        const emailAlert = failureConfig?.emailAlert || failureConfig?.['EmailAlert'];
        const alertStatus = emailAlert?.alertStatus || emailAlert?.['AlertStatus'];
        return alertStatus === 'ENABLED' ? 'Yes' : 'No';
      },
    },
    {
      id: 'refreshSchedule',
      label: 'Refresh Schedule',
      width: 200,
      visible: true,
      renderCell: (params: { row: AssetRow; value: any }) => 
        renderRefreshScheduleCell(params, handlers.onRefreshScheduleClick),
      valueGetter: (params) => getRefreshScheduleValue(params),
    }
  ];
}

/**
 * Render refresh schedule cell for datasets
 */
function renderRefreshScheduleCell(params: { row: AssetRow; value: any }, onRefreshScheduleClick?: (dataset: any) => void) {
  if (!isDataset(params.row)) {
    return <Typography variant="body2" color="text.secondary">-</Typography>;
  }

  const { refreshSchedules } = params.row;
  
  if (!refreshSchedules || refreshSchedules.length === 0) {
    return <Typography variant="body2" color="text.secondary">None</Typography>;
  }

  // Validate that refreshSchedules is a proper array with valid objects
  const validSchedules = Array.isArray(refreshSchedules) 
    ? refreshSchedules.filter((s: any) => s && typeof s === 'object' && 
        (s.refreshType || s['RefreshType']) && 
        (s.scheduleFrequency || s['ScheduleFrequency']))
    : [];

  if (validSchedules.length === 0) {
    return <Typography variant="body2" color="text.secondary">Invalid data</Typography>;
  }

  // Find first regular (FULL_REFRESH) and first incremental schedule
  const fullRefreshSchedule = validSchedules.find((s: any) => 
    (s.refreshType || s['RefreshType']) === 'FULL_REFRESH'
  );
  const incrementalSchedule = validSchedules.find((s: any) => 
    (s.refreshType || s['RefreshType']) === 'INCREMENTAL_REFRESH'
  );
  
  const formatScheduleTime = (schedule: any) => {
    const frequency = schedule.scheduleFrequency || schedule['ScheduleFrequency'];
    if (!schedule || !frequency) {
      return 'Unknown';
    }
    
    // Handle both camelCase and PascalCase properties
    const interval = frequency.interval || frequency['Interval'];
    const timeOfTheDay = frequency.timeOfTheDay || frequency['TimeOfTheDay'];
    const refreshOnDay = frequency.refreshOnDay || frequency['RefreshOnDay'];
    let timeStr = '';
    
    if (!interval) {
      return 'Unknown interval';
    }
    
    if (interval === 'DAILY') {
      timeStr = timeOfTheDay ? `Daily at ${timeOfTheDay}` : 'Daily';
    } else if (interval === 'WEEKLY') {
      const dayOfWeek = refreshOnDay?.dayOfWeek || refreshOnDay?.['DayOfWeek'];
      const day = dayOfWeek ? dayOfWeek.charAt(0) + dayOfWeek.slice(1).toLowerCase() : '';
      timeStr = timeOfTheDay ? `${day} at ${timeOfTheDay}` : `Weekly ${day}`;
    } else if (interval === 'MONTHLY') {
      const dayOfMonth = refreshOnDay?.dayOfMonth || refreshOnDay?.['DayOfMonth'] || '1st';
      timeStr = timeOfTheDay ? `${dayOfMonth} at ${timeOfTheDay}` : `Monthly ${dayOfMonth}`;
    } else if (interval === 'HOURLY') {
      timeStr = 'Hourly';
    } else if (interval.includes('MINUTE')) {
      timeStr = interval.replace('MINUTE', '') + 'm';
    } else {
      timeStr = interval;
    }
    
    return timeStr;
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 0.5,
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: 'action.hover',
          borderRadius: 1,
          p: 0.5,
          m: -0.5,
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (onRefreshScheduleClick) {
          onRefreshScheduleClick(params.row);
        }
      }}
    >
      {fullRefreshSchedule && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip 
            label="Full" 
            size="small" 
            variant="outlined" 
            color="primary"
            sx={{ minWidth: 45, fontSize: '0.7rem' }}
          />
          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
            {formatScheduleTime(fullRefreshSchedule)}
          </Typography>
        </Box>
      )}
      {incrementalSchedule && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip 
            label="Inc" 
            size="small" 
            variant="outlined" 
            color="secondary"
            sx={{ minWidth: 45, fontSize: '0.7rem' }}
          />
          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
            {formatScheduleTime(incrementalSchedule)}
          </Typography>
        </Box>
      )}
      {validSchedules.length > 2 && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          +{validSchedules.length - 2} more
        </Typography>
      )}
      {validSchedules.length > 1 && !(validSchedules.length > 2 && fullRefreshSchedule && incrementalSchedule) && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          +{validSchedules.length - 1} more
        </Typography>
      )}
    </Box>
  );
}

/**
 * Get refresh schedule value for sorting
 */
function getRefreshScheduleValue(params: { row: AssetRow }) {
  if (!isDataset(params.row)) return '';
  const { refreshSchedules } = params.row;
  if (!refreshSchedules || refreshSchedules.length === 0) return 'None';
  
  // Validate schedules before accessing properties
  const validSchedules = refreshSchedules.filter((s: any) => 
    s && 
    typeof s === 'object' && 
    (s.scheduleFrequency || s['ScheduleFrequency']) && 
    ((s.scheduleFrequency && s.scheduleFrequency.interval) || 
     (s['ScheduleFrequency'] && s['ScheduleFrequency']['Interval']))
  );
  
  if (validSchedules.length === 0) return 'Invalid';
  
  return validSchedules.map((s: any) => {
    const freq = s.scheduleFrequency || s['ScheduleFrequency'];
    return freq.interval || freq['Interval'];
  }).join(', ');
}

/**
 * Generate folder-specific columns
 */
export function generateFolderColumns(handlers: Handlers): ColumnConfig[] {
  return [
    {
      id: 'path',
      label: 'Path',
      flex: 1,
      minWidth: 150,
      visible: true,
      sortable: true,
      renderCell: (params: { row: AssetRow; value: any }) => {
        const path = params.row.path || '/';
        return (
          <Tooltip title={path}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'text.secondary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {path}
            </Typography>
          </Tooltip>
        );
      },
      valueGetter: (params) => isFolder(params.row) ? (params.row.path || '/') : '/',
    },
    {
      id: 'memberCount',
      label: 'Members',
      width: 100,
      visible: true,
      renderCell: (params) => (
        <Chip 
          label={params.row.memberCount || 0} 
          size="small" 
          color={params.row.memberCount > 0 ? 'primary' : 'default'}
          sx={{ 
            cursor: 'pointer',
            '&:hover': { 
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
            }
          }}
          onClick={() => handlers.onFolderMembersClick?.(params.row)}
        />
      ),
      valueGetter: (params: any) => params.row.memberCount || 0,
    }
  ];
}

/**
 * Generate user-specific columns
 */
export function generateUserColumns(handlers: Handlers): ColumnConfig[] {
  return [
    {
      id: 'email',
      label: 'Email',
      flex: 1,
      minWidth: 200,
      visible: true,
      renderCell: (params) => (
        <Typography 
          variant="body2" 
          sx={{ 
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {params.row.email || params.row.Email || '-'}
        </Typography>
      ),
    },
    {
      id: 'role',
      label: 'Role',
      width: 120,
      visible: true,
      renderCell: (params) => {
        const role = params.row.role || params.row.Role || 'READER';
        return (
          <Chip 
            label={role} 
            size="small" 
            color={role === 'ADMIN' ? 'error' : role === 'AUTHOR' ? 'warning' : 'default'}
          />
        );
      },
    },
    {
      id: 'activity',
      label: 'Activity',
      width: 150,
      visible: true,
      sortable: true,
      renderCell: (params: { row: AssetRow; value: any }) => {
        if (!isUser(params.row)) {
          return <Typography variant="body2" color="text.secondary">-</Typography>;
        }
        const activity = params.row.activity;
        
        if (!activity || activity.totalActivities === 0) {
          return <Typography variant="body2" color="text.secondary">-</Typography>;
        }
        
        return (
          <Box
            sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              cursor: handlers.onActivityClick ? 'pointer' : 'default',
              '&:hover': handlers.onActivityClick ? {
                textDecoration: 'underline'
              } : {}
            }}
            onClick={() => handlers.onActivityClick?.(params.row)}
          >
            <Typography variant="body2" fontWeight="medium">
              {activity.totalActivities?.toLocaleString() || '0'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {activity.lastActive ? formatRelativeDate(activity.lastActive) : 'No activity'}
            </Typography>
          </Box>
        );
      },
      valueGetter: (params) => isUser(params.row) ? (params.row.activity?.totalActivities || 0) : 0,
    },
    {
      id: 'groups',
      label: 'Groups',
      width: 150,
      visible: true,
      renderCell: (params: { row: AssetRow; value: any }) => {
        const groupCount = isUser(params.row) ? (params.row.groupCount || 0) : 0;
        if (groupCount === 0) return '-';
        return (
          <Chip 
            label={groupCount.toString()} 
            size="small" 
            color="default"
            sx={{ 
              cursor: 'pointer',
              '&:hover': { 
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
              }
            }}
            onClick={() => handlers.onUserGroupsClick?.(params.row)}
          />
        );
      },
      valueGetter: (params) => isUser(params.row) ? (params.row.groupCount || 0) : 0,
    }
  ];
}

/**
 * Generate group-specific columns
 */
export function generateGroupColumns(handlers: Handlers): ColumnConfig[] {
  return [
    {
      id: 'description',
      label: 'Description',
      flex: 3,
      minWidth: 300,
      visible: true,
      renderCell: (params) => (
        <Tooltip title={params.value || 'No description'}>
          <Typography variant="body2" noWrap sx={{ color: params.value ? 'inherit' : 'text.secondary' }}>
            {params.value || 'No description'}
          </Typography>
        </Tooltip>
      ),
    },
    {
      id: 'memberCount',
      label: 'Members',
      width: 100,
      visible: true,
      renderCell: (params) => {
        const memberCount = params.row.memberCount || params.row.Members?.length || 0;
        return (
          <Chip 
            label={memberCount} 
            size="small" 
            color={memberCount > 0 ? 'primary' : 'default'}
            onClick={(e) => {
              e.stopPropagation();
              if (handlers.onGroupMembersClick) {
                handlers.onGroupMembersClick(params.row);
              }
            }}
            sx={{
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          />
        );
      },
      valueGetter: (params: any) => params.row.memberCount || params.row.Members?.length || 0,
    },
    {
      id: 'assetsCount', 
      label: 'Assets',
      width: 100,
      visible: true,
      renderCell: (params) => {
        const assetsCount = params.row.assetsCount || 0;
        return (
          <Chip 
            label={assetsCount} 
            size="small" 
            color={assetsCount > 0 ? 'success' : 'default'}
            onClick={(e) => {
              e.stopPropagation();
              if (handlers.onGroupAssetsClick) {
                handlers.onGroupAssetsClick(params.row);
              }
            }}
            sx={assetsCount > 0 ? {
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'success.dark',
                color: 'white',
              },
            } : {}}
          />
        );
      },
      valueGetter: (params: any) => params.row.assetsCount || 0,
    }
  ];
}

/**
 * Generate datasource-specific columns
 */
export function generateDatasourceColumns(): ColumnConfig[] {
  return [
    {
      id: 'sourceType',
      label: 'Source Type',
      width: 200,
      visible: true,
      renderCell: (params: { row: AssetRow; value: any }) => {
        const type = isDatasource(params.row) ? (params.row.sourceType || 'UNKNOWN') : 'UNKNOWN';
        
        return (
          <DatasourceTypeBadge
            datasourceType={type}
            importMode={undefined}
          />
        );
      },
      valueGetter: (params) => isDatasource(params.row) ? (params.row.sourceType || 'UNKNOWN') : 'UNKNOWN',
    }
  ];
}

/**
 * Generate dashboard/analysis-specific columns
 */
export function generateDashboardAnalysisColumns(handlers: Handlers): ColumnConfig[] {
  return [
    {
      id: 'status',
      label: 'Status',
      width: 120,
      visible: false,
      renderCell: (params: { row: AssetRow; value: any }) => {
        const status = params.row.status || 'unknown';
        const color = status === 'active' ? 'success' : 
                     status === 'archived' ? 'warning' : 
                     status === 'deleted' ? 'error' : 'default';
        return <Chip label={status} size="small" color={color} />;
      },
    },
    {
      id: 'errors',
      label: 'Errors',
      width: 100,
      visible: true,
      sortable: true,
      renderCell: (params: { row: AssetRow; value: any }) => {
        const errors = params.row.definitionErrors;
        
        if (!errors || errors.length === 0) {
          return null; // Show blank spot if no errors
        }
        
        return (
          <Chip
            label={errors.length}
            color="error"
            size="small"
            icon={<ErrorOutlineIcon />}
            onClick={(e) => {
              e.stopPropagation();
              if (handlers.onDefinitionErrorsClick) {
                handlers.onDefinitionErrorsClick(params.row);
              }
            }}
            sx={{
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'error.dark',
              },
            }}
          />
        );
      },
      valueGetter: (params) => {
        const errors = params.row.definitionErrors;
        return errors ? errors.length : 0;
      },
    },
    {
      id: 'activity',
      label: 'Activity',
      width: 150,
      visible: true,
      sortable: true,
      renderCell: (params: { row: AssetRow; value: any }) => {
        if (!isDashboard(params.row) && !isAnalysis(params.row)) {
          return <Typography variant="body2" color="text.secondary">-</Typography>;
        }
        const activity = params.row.activity;
        if (!activity || activity.totalViews === 0) {
          return <Typography variant="body2" color="text.secondary">-</Typography>;
        }
        
        return (
          <Box
            sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              cursor: handlers.onActivityClick ? 'pointer' : 'default',
              '&:hover': handlers.onActivityClick ? {
                textDecoration: 'underline'
              } : {}
            }}
            onClick={() => handlers.onActivityClick?.(params.row)}
          >
            <Typography variant="body2" fontWeight="medium">
              {activity.totalViews?.toLocaleString() || '0'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {activity.uniqueViewers} viewer{activity.uniqueViewers !== 1 ? 's' : ''}
            </Typography>
          </Box>
        );
      },
      valueGetter: (params) => (isDashboard(params.row) || isAnalysis(params.row)) ? (params.row.activity?.totalViews || 0) : 0,
    }
  ];
}

/**
 * Generate used by column
 */
export function generateUsedByColumn(handlers: Handlers): ColumnConfig {
  return {
    id: 'usedBy',
    label: 'Used By',
    width: 100,
    visible: true,
    sortable: true,
    renderCell: (params: { row: AssetRow; value: any }) => {
      const relatedAssets = params.row.relatedAssets;
      let activeCount = 0;
      let archivedCount = 0;
      
      if (Array.isArray(relatedAssets)) {
        const usedByAssets = relatedAssets.filter(r => r.relationshipType === 'used_by');
        activeCount = usedByAssets.filter(r => !r.targetIsArchived).length;
        archivedCount = usedByAssets.filter(r => r.targetIsArchived).length;
      } else if (relatedAssets?.usedBy) {
        activeCount = relatedAssets.usedBy.length;
      }
      
      const totalCount = activeCount + archivedCount;
      
      if (totalCount === 0) {
        return (
          <TypedChip
            type="RELATIONSHIP"
            count={0}
            size="small"
            variant="filled"
            showIcon={false}
            onClick={() => handlers.onRelatedAssetsClick?.(params.row, params.row.relatedAssets)}
          />
        );
      }
      
      return (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {activeCount > 0 && (
            <TypedChip
              type="RELATIONSHIP"
              count={activeCount}
              size="small"
              variant="filled"
              showIcon={false}
              onClick={() => handlers.onRelatedAssetsClick?.(params.row, params.row.relatedAssets)}
            />
          )}
          {archivedCount > 0 && (
            <Chip
              label={archivedCount}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.75rem',
                backgroundColor: alpha(colors.neutral[500], 0.1),
                color: colors.neutral[600],
                '&:hover': {
                  backgroundColor: alpha(colors.neutral[500], 0.2),
                  cursor: 'pointer',
                },
              }}
              onClick={() => handlers.onRelatedAssetsClick?.(params.row, params.row.relatedAssets)}
            />
          )}
        </Box>
      );
    },
    valueGetter: (params: { row: AssetRow }) => {
      const relatedAssets = params.row.relatedAssets;
      if (Array.isArray(relatedAssets)) {
        return relatedAssets.filter(r => r.relationshipType === 'used_by').length;
      }
      return params.row.relatedAssets?.usedBy?.length || 0;
    },
  };
}

/**
 * Generate uses column
 */
export function generateUsesColumn(handlers: Handlers): ColumnConfig {
  return {
    id: 'uses',
    label: 'Uses',
    width: 100,
    visible: true,
    sortable: true,
    renderCell: (params: { row: AssetRow; value: any }) => {
      const relatedAssets = params.row.relatedAssets;
      let activeCount = 0;
      let archivedCount = 0;
      
      if (Array.isArray(relatedAssets)) {
        const usesAssets = relatedAssets.filter(r => r.relationshipType === 'uses');
        activeCount = usesAssets.filter(r => !r.targetIsArchived).length;
        archivedCount = usesAssets.filter(r => r.targetIsArchived).length;
      } else if (relatedAssets?.uses) {
        activeCount = relatedAssets.uses.length;
      }
      
      const totalCount = activeCount + archivedCount;
      
      if (totalCount === 0) {
        return (
          <TypedChip
            type="RELATIONSHIP"
            count={0}
            size="small"
            variant="filled"
            showIcon={false}
            onClick={() => handlers.onRelatedAssetsClick?.(params.row, params.row.relatedAssets)}
          />
        );
      }
      
      return (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {activeCount > 0 && (
            <TypedChip
              type="RELATIONSHIP"
              count={activeCount}
              size="small"
              variant="filled"
              showIcon={false}
              onClick={() => handlers.onRelatedAssetsClick?.(params.row, params.row.relatedAssets)}
            />
          )}
          {archivedCount > 0 && (
            <Chip
              label={archivedCount}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.75rem',
                backgroundColor: alpha(colors.neutral[500], 0.1),
                color: colors.neutral[600],
                '&:hover': {
                  backgroundColor: alpha(colors.neutral[500], 0.2),
                  cursor: 'pointer',
                },
              }}
              onClick={() => handlers.onRelatedAssetsClick?.(params.row, params.row.relatedAssets)}
            />
          )}
        </Box>
      );
    },
    valueGetter: (params: { row: AssetRow }) => {
      const relatedAssets = params.row.relatedAssets;
      if (Array.isArray(relatedAssets)) {
        return relatedAssets.filter(r => r.relationshipType === 'uses').length;
      }
      return params.row.relatedAssets?.uses?.length || 0;
    },
  };
}

/**
 * Generate search match reasons column
 * Shows why assets matched a search query (name, tags, dependencies, etc.)
 */
export function generateSearchMatchReasonsColumn(): ColumnConfig {
  return {
    id: 'searchMatchReasons',
    label: 'Match',
    width: 120,
    visible: true,
    sortable: false,
    hideable: true,
    renderCell: (params: { row: AssetRow; value: any }) => {
      const reasons = params.row.searchMatchReasons;

      if (!reasons || reasons.length === 0) {
        return null;
      }

      return (
        <SearchMatchChipGroup
          reasons={reasons}
          maxVisible={2}
          compact
        />
      );
    },
    valueGetter: (params: { row: AssetRow }) => {
      const reasons = params.row.searchMatchReasons;
      return reasons ? reasons.join(', ') : '';
    },
  };
}