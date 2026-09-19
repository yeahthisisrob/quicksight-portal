import { Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material';

import { pal } from '@/shared/design-system';

import type { AssetType } from '../../model/types';
import { assetTypeConfig } from '../constants';

interface AssetTypeSelectorProps {
  selectedTypes: AssetType[];
  onToggle: (assetType: AssetType) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  counts?: Record<AssetType, number>;
  disabled?: boolean;
}

/**
 * Which asset types an export covers. Each type is a chip in its asset hue
 * (icon, label, cached count); the description lives in the tooltip.
 * Types that cannot be exported yet stay visible but inert.
 */
export default function AssetTypeSelector({
  selectedTypes,
  onToggle,
  onSelectAll,
  onClearAll,
  counts,
  disabled = false,
}: AssetTypeSelectorProps) {
  const selectableTypes = Object.entries(assetTypeConfig).filter(([, config]) => !config.disabled);
  const allSelected = selectableTypes.every(([assetType]) =>
    selectedTypes.includes(assetType as AssetType)
  );

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Stack sx={{ alignItems: 'center' }} direction="row" spacing={1}>
          <Typography variant="subtitle2">Asset types</Typography>
          <Typography variant="caption" color="text.secondary">
            {selectedTypes.length} of {selectableTypes.length} selected
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <Button
            size="small"
            onClick={onSelectAll}
            disabled={disabled || !onSelectAll || allSelected}
          >
            Select all
          </Button>
          <Button
            size="small"
            onClick={onClearAll}
            disabled={disabled || !onClearAll || selectedTypes.length === 0}
          >
            Clear
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {Object.entries(assetTypeConfig).map(([assetType, config]) => {
          const isSelected = selectedTypes.includes(assetType as AssetType);
          const count = counts?.[assetType as AssetType] || 0;
          const isAssetDisabled = disabled || Boolean(config.disabled);
          const Icon = config.icon;

          const chip = (
            <Chip
              key={assetType}
              icon={<Icon fontSize="small" />}
              label={
                config.comingSoon
                  ? `${config.label} (soon)`
                  : count > 0
                    ? `${config.label} · ${count.toLocaleString()}`
                    : config.label
              }
              clickable={!isAssetDisabled}
              disabled={isAssetDisabled}
              onClick={() => !isAssetDisabled && onToggle(assetType as AssetType)}
              variant={isSelected && !isAssetDisabled ? 'filled' : 'outlined'}
              sx={(theme) => {
                const hue = pal(theme).asset[config.hue];
                return {
                  fontWeight: isSelected ? 600 : 400,
                  '& .MuiChip-icon': { color: hue.main },
                  ...(isSelected && !isAssetDisabled
                    ? {
                        bgcolor: hue.subtle,
                        color: hue.strong,
                        border: `1px solid ${hue.main}`,
                        '&:hover': { bgcolor: hue.subtle },
                      }
                    : {}),
                };
              }}
            />
          );

          return isAssetDisabled ? (
            chip
          ) : (
            <Tooltip key={assetType} title={config.description} enterDelay={500}>
              {chip}
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}
