import { Chip, Tooltip, Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

interface DatasourceTypeBadgeProps {
  datasourceType?: string;
  importMode?: 'SPICE' | 'DIRECT_QUERY';
  compact?: boolean;
}

const StyledChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'datasourceType',
})<{ datasourceType?: string }>(({ theme, datasourceType }) => {
  // Define colors for different datasource types
  const getColor = () => {
    if (!datasourceType) return theme.palette.grey[400];
    
    const lowerType = datasourceType.toLowerCase();
    if (lowerType.includes('redshift')) return '#E31C58';
    if (lowerType.includes('s3')) return '#FF9900';
    if (lowerType.includes('athena')) return '#232F3E';
    if (lowerType.includes('rds') || lowerType.includes('aurora')) return '#146EB4';
    if (lowerType.includes('postgresql')) return '#336791';
    if (lowerType.includes('mysql')) return '#00758F';
    if (lowerType.includes('uploaded') || lowerType.includes('file')) return '#5C6BC0';
    if (lowerType.includes('custom')) return '#00897B';
    return theme.palette.primary.main;
  };

  return {
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[50],
    borderColor: getColor(),
    color: getColor(),
    borderWidth: 1.5,
    fontSize: '0.75rem',
    fontWeight: 500,
    height: 24,
    '& .MuiChip-label': {
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
  };
});

const ImportModeChip = styled(Chip)<{ mode?: string }>(({ theme, mode }) => ({
  backgroundColor: mode === 'SPICE' ? '#E8F5E9' : '#E3F2FD',
  color: mode === 'SPICE' ? '#2E7D32' : '#1565C0',
  fontSize: '0.7rem',
  fontWeight: 600,
  height: 20,
  marginLeft: theme.spacing(0.5),
  '& .MuiChip-label': {
    paddingLeft: theme.spacing(0.75),
    paddingRight: theme.spacing(0.75),
  },
}));

export default function DatasourceTypeBadge({ datasourceType, importMode, compact = false }: DatasourceTypeBadgeProps) {
  if (!datasourceType && !importMode) {
    return null;
  }

  const formatDatasourceType = (type: string) => {
    // Map QuickSight datasource types to friendly names
    const typeMap: Record<string, string> = {
      'AMAZONELASTICSEARCH': 'Elasticsearch',
      'ATHENA': 'Athena',
      'AURORA': 'Aurora',
      'AURORA_POSTGRESQL': 'Aurora PG',
      'MARIADB': 'MariaDB',
      'MYSQL': 'MySQL',
      'POSTGRESQL': 'PostgreSQL',
      'PRESTO': 'Presto',
      'REDSHIFT': 'Redshift',
      'S3': 'S3',
      'SNOWFLAKE': 'Snowflake',
      'SPARK': 'Spark',
      'SQLSERVER': 'SQL Server',
      'TERADATA': 'Teradata',
      'TIMESTREAM': 'Timestream',
      'TWITTER': 'Twitter',
      'BIGQUERY': 'BigQuery',
      'DATABRICKS': 'Databricks',
      'FILE': 'File',
      'COMPOSITE': 'Composite',
      'Custom SQL': 'SQL',
      'Uploaded File': 'File',
      'Database': 'Database',
      'Unknown': 'Unknown'
    };
    
    const mapped = typeMap[type] || type;
    
    // Apply compact formatting if needed
    if (mapped.length > 10 && compact) {
      return mapped.substring(0, 8) + '...';
    }
    return mapped;
  };

  const chipContent = (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      {datasourceType && (
        <StyledChip
          label={formatDatasourceType(datasourceType)}
          variant="outlined"
          size="small"
          datasourceType={datasourceType}
        />
      )}
      {importMode && (
        <ImportModeChip
          label={importMode === 'SPICE' ? 'SPICE' : 'DQ'}
          size="small"
          mode={importMode}
        />
      )}
    </Box>
  );

  if (!datasourceType && importMode) {
    return (
      <ImportModeChip
        label={importMode === 'SPICE' ? 'SPICE' : 'Direct Query'}
        size="small"
        mode={importMode}
      />
    );
  }

  return (
    <Tooltip 
      title={
        <Box>
          {datasourceType && (
            <Typography variant="body2">
              Datasource: {datasourceType}
            </Typography>
          )}
          {importMode && (
            <Typography variant="body2">
              Mode: {importMode === 'SPICE' ? 'SPICE (In-Memory)' : 'Direct Query'}
            </Typography>
          )}
        </Box>
      }
    >
      {chipContent}
    </Tooltip>
  );
}