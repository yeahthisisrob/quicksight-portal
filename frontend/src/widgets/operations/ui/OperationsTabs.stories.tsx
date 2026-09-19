import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { PageHeader, TabBar } from '@/shared/design-system';

import { OPERATIONS_TABS, type OperationsTab } from '../lib/operationsTab';

/**
 * The Operations page header with its tabs, on its own. The page itself
 * needs the router's search params; this shows the chrome the user sees.
 */
function OperationsChrome({ initial }: { initial: OperationsTab }) {
  const [tab, setTab] = useState<OperationsTab>(initial);
  return (
    <PageHeader
      title="Operations"
      description="Exports, archived assets and maintenance scripts for the whole account."
    >
      <TabBar
        ariaLabel="Operations"
        value={tab}
        onChange={setTab}
        tabs={OPERATIONS_TABS.map((value) => ({
          value,
          label:
            value === 'archived' ? 'Archived assets' : value[0]!.toUpperCase() + value.slice(1),
        }))}
      />
    </PageHeader>
  );
}

const meta = {
  title: 'Widgets/Operations/OperationsTabs',
  component: OperationsChrome,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof OperationsChrome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExportTab: Story = { args: { initial: 'export' } };
export const ArchivedTab: Story = { args: { initial: 'archived' } };
export const ScriptsTab: Story = { args: { initial: 'scripts' } };
