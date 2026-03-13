import { MoreVert as MoreVertIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { useState } from 'react';

import { getQuickSightConsoleUrl } from '@/shared/lib/assetTypeUtils';

interface ActionsDropdownProps {
  asset: any;
  assetType: string;
  handlers: {
    navigate: (path: string) => void;
    onJsonViewerClick?: (asset: any, assetType: string) => void;
    onGroupUpdate?: (group: any) => void;
    onGroupDelete?: (group: any) => void;
    onUserDelete?: (user: any) => void;
    onNotifyInactive?: (asset: any) => void;
    onNotifyInactiveAnalyses?: (asset: any) => void;
    onNotifyUnusedDatasets?: (asset: any) => void;
  };
}

export const ActionsDropdown = ({ asset, assetType, handlers }: ActionsDropdownProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (action: () => void) => {
    action();
    handleClose();
  };

  return (
    <>
      <IconButton
        size="small"
        onClick={handleClick}
        sx={{ 
          '&:hover': { backgroundColor: 'action.hover' },
          color: 'text.secondary',
          padding: '4px',
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => handleAction(() => handlers.navigate(`/assets/${assetType}s/${asset.id}`))}>
          View Details
        </MenuItem>
        {!['user', 'group'].includes(assetType) && (
          <MenuItem onClick={() => handleAction(() => {
            const url = getQuickSightConsoleUrl(assetType, asset.id);
            if (url) window.open(url, '_blank');
          })}>
            <OpenInNewIcon fontSize="small" sx={{ mr: 1 }} />
            Open in QuickSight
          </MenuItem>
        )}
        <MenuItem onClick={() => handleAction(() => handlers.onJsonViewerClick?.(asset, assetType))}>
          View JSON
        </MenuItem>
        {(assetType === 'dashboard' || assetType === 'analysis') && (
          <MenuItem onClick={() => handleAction(() => handlers.onNotifyInactive?.(asset))}>
            Notify Inactive
          </MenuItem>
        )}
        {assetType === 'user' && (
          <MenuItem onClick={() => handleAction(() => handlers.onNotifyInactiveAnalyses?.(asset))}>
            Notify Inactive Analyses
          </MenuItem>
        )}
        {assetType === 'user' && (
          <MenuItem onClick={() => handleAction(() => handlers.onNotifyUnusedDatasets?.(asset))}>
            Notify Unused Datasets
          </MenuItem>
        )}
        {assetType === 'user' && ['READER', 'READER_PRO'].includes(asset.role) && (
          <MenuItem
            onClick={() => handleAction(() => handlers.onUserDelete?.(asset))}
            sx={{ color: 'error.main' }}
          >
            Delete User
          </MenuItem>
        )}
        {assetType === 'group' && (
          <>
            <MenuItem onClick={() => handleAction(() => handlers.onGroupUpdate?.(asset))}>
              Edit Description
            </MenuItem>
            <MenuItem onClick={() => handleAction(() => handlers.onGroupDelete?.(asset))}>
              Delete Group
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
};