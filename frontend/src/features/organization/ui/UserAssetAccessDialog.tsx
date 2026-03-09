import {
  Dashboard as DashboardIcon,
  Storage as DatasetIcon,
  Analytics as AnalysisIcon,
  CloudQueue as DatasourceIcon,
  Folder as FolderIcon,
  Person as PersonIcon,
  People as PeopleIcon,
  Search as SearchIcon,
  FileDownload as FileDownloadIcon,
  MoreVert as MoreVertIcon,
  OpenInNew as OpenInNewIcon,
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
  Tooltip,
  alpha,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import { useState, useEffect, useCallback } from 'react';

import { assetsApi } from '@/shared/api';
import { colors } from '@/shared/design-system/theme';
import { getQuickSightConsoleUrl } from '@/shared/lib/assetTypeUtils';
import { dataToCSV, downloadCSV, generateCSVFilename, type ExportColumn } from '@/shared/lib/exportUtils';

import type { components } from '@shared/generated/types';

type UserAssetAccessItem = components['schemas']['UserAssetAccessItem'];
type AccessSource = components['schemas']['AccessSource'];

interface UserAssetAccessDialogProps {
  open: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string;
  };
}

const assetTypeIcons: Record<string, React.ReactElement> = {
  dashboard: <DashboardIcon />,
  dataset: <DatasetIcon />,
  analysis: <AnalysisIcon />,
  datasource: <DatasourceIcon />,
  folder: <FolderIcon />,
};

const ACCESS_SOURCE_CONFIG: Record<string, { label: string; color: string; icon: typeof PersonIcon }> = {
  direct: { label: 'Direct', color: colors.assetTypes.user.main, icon: PersonIcon },
  group: { label: 'Via Group', color: colors.assetTypes.group.main, icon: PeopleIcon },
  folder: { label: 'Via Folder', color: '#ed6c02', icon: FolderIcon },
};

function AccessSourceChip({ source }: { source: AccessSource }) {
  const config = ACCESS_SOURCE_CONFIG[source.type] || ACCESS_SOURCE_CONFIG.direct;
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
          fontWeight: 500,
          fontSize: 11,
          height: 20,
          '& .MuiChip-label': { px: 0.75 },
          '& .MuiChip-icon': { color: config.color, ml: 0.5 },
        }}
      />
    </Tooltip>
  );
}

export function UserAssetAccessDialog({ open, onClose, user }: UserAssetAccessDialogProps) {
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<UserAssetAccessItem[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<UserAssetAccessItem[]>([]);
  const [assetsByType, setAssetsByType] = useState<Record<string, number>>({});
  const [totalAssets, setTotalAssets] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [accessFilter, setAccessFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuAsset, setMenuAsset] = useState<UserAssetAccessItem | null>(null);

  const handleOpenInQuickSight = () => {
    if (!menuAsset) return;
    const url = getQuickSightConsoleUrl(menuAsset.assetType, menuAsset.assetId);
    if (url) {
      window.open(url, '_blank');
    }
    setMenuAnchor(null);
    setMenuAsset(null);
  };

  const filterAssets = useCallback(() => {
    let filtered = [...assets];

    if (selectedType !== 'all') {
      filtered = filtered.filter(asset => asset.assetType === selectedType);
    }

    if (accessFilter !== 'all') {
      filtered = filtered.filter(asset =>
        asset.sources.some(s => {
          if (accessFilter === 'direct') return s.type === 'direct';
          if (accessFilter === 'group') return s.type === 'group';
          if (accessFilter === 'folder') return s.type === 'folder';
          return true;
        })
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(asset =>
        asset.assetName.toLowerCase().includes(term) ||
        asset.assetId.toLowerCase().includes(term) ||
        asset.sources.some(s =>
          s.groupName?.toLowerCase().includes(term) ||
          s.folderName?.toLowerCase().includes(term)
        )
      );
    }

    setFilteredAssets(filtered);
  }, [assets, selectedType, accessFilter, searchTerm]);

  const fetchUserAssetAccess = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      const response = await assetsApi.getUserAssetAccess(user.name);
      setAssets(response.assets || []);
      setAssetsByType(response.assetsByType || {});
      setTotalAssets(response.totalAssets || 0);
    } catch (err: any) {
      console.error('Failed to fetch user asset access:', err);
      setError(err.message || 'Failed to fetch user asset access');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open && user) {
      fetchUserAssetAccess();
    } else if (!open) {
      setAssets([]);
      setFilteredAssets([]);
      setSearchTerm('');
      setSelectedType('all');
      setAccessFilter('all');
      setError(null);
    }
  }, [open, user, fetchUserAssetAccess]);

  useEffect(() => {
    filterAssets();
  }, [filterAssets]);

  const handleExportCSV = () => {
    const columns: ExportColumn[] = [
      { id: 'assetName', label: 'Asset Name' },
      { id: 'assetType', label: 'Type' },
      { id: 'assetId', label: 'Asset ID' },
      {
        id: 'sources',
        label: 'Access Sources',
        getValue: (row) => row.sources.map((s: AccessSource) => {
          if (s.type === 'direct') return 'Direct';
          if (s.type === 'group') return `Via Group: ${s.groupName}`;
          if (s.type === 'folder') return `Via Folder: ${s.folderPath}${s.groupName ? ` (group: ${s.groupName})` : ''}`;
          return s.type;
        }).join('; ')
      },
    ];

    const csvContent = dataToCSV(filteredAssets, columns);
    const filename = generateCSVFilename(`user-${user.name}-asset-access`);
    downloadCSV(csvContent, filename);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Asset Access: {user.name}</Typography>
          {!loading && (
            <Chip
              label={`${totalAssets} assets`}
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
              placeholder="Search assets, groups, folders..."
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
              onChange={(_e, v) => setSelectedType(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
            >
              <Tab label={`All (${totalAssets})`} value="all" />
              {Object.entries(assetsByType).map(([type, count]) => {
                const typeMap: Record<string, string> = {
                  dashboards: 'dashboard',
                  datasets: 'dataset',
                  analyses: 'analysis',
                  datasources: 'datasource',
                  folders: 'folder',
                };
                if (!count) return null;
                return (
                  <Tab
                    key={type}
                    label={`${type.charAt(0).toUpperCase() + type.slice(1)} (${count})`}
                    value={typeMap[type] || type}
                  />
                );
              })}
            </Tabs>

            <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
              {['all', 'direct', 'group', 'folder'].map((filter) => (
                <Chip
                  key={filter}
                  label={filter === 'all' ? 'All Access' : filter === 'direct' ? 'Direct' : filter === 'group' ? 'Via Group' : 'Via Folder'}
                  size="small"
                  variant={accessFilter === filter ? 'filled' : 'outlined'}
                  color={accessFilter === filter ? 'primary' : 'default'}
                  onClick={() => setAccessFilter(filter)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>

            {filteredAssets.length === 0 ? (
              <Typography color="textSecondary" align="center" py={4}>
                {searchTerm || selectedType !== 'all' || accessFilter !== 'all'
                  ? 'No assets match your filters'
                  : 'This user has no asset access'}
              </Typography>
            ) : (
              <>
                <List>
                  {filteredAssets.map((asset) => (
                    <ListItem
                      key={`${asset.assetType}-${asset.assetId}`}
                      secondaryAction={
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            setMenuAnchor(e.currentTarget);
                            setMenuAsset(asset);
                          }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      }
                    >
                      <ListItemIcon>
                        {assetTypeIcons[asset.assetType] || <FolderIcon />}
                      </ListItemIcon>
                      <ListItemText
                        disableTypography
                        primary={
                          <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                            <Typography variant="body2">{asset.assetName}</Typography>
                            {asset.sources.map((source, idx) => (
                              <AccessSourceChip key={idx} source={source} />
                            ))}
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="textSecondary">
                            {asset.assetType} &bull; {asset.assetId}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
                <Menu
                  anchorEl={menuAnchor}
                  open={Boolean(menuAnchor)}
                  onClose={() => { setMenuAnchor(null); setMenuAsset(null); }}
                >
                  <MenuItem onClick={handleOpenInQuickSight}>
                    <OpenInNewIcon fontSize="small" sx={{ mr: 1 }} />
                    Open in QuickSight
                  </MenuItem>
                </Menu>
              </>
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
