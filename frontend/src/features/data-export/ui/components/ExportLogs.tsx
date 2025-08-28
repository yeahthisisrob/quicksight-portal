import {
  InfoOutlined as InfoIcon,
  WarningAmberOutlined as WarningIcon,
  ErrorOutlineOutlined as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AccessTime as TimeIcon,
  FilterListOutlined as FilterIcon,
} from '@mui/icons-material';
import {
  Box,
  Paper,
  Typography,
  Chip,
  alpha,
  IconButton,
  Tooltip,
  Collapse,
  useTheme,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { format } from 'date-fns';
import React from 'react';

import { colors } from '@/shared/design-system/theme';

interface ExportLogEntry {
  ts: number;
  msg: string;
  level?: 'info' | 'warn' | 'error';
  assetType?: string;
  assetId?: string;
  apiCalls?: number;
}

interface ExportLogsProps {
  logs: ExportLogEntry[];
  maxHeight?: number;
  showTimestamps?: boolean;
  defaultExpanded?: boolean;
}

export function ExportLogs({
  logs,
  maxHeight = 400,
  showTimestamps = true,
  defaultExpanded = true,
}: ExportLogsProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [showFilters, setShowFilters] = React.useState(false);
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>([]);

  // Get unique asset types from logs
  const availableTypes = React.useMemo(() => {
    const types = new Set<string>();
    logs.forEach(log => {
      if (log.assetType) {
        types.add(log.assetType);
      }
    });
    return Array.from(types).sort();
  }, [logs]);

  // Filter logs based on selected types and sort by timestamp descending (newest first)
  const filteredLogs = React.useMemo(() => {
    let filtered = logs;
    if (selectedTypes.length > 0) {
      filtered = logs.filter(log => 
        !log.assetType || selectedTypes.includes(log.assetType)
      );
    }
    // Sort by timestamp descending (newest first)
    return [...filtered].sort((a, b) => b.ts - a.ts);
  }, [logs, selectedTypes]);

  const handleTypeFilter = (_event: React.MouseEvent<HTMLElement>, newTypes: string[]) => {
    setSelectedTypes(newTypes);
  };

  const getLogIcon = (level?: string) => {
    switch (level) {
      case 'error':
        return <ErrorIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />;
      case 'warn':
        return <WarningIcon sx={{ fontSize: 16, color: theme.palette.warning.main }} />;
      default:
        return <InfoIcon sx={{ fontSize: 16, color: theme.palette.info.main }} />;
    }
  };

  const getLogColor = (level?: string) => {
    switch (level) {
      case 'error':
        return theme.palette.error.main;
      case 'warn':
        return theme.palette.warning.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  const getAssetTypeColor = (assetType?: string) => {
    switch (assetType) {
      case 'dashboard':
        return { bg: alpha('#1976d2', 0.08), border: alpha('#1976d2', 0.3) }; // Blue
      case 'analysis':
        return { bg: alpha('#388e3c', 0.08), border: alpha('#388e3c', 0.3) }; // Green
      case 'dataset':
        return { bg: alpha('#f57c00', 0.08), border: alpha('#f57c00', 0.3) }; // Orange
      case 'datasource':
        return { bg: alpha('#7b1fa2', 0.08), border: alpha('#7b1fa2', 0.3) }; // Purple
      case 'folder':
        return { bg: alpha('#616161', 0.08), border: alpha('#616161', 0.3) }; // Gray
      case 'user':
        return { bg: alpha('#00796b', 0.08), border: alpha('#00796b', 0.3) }; // Teal
      case 'group':
        return { bg: alpha('#c2185b', 0.08), border: alpha('#c2185b', 0.3) }; // Pink
      default:
        return { bg: 'transparent', border: 'transparent' };
    }
  };

  const formatTimestamp = (ts: number) => {
    return format(new Date(ts), 'MMM dd, HH:mm:ss.SSS');
  };

  if (logs.length === 0) {
    return (
      <Paper
        sx={{
          p: 3,
          background: alpha(colors.primary.light, 0.02),
          border: `1px solid ${alpha(colors.primary.main, 0.1)}`,
          borderRadius: '12px',
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="center" py={4}>
          <Typography variant="body2" color="text.secondary">
            No export logs available
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        background: alpha(colors.primary.light, 0.02),
        border: `1px solid ${alpha(colors.primary.main, 0.1)}`,
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${alpha(colors.primary.main, 0.08)}`,
          background: alpha(colors.primary.light, 0.03),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <TimeIcon sx={{ fontSize: 18, color: colors.primary.main }} />
          <Typography variant="subtitle2" fontWeight={600}>
            Export Progress & Activity
          </Typography>
          <Chip
            label={`${filteredLogs.length} of ${logs.length} entries`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.75rem',
              backgroundColor: alpha(colors.primary.main, 0.1),
              color: colors.primary.main,
            }}
          />
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          {availableTypes.length > 0 && (
            <Tooltip title="Filter by asset type">
              <IconButton
                size="small"
                onClick={() => setShowFilters(!showFilters)}
                sx={{
                  color: showFilters ? colors.primary.main : theme.palette.text.secondary,
                  '&:hover': {
                    backgroundColor: alpha(colors.primary.main, 0.08),
                  },
                }}
              >
                <FilterIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={expanded ? 'Collapse logs' : 'Expand logs'}>
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{
                color: colors.primary.main,
                '&:hover': {
                  backgroundColor: alpha(colors.primary.main, 0.08),
                },
              }}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Filter Controls */}
      <Collapse in={showFilters && availableTypes.length > 0}>
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: `1px solid ${alpha(colors.primary.main, 0.08)}`,
            backgroundColor: alpha(colors.primary.light, 0.01),
          }}
        >
          <Typography variant="caption" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
            Filter by asset type:
          </Typography>
          <ToggleButtonGroup
            value={selectedTypes}
            onChange={handleTypeFilter}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                fontSize: '0.7rem',
                height: 24,
                px: 1,
                textTransform: 'none',
                fontFamily: 'monospace',
              }
            }}
          >
            {availableTypes.map(type => {
              const assetColors = getAssetTypeColor(type);
              return (
                <ToggleButton
                  key={type}
                  value={type}
                  sx={{
                    backgroundColor: selectedTypes.includes(type) ? assetColors.bg : 'transparent',
                    borderColor: assetColors.border,
                    color: selectedTypes.includes(type) ? assetColors.border : theme.palette.text.secondary,
                    '&:hover': {
                      backgroundColor: assetColors.bg,
                    },
                    '&.Mui-selected': {
                      backgroundColor: assetColors.bg,
                      color: assetColors.border,
                      '&:hover': {
                        backgroundColor: alpha(assetColors.border, 0.15),
                      },
                    },
                  }}
                >
                  {type}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        </Box>
      </Collapse>

      {/* Log Entries */}
      <Collapse in={expanded}>
        <Box
          sx={{
            maxHeight,
            overflowY: 'auto',
            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            borderRadius: '4px',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: alpha(theme.palette.divider, 0.1),
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: alpha(theme.palette.divider, 0.3),
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: alpha(theme.palette.divider, 0.5),
              },
            },
          }}
        >
          {/* Fixed Header */}
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              backgroundColor: theme.palette.background.paper,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            }}
          >
            <Box display="flex" alignItems="center" sx={{ minHeight: '40px' }}>
              <Box sx={{ width: '24px', padding: '8px 4px', textAlign: 'center' }}>
                <Typography variant="caption" fontWeight={600}></Typography>
              </Box>
              {showTimestamps && (
                <Box sx={{ 
                  width: '160px', 
                  padding: '6px 8px',
                  backgroundColor: alpha(colors.primary.light, 0.05),
                }}>
                  <Typography variant="caption" fontWeight={600}>Time</Typography>
                </Box>
              )}
              <Box sx={{ 
                width: '70px', 
                padding: '6px 8px',
                backgroundColor: alpha(colors.primary.light, 0.05),
              }}>
                <Typography variant="caption" fontWeight={600}>Duration</Typography>
              </Box>
              <Box sx={{ 
                width: '80px', 
                padding: '6px 8px',
                backgroundColor: alpha(colors.primary.light, 0.05),
              }}>
                <Typography variant="caption" fontWeight={600}>API Calls</Typography>
              </Box>
              <Box sx={{ 
                width: '110px', 
                padding: '6px 8px',
                backgroundColor: alpha(colors.primary.light, 0.05),
              }}>
                <Typography variant="caption" fontWeight={600}>Type</Typography>
              </Box>
              <Box sx={{ 
                flex: 1,
                padding: '6px 8px',
                backgroundColor: alpha(colors.primary.light, 0.05),
              }}>
                <Typography variant="caption" fontWeight={600}>Message</Typography>
              </Box>
            </Box>
          </Box>
          
          {/* Log Rows */}
          {filteredLogs.map((log, index) => {
            // Find the earliest timestamp from the original logs array (not filtered/sorted)
            const startTime = Math.min(...logs.map(l => l.ts));
            const runningDuration = ((log.ts - startTime) / 1000).toFixed(1);
            const assetColors = getAssetTypeColor(log.assetType);
            
            return (
              <Box
                key={`${log.ts}-${index}`}
                display="flex"
                alignItems="center"
                sx={{
                  minHeight: '28px',
                  backgroundColor: assetColors.bg,
                  borderLeft: log.assetType ? `3px solid ${assetColors.border}` : 'none',
                  '&:hover': {
                    backgroundColor: log.assetType 
                      ? alpha(assetColors.border, 0.12)
                      : alpha(colors.primary.light, 0.03),
                  },
                  borderBottom: index < filteredLogs.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : 'none',
                }}
              >
                {/* Level Icon */}
                <Box sx={{ width: '24px', padding: '4px 2px', textAlign: 'center' }}>
                  {getLogIcon(log.level)}
                </Box>
                
                {/* Timestamp */}
                {showTimestamps && (
                  <Box sx={{ 
                    width: '160px',
                    padding: '4px 6px',
                    fontFamily: 'monospace',
                    fontSize: '0.7rem',
                    color: alpha(theme.palette.text.secondary, 0.8),
                  }}>
                    {formatTimestamp(log.ts)}
                  </Box>
                )}
                
                {/* Running Duration */}
                <Box sx={{ 
                  width: '70px',
                  padding: '4px 6px',
                  fontFamily: 'monospace',
                  fontSize: '0.7rem',
                  color: alpha(theme.palette.text.secondary, 0.8),
                  textAlign: 'right',
                }}>
                  +{runningDuration}s
                </Box>
                
                {/* API Calls */}
                <Box sx={{ 
                  width: '80px',
                  padding: '4px 6px',
                  fontFamily: 'monospace',
                  fontSize: '0.7rem',
                  color: alpha(theme.palette.text.secondary, 0.8),
                  textAlign: 'center',
                }}>
                  {log.apiCalls || '-'}
                </Box>
                
                {/* Asset Type */}
                <Box sx={{ width: '110px', padding: '4px 6px' }}>
                  {log.assetType && (
                    <Chip
                      label={log.assetType}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        backgroundColor: alpha(colors.primary.main, 0.08),
                        color: colors.primary.dark,
                        fontFamily: 'monospace',
                      }}
                    />
                  )}
                </Box>
                
                {/* Message */}
                <Box sx={{ 
                  flex: 1,
                  padding: '4px 6px',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: getLogColor(log.level),
                  wordBreak: 'break-word',
                }}>
                  {log.msg}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Paper>
  );
}