import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  authorRoutes,
  SMUS_NOT_CONFIGURED,
  SOURCE,
} from '@/features/author/ui/__stories__/fixtures';

import { AppShell } from '../../.storybook/mocks/AppShell';
import AuthorPage from './AuthorPage';

const sourceUrl = `/author?type=${SOURCE.type}&id=${SOURCE.id}&name=${encodeURIComponent(SOURCE.name)}`;

/**
 * The Author page exactly as a user sees it: inside the top bar and sidebar,
 * at its real route, with the API stubbed. Click through the steps.
 */
const meta: Meta<typeof AuthorPage> = {
  title: 'Pages/Author',
  component: AuthorPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithSource: Story = {
  name: 'Opened from a dashboard row',
  parameters: { router: { initialEntries: [sourceUrl] } },
  render: () => (
    <AppShell path="author" routes={authorRoutes()}>
      <AuthorPage />
    </AppShell>
  ),
};

export const Start: Story = {
  name: 'Fresh, nothing chosen',
  parameters: { router: { initialEntries: ['/author'] } },
  render: () => (
    <AppShell path="author" routes={authorRoutes()}>
      <AuthorPage />
    </AppShell>
  ),
};

export const SmusNotConfigured: Story = {
  parameters: { router: { initialEntries: [sourceUrl] } },
  render: () => (
    <AppShell path="author" routes={authorRoutes([SMUS_NOT_CONFIGURED])}>
      <AuthorPage />
    </AppShell>
  ),
};
