import {
  Dashboard as DashboardIcon,
  Storage as DatasetIcon,
  Analytics as AnalysisIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import {
  Box,
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';

import DatasourceTypeBadge from './DatasourceTypeBadge';

interface AssetReference {
  assetType: 'dataset' | 'analysis' | 'dashboard';
  assetId: string;
  assetName: string;
  datasetId?: string;
  datasetName?: string;
  datasourceType?: string;
  importMode?: 'SPICE' | 'DIRECT_QUERY';
}

interface FieldUsageBadgesProps {
  sources: AssetReference[];
}

export default function FieldUsageBadges({ sources }: FieldUsageBadgesProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>, type: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedType(type);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSelectedType(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar('Copied to clipboard', { variant: 'info' });
  };

  const open = Boolean(anchorEl);

  // Group sources by type
  const grouped = sources.reduce((acc, source) => {
    if (!acc[source.assetType]) {
      acc[source.assetType] = [];
    }
    acc[source.assetType].push(source);
    return acc;
  }, {} as Record<string, AssetReference[]>);

  const getIcon = (type: string) => {
    switch (type) {
      case 'dashboard':
        return <DashboardIcon fontSize="small" />;
      case 'analysis':
        return <AnalysisIcon fontSize="small" />;
      case 'dataset':
        return <DatasetIcon fontSize="small" />;
      default:
        return null;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'dashboard':
        return 'success';
      case 'analysis':
        return 'secondary';
      case 'dataset':
        return 'primary';
      default:
        return 'default';
    }
  };

  // Note: Unique datasets are displayed in the detail popover

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        {Object.entries(grouped).map(([type, items]) => (
          <IconButton
            key={type}
            size="small"
            onClick={(e) => handleClick(e, type)}
            sx={{ p: 0.5 }}
          >
            <Badge badgeContent={items.length} color={getColor(type)}>
              {getIcon(type)}
            </Badge>
          </IconButton>
        ))}
        <IconButton 
          size="small" 
          onClick={(e) => handleClick(e, 'all')}
          sx={{ p: 0.5, ml: 0.5 }}
        >
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, minWidth: 300, maxWidth: 500 }}>
          <Typography variant="subtitle2" gutterBottom>
            {selectedType === 'dashboard' && 'Dashboards'}
            {selectedType === 'analysis' && 'Analyses'}
            {selectedType === 'dataset' && 'Datasets'}
            {selectedType === 'all' && 'All Assets'}
          </Typography>
          <List dense>
            {selectedType === 'all' ? (
              // Show all items grouped by type
              Object.entries(grouped).map(([type, items]) => (
                <React.Fragment key={type}>
                  <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1, display: 'block' }}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}s ({items.length})
                  </Typography>
                  {items.map((item, index) => (
                    <React.Fragment key={`${type}-${index}`}>
                      <ListItem
                        secondaryAction={
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => copyToClipboard(item.assetId)}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {getIcon(type)}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.assetName}
                          secondary={
                            <>
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ fontFamily: 'monospace', fontSize: '0.7rem', display: 'block' }}
                              >
                                {item.assetId}
                              </Typography>
                              {item.datasetName && (
                                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                  <Typography component="span" variant="caption" color="text.secondary">
                                    Dataset: {item.datasetName}
                                  </Typography>
                                  <DatasourceTypeBadge
                                    datasourceType={item.datasourceType}
                                    importMode={item.importMode}
                                    compact
                                  />
                                </Box>
                              )}
                            </>
                          }
                        />
                      </ListItem>
                      {index < items.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))
            ) : (
              // Show items of selected type
              selectedType && grouped[selectedType]?.map((item, index) => (
                <React.Fragment key={index}>
                  <ListItem
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => copyToClipboard(item.assetId)}
                      >
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {getIcon(selectedType)}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.assetName}
                      secondary={
                        <>
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ fontFamily: 'monospace', fontSize: '0.7rem', display: 'block' }}
                          >
                            {item.assetId}
                          </Typography>
                          {item.datasetName && (
                            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <Typography component="span" variant="caption" color="text.secondary">
                                Dataset: {item.datasetName}
                              </Typography>
                              <DatasourceTypeBadge
                                datasourceType={item.datasourceType}
                                importMode={item.importMode}
                                compact
                              />
                            </Box>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                  {index < grouped[selectedType].length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))
            )}
          </List>
        </Box>
      </Popover>
    </>
  );
}