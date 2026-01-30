import {
  Box,
  Button,
  ButtonGroup,
  Tooltip,
  alpha,
} from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';
import { catalogIcons } from '@/shared/ui/icons';

import { TagFilterBar } from './TagFilterBar';

type ViewMode = 'physical' | 'semantic' | 'mapping' | 'visual-fields' | 'calculated';

interface TagFilter {
  key: string;
  value: string;
}

interface AssetFilter {
  id: string;
  name: string;
  type: string;
}

interface DataCatalogHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onImport?: () => void;
  onExport?: () => void;
  availableTags?: { key: string; value: string; count: number }[];
  includeTags?: TagFilter[];
  excludeTags?: TagFilter[];
  onIncludeTagsChange?: (tags: TagFilter[]) => void;
  onExcludeTagsChange?: (tags: TagFilter[]) => void;
  tagsLoading?: boolean;
  availableAssets?: { id: string; name: string; type: string; fieldCount: number }[];
  selectedAssets?: AssetFilter[];
  onSelectedAssetsChange?: (assets: AssetFilter[]) => void;
  assetsLoading?: boolean;
}

export default function DataCatalogHeader({
  viewMode,
  onViewModeChange,
  availableTags = [],
  includeTags = [],
  excludeTags = [],
  onIncludeTagsChange,
  onExcludeTagsChange,
  tagsLoading = false,
  availableAssets = [],
  selectedAssets = [],
  onSelectedAssetsChange,
  assetsLoading = false,
}: DataCatalogHeaderProps) {

  const PhysicalIcon = catalogIcons.physical;
  const VisualFieldIcon = catalogIcons.visual;
  const CalculatedIcon = catalogIcons.calculated;
  const SemanticIcon = catalogIcons.semantic;
  const LockIcon = catalogIcons.lock;

  return (
    <>
      {/* Tag Filter Bar */}
      {onIncludeTagsChange && onExcludeTagsChange && (
        <Box sx={{ mb: spacing.md / 8 }}>
          <TagFilterBar
            availableTags={availableTags}
            includeTags={includeTags}
            excludeTags={excludeTags}
            onIncludeTagsChange={onIncludeTagsChange}
            onExcludeTagsChange={onExcludeTagsChange}
            isLoading={tagsLoading || assetsLoading}
            availableAssets={availableAssets}
            selectedAssets={selectedAssets}
            onSelectedAssetsChange={onSelectedAssetsChange}
          />
        </Box>
      )}

      {/* Tabs */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: spacing.lg / 8,
        p: spacing.md / 8,
        borderRadius: `${spacing.sm / 8}px`,
        background: `linear-gradient(135deg, ${alpha(colors.primary.light, 0.03)} 0%, ${alpha(colors.primary.main, 0.03)} 100%)`,
        border: `1px solid ${alpha(colors.primary.main, 0.08)}`,
      }}>
        <ButtonGroup 
          variant="outlined"
          sx={{
            '& .MuiButton-root': {
              borderColor: colors.neutral[200],
              color: colors.neutral[700],
              fontWeight: 500,
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: colors.primary.main,
                backgroundColor: alpha(colors.primary.main, 0.08),
                transform: 'translateY(-1px)',
                boxShadow: `0 2px 8px ${alpha(colors.primary.main, 0.15)}`,
              },
              '&.MuiButton-contained': {
                backgroundColor: colors.primary.main,
                color: 'white',
                borderColor: colors.primary.main,
                boxShadow: `0 2px 8px ${alpha(colors.primary.main, 0.25)}`,
                '&:hover': {
                  backgroundColor: colors.primary.dark,
                  borderColor: colors.primary.dark,
                  transform: 'translateY(-1px)',
                  boxShadow: `0 4px 12px ${alpha(colors.primary.main, 0.35)}`,
                },
              },
              '&.Mui-disabled': {
                borderColor: colors.neutral[200],
                color: colors.neutral[400],
                backgroundColor: alpha(colors.neutral[100], 0.5),
              },
            },
          }}
        >
          <Tooltip title="Physical fields from datasets and analyses">
            <Button
              startIcon={<PhysicalIcon />}
              variant={viewMode === 'physical' ? 'contained' : 'outlined'}
              onClick={() => onViewModeChange('physical')}
            >
              Physical Fields
            </Button>
          </Tooltip>
          <Tooltip title="Visual field usage across dashboards">
            <Button
              startIcon={<VisualFieldIcon />}
              variant={viewMode === 'visual-fields' ? 'contained' : 'outlined'}
              onClick={() => onViewModeChange('visual-fields')}
            >
              Visual Fields
            </Button>
          </Tooltip>
          <Tooltip title="Calculated field expressions and dependencies">
            <Button
              startIcon={<CalculatedIcon />}
              variant={viewMode === 'calculated' ? 'contained' : 'outlined'}
              onClick={() => onViewModeChange('calculated')}
            >
              Calculated
            </Button>
          </Tooltip>
          <Tooltip title="Coming Soon: Business terms and definitions">
            <span>
              <Button
                startIcon={<SemanticIcon />}
                variant="outlined"
                disabled
                endIcon={<LockIcon fontSize="small" />}
                sx={{ opacity: 0.7 }}
              >
                Semantic Layer
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Coming Soon: Field to term mappings">
            <span>
              <Button
                variant="outlined"
                disabled
                endIcon={<LockIcon fontSize="small" />}
                sx={{ opacity: 0.7 }}
              >
                Field Mapping
              </Button>
            </span>
          </Tooltip>
        </ButtonGroup>
      </Box>
    </>
  );
}