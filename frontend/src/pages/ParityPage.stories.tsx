import type { Meta, StoryObj } from '@storybook/react-vite';

import { AppShell } from '../../.storybook/mocks/AppShell';
import ParityPage from './ParityPage';

/** The parity page in the app shell. Static: it calls no API. */
const meta: Meta<typeof ParityPage> = {
  title: 'Pages/AWS parity',
  component: ParityPage,
  parameters: { layout: 'fullscreen', router: { initialEntries: ['/parity'] } },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AppShell path="parity">
      <ParityPage />
    </AppShell>
  ),
};
