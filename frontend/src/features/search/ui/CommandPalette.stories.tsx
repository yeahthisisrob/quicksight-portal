import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';

import { type MockRoute, useMockApi } from '../../../../.storybook/mocks/api';
import { SEARCH_FAILING, SEARCH_PENDING, searchRoute } from '../../../../.storybook/mocks/search';
import { CommandPaletteProvider, useCommandPalette } from '../model/commandPalette';
import { CommandPalette } from './CommandPalette';

/** Opens the palette as soon as the story mounts, the way Cmd+K would. */
function OpenOnMount() {
  const palette = useCommandPalette();
  useEffect(() => palette.show(), [palette.show]);
  return null;
}

function Mocked({
  routes: r,
  text,
  children,
}: {
  routes: MockRoute[];
  text?: string;
  children?: React.ReactNode;
}) {
  useMockApi(r);
  return (
    <CommandPaletteProvider>
      <OpenOnMount />
      <CommandPalette defaultText={text} />
      {children}
    </CommandPaletteProvider>
  );
}

const meta: Meta<typeof CommandPalette> = {
  title: 'Features/Search/CommandPalette',
  component: CommandPalette,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Cmd+K anywhere: one box over everything the portal knows. Results are grouped by type and say why they matched; calculated fields show their expression and where they are defined. Arrows move, Enter opens, Esc closes.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Results: Story = {
  name: 'Results for "sales revenue"',
  render: () => <Mocked routes={[searchRoute()]} text="sales revenue" />,
};

export const Empty: Story = {
  name: 'Nothing matches',
  render: () => <Mocked routes={[searchRoute()]} text="quarterly churn cohort" />,
};

export const BeforeTyping: Story = {
  render: () => <Mocked routes={[searchRoute()]} />,
};

export const Loading: Story = {
  render: () => <Mocked routes={[SEARCH_PENDING]} text="sales" />,
};

export const Failing: Story = {
  render: () => <Mocked routes={[SEARCH_FAILING]} text="sales" />,
};
