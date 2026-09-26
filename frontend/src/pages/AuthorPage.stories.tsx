import type { Meta, StoryObj } from '@storybook/react-vite';

import { assistantRoutes } from '@/features/assistant/ui/__stories__/assistant';
import {
  authorRoutes,
  REPAIR_PLAN,
  repairPlanRoute,
  SMUS_NOT_CONFIGURED,
  SMUS_SETTINGS_NOT_CONFIGURED,
  SOURCE,
} from '@/features/author/ui/__stories__/fixtures';
import { settingsRoutes } from '@/features/settings/ui/__stories__/fixtures';

import { AppShell } from '../../.storybook/mocks/AppShell';
import AuthorPage from './AuthorPage';

const sourceUrl = `/author?type=${SOURCE.type}&id=${SOURCE.id}&name=${encodeURIComponent(SOURCE.name)}`;

/**
 * The Author page exactly as a user sees it: inside the top bar and sidebar,
 * at its real route, with the API stubbed. The Assistant makes things; the
 * Studio edits and fixes what exists - click a row to open it, fix its
 * issues, edit visuals on the canvas and save.
 */
const meta: Meta<typeof AuthorPage> = {
  title: 'Pages/Author',
  component: AuthorPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** /author?tab=studio - the Editor with nothing open: what needs fixing first. */
export const Studio: Story = {
  name: 'Studio',
  parameters: { router: { initialEntries: ['/author?tab=studio'] } },
  render: () => (
    <AppShell path="author" routes={authorRoutes()}>
      <AuthorPage />
    </AppShell>
  ),
};

export const WithSource: Story = {
  name: 'Studio: opened from a dashboard row',
  parameters: { router: { initialEntries: [sourceUrl] } },
  render: () => (
    <AppShell path="author" routes={authorRoutes()}>
      <AuthorPage />
    </AppShell>
  ),
};

/** Opened from the errors dialog or the row menu: the Issues panel, every fix proposed. */
export const RepairFromErrors: Story = {
  name: 'Studio: opened to fix a broken dashboard',
  parameters: { router: { initialEntries: [sourceUrl] } },
  render: () => (
    <AppShell path="author" routes={authorRoutes([repairPlanRoute(REPAIR_PLAN)])}>
      <AuthorPage />
    </AppShell>
  ),
};

/** SMUS is not configured: the Studio works all the same; the Data panel says so. */
export const StudioWithoutSmus: Story = {
  name: 'Studio: SMUS not configured',
  parameters: { router: { initialEntries: [sourceUrl] } },
  render: () => (
    <AppShell
      path="author"
      routes={authorRoutes([SMUS_SETTINGS_NOT_CONFIGURED, SMUS_NOT_CONFIGURED])}
    >
      <AuthorPage />
    </AppShell>
  ),
};

/** /author?tab=studio&view=templates - the naming standard and the template library. */
export const StudioTemplates: Story = {
  name: 'Studio: Templates',
  parameters: { router: { initialEntries: ['/author?tab=studio&view=templates'] } },
  render: () => (
    <AppShell path="author" routes={authorRoutes()}>
      <AuthorPage />
    </AppShell>
  ),
};

/** /author?tab=api - authoring by API: an agent with a key, the keys, every operation. */
export const ApiTab: Story = {
  name: 'API tab',
  parameters: { router: { initialEntries: ['/author?tab=api'] } },
  render: () => (
    <AppShell path="author" routes={authorRoutes(settingsRoutes())}>
      <AuthorPage />
    </AppShell>
  ),
};

/** /author - the Assistant tab, first: ask, see the plan and the preview, run. */
export const AssistantTab: Story = {
  name: 'Assistant tab (the default)',
  parameters: { router: { initialEntries: ['/author'] } },
  render: () => (
    <AppShell path="author" routes={authorRoutes(assistantRoutes())}>
      <AuthorPage />
    </AppShell>
  ),
};
