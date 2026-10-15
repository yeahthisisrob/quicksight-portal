import { Close as CloseIcon } from '@mui/icons-material';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';

import { AssetRelationshipSection } from '@/shared/ui/AssetRelationshipSection';

type AssetListType = 'dashboard' | 'analysis' | 'dataset' | 'datasource';

export interface AssetListItem {
  id: string;
  name: string;
  type: AssetListType;
  /** A line under the id: where it is tied, what it is for. */
  hint?: string;
  isArchived?: boolean;
}

interface AssetListDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  assets: AssetListItem[];
  onAssetClick: (asset: AssetListItem) => void;
}

/** The order the sections come in: data first, then what reads it. */
const SECTION_ORDER: AssetListType[] = ['dataset', 'analysis', 'dashboard', 'datasource'];

/**
 * A list of assets behind a count: the same typed sections the asset pages
 * open from their relationship counts, one per asset type present, each row
 * a click through to the asset.
 */
export function AssetListDialog({
  open,
  onClose,
  title,
  description,
  assets,
  onAssetClick,
}: AssetListDialogProps) {
  const sections = SECTION_ORDER.filter((type) => assets.some((a) => a.type === type));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>
        {title}
        {description && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
            {description}
          </Typography>
        )}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sections.map((type) => (
            <AssetRelationshipSection
              key={type}
              type={type}
              assets={assets.filter((a) => a.type === type)}
              onAssetClick={(asset) => onAssetClick(asset as AssetListItem)}
            />
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
