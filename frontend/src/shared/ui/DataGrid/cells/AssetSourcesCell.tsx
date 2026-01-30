import { Box, Chip, Stack, Tooltip } from '@mui/material';
import React from 'react';

export interface AssetSource {
  assetType: 'dataset' | 'analysis' | 'dashboard';
  assetId: string;
  assetName?: string;
}

export interface AssetSourcesCellProps {
  /** Array of asset sources */
  sources: AssetSource[];
}

const assetTypeConfig: Record<
  AssetSource['assetType'],
  { label: string; pluralLabel: string; color: 'success' | 'secondary' | 'error' }
> = {
  dataset: { label: 'dataset', pluralLabel: 'datasets', color: 'success' },
  analysis: { label: 'analysis', pluralLabel: 'analyses', color: 'secondary' },
  dashboard: { label: 'dashboard', pluralLabel: 'dashboards', color: 'error' },
};

/**
 * Reusable cell component for displaying asset sources with tooltips.
 * Groups sources by asset type and shows counts with asset names in tooltips.
 */
export const AssetSourcesCell: React.FC<AssetSourcesCellProps> = ({ sources }) => {
  const groupedSources = React.useMemo(() => {
    const groups: Record<AssetSource['assetType'], AssetSource[]> = {
      dataset: [],
      analysis: [],
      dashboard: [],
    };
    sources.forEach((source) => {
      if (groups[source.assetType]) {
        groups[source.assetType].push(source);
      }
    });
    return groups;
  }, [sources]);

  const getTooltipContent = (items: AssetSource[], type: string) => {
    if (items.length === 0) return '';
    const names = items.map((s) => s.assetName || s.assetId).join('\n');
    return `${type}:\n${names}`;
  };

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {(Object.keys(assetTypeConfig) as AssetSource['assetType'][]).map((type) => {
        const items = groupedSources[type];
        if (items.length === 0) return null;

        const config = assetTypeConfig[type];
        const label = `${items.length} ${items.length > 1 ? config.pluralLabel : config.label}`;
        const tooltipTitle =
          type.charAt(0).toUpperCase() + type.slice(1) + 's';

        return (
          <Tooltip
            key={type}
            title={
              <Box sx={{ whiteSpace: 'pre-line' }}>
                {getTooltipContent(items, tooltipTitle)}
              </Box>
            }
            arrow
          >
            <Chip
              label={label}
              size="small"
              variant="outlined"
              color={config.color}
            />
          </Tooltip>
        );
      })}
    </Stack>
  );
};

export default AssetSourcesCell;
