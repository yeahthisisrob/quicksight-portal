import {
  Close as CloseIcon,
  Search as SearchIcon,
  Storage as DatasetIcon,
  Assessment as AnalysisIcon,
  Dashboard as DashboardIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  TextField,
  InputAdornment,
  Chip,
} from '@mui/material';
import { useState } from 'react';

interface AssetListDialogProps {
  open: boolean;
  onClose: () => void;
  field: any;
  assetType: string;
  assets: any[];
}

export default function AssetListDialog({
  open,
  onClose,
  field,
  assetType,
  assets,
}: AssetListDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAssets = assets.filter(asset =>
    asset.assetName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.assetId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAssetIcon = () => {
    switch (assetType) {
      case 'dataset':
        return <DatasetIcon color="primary" />;
      case 'analysis':
        return <AnalysisIcon color="secondary" />;
      case 'dashboard':
        return <DashboardIcon color="success" />;
      default:
        return null;
    }
  };

  const getAssetTypeName = () => {
    switch (assetType) {
      case 'dataset':
        return 'Datasets';
      case 'analysis':
        return 'Analyses';
      case 'dashboard':
        return 'Dashboards';
      default:
        return 'Assets';
    }
  };

  const handleOpenAsset = (asset: any) => {
    // Navigate to asset detail page
    const path = `/${assetType}s/${asset.assetId}`;
    window.open(path, '_blank');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getAssetIcon()}
            <Typography variant="h6">
              {getAssetTypeName()} Using "{field?.fieldName}"
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            placeholder={`Search ${getAssetTypeName().toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {filteredAssets.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
            No {getAssetTypeName().toLowerCase()} found
          </Typography>
        ) : (
          <List>
            {filteredAssets.map((asset, index) => (
              <ListItem
                key={`${asset.assetId}-${index}`}
                disablePadding
                sx={{ mb: 1 }}
              >
                <ListItemButton
                  onClick={() => handleOpenAsset(asset)}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    '&:hover': {
                      bgcolor: 'action.hover',
                    }
                  }}
                >
                  <ListItemIcon>
                    {getAssetIcon()}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1">
                          {asset.assetName}
                        </Typography>
                        {asset.isCalculated && (
                          <Chip label="Calculated" size="small" color="primary" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        ID: {asset.assetId}
                      </Typography>
                    }
                  />
                  <IconButton size="small" edge="end">
                    <OpenIcon fontSize="small" />
                  </IconButton>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" align="center">
            Total: {filteredAssets.length} {assetType}{filteredAssets.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}