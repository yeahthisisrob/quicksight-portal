/**
 * The project filter on the field-first tabs. Picking a project and getting
 * back to every project has to work in both directions, because a project with
 * no linked datasets shows nothing and the way out is the filter itself.
 */
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { theme } from '@/app/theme';

import { smusCatalogApi } from '@/shared/api';

import { CatalogTabsPage } from '../CatalogTabsPage';

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

const calculatedFields = vi.fn();

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api')>();
  return { ...actual, smusCatalogApi: { list: vi.fn() } };
});

// The field hooks import the module directly, not the barrel.
vi.mock('@/shared/api/modules/data-catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/modules/data-catalog')>();
  return {
    ...actual,
    fieldCatalogApi: {
      calculatedFields: (...args: unknown[]) => calculatedFields(...args),
      calculatedField: vi.fn(),
      columns: vi.fn().mockResolvedValue({
        configured: true,
        exportedAt: null,
        counts: { columns: 0, datasets: 0, withSmus: 0, withSmusColumn: 0 },
        items: [],
      }),
    },
  };
});

const PROJECTS = [
  { id: 'proj-prod', name: 'analytics_prod', count: 12 },
  { id: 'proj-dev', name: 'analytics_dev', count: 3 },
];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MemoryRouter initialEntries={['/data-catalog']}>
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const fieldsFor = (projectId?: string) => ({
  configured: true,
  exportedAt: '2026-09-19T00:00:00Z',
  counts: { fields: 0, conflicts: 0, unused: 0, withNotes: 0 },
  // Only datasets in the prod project matched a listing, which is the state a
  // linking gap leaves behind.
  items:
    projectId === 'proj-dev'
      ? []
      : [
          {
            key: 'cf_margin',
            name: 'margin',
            expression: '{revenue} - {cost}',
            definedIn: [],
            datasets: [],
            references: [],
            usedBy: { dashboards: 1, analyses: 0, visuals: 2 },
            hasNote: false,
          },
        ],
});

describe('CatalogTabsPage project filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(smusCatalogApi.list).mockResolvedValue({
      configured: true,
      exportedAt: '2026-09-19T00:00:00Z',
      projects: PROJECTS,
      assets: [],
      terms: [],
    } as never);
    calculatedFields.mockImplementation((params: { projectId?: string }) =>
      Promise.resolve(fieldsFor(params?.projectId))
    );
  });

  afterEach(cleanup);

  it('opens on every project, narrows to one, and gets back again', async () => {
    const user = userEvent.setup();
    render(<CatalogTabsPage />, { wrapper });

    // Opens unfiltered: the fields show without a project being chosen.
    await waitFor(() => expect(screen.getByText('margin')).toBeInTheDocument());
    expect(calculatedFields).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: undefined })
    );
    expect(screen.getByLabelText('Project')).toHaveTextContent('All projects');

    // Narrow to a project whose datasets never matched a listing.
    await user.click(screen.getByLabelText('Project'));
    await user.click(within(screen.getByRole('listbox')).getByText('analytics_dev'));
    await waitFor(() =>
      expect(calculatedFields).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-dev' })
      )
    );
    await waitFor(() => expect(screen.queryByText('margin')).not.toBeInTheDocument());

    // And back out of it, which is the only way to see anything again.
    await user.click(screen.getByLabelText('Project'));
    await user.click(within(screen.getByRole('listbox')).getByText('All projects'));
    await waitFor(() => expect(screen.getByText('margin')).toBeInTheDocument());
    expect(screen.getByLabelText('Project')).toHaveTextContent('All projects');
  });

  it('keeps every project after a trip through the SMUS tab, which is bound to one', async () => {
    const user = userEvent.setup();
    render(<CatalogTabsPage />, { wrapper });
    await waitFor(() => expect(screen.getByText('margin')).toBeInTheDocument());

    // The SMUS tab shows one project because everything in SMUS is per
    // project, but it must not write that choice down for the other tabs.
    await user.click(screen.getByRole('tab', { name: /SMUS assets/i }));
    await waitFor(() =>
      expect(screen.getByLabelText('Project')).toHaveTextContent('analytics_prod')
    );

    await user.click(screen.getByRole('tab', { name: /Calculated fields/i }));
    await waitFor(() => expect(screen.getByText('margin')).toBeInTheDocument());
    expect(screen.getByLabelText('Project')).toHaveTextContent('All projects');
  });
});
