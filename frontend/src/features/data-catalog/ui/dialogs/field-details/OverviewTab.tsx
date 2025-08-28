/**
 * Overview tab for field details dialog
 */
import {
  Warning as WarningIcon,
  Dashboard as DashboardIcon,
  Dataset as DatasetIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import {
  Alert,
  alpha,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

interface OverviewTabProps {
  field: any;
  hasVariants: boolean;
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

export function OverviewTab({ field, hasVariants, groupedSources }: OverviewTabProps) {
  return (
    <Stack spacing={3}>
      {/* Basic Information */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Field Information
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Field Name</Typography>
            <Typography variant="body1" fontWeight={500}>{field.fieldName}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Data Type</Typography>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
              {hasVariants && field.variants?.length > 1 ? (
                <>
                  <Chip 
                    label={`${field.variants.length} Type Variants`} 
                    size="small" 
                    color="warning"
                    icon={<WarningIcon sx={{ fontSize: 16 }} />}
                  />
                  <Typography variant="caption" color="text.secondary">
                    ({field.variants.map((v: any) => `${v.dataType}: ${v.count}`).join(', ')})
                  </Typography>
                </>
              ) : (
                <Chip 
                  label={field.dataType || 'Unknown'} 
                  size="small" 
                  variant="outlined"
                  color="primary"
                />
              )}
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Usage Summary */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Usage Summary
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {Object.entries(groupedSources).map(([type, sources]: [string, any]) => {
            const config = assetTypeConfig[type as keyof typeof assetTypeConfig];
            if (!config) return null;
            
            return (
              <Grid item xs={12} sm={4} key={type}>
                <Card 
                  variant="outlined"
                  sx={{ 
                    bgcolor: config.bgColor,
                    borderColor: config.color,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 2,
                    }
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <config.icon sx={{ color: config.color, fontSize: 32, mb: 1 }} />
                    <Typography variant="h4" fontWeight={600} color={config.color}>
                      {sources.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {sources.length === 1 ? config.label : config.pluralLabel}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* Variants Details */}
      {hasVariants && field.variants?.length > 1 && (
        <Alert severity="warning" sx={{ bgcolor: 'warning.50' }}>
          <Typography variant="subtitle2" gutterBottom>
            Type Inconsistency Detected
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This field has {field.variants.length} different data type variants across your assets:
          </Typography>
          <Stack spacing={1} sx={{ mt: 2 }}>
            {field.variants.map((variant: any, idx: number) => (
              <Stack key={idx} direction="row" alignItems="center" spacing={2}>
                <Chip 
                  label={variant.dataType} 
                  size="small" 
                  color={idx === 0 ? "primary" : "default"}
                />
                <Typography variant="body2">
                  Used in {variant.count} {variant.count === 1 ? 'asset' : 'assets'}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}