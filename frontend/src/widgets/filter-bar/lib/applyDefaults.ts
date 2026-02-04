import type { FilterBarProps } from './types';

interface FilterBarPropsWithDefaults extends FilterBarProps {
  showActivityOption: boolean;
  enableTagFiltering: boolean;
  availableTags: NonNullable<FilterBarProps['availableTags']>;
  includeTags: NonNullable<FilterBarProps['includeTags']>;
  excludeTags: NonNullable<FilterBarProps['excludeTags']>;
  isLoadingTags: boolean;
  enableErrorFiltering: boolean;
  enableActivityFiltering: boolean;
  enableFolderFiltering: boolean;
  availableFolders: NonNullable<FilterBarProps['availableFolders']>;
  includeFolders: NonNullable<FilterBarProps['includeFolders']>;
  excludeFolders: NonNullable<FilterBarProps['excludeFolders']>;
  isLoadingFolders: boolean;
  enableAssetSelection: boolean;
  availableAssets: NonNullable<FilterBarProps['availableAssets']>;
  selectedAssets: NonNullable<FilterBarProps['selectedAssets']>;
  showSearch: boolean;
}

export function applyFilterBarDefaults(props: FilterBarProps): FilterBarPropsWithDefaults {
  return {
    ...props,
    showActivityOption: props.showActivityOption ?? false,
    enableTagFiltering: props.enableTagFiltering ?? false,
    availableTags: props.availableTags ?? [],
    includeTags: props.includeTags ?? [],
    excludeTags: props.excludeTags ?? [],
    isLoadingTags: props.isLoadingTags ?? false,
    enableErrorFiltering: props.enableErrorFiltering ?? false,
    enableActivityFiltering: props.enableActivityFiltering ?? false,
    enableFolderFiltering: props.enableFolderFiltering ?? false,
    availableFolders: props.availableFolders ?? [],
    includeFolders: props.includeFolders ?? [],
    excludeFolders: props.excludeFolders ?? [],
    isLoadingFolders: props.isLoadingFolders ?? false,
    enableAssetSelection: props.enableAssetSelection ?? false,
    availableAssets: props.availableAssets ?? [],
    selectedAssets: props.selectedAssets ?? [],
    showSearch: props.showSearch ?? false,
  };
}
