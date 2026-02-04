import { Typography } from '@mui/material';
import React from 'react';

import { colors, spacing } from '@/shared/design-system/theme';

interface FilterStatsProps {
  tagKeyCount: number;
  tagValueCount: number;
  folderCount: number;
  assetCount: number;
}

export const FilterStats: React.FC<FilterStatsProps> = ({
  tagKeyCount,
  tagValueCount,
  folderCount,
  assetCount,
}) => {
  if (tagKeyCount === 0 && folderCount === 0 && assetCount === 0) {
    return null;
  }

  const parts: string[] = [];
  if (tagKeyCount > 0) {
    parts.push(`${tagKeyCount} tag keys | ${tagValueCount} tag values`);
  }
  if (folderCount > 0) {
    parts.push(`${folderCount} folders`);
  }
  if (assetCount > 0) {
    parts.push(`${assetCount} assets`);
  }

  return (
    <Typography
      variant="caption"
      sx={{ mt: spacing.sm / 8, display: 'block', color: colors.neutral[600] }}
    >
      {parts.join(' | ')}
    </Typography>
  );
};
