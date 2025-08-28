import { Stack, Typography, Paper, Box } from '@mui/material';

import TypedChip from './index';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof TypedChip> = {
  title: 'Shared/UI/TypedChip',
  component: TypedChip,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A universal chip component for displaying various types (assets, fields, filters, tags, relationships, etc.) with consistent styling and behavior. Used across the application for asset indicators, JSON viewer highlights, tags, relationships, and more.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['DASHBOARD', 'ANALYSIS', 'DATASET', 'DATASOURCE', 'FOLDER', 'USER', 'GROUP', 'FIELDS', 'CALCULATED_FIELDS', 'VISUALS', 'SHEETS', 'FILTERS', 'EXPRESSIONS', 'UNKNOWN', 'TAG', 'CATALOG_HIDDEN', 'PORTAL_HIDDEN', 'RELATIONSHIP'],
      description: 'The type to display',
    },
    count: {
      control: 'number',
      description: 'Optional count to display instead of label',
    },
    showIcon: {
      control: 'boolean',
      description: 'Whether to show the type icon',
    },
    size: {
      control: 'select',
      options: ['small', 'medium'],
      description: 'Size of the chip',
    },
    variant: {
      control: 'select',
      options: ['filled', 'outlined'],
      description: 'Visual variant of the chip',
    },
    customLabel: {
      control: 'text',
      description: 'Custom label to override the default type label',
    },
    isActive: {
      control: 'boolean',
      description: 'Whether the chip is in active/selected state',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    type: 'DASHBOARD',
    showIcon: true,
    size: 'small',
    variant: 'filled',
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

export const AllChipTypes: Story = {
  render: () => (
    <Stack spacing={4}>
      <StorySection title="Asset Types">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TypedChip type="DASHBOARD" />
          <TypedChip type="ANALYSIS" />
          <TypedChip type="DATASET" />
          <TypedChip type="DATASOURCE" />
          <TypedChip type="FOLDER" />
          <TypedChip type="USER" />
          <TypedChip type="GROUP" />
        </Stack>
      </StorySection>

      <StorySection title="JSON Viewer Types">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TypedChip type="FIELDS" />
          <TypedChip type="CALCULATED_FIELDS" />
          <TypedChip type="VISUALS" />
          <TypedChip type="SHEETS" />
          <TypedChip type="FILTERS" />
          <TypedChip type="EXPRESSIONS" />
        </Stack>
      </StorySection>

      <StorySection title="Tag Types">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TypedChip type="TAG" />
          <TypedChip type="CATALOG_HIDDEN" />
          <TypedChip type="PORTAL_HIDDEN" />
          <TypedChip type="TAG" customLabel="Custom:Value" />
          <TypedChip type="TAG" customLabel="Environment:Prod" />
        </Stack>
      </StorySection>

      <StorySection title="Status & Relationship Types">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TypedChip type="UNKNOWN" />
          <TypedChip type="RELATIONSHIP" count={0} />
          <TypedChip type="RELATIONSHIP" count={5} />
          <TypedChip type="RELATIONSHIP" count={12} />
        </Stack>
      </StorySection>
    </Stack>
  ),
};

export const Variants: Story = {
  render: () => (
    <Stack spacing={4}>
      <StorySection title="Filled Variant">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TypedChip type="DASHBOARD" variant="filled" />
          <TypedChip type="ANALYSIS" variant="filled" />
          <TypedChip type="TAG" variant="filled" />
          <TypedChip type="RELATIONSHIP" variant="filled" count={5} />
        </Stack>
      </StorySection>

      <StorySection title="Outlined Variant">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TypedChip type="DASHBOARD" variant="outlined" />
          <TypedChip type="ANALYSIS" variant="outlined" />
          <TypedChip type="TAG" variant="outlined" />
          <TypedChip type="RELATIONSHIP" variant="outlined" count={5} />
        </Stack>
      </StorySection>
    </Stack>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack spacing={4}>
      <StorySection title="Small Size (Default)">
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <TypedChip type="DASHBOARD" size="small" />
          <TypedChip type="ANALYSIS" size="small" />
          <TypedChip type="TAG" size="small" />
          <TypedChip type="RELATIONSHIP" size="small" count={5} />
        </Stack>
      </StorySection>

      <StorySection title="Medium Size">
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <TypedChip type="DASHBOARD" size="medium" />
          <TypedChip type="ANALYSIS" size="medium" />
          <TypedChip type="TAG" size="medium" />
          <TypedChip type="RELATIONSHIP" size="medium" count={5} />
        </Stack>
      </StorySection>
    </Stack>
  ),
};

export const WithCounts: Story = {
  render: () => (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <TypedChip type="DASHBOARD" count={12} />
        <TypedChip type="ANALYSIS" count={5} />
        <TypedChip type="DATASET" count={23} />
        <TypedChip type="DATASOURCE" count={3} />
        <TypedChip type="FOLDER" count={0} />
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <TypedChip type="RELATIONSHIP" count={0} />
        <TypedChip type="RELATIONSHIP" count={1} />
        <TypedChip type="RELATIONSHIP" count={5} />
        <TypedChip type="RELATIONSHIP" count={99} />
        <TypedChip type="RELATIONSHIP" count={999} />
      </Stack>
    </Stack>
  ),
};

export const IconControl: Story = {
  render: () => (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <TypedChip type="DASHBOARD" showIcon={true} />
        <TypedChip type="ANALYSIS" showIcon={true} />
        <TypedChip type="TAG" showIcon={true} />
        <TypedChip type="RELATIONSHIP" showIcon={true} count={5} />
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <TypedChip type="DASHBOARD" showIcon={false} />
        <TypedChip type="ANALYSIS" showIcon={false} />
        <TypedChip type="TAG" showIcon={false} />
        <TypedChip type="RELATIONSHIP" showIcon={false} count={5} />
      </Stack>
    </Stack>
  ),
};

export const ActiveState: Story = {
  render: () => (
    <Stack spacing={2}>
      <Typography variant="body2">For JSON Viewer highlight selection:</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <TypedChip type="FIELDS" variant="outlined" />
        <TypedChip type="CALCULATED_FIELDS" variant="outlined" isActive />
        <TypedChip type="VISUALS" variant="outlined" />
        <TypedChip type="SHEETS" variant="outlined" isActive />
        <TypedChip type="FILTERS" variant="outlined" />
      </Stack>
    </Stack>
  ),
};

export const TagExamples: Story = {
  render: () => (
    <Stack spacing={3}>
      <StorySection title="System Tags">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TypedChip type="CATALOG_HIDDEN" />
          <TypedChip type="PORTAL_HIDDEN" />
        </Stack>
      </StorySection>

      <StorySection title="Custom Tags">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TypedChip type="TAG" customLabel="Environment" variant="outlined" />
          <TypedChip type="TAG" customLabel="Production" variant="outlined" />
          <TypedChip type="TAG" customLabel="Cost Center" variant="outlined" />
          <TypedChip type="TAG" customLabel="Department:HR" variant="outlined" />
        </Stack>
      </StorySection>

      <StorySection title="Tag Overflow">
        <Stack direction="row" spacing={1} alignItems="center">
          <TypedChip type="TAG" customLabel="Tag 1" variant="outlined" />
          <TypedChip type="TAG" customLabel="Tag 2" variant="outlined" />
          <TypedChip type="TAG" customLabel="+5" variant="filled" showIcon={false} />
        </Stack>
      </StorySection>
    </Stack>
  ),
};

export const RelationshipExamples: Story = {
  render: () => (
    <Stack spacing={3}>
      <StorySection title="Used By / Uses in Asset Tables">
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" sx={{ minWidth: 120 }}>No relationships:</Typography>
              <TypedChip type="RELATIONSHIP" count={0} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" sx={{ minWidth: 120 }}>Few relationships:</Typography>
              <TypedChip type="RELATIONSHIP" count={3} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" sx={{ minWidth: 120 }}>Many relationships:</Typography>
              <TypedChip type="RELATIONSHIP" count={42} />
            </Box>
          </Stack>
        </Paper>
      </StorySection>

      <StorySection title="Clickable Relationships">
        <Stack direction="row" spacing={1}>
          <TypedChip type="RELATIONSHIP" count={5} onClick={() => alert('Clicked!')} />
          <TypedChip type="RELATIONSHIP" count={0} onClick={() => alert('Clicked!')} />
          <Typography variant="caption" sx={{ ml: 2, alignSelf: 'center' }}>
            ← Click these chips
          </Typography>
        </Stack>
      </StorySection>
    </Stack>
  ),
};

export const RealWorldUsage: Story = {
  render: () => (
    <Stack spacing={4}>
      <StorySection title="Asset Type Selection (Export Page)">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TypedChip type="DASHBOARD" count={15} />
          <TypedChip type="ANALYSIS" count={8} />
          <TypedChip type="DATASET" count={42} />
          <TypedChip type="DATASOURCE" count={5} />
        </Stack>
      </StorySection>

      <StorySection title="Tags Cell in Asset Table">
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TypedChip type="TAG" customLabel="Owner:BI" variant="outlined" size="small" />
              <TypedChip type="TAG" customLabel="Dept:Sales" variant="outlined" size="small" />
              <TypedChip type="TAG" customLabel="+3" variant="filled" size="small" showIcon={false} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TypedChip type="CATALOG_HIDDEN" size="small" />
              <TypedChip type="TAG" customLabel="Archived" variant="outlined" size="small" />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TypedChip type="PORTAL_HIDDEN" size="small" />
            </Box>
          </Stack>
        </Paper>
      </StorySection>

      <StorySection title="Date Column with Unknown">
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="body2">Last Modified:</Typography>
          <TypedChip type="UNKNOWN" size="small" />
        </Stack>
      </StorySection>
    </Stack>
  ),
};