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
 * at its real route, with the API stubbed. Click through the steps: the
 * source list is ranked by use with insights on the preview, the planner
 * proposes a dataset and an edit, the mockup is editable, and the copy can
 * be published into a folder.
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

/** Opened from the errors dialog or the row menu: lands on the Repair step. */
export const RepairFromErrors: Story = {
  name: 'Opened to repair a broken dashboard',
  parameters: { router: { initialEntries: [`${sourceUrl}&repair=1`] } },
  render: () => (
    <AppShell path="author" routes={authorRoutes([repairPlanRoute(REPAIR_PLAN)])}>
      <AuthorPage />
    </AppShell>
  ),
};

/** /author?new=1 - the flow that starts from nothing, on the Datasets step. */
export const StartedFromNothing: Story = {
  name: 'Started from nothing',
  parameters: { router: { initialEntries: ['/author?new=1'] } },
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

export const SmusNotConfigured: Story = {
  name: 'Gated: SMUS not configured',
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
