import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { MockedApi } from '../../../../.storybook/mocks/api';
import { themeRoutes } from './__stories__/fixtures';
import { ThemePicker } from './ThemePicker';

/** The account's themes first, with their colors, then QuickSight's own. */
const meta: Meta = {
  title: 'Entities/Theme/ThemePicker',
  component: ThemePicker,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof meta>;

function Picker({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <ThemePicker value={value} onChange={setValue} />;
}

export const CustomTheme: Story = {
  render: () => (
    <MockedApi routes={themeRoutes()}>
      <Picker initial="brand" />
    </MockedApi>
  ),
};

export const BuiltIn: Story = {
  render: () => (
    <MockedApi routes={themeRoutes()}>
      <Picker initial="MIDNIGHT" />
    </MockedApi>
  ),
};
