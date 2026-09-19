import { Button, Stack, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route, Routes } from 'react-router-dom';

import { Container, KeyValuePairs, PageHeader, StatusIndicator } from '@/shared/design-system';

import MainLayout from './MainLayout';

const meta = {
  title: 'Widgets/Navigation/MainLayout',
  component: MainLayout,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Top bar, side navigation and the page. The sidebar collapses to icons and remembers that per browser.',
      },
    },
  },
} satisfies Meta<typeof MainLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

function SamplePage() {
  return (
    <>
      <PageHeader
        title="Datasets"
        counter={412}
        description="Every dataset in the account, with where it reads from and who uses it."
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" color="inherit">
              Export
            </Button>
            <Button variant="contained">Refresh</Button>
          </Stack>
        }
      />
      <Container header="Summary" description="A container inside the standard layout.">
        <KeyValuePairs
          columns={3}
          items={[
            { label: 'SPICE', value: '318' },
            { label: 'Direct query', value: '94' },
            {
              label: 'Last export',
              value: <StatusIndicator type="success">2 min ago</StatusIndicator>,
            },
          ]}
        />
      </Container>
      <Typography sx={{ mt: 2 }} color="text.secondary">
        Page content continues below the fold.
      </Typography>
    </>
  );
}

export const Default: Story = {
  render: () => (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="*" element={<SamplePage />} />
      </Route>
    </Routes>
  ),
};
