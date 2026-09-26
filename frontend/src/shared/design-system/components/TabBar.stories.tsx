import {
  Archive as ArchiveIcon,
  Code as CodeIcon,
  ImportExport as ExportIcon,
} from '@mui/icons-material';
import { Button, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Container } from './Container';
import { TabBar } from './TabBar';

const meta: Meta<typeof TabBar> = {
  title: 'Design System/TabBar',
  component: TabBar,
  parameters: {
    docs: {
      description: {
        component:
          'Tabs that switch between views of one page. Keep labels to a word or two, and sync the value with a query parameter so a tab is deep-linkable.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

type Tab = 'export' | 'archived' | 'scripts';

function Demo() {
  const [tab, setTab] = useState<Tab>('export');
  return (
    <Container disableContentPadding sx={{ maxWidth: 720 }}>
      <TabBar
        ariaLabel="Operations"
        value={tab}
        onChange={setTab}
        actions={
          <Button size="small" variant="outlined" color="inherit">
            Refresh
          </Button>
        }
        tabs={[
          { value: 'export', label: 'Export', icon: <ExportIcon /> },
          {
            value: 'archived',
            label: 'Archived assets',
            badge: 37,
            icon: <ArchiveIcon />,
          },
          { value: 'scripts', label: 'Scripts', icon: <CodeIcon /> },
        ]}
      />
      <Typography sx={{ p: 2.5 }}>Content for the {tab} tab.</Typography>
    </Container>
  );
}

export const WithIcons: Story = { render: () => <Demo /> };
