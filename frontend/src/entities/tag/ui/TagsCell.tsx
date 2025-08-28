import { Box, Tooltip, Typography } from '@mui/material';

import { colors } from '@/shared/design-system/theme';
import { TypedChip } from '@/shared/ui';

interface Tag {
  key: string;
  value: string;
}

interface TagsCellProps {
  tags: Tag[];
  onClick?: () => void;
}

const PORTAL_EXCLUDE_TAGS = {
  EXCLUDE_FROM_CATALOG: 'Portal:ExcludeFromCatalog',
  EXCLUDE_FROM_PORTAL: 'Portal:ExcludeFromPortal',
};

export default function TagsCell({ tags = [], onClick }: TagsCellProps) {
  if (!tags || tags.length === 0) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 0.5,
          cursor: onClick ? 'pointer' : 'default',
          color: colors.neutral[400],
          '&:hover': onClick ? {
            color: colors.neutral[500],
          } : {},
        }}
        onClick={onClick}
      >
        <Typography variant="caption" sx={{ color: 'inherit' }}>
          No tags
        </Typography>
      </Box>
    );
  }

  // Sort tags to show portal exclusion tags first
  const sortedTags = [...tags].sort((a, b) => {
    const aIsPortal = a.key === PORTAL_EXCLUDE_TAGS.EXCLUDE_FROM_CATALOG || a.key === PORTAL_EXCLUDE_TAGS.EXCLUDE_FROM_PORTAL;
    const bIsPortal = b.key === PORTAL_EXCLUDE_TAGS.EXCLUDE_FROM_CATALOG || b.key === PORTAL_EXCLUDE_TAGS.EXCLUDE_FROM_PORTAL;
    if (aIsPortal && !bIsPortal) return -1;
    if (!aIsPortal && bIsPortal) return 1;
    return 0;
  });

  const displayTags = sortedTags.slice(0, 2);
  const remainingCount = tags.length - 2;

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 0.5,
        cursor: onClick ? 'pointer' : 'default'
      }}
      onClick={onClick}
    >
      {displayTags.map((tag, index) => {
        const isExcludeFromCatalog = tag.key === PORTAL_EXCLUDE_TAGS.EXCLUDE_FROM_CATALOG;
        const isExcludeFromPortal = tag.key === PORTAL_EXCLUDE_TAGS.EXCLUDE_FROM_PORTAL;
        const isPortalTag = isExcludeFromCatalog || isExcludeFromPortal;
        
        const chipType = isExcludeFromCatalog ? 'CATALOG_HIDDEN' :
                        isExcludeFromPortal ? 'PORTAL_HIDDEN' : 'TAG';
                    
        const label = isExcludeFromCatalog ? 'Catalog Hidden' :
                     isExcludeFromPortal ? 'Portal Hidden' :
                     tag.value.length > 15 ? `${tag.value.substring(0, 15)}...` : tag.value;
                     
        const tooltipTitle = isPortalTag 
          ? (isExcludeFromPortal 
              ? 'Assets in this folder are hidden from the entire portal' 
              : 'Assets in this folder are excluded from the data catalog')
          : `${tag.key}: ${tag.value}`;
        
        return (
          <Tooltip key={index} title={tooltipTitle}>
            <TypedChip
              type={chipType}
              customLabel={label}
              size="small"
              variant={isPortalTag ? "filled" : "outlined"}
              showIcon={false}
            />
          </Tooltip>
        );
      })}
      {remainingCount > 0 && (
        <TypedChip
          type="TAG"
          customLabel={`+${remainingCount}`}
          size="small"
          variant="filled"
          showIcon={false}
        />
      )}
    </Box>
  );
}