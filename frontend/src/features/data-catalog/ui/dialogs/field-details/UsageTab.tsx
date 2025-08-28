/**
 * Usage tab showing where field is used
 */
import {
  OpenInNew as OpenInNewIcon,
  Dashboard as DashboardIcon,
  Dataset as DatasetIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import {
  alpha,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface UsageTabProps {
  groupedSources: Record<string, any[]>;
}

const assetTypeConfig = {
  dataset: { 
    icon: DatasetIcon, 
    color: '#3B82F6',
    bgColor: alpha('#3B82F6', 0.1),
    path: '/assets/datasets',
    label: 'Dataset',
    pluralLabel: 'Datasets'
  },
  analysis: { 
    icon: AnalyticsIcon, 
    color: '#8B5CF6',
    bgColor: alpha('#8B5CF6', 0.1),
    path: '/assets/analyses',
    label: 'Analysis',
    pluralLabel: 'Analyses'
  },
  dashboard: { 
    icon: DashboardIcon, 
    color: '#10B981',
    bgColor: alpha('#10B981', 0.1),
    path: '/assets/dashboards',
    label: 'Dashboard',
    pluralLabel: 'Dashboards'
  },
};

export function UsageTab({ groupedSources }: UsageTabProps) {
  const navigate = useNavigate();
  
  const handleNavigateToAsset = (assetType: string, assetId: string) => {
    const config = assetTypeConfig[assetType as keyof typeof assetTypeConfig];
    if (config) {
      navigate(`${config.path}/${assetId}`);
    }
  };
  
  const assetGroups = Object.entries(groupedSources);
  
  if (assetGroups.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No usage information available
        </Typography>
      </Paper>
    );
  }
  
  return (
    <Stack spacing={3}>
      {assetGroups.map(([type, sources]: [string, any]) => {
        const config = assetTypeConfig[type as keyof typeof assetTypeConfig];
        if (!config) return null;
        
        return (
          <Paper key={type} variant="outlined" sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <config.icon sx={{ color: config.color }} />
              <Typography variant="subtitle2" fontWeight={600}>
                {config.pluralLabel} ({sources.length})
              </Typography>
            </Stack>
            
            <List dense>
              {sources.map((source: any, index: number) => (
                <React.Fragment key={source.assetId}>
                  <ListItem
                    secondaryAction={
                      <Tooltip title="Open Asset">
                        <IconButton 
                          edge="end" 
                          size="small"
                          onClick={() => handleNavigateToAsset(type, source.assetId)}
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemIcon>
                      <config.icon sx={{ color: config.color, fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={source.assetName || source.assetId}
                      secondary={
                        source.sheetName && (
                          <Typography variant="caption" color="text.secondary">
                            Sheet: {source.sheetName}
                          </Typography>
                        )
                      }
                    />
                  </ListItem>
                  {index < sources.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        );
      })}
    </Stack>
  );
}