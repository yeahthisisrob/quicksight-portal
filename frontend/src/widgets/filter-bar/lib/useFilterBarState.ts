import { useState, useMemo, useCallback } from 'react';

import {
  DEFAULT_DATE_FILTER,
  DEFAULT_ERROR_FILTER,
  DEFAULT_ACTIVITY_FILTER,
} from './constants';

import type {
  DateFilterState,
  ErrorFilterState,
  ActivityFilterState,
  TagOption,
  TagFilter,
  FolderOption,
  FolderFilter,
  AssetOption,
  AssetFilter,
} from './types';

const ASSET_KEY = '__ASSET__';

interface UseFilterBarStateOptions {
  // Date
  dateFilter?: DateFilterState;
  onDateFilterChange?: (filter: DateFilterState) => void;

  // Tags
  availableTags?: TagOption[];
  includeTags?: TagFilter[];
  excludeTags?: TagFilter[];
  onIncludeTagsChange?: (tags: TagFilter[]) => void;
  onExcludeTagsChange?: (tags: TagFilter[]) => void;

  // Errors
  errorFilter?: ErrorFilterState;
  onErrorFilterChange?: (filter: ErrorFilterState) => void;

  // Activity
  activityFilter?: ActivityFilterState;
  onActivityFilterChange?: (filter: ActivityFilterState) => void;

  // Folders
  includeFolders?: FolderFilter[];
  excludeFolders?: FolderFilter[];
  onIncludeFoldersChange?: (folders: FolderFilter[]) => void;
  onExcludeFoldersChange?: (folders: FolderFilter[]) => void;

  // Assets
  enableAssetSelection?: boolean;
  availableAssets?: AssetOption[];
  selectedAssets?: AssetFilter[];
  onSelectedAssetsChange?: (assets: AssetFilter[]) => void;
}

export function useFilterBarState(options: UseFilterBarStateOptions) {
  const {
    dateFilter,
    onDateFilterChange,
    availableTags = [],
    includeTags = [],
    excludeTags = [],
    onIncludeTagsChange,
    onExcludeTagsChange,
    errorFilter,
    onErrorFilterChange,
    activityFilter,
    onActivityFilterChange,
    includeFolders = [],
    excludeFolders = [],
    onIncludeFoldersChange,
    onExcludeFoldersChange,
    enableAssetSelection = false,
    availableAssets = [],
    selectedAssets = [],
    onSelectedAssetsChange,
  } = options;

  const [isExpanded, setIsExpanded] = useState(false);
  const [filterMode, setFilterMode] = useState<'include' | 'exclude'>('include');
  const [folderFilterMode, setFolderFilterMode] = useState<'include' | 'exclude'>('include');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Group tags by key
  const groupedTags = useMemo(() => {
    return availableTags.reduce(
      (acc, tag) => {
        if (!acc[tag.key]) acc[tag.key] = [];
        acc[tag.key].push(tag);
        return acc;
      },
      {} as Record<string, TagOption[]>
    );
  }, [availableTags]);

  // Build list of all filter type keys
  const allKeys = useMemo(() => {
    const tagKeys = Object.keys(groupedTags).sort();
    if (enableAssetSelection && availableAssets.length > 0 && onSelectedAssetsChange) {
      return [ASSET_KEY, ...tagKeys];
    }
    return tagKeys;
  }, [groupedTags, enableAssetSelection, availableAssets.length, onSelectedAssetsChange]);

  // Calculate total active filters
  const totalFilters = useMemo(() => {
    let count = 0;
    if (dateFilter && dateFilter.range !== 'all') count++;
    if (errorFilter && errorFilter !== 'all') count++;
    if (activityFilter && activityFilter !== 'all') count++;
    count += includeTags.length;
    count += excludeTags.length;
    count += includeFolders.length;
    count += excludeFolders.length;
    count += selectedAssets.length;
    return count;
  }, [dateFilter, errorFilter, activityFilter, includeTags, excludeTags, includeFolders, excludeFolders, selectedAssets]);

  // Tag handlers
  const handleAddTag = useCallback(
    (tag: TagOption) => {
      const newTag = { key: tag.key, value: tag.value };
      const targetList = filterMode === 'include' ? includeTags : excludeTags;
      const onChange = filterMode === 'include' ? onIncludeTagsChange : onExcludeTagsChange;
      if (onChange && !targetList.some((t) => t.key === newTag.key && t.value === newTag.value)) {
        onChange([...targetList, newTag]);
      }
    },
    [filterMode, includeTags, excludeTags, onIncludeTagsChange, onExcludeTagsChange]
  );

  const handleRemoveIncludeTag = useCallback(
    (index: number) => onIncludeTagsChange?.(includeTags.filter((_, i) => i !== index)),
    [includeTags, onIncludeTagsChange]
  );

  const handleRemoveExcludeTag = useCallback(
    (index: number) => onExcludeTagsChange?.(excludeTags.filter((_, i) => i !== index)),
    [excludeTags, onExcludeTagsChange]
  );

  // Asset handlers
  const handleAddAsset = useCallback(
    (asset: AssetOption) => {
      if (!onSelectedAssetsChange) return;
      if (!selectedAssets.some((a) => a.id === asset.id)) {
        onSelectedAssetsChange([
          ...selectedAssets,
          { id: asset.id, name: asset.name, type: asset.type },
        ]);
      }
    },
    [onSelectedAssetsChange, selectedAssets]
  );

  const handleRemoveAsset = useCallback(
    (index: number) => onSelectedAssetsChange?.(selectedAssets.filter((_, i) => i !== index)),
    [onSelectedAssetsChange, selectedAssets]
  );

  // Folder handlers
  const handleAddFolder = useCallback(
    (folder: FolderOption) => {
      const newFolder = { id: folder.id, name: folder.name };
      const targetList = folderFilterMode === 'include' ? includeFolders : excludeFolders;
      const onChange = folderFilterMode === 'include' ? onIncludeFoldersChange : onExcludeFoldersChange;
      if (onChange && !targetList.some((f) => f.id === newFolder.id)) {
        onChange([...targetList, newFolder]);
      }
    },
    [folderFilterMode, includeFolders, excludeFolders, onIncludeFoldersChange, onExcludeFoldersChange]
  );

  const handleRemoveIncludeFolder = useCallback(
    (index: number) => onIncludeFoldersChange?.(includeFolders.filter((_, i) => i !== index)),
    [includeFolders, onIncludeFoldersChange]
  );

  const handleRemoveExcludeFolder = useCallback(
    (index: number) => onExcludeFoldersChange?.(excludeFolders.filter((_, i) => i !== index)),
    [excludeFolders, onExcludeFoldersChange]
  );

  // Clear handlers
  const handleClearDateFilter = useCallback(
    () => onDateFilterChange?.(DEFAULT_DATE_FILTER),
    [onDateFilterChange]
  );

  const handleClearErrorFilter = useCallback(
    () => onErrorFilterChange?.(DEFAULT_ERROR_FILTER),
    [onErrorFilterChange]
  );

  const handleClearActivityFilter = useCallback(
    () => onActivityFilterChange?.(DEFAULT_ACTIVITY_FILTER),
    [onActivityFilterChange]
  );

  const handleClearAll = useCallback(() => {
    onDateFilterChange?.(DEFAULT_DATE_FILTER);
    onErrorFilterChange?.(DEFAULT_ERROR_FILTER);
    onActivityFilterChange?.(DEFAULT_ACTIVITY_FILTER);
    onIncludeTagsChange?.([]);
    onExcludeTagsChange?.([]);
    onIncludeFoldersChange?.([]);
    onExcludeFoldersChange?.([]);
    onSelectedAssetsChange?.([]);
  }, [
    onDateFilterChange,
    onErrorFilterChange,
    onActivityFilterChange,
    onIncludeTagsChange,
    onExcludeTagsChange,
    onIncludeFoldersChange,
    onExcludeFoldersChange,
    onSelectedAssetsChange,
  ]);

  const toggleExpanded = useCallback(() => setIsExpanded((prev) => !prev), []);

  return {
    // State
    isExpanded,
    filterMode,
    folderFilterMode,
    selectedKey,
    groupedTags,
    allKeys,
    totalFilters,

    // Setters
    setFilterMode,
    setFolderFilterMode,
    setSelectedKey,
    toggleExpanded,

    // Handlers
    handleAddTag,
    handleRemoveIncludeTag,
    handleRemoveExcludeTag,
    handleAddAsset,
    handleRemoveAsset,
    handleAddFolder,
    handleRemoveIncludeFolder,
    handleRemoveExcludeFolder,
    handleClearDateFilter,
    handleClearErrorFilter,
    handleClearActivityFilter,
    handleClearAll,
  };
}
