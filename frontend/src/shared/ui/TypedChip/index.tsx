import { ChipProps } from '@mui/material';
import React from 'react';

import { colors } from '@/shared/design-system/theme';

import { chipConfig, ChipType } from './chipConfig';
import { 
  AssetTypeChip, 
  JsonHighlightChip, 
  RelationshipChip, 
  StatusChip, 
  TagChip 
} from './renderers';

export type { ChipType } from './chipConfig';

export interface TypedChipProps extends Omit<ChipProps, 'color' | 'icon'> {
  type: ChipType;
  customLabel?: string;
  count?: number;
  showIcon?: boolean;
  isActive?: boolean;
}

/**
 * Get chip metadata for a given type
 */
function getChipMetadata(type: ChipType) {
  const config = chipConfig[type];
  const Icon = config.icon;
  
  const isJsonHighlight = 'jsonHighlight' in config && config.jsonHighlight;
  const isStatusType = 'statusType' in config && config.statusType;
  const isTagType = 'tagType' in config && config.tagType;
  const isRelationshipType = 'relationshipType' in config && config.relationshipType;
  const specialTag = isTagType && 'specialTag' in config ? config.specialTag : null;
  
  // Get color configuration for asset types
  const colorConfig = (!isJsonHighlight && !isStatusType && !isTagType && !isRelationshipType && 'colorKey' in config) 
    ? colors.assetTypes[config.colorKey] 
    : null;
  
  return {
    config,
    Icon,
    isJsonHighlight,
    isStatusType,
    isTagType,
    isRelationshipType,
    specialTag,
    colorConfig
  };
}

/**
 * Determine which renderer to use
 */
function selectRenderer(metadata: ReturnType<typeof getChipMetadata>) {
  if (metadata.isStatusType) return 'status';
  if (metadata.isTagType) return 'tag';
  if (metadata.isRelationshipType) return 'relationship';
  if (metadata.isJsonHighlight) return 'jsonHighlight';
  return 'assetType';
}

const TypedChip = React.forwardRef<HTMLDivElement, TypedChipProps>(({ 
  type,
  customLabel,
  count,
  showIcon = true, 
  size = 'small',
  variant = 'filled',
  isActive = false,
  ...chipProps 
}, ref) => {
  const metadata = getChipMetadata(type);
  const label = count !== undefined ? `${count}` : (customLabel || metadata.config.label || type);
  const effectiveVariant = isActive ? 'filled' : variant;
  const rendererType = selectRenderer(metadata);
  
  // Common props for all renderers - explicitly set label as string
  const commonProps = {
    ...chipProps,
    ref,
    Icon: metadata.Icon,
    label, // Our computed string label overrides any label from chipProps
    effectiveVariant,
    size,
    showIcon,
    type,
    count,
  };
  
  // Render based on type
  switch (rendererType) {
    case 'status':
      return <StatusChip {...commonProps} />;
      
    case 'tag':
      return <TagChip {...commonProps} specialTag={metadata.specialTag} />;
      
    case 'relationship':
      return <RelationshipChip {...commonProps} />;
      
    case 'jsonHighlight':
      return <JsonHighlightChip {...commonProps} />;
      
    case 'assetType':
      if (!metadata.colorConfig) {
        throw new Error(`Missing color config for chip type: ${type}`);
      }
      return <AssetTypeChip {...commonProps} colorConfig={metadata.colorConfig} />;
      
    default:
      throw new Error(`Unknown renderer type: ${rendererType}`);
  }
});

TypedChip.displayName = 'TypedChip';

export default TypedChip;