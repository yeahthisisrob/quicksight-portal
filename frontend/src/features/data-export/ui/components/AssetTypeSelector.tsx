import { Box, Button, Chip, Stack, Tooltip, Typography, alpha } from '@mui/material';

import { spacing } from '@/shared/design-system/theme';

import { AssetType } from '../../model/types';
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
 * Compact multi-select for export asset types. Each type renders as a
 * selectable chip (icon + label + optional cached count); the full
 * description lives in the tooltip. Disabled/coming-soon types stay
 * visible but inert.
 */
export default function AssetTypeSelector({
  selectedTypes,
  onToggle,
  onSelectAll,
  onClearAll,
  counts,
  disabled = false,
}: AssetTypeSelectorProps) {
  const selectableTypes = Object.entries(assetTypeConfig).filter(
    ([, config]) => !(config as any).disabled
  );
  const allSelected = selectableTypes.every(([assetType]) =>
    selectedTypes.includes(assetType as AssetType)
  );

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: spacing.sm / 8 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Asset Types
          </Typography>
          <Chip
            label={`${selectedTypes.length} of ${selectableTypes.length} selected`}
            size="small"
            color={selectedTypes.length > 0 ? 'primary' : 'default'}
            variant="outlined"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <Button
            size="small"
            onClick={onSelectAll}
            disabled={disabled || !onSelectAll || allSelected}
            sx={{ minWidth: 0, textTransform: 'none' }}
          >
            Select all
          </Button>
          <Button
            size="small"
            onClick={onClearAll}
            disabled={disabled || !onClearAll || selectedTypes.length === 0}
            sx={{ minWidth: 0, textTransform: 'none' }}
          >
            Clear
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {Object.entries(assetTypeConfig).map(([assetType, config]) => {
          const isSelected = selectedTypes.includes(assetType as AssetType);
          const count = counts?.[assetType as AssetType] || 0;
          const isAssetDisabled = disabled || (config as any).disabled;
          const comingSoon = Boolean((config as any).comingSoon);
          const Icon = config.icon;

          const chip = (
            <Chip
              key={assetType}
              icon={<Icon sx={{ fontSize: 18 }} />}
              label={
                comingSoon
                  ? `${config.label} (soon)`
                  : count > 0
                    ? `${config.label} · ${count.toLocaleString()}`
                    : config.label
              }
              clickable={!isAssetDisabled}
              disabled={isAssetDisabled}
              onClick={() => !isAssetDisabled && onToggle(assetType as AssetType)}
              variant={isSelected && !isAssetDisabled ? 'filled' : 'outlined'}
              sx={{
                height: 32,
                fontWeight: isSelected ? 600 : 400,
                ...(isSelected && !isAssetDisabled
                  ? {
                      bgcolor: alpha(config.color, 0.12),
                      color: config.color,
                      border: `1px solid ${alpha(config.color, 0.5)}`,
                      '& .MuiChip-icon': { color: config.color },
                      '&:hover': { bgcolor: alpha(config.color, 0.2) },
                    }
                  : {
                      '& .MuiChip-icon': { color: config.color },
                    }),
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
