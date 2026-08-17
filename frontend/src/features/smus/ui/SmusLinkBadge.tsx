import { Hub as HubIcon } from '@mui/icons-material';
import { Box, Tooltip } from '@mui/material';

import type { SmusDatasetLink } from '@/shared/api/modules/smus';

/**
 * SMUS accent color (SageMaker purple) — deliberately distinct from the
 * portal's status palette so the indicator reads as "external catalog link",
 * not success/info. Defined once here.
 */
export const SMUS_ACCENT = '#8C4FFF';

interface SmusLinkBadgeProps {
  link: SmusDatasetLink;
  size?: number;
}

/**
 * Positive-only indicator that a QuickSight dataset has a matching catalog
 * item in the configured SMUS (SageMaker Unified Studio) domain. Rendered
 * beside the dataset name; unlinked datasets show nothing (no noise).
 */
export function SmusLinkBadge({ link, size = 16 }: SmusLinkBadgeProps) {
  if (!link.linked) return null;

  const matchLabel = link.matchType === 'source-table' ? 'matched by source table' : 'matched by name';

  return (
    <Tooltip
      title={`Linked to SMUS catalog: ${link.listingName || link.listingId} (${matchLabel})`}
      enterDelay={300}
    >
      <Box
        component="span"
        sx={{ display: 'inline-flex', alignItems: 'center', color: SMUS_ACCENT, flexShrink: 0 }}
        aria-label="Linked to SMUS catalog"
      >
        <HubIcon sx={{ fontSize: size }} />
      </Box>
    </Tooltip>
  );
}
