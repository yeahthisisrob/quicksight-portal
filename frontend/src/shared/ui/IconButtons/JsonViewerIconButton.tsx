import { Code as JsonIcon } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';

interface JsonViewerIconButtonProps {
  asset: any;
  assetType: string;
  onView: (state: { open: boolean; [key: string]: any }) => void;
  tooltip?: string;
}

export const JsonViewerIconButton = ({ 
  asset, 
  assetType, 
  onView, 
  tooltip = "View JSON" 
}: JsonViewerIconButtonProps) => {
  return (
    <Tooltip title={tooltip}>
      <IconButton
        size="small"
        onClick={() => onView({ open: true, [assetType]: asset })}
      >
        <JsonIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
};