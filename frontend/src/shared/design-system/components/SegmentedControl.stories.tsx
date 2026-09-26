import { GridView as GridIcon, ViewList as ListIcon } from '@mui/icons-material';
import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { SegmentedControl } from './SegmentedControl';

const meta: Meta<typeof SegmentedControl> = {
  title: 'Design System/SegmentedControl',
  component: SegmentedControl,
  parameters: {
    docs: {
      description: {
        component:
          'A single-choice switch for two to five short options. For longer lists use a Select; for navigation use TabBar.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

function Demo() {
  const [mode, setMode] = useState<'clone' | 'update'>('clone');
  const [view, setView] = useState<'grid' | 'list' | 'map'>('grid');
  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <SegmentedControl
        ariaLabel="How to apply"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'clone', label: 'Create a copy' },
          { value: 'update', label: 'Change in place' },
        ]}
      />
      <SegmentedControl
        ariaLabel="View"
        value={view}
        onChange={setView}
        options={[
          { value: 'grid', label: 'Grid', icon: <GridIcon /> },
          { value: 'list', label: 'List', icon: <ListIcon /> },
          { value: 'map', label: 'Map', disabled: true },
        ]}
      />
    </Stack>
  );
}

export const Default: Story = { render: () => <Demo /> };
