import { 
  Dashboard as DashboardIcon,
  Analytics as AnalysisIcon,
  Storage as DatasetIcon,
  CloudQueue as DatasourceIcon,
  Folder as FolderIcon,
  Person as UserIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { Box, Typography, Paper, Chip, Stack } from '@mui/material';

import { colors, spacing, typography, borderRadius, shadows } from '../theme';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Shared/Design System/Theme',
  parameters: {
    docs: {
      description: {
        component: 'Design system theme tokens used across the application for consistent styling.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const AssetTypeIcon = ({ type, icon: Icon }: { type: keyof typeof colors.assetTypes; icon: any }) => {
  const config = colors.assetTypes[type];
  return (
    <Paper
      sx={{
        p: 3,
        textAlign: 'center',
        borderRadius: `${borderRadius.lg}px`,
        transition: `all 250ms cubic-bezier(0.4, 0, 0.2, 1)`,
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: shadows.lg,
        },
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: `${borderRadius.md}px`,
          backgroundColor: config.light,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          mb: 2,
        }}
      >
        <Icon sx={{ fontSize: 32, color: config.main }} />
      </Box>
      <Typography variant="h6" textTransform="capitalize" gutterBottom>
        {type}
      </Typography>
      <Stack spacing={1} alignItems="center">
        <Chip 
          label="Main" 
          size="small" 
          sx={{ 
            backgroundColor: config.main, 
            color: 'white',
            fontWeight: typography.fontWeight.semibold,
          }} 
        />
        <Chip 
          label="Light" 
          size="small" 
          sx={{ 
            backgroundColor: config.light, 
            color: config.dark,
            border: `1px solid ${config.main}`,
          }} 
        />
        <Chip 
          label="Dark" 
          size="small" 
          sx={{ 
            backgroundColor: config.dark, 
            color: 'white',
          }} 
        />
      </Stack>
    </Paper>
  );
};

export const Colors: Story = {
  render: () => (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: typography.fontWeight.semibold }}>
        Asset Type Colors
      </Typography>
      <Box 
        sx={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: 3,
          mb: 6,
        }}
      >
        <AssetTypeIcon type="dashboard" icon={DashboardIcon} />
        <AssetTypeIcon type="analysis" icon={AnalysisIcon} />
        <AssetTypeIcon type="dataset" icon={DatasetIcon} />
        <AssetTypeIcon type="datasource" icon={DatasourceIcon} />
        <AssetTypeIcon type="folder" icon={FolderIcon} />
        <AssetTypeIcon type="user" icon={UserIcon} />
        <AssetTypeIcon type="group" icon={GroupIcon} />
      </Box>

      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: typography.fontWeight.semibold }}>
        Status Colors
      </Typography>
      <Stack direction="row" spacing={2}>
        {Object.entries(colors.status).map(([status, color]) => (
          <Paper key={status} sx={{ p: 3, textAlign: 'center', minWidth: 120 }}>
            <Box
              sx={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: color,
                mx: 'auto',
                mb: 2,
              }}
            />
            <Typography variant="body2" textTransform="capitalize">
              {status}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {color}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </Box>
  ),
};

export const TypographyScale: Story = {
  render: () => (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: typography.fontWeight.semibold }}>
        Typography Scale
      </Typography>
      <Stack spacing={3}>
        {Object.entries(typography.fontSize).map(([size, value]) => (
          <Box key={size}>
            <Typography 
              sx={{ 
                fontSize: value,
                fontWeight: typography.fontWeight.regular,
                mb: 0.5,
              }}
            >
              The quick brown fox jumps over the lazy dog
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {size}: {value}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Typography variant="h4" gutterBottom sx={{ mt: 6, mb: 4, fontWeight: typography.fontWeight.semibold }}>
        Font Weights
      </Typography>
      <Stack spacing={2}>
        {Object.entries(typography.fontWeight).map(([weight, value]) => (
          <Box key={weight}>
            <Typography 
              sx={{ 
                fontSize: typography.fontSize.base,
                fontWeight: value,
                mb: 0.5,
              }}
            >
              The quick brown fox jumps over the lazy dog
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {weight}: {value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  ),
};

export const Spacing: Story = {
  render: () => (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: typography.fontWeight.semibold }}>
        Spacing Scale
      </Typography>
      <Stack spacing={2}>
        {Object.entries(spacing).map(([size, value]) => (
          <Box key={size} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ minWidth: 40 }}>
              {size}
            </Typography>
            <Box
              sx={{
                height: 32,
                width: value,
                backgroundColor: 'primary.main',
                borderRadius: `${borderRadius.sm}px`,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {value}px
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  ),
};

export const BorderRadius: Story = {
  render: () => (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: typography.fontWeight.semibold }}>
        Border Radius
      </Typography>
      <Stack direction="row" spacing={3} flexWrap="wrap">
        {Object.entries(borderRadius).map(([size, value]) => (
          <Box key={size} sx={{ textAlign: 'center' }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                backgroundColor: 'primary.main',
                borderRadius: typeof value === 'number' ? `${value}px` : value,
                mb: 1,
              }}
            />
            <Typography variant="body2">{size}</Typography>
            <Typography variant="caption" color="text.secondary">
              {value}{typeof value === 'number' ? 'px' : ''}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  ),
};

export const Shadows: Story = {
  render: () => (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: typography.fontWeight.semibold }}>
        Shadow Elevations
      </Typography>
      <Stack spacing={4}>
        {Object.entries(shadows).map(([size, value]) => (
          <Paper
            key={size}
            sx={{
              p: 3,
              boxShadow: value,
              borderRadius: `${borderRadius.md}px`,
            }}
          >
            <Typography variant="h6" textTransform="capitalize">
              {size}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {value}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </Box>
  ),
};