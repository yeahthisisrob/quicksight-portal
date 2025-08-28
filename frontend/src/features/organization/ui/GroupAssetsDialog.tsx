import {
  Dashboard as DashboardIcon,
  Storage as DatasetIcon,
  Analytics as AnalysisIcon,
  CloudQueue as DatasourceIcon,
  Folder as FolderIcon,
  Search as SearchIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import { useState, useEffect, useCallback } from 'react';

import { api } from '@/shared/api';
import { dataToCSV, downloadCSV, generateCSVFilename, type ExportColumn } from '@/shared/lib/exportUtils';

interface GroupAssetsDialogProps {
  open: boolean;
  onClose: () => void;
  group: {
    id: string;
    name: string;
  };
}

interface GroupAsset {
  assetId: string;
  assetType: string;
  assetName: string;
  arn: string;
  accessType: 'direct' | 'folder_inherited';
  folderPath?: string;
  permissions?: string[];
}

const assetTypeIcons: Record<string, React.ReactElement> = {
  dashboard: <DashboardIcon />,
  dataset: <DatasetIcon />,
  analysis: <AnalysisIcon />,
  datasource: <DatasourceIcon />,
  folder: <FolderIcon />,
};

export function GroupAssetsDialog({ open, onClose, group }: GroupAssetsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<GroupAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<GroupAsset[]>([]);
  const [assetsByType, setAssetsByType] = useState<Record<string, number>>({});
  const [totalAssets, setTotalAssets] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const filterAssets = useCallback(() => {
    let filtered = [...assets];

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(asset => asset.assetType === selectedType);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(asset => 
        asset.assetName.toLowerCase().includes(term) ||
        asset.assetId.toLowerCase().includes(term) ||
        asset.folderPath?.toLowerCase().includes(term)
      );
    }

    setFilteredAssets(filtered);
  }, [assets, selectedType, searchTerm]);

  const fetchGroupAssets = useCallback(async () => {
    if (!group) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/groups/${encodeURIComponent(group.name)}/assets`);
      // The API returns the data directly, not wrapped in success/data
      if (response.data) {
        setAssets(response.data.assets || []);
        setAssetsByType(response.data.assetsByType || {});
        setTotalAssets(response.data.totalAssets || 0);
      }
    } catch (err: any) {
      console.error('Failed to fetch group assets:', err);
      setError(err.response?.data?.error || 'Failed to fetch group assets');
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    if (open && group) {
      fetchGroupAssets();
    } else if (!open) {
      // Reset state when dialog closes
      setAssets([]);
      setFilteredAssets([]);
      setSearchTerm('');
      setSelectedType('all');
      setError(null);
    }
  }, [open, group, fetchGroupAssets]);

  useEffect(() => {
    filterAssets();
  }, [filterAssets]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setSelectedType(newValue);
  };

  const handleExportCSV = () => {
    const columns: ExportColumn[] = [
      { id: 'assetName', label: 'Asset Name' },
      { id: 'assetType', label: 'Type' },
      { id: 'assetId', label: 'Asset ID' },
      { id: 'accessType', label: 'Access Type' },
      { id: 'folderPath', label: 'Folder Path' },
      { 
        id: 'permissions', 
        label: 'Permission Level',
        getValue: (row) => getPermissionLabel(row.permissions)
      }
    ];

    const csvContent = dataToCSV(filteredAssets, columns);
    const filename = generateCSVFilename(`group-${group.name}-assets`);
    downloadCSV(csvContent, filename);
  };

  const getPermissionLabel = (permissions: string[] = []) => {
    if (permissions.includes('quicksight:UpdateDashboard') || 
        permissions.includes('quicksight:UpdateAnalysis') || 
        permissions.includes('quicksight:UpdateDataSet')) {
      return 'Edit';
    }
    if (permissions.includes('quicksight:DescribeDashboard') || 
        permissions.includes('quicksight:DescribeAnalysis') || 
        permissions.includes('quicksight:DescribeDataSet')) {
      return 'View';
    }
    return 'Access';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Assets for Group: {group.name}</Typography>
          {!loading && (
            <Chip 
              label={`${totalAssets} total assets`} 
              color="primary" 
              size="small"
            />
          )}
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            <Tabs 
              value={selectedType} 
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
            >
              <Tab label={`All (${totalAssets})`} value="all" />
              {Object.entries(assetsByType).map(([type, count]) => {
                // Map plural type names to singular for filtering
                const typeMap: Record<string, string> = {
                  'dashboards': 'dashboard',
                  'datasets': 'dataset',
                  'analyses': 'analysis',
                  'datasources': 'datasource',
                  'folders': 'folder'
                };
                
                return (
                  <Tab 
                    key={type} 
                    label={`${type.charAt(0).toUpperCase() + type.slice(1)} (${count})`} 
                    value={typeMap[type] || type} 
                  />
                );
              })}
            </Tabs>

            {filteredAssets.length === 0 ? (
              <Typography color="textSecondary" align="center" py={4}>
                {searchTerm || selectedType !== 'all' 
                  ? 'No assets match your filters' 
                  : 'This group has no asset permissions'}
              </Typography>
            ) : (
              <List>
                {filteredAssets.map((asset) => (
                  <ListItem key={`${asset.assetType}-${asset.assetId}`}>
                    <ListItemIcon>
                      {assetTypeIcons[asset.assetType] || <FolderIcon />}
                    </ListItemIcon>
                    <ListItemText
                      disableTypography
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body1">{asset.assetName}</Typography>
                          <Chip 
                            label={asset.accessType === 'folder_inherited' ? 'Inherited' : 'Direct'} 
                            size="small" 
                            color={asset.accessType === 'folder_inherited' ? 'default' : 'primary'}
                            variant="outlined"
                          />
                          {asset.permissions && (
                            <Chip 
                              label={getPermissionLabel(asset.permissions)} 
                              size="small" 
                              color="success"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" color="textSecondary">
                            {asset.assetType} • {asset.assetId}
                          </Typography>
                          {asset.folderPath && (
                            <Typography variant="caption" display="block" color="textSecondary">
                              Via folder: {asset.folderPath}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        {filteredAssets.length > 0 && (
          <Button 
            onClick={handleExportCSV}
            startIcon={<FileDownloadIcon />}
            color="primary"
          >
            Export CSV
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}