import { MoreVert as MoreVertIcon } from '@mui/icons-material';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { useState } from 'react';

interface ActionsDropdownProps {
  asset: any;
  assetType: string;
  handlers: {
    navigate: (path: string) => void;
    onJsonViewerClick?: (asset: any, assetType: string) => void;
    onGroupUpdate?: (group: any) => void;
    onGroupDelete?: (group: any) => void;
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
        <MenuItem onClick={() => handleAction(() => handlers.onJsonViewerClick?.(asset, assetType))}>
          View JSON
        </MenuItem>
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