import { Stack, Typography, Box, Paper, TextField } from '@mui/material';

import { SearchMatchChip, SearchMatchChipGroup } from './index';

import type { SearchMatchReason } from '@shared/generated';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof SearchMatchChip> = {
  title: 'Shared/UI/SearchMatchChip',
  component: SearchMatchChip,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Displays why an asset matched a search query. Used in search results to provide transparency about match reasons - whether the match was in the name, tags, permissions, or through dependency relationships.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    reason: {
      control: 'select',
      options: [
        'name',
        'id',
        'description',
        'arn',
        'tag_key',
        'tag_value',
        'permission',
        'dependency_dataset',
        'dependency_datasource',
        'dependency_analysis',
      ] as SearchMatchReason[],
      description: 'The reason why the asset matched the search',
    },
    showIcon: {
      control: 'boolean',
      description: 'Whether to show the reason icon',
    },
    compact: {
      control: 'boolean',
      description: 'Whether to show in compact mode (icon only)',
    },
    size: {
      control: 'select',
      options: ['small', 'medium'],
      description: 'Size of the chip',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    reason: 'name',
    showIcon: true,
    compact: false,
    size: 'small',
  },
};

const StorySection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Box sx={{ mb: 4 }}>
    <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 500 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

export const AllMatchReasons: Story = {
  render: () => (
    <Stack spacing={4}>
      <StorySection title="Direct Match Reasons">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          These indicate the asset itself matched the search query
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <SearchMatchChip reason="name" />
          <SearchMatchChip reason="id" />
          <SearchMatchChip reason="description" />
          <SearchMatchChip reason="arn" />
        </Stack>
      </StorySection>

      <StorySection title="Tag & Permission Matches">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Matched in the asset&apos;s tags or permissions
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <SearchMatchChip reason="tag_key" />
          <SearchMatchChip reason="tag_value" />
          <SearchMatchChip reason="permission" />
        </Stack>
      </StorySection>

      <StorySection title="Dependency Matches (Lineage-Aware Search)">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The asset uses a dependency that matched the search query
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <SearchMatchChip reason="dependency_dataset" />
          <SearchMatchChip reason="dependency_datasource" />
          <SearchMatchChip reason="dependency_analysis" />
        </Stack>
      </StorySection>
    </Stack>
  ),
};

export const CompactMode: Story = {
  render: () => (
    <Stack spacing={3}>
      <StorySection title="Normal vs Compact">
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ minWidth: 80 }}>
              Normal:
            </Typography>
            <SearchMatchChip reason="name" />
            <SearchMatchChip reason="tag_key" />
            <SearchMatchChip reason="dependency_dataset" />
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ minWidth: 80 }}>
              Compact:
            </Typography>
            <SearchMatchChip reason="name" compact />
            <SearchMatchChip reason="tag_key" compact />
            <SearchMatchChip reason="dependency_dataset" compact />
          </Stack>
        </Stack>
      </StorySection>

      <StorySection title="Compact in Table Row Context">
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" sx={{ flex: 1 }}>
              Sales Dashboard Q4
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <SearchMatchChip reason="name" compact />
              <SearchMatchChip reason="tag_value" compact />
            </Stack>
          </Stack>
        </Paper>
      </StorySection>
    </Stack>
  ),
};

export const ChipGroup: Story = {
  render: () => (
    <Stack spacing={4}>
      <StorySection title="SearchMatchChipGroup Component">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Groups multiple match reasons with automatic overflow handling
        </Typography>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" sx={{ minWidth: 140 }}>
              Single match:
            </Typography>
            <SearchMatchChipGroup reasons={['name']} />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" sx={{ minWidth: 140 }}>
              Multiple matches:
            </Typography>
            <SearchMatchChipGroup reasons={['name', 'tag_key', 'permission']} />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" sx={{ minWidth: 140 }}>
              With overflow (5):
            </Typography>
            <SearchMatchChipGroup
              reasons={[
                'name',
                'tag_key',
                'tag_value',
                'permission',
                'dependency_dataset',
              ]}
              maxVisible={3}
            />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" sx={{ minWidth: 140 }}>
              Compact group:
            </Typography>
            <SearchMatchChipGroup
              reasons={['name', 'tag_key', 'dependency_dataset', 'dependency_datasource']}
              maxVisible={4}
              compact
            />
          </Stack>
        </Stack>
      </StorySection>
    </Stack>
  ),
};

export const RealWorldUsage: Story = {
  render: () => (
    <Stack spacing={4}>
      <StorySection title="Search Results Table">
        <Paper sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 200px',
                gap: 2,
                p: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
                fontWeight: 500,
              }}
            >
              <Typography variant="body2">Asset Name</Typography>
              <Typography variant="body2">Match Reasons</Typography>
            </Box>
            {[
              { name: 'Sales Dashboard Q4', reasons: ['name'] as SearchMatchReason[] },
              {
                name: 'Revenue Analysis',
                reasons: ['tag_value', 'dependency_dataset'] as SearchMatchReason[],
              },
              {
                name: 'Customer Metrics',
                reasons: ['permission', 'dependency_dataset', 'dependency_datasource'] as SearchMatchReason[],
              },
              { name: 'Product KPIs', reasons: ['description', 'tag_key'] as SearchMatchReason[] },
            ].map((row, i) => (
              <Box
                key={i}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 200px',
                  gap: 2,
                  p: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Typography variant="body2">{row.name}</Typography>
                <SearchMatchChipGroup reasons={row.reasons} compact />
              </Box>
            ))}
          </Stack>
        </Paper>
      </StorySection>

      <StorySection title="Search Bar with Results Preview">
        <Paper sx={{ p: 2, maxWidth: 400 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search assets..."
            value="sales"
            InputProps={{ readOnly: true }}
            sx={{ mb: 2 }}
          />
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">
              Results matching &quot;sales&quot;:
            </Typography>
            {[
              { name: 'Sales Dashboard', reasons: ['name'] as SearchMatchReason[] },
              {
                name: 'Revenue Report',
                reasons: ['tag_value'] as SearchMatchReason[],
              },
              {
                name: 'Q4 Analysis',
                reasons: ['dependency_dataset'] as SearchMatchReason[],
              },
            ].map((row, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 1,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Typography variant="body2">{row.name}</Typography>
                <SearchMatchChipGroup reasons={row.reasons} compact maxVisible={2} />
              </Box>
            ))}
          </Stack>
        </Paper>
      </StorySection>

      <StorySection title="Why Lineage-Aware Search Matters">
        <Paper sx={{ p: 2, bgcolor: 'info.50' }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            When searching for &quot;customer_data&quot; (a dataset):
          </Typography>
          <Stack spacing={1} sx={{ ml: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <SearchMatchChip reason="name" />
              <Typography variant="caption">- Direct match: &quot;customer_data&quot; dataset</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <SearchMatchChip reason="dependency_dataset" />
              <Typography variant="caption">
                - Dashboard &quot;Customer Insights&quot; uses this dataset
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <SearchMatchChip reason="dependency_dataset" />
              <Typography variant="caption">
                - Analysis &quot;Churn Prediction&quot; uses this dataset
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      </StorySection>
    </Stack>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack spacing={3}>
      <StorySection title="Small (Default)">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <SearchMatchChip reason="name" size="small" />
          <SearchMatchChip reason="tag_key" size="small" />
          <SearchMatchChip reason="dependency_dataset" size="small" />
        </Stack>
      </StorySection>

      <StorySection title="Medium">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <SearchMatchChip reason="name" size="medium" />
          <SearchMatchChip reason="tag_key" size="medium" />
          <SearchMatchChip reason="dependency_dataset" size="medium" />
        </Stack>
      </StorySection>
    </Stack>
  ),
};
