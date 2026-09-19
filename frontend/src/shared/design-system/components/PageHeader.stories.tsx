import { Button, Link, Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { PageHeader } from './PageHeader';
import { TabBar } from './TabBar';

const meta: Meta<typeof PageHeader> = {
  title: 'Design System/PageHeader',
  component: PageHeader,
  parameters: {
    docs: {
      description: {
        component:
          'The top of every page: a heading, an optional description, a counter, and the primary actions. Content-level headings belong on Containers.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {
  args: { title: 'Dashboards' },
};

export const WithEverything: Story = {
  args: {
    title: 'Dashboards',
    counter: 1284,
    description: 'Every dashboard in the account, with who uses it and what it reads from.',
    breadcrumbs: (
      <Link href="#" variant="body2">
        Assets
      </Link>
    ),
    actions: (
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" color="inherit">
          Export
        </Button>
        <Button variant="contained">Refresh</Button>
      </Stack>
    ),
  },
};

export const WithTabs: Story = {
  args: {
    title: 'Operations',
    description: 'Exports, archived assets and maintenance scripts.',
    children: (
      <TabBar
        ariaLabel="Operations"
        value="export"
        onChange={() => {}}
        tabs={[
          { value: 'export', label: 'Export' },
          { value: 'archived', label: 'Archived assets', badge: 37 },
          { value: 'scripts', label: 'Scripts' },
        ]}
      />
    ),
  },
};

/** The old prop names still work. */
export const LegacyProps: Story = {
  args: {
    title: 'Datasets',
    totalRows: 42,
    extraActions: <Button variant="contained">New</Button>,
  },
};
