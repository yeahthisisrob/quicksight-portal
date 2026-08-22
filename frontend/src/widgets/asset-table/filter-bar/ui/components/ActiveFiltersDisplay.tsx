import {
  Add,
  Remove,
  Dashboard as DashboardIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { Box, Chip } from '@mui/material';
import React from 'react';

import { AssetChip, FilterSection } from './shared';

import type { TagFilter, FolderFilter, AssetFilter } from '../../lib/types';

// ============================================================================
// Types
// ============================================================================

export interface ActiveFiltersDisplayProps {
  selectedAssets: AssetFilter[];
  includeTags: TagFilter[];
  excludeTags: TagFilter[];
  includeFolders: FolderFilter[];
  excludeFolders: FolderFilter[];
  onRemoveAsset: (index: number) => void;
  onRemoveIncludeTag: (index: number) => void;
  onRemoveExcludeTag: (index: number) => void;
  onRemoveIncludeFolder: (index: number) => void;
  onRemoveExcludeFolder: (index: number) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export const ActiveFiltersDisplay: React.FC<ActiveFiltersDisplayProps> = ({
  selectedAssets,
  includeTags,
  excludeTags,
  includeFolders,
  excludeFolders,
  onRemoveAsset,
  onRemoveIncludeTag,
  onRemoveExcludeTag,
  onRemoveIncludeFolder,
  onRemoveExcludeFolder,
}) => {
  const totalFilters =
    selectedAssets.length +
    includeTags.length +
    excludeTags.length +
    includeFolders.length +
    excludeFolders.length;

  if (totalFilters === 0) return null;

  return (
    <Box sx={{ mt: 2 }}>
      {selectedAssets.length > 0 && (
        <FilterSection
          title="Assets (fields from these assets):"
          icon={<DashboardIcon sx={{ fontSize: 14 }} />}
          color="primary.main"
        >
          {selectedAssets.map((asset, idx) => (
            <AssetChip
              key={`asset-full-${idx}`}
              asset={asset}
              onDelete={() => onRemoveAsset(idx)}
              showFullName
            />
          ))}
        </FilterSection>
      )}

      {includeFolders.length > 0 && (
        <FilterSection
          title="In Folders (OR):"
          icon={<FolderIcon sx={{ fontSize: 14 }} />}
          color="primary.main"
        >
          {includeFolders.map((folder, idx) => (
            <Chip
              key={`include-folder-${idx}`}
              icon={<FolderIcon sx={{ fontSize: 14 }} />}
              label={folder.name}
              size="small"
              color="primary"
              onDelete={() => onRemoveIncludeFolder(idx)}
              sx={{ mb: 0.5 }}
            />
          ))}
        </FilterSection>
      )}

      {excludeFolders.length > 0 && (
        <FilterSection
          title="Not In Folders (AND NOT):"
          icon={<FolderIcon sx={{ fontSize: 14 }} />}
          color="error.main"
        >
          {excludeFolders.map((folder, idx) => (
            <Chip
              key={`exclude-folder-${idx}`}
              icon={<FolderIcon sx={{ fontSize: 14 }} />}
              label={folder.name}
              size="small"
              color="error"
              onDelete={() => onRemoveExcludeFolder(idx)}
              sx={{ mb: 0.5 }}
            />
          ))}
        </FilterSection>
      )}

      {includeTags.length > 0 && (
        <FilterSection
          title="Include Tags (OR):"
          icon={<Add sx={{ fontSize: 14 }} />}
          color="success.main"
        >
          {includeTags.map((tag, idx) => (
            <Chip
              key={`include-${idx}`}
              label={`${tag.key}=${tag.value}`}
              size="small"
              color="success"
              onDelete={() => onRemoveIncludeTag(idx)}
              sx={{ mb: 0.5 }}
            />
          ))}
        </FilterSection>
      )}

      {excludeTags.length > 0 && (
        <FilterSection
          title="Exclude Tags (AND NOT):"
          icon={<Remove sx={{ fontSize: 14 }} />}
          color="error.main"
        >
          {excludeTags.map((tag, idx) => (
            <Chip
              key={`exclude-${idx}`}
              label={`${tag.key}=${tag.value}`}
              size="small"
              color="error"
              onDelete={() => onRemoveExcludeTag(idx)}
              sx={{ mb: 0.5 }}
            />
          ))}
        </FilterSection>
      )}
    </Box>
  );
};
