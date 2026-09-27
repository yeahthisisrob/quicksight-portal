import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi } from '../../../../.storybook/mocks/api';
import { BRAND_DRAFT, newThemeRoutes } from './__stories__/fixtures';
import { DefaultThemeControl } from './DefaultThemeControl';
import { NewThemeDialog } from './NewThemeDialog';
import { ThemePreview } from './ThemePreview';

/**
 * Making themes: from a picture of a brand, a logo or a layout (a model
 * drafts one, as a job) or from scratch; edited and previewed before
 * anything is created. And the theme new assets wear.
 */
const meta: Meta = {
  title: 'Features/Themes',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const FromAPicture: Story = {
  render: () => (
    <MockedApi routes={newThemeRoutes()}>
      <NewThemeDialog open onClose={() => {}} />
    </MockedApi>
  ),
};

export const EditingADraft: Story = {
  render: () => (
    <MockedApi routes={newThemeRoutes()}>
      <NewThemeDialog open onClose={() => {}} initialDraft={BRAND_DRAFT} />
    </MockedApi>
  ),
};

export const ADraftThatCannotBeCreated: Story = {
  render: () => (
    <MockedApi routes={newThemeRoutes()}>
      <NewThemeDialog
        open
        onClose={() => {}}
        initialDraft={{ ...BRAND_DRAFT, name: '', dataColors: ['#0B6E4F', 'green'] }}
      />
    </MockedApi>
  ),
};

export const Previews: Story = {
  render: () => (
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
      <ThemePreview draft={BRAND_DRAFT} />
      <ThemePreview
        draft={{
          ...BRAND_DRAFT,
          name: 'Night ops',
          baseThemeId: 'MIDNIGHT',
          uiColors: {},
          dataColors: ['#7FDBFF', '#FFDC00', '#FF851B', '#B10DC9'],
        }}
      />
    </Stack>
  ),
};

export const DefaultForNewAssets: Story = {
  render: () => (
    <MockedApi routes={newThemeRoutes()}>
      <DefaultThemeControl />
    </MockedApi>
  ),
};
