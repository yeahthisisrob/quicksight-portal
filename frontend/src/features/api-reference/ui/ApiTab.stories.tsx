import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { Container } from '@/shared/design-system';

import { mockApi } from '../../../../.storybook/mocks/api';
import { assistantRoutes } from './__stories__/assistant';
import ApiTab from './ApiTab';

function Mocked({ children }: { children: React.ReactNode }) {
  const [restore] = useState(() => mockApi(assistantRoutes()));
  useEffect(() => restore, [restore]);
  return <>{children}</>;
}

/**
 * The Author page's API tab: use an agent with a key, the keys (a slot the
 * page fills from Settings), where this is heading, and every operation
 * from the contract the API serves, searchable.
 */
const meta: Meta<typeof ApiTab> = {
  title: 'Features/Author/API tab',
  component: ApiTab,
  parameters: { layout: 'fullscreen' },
  args: { origin: 'https://d1234abcd.cloudfront.net' },
  decorators: [
    (Story) => (
      <Mocked>
        <Story />
      </Mocked>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Quick start, keys slot, AWS Context, reference',
  args: {
    keysPanel: (
      <Container header="API keys" description="The Settings panel renders here on the page.">
        (keys)
      </Container>
    ),
  },
};

export const ReferenceOnly: Story = {
  name: 'Without the keys panel',
};
