import {
  DriveFileRenameOutline as RenameIcon,
  Hub as HubIcon,
  MoreVert as MoreVertIcon,
  OpenInNew as OpenInNewIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { memo, useState } from 'react';

import { SMUS_ACCENT } from '@/features/smus';

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
    onRenameClick?: (asset: any) => void;
  };
}

// Types the backend can rename live in QuickSight (datasources need
// connection params resent; users/groups have no rename API)
const RENAMEABLE_TYPES = ['dashboard', 'analysis', 'dataset', 'folder'];

// Memoized: rendered once per row, so stable props skip re-rendering all rows'
// menus when the grid re-renders
export const ActionsDropdown = memo(({ asset, assetType, handlers }: ActionsDropdownProps) => {
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
        {assetType === 'dataset' && asset.smusLink?.linked && asset.smusLink?.url && (
          <MenuItem onClick={() => handleAction(() => window.open(asset.smusLink.url, '_blank'))}>
            <HubIcon fontSize="small" sx={{ mr: 1, color: SMUS_ACCENT }} />
            View in SMUS
          </MenuItem>
        )}
        <MenuItem
          onClick={() => handleAction(() => handlers.navigate(`/assets/${assetType}s/${asset.id}/timeline`))}
        >
          <TimelineIcon fontSize="small" sx={{ mr: 1 }} />
          View Timeline
        </MenuItem>
        <MenuItem onClick={() => handleAction(() => handlers.onJsonViewerClick?.(asset, assetType))}>
          View JSON
        </MenuItem>
        {RENAMEABLE_TYPES.includes(assetType) && (
          <MenuItem onClick={() => handleAction(() => handlers.onRenameClick?.(asset))}>
            <RenameIcon fontSize="small" sx={{ mr: 1 }} />
            Rename
          </MenuItem>
        )}
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
});

ActionsDropdown.displayName = 'ActionsDropdown';