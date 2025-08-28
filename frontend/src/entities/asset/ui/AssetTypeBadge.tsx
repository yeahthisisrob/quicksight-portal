import TypedChip from '@/shared/ui/TypedChip';

import { AssetType } from '../model';

interface AssetTypeBadgeProps {
  type: AssetType;
  size?: 'small' | 'medium';
}

export function AssetTypeBadge({ type, size = 'small' }: AssetTypeBadgeProps) {
  // Convert lowercase asset type to uppercase for TypedChip
  const chipType = type.toUpperCase() as any;
  
  return (
    <TypedChip
      type={chipType}
      size={size}
      variant="outlined"
    />
  );
}