import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';

import type { ExportMode } from '../../model/types';
import ExportControls from './ExportControls';

const meta = {
  title: 'Features/DataExport/ExportControls',
  component: ExportControls,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '720px' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    exportMode: 'smart',
    onModeChange: () => {},
    disabled: false,
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return (
      <ExportControls
        {...args}
        onModeChange={(exportMode: ExportMode) => updateArgs({ exportMode })}
      />
    );
  },
} satisfies Meta<typeof ExportControls>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Smart sync; the mode switch is live. The running state is in DataExportView. */
export const Default: Story = {};

/** Rebuild ignores the asset type selection and warns about duration. */
export const RebuildMode: Story = {
  args: { exportMode: 'rebuild' },
};

/** While an export runs the mode cannot change. */
export const Running: Story = {
  args: { disabled: true },
};
