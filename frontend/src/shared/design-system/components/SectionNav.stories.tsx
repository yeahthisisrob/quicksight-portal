import { Settings, Storage, Work } from '@mui/icons-material';
import { Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Container } from './Container';
import { SectionNav } from './SectionNav';

type Section = 'general' | 'data' | 'jobs';

/**
 * A page of sections, listed down the left with the open one on the right.
 * For pages whose sections keep growing; a row of tabs is for a handful of
 * views of one thing.
 */
const meta: Meta<typeof SectionNav> = {
  title: 'Design System/SectionNav',
  component: SectionNav,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof meta>;

function Demo({ withIcons = false }: { withIcons?: boolean }) {
  const [value, setValue] = useState<Section>('general');
  const icon = (node: React.ReactElement) => (withIcons ? node : undefined);
  return (
    <SectionNav<Section>
      ariaLabel="Demo sections"
      value={value}
      onChange={setValue}
      sections={[
        { id: 'general', label: 'General', icon: icon(<Settings fontSize="small" />), badge: 2 },
        { id: 'data', label: 'Data', icon: icon(<Storage fontSize="small" />) },
        { id: 'jobs', label: 'Jobs', icon: icon(<Work fontSize="small" />), badge: 0 },
      ]}
    >
      <Container header={value[0]!.toUpperCase() + value.slice(1)} description="The open section.">
        <Typography variant="body2">Content for {value}.</Typography>
      </Container>
    </SectionNav>
  );
}

export const Default: Story = { render: () => <Demo /> };

type Nested = 'assistant' | 'studio:editor' | 'studio:templates' | 'api';

function NestedDemo() {
  const [value, setValue] = useState<Nested>('studio:templates');
  return (
    <SectionNav<Nested>
      ariaLabel="Nested sections"
      value={value}
      onChange={setValue}
      sections={[
        { id: 'assistant', label: 'Assistant' },
        {
          id: 'studio:editor',
          label: 'Studio',
          children: [
            { id: 'studio:editor', label: 'Editor' },
            { id: 'studio:templates', label: 'Templates' },
          ],
        },
        { id: 'api', label: 'API' },
      ]}
    >
      <Container
        header={value}
        description="The open section; choosing Studio opens its first view."
      >
        <Typography variant="body2">Content for {value}.</Typography>
      </Container>
    </SectionNav>
  );
}

/** Sections under a section, indented; the parent reads bold while any of its views is open. */
export const Nested: Story = { render: () => <NestedDemo /> };

/** Icons beside the labels, as the Operations page uses them; a zero badge is not shown. */
export const WithIcons: Story = { render: () => <Demo withIcons /> };
