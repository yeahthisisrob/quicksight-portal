import type { Meta, StoryObj } from '@storybook/react-vite';
import { Navigate } from 'react-router-dom';

import { type MockRoute, useMockApi } from '../../../../.storybook/mocks/api';
import { LONG_FORMS_ASSET, SALES_GOLD_DATASET } from './__stories__/fixtures';
import { catalogRoutes } from './__stories__/routes';
import { AssetDetail } from './AssetDetail';
import { CatalogPage } from './CatalogPage';
import ExpressionGraphDialog from './dialogs/ExpressionGraphDialog';

/**
 * The page makes three kinds of request: the unscoped list (to learn the
 * projects), the project's list (search/term), and one asset. Each story
 * stubs those at the HTTP layer and lets the real page logic run.
 */

const EMPTY_CATALOG = {
  exportedAt: '2026-09-18T09:30:00Z',
  projectFilter: [],
  projects: [],
  glossaryTerms: [],
  assets: [],
};

/**
 * Installs the stub during render, before the page's own effects fire, and
 * moves Storybook's router (a MemoryRouter from the global decorator) to the
 * story's path so URL state is exercised.
 */
function Mocked({
  routes: r,
  path,
  children,
}: {
  routes: MockRoute[];
  path: string;
  children: React.ReactNode;
}) {
  useMockApi(r);
  return (
    <>
      <Navigate to={path} replace />
      {children}
    </>
  );
}

const meta: Meta<typeof CatalogPage> = {
  title: 'Features/DataCatalog/CatalogPage',
  component: CatalogPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The catalog, SMUS first: one project at a time, its published assets on the left, one asset on the right with what SMUS owns and what QuickSight adds.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** The left pane in "Everything" mode: rules by expression, visuals, listings across projects. */
export const SearchEverything: Story = {
  name: 'Search everything: "closed margin"',
  render: () => (
    <Mocked
      routes={catalogRoutes()}
      path="/data-catalog?project=proj-analytics-prod&q=closed%20margin"
    >
      <CatalogPage initialScope="everything" />
    </Mocked>
  ),
};

/** An asset no QuickSight dataset reads yet. */
export const NoQuickSightDatasets: Story = {
  render: () => (
    <Mocked
      routes={catalogRoutes()}
      path="/data-catalog?project=proj-analytics-prod&asset=lst-customer-dim"
    >
      <CatalogPage />
    </Mocked>
  ),
};

/** Nothing selected, a glossary term filter on. */
export const FilteredByTerm: Story = {
  render: () => (
    <Mocked routes={catalogRoutes()} path="/data-catalog?project=proj-analytics-prod&term=PII">
      <CatalogPage />
    </Mocked>
  ),
};

/** Configured, but the SMUS export has never run: the page points at Operations. */
export const NoExportYet: Story = {
  render: () => (
    <Mocked
      routes={catalogRoutes([
        {
          method: 'get',
          url: /\/data-catalog\/smus$/,
          respond: () => ({
            body: {
              success: true,
              data: { ...EMPTY_CATALOG, configured: true, exportedAt: null },
            },
          }),
        },
      ])}
      path="/data-catalog"
    >
      <CatalogPage />
    </Mocked>
  ),
};

/** Configured, but no project has published anything. */
export const EmptyDomain: Story = {
  render: () => (
    <Mocked
      routes={catalogRoutes([
        {
          method: 'get',
          url: /\/data-catalog\/smus$/,
          respond: () => ({
            body: { success: true, data: { configured: true, ...EMPTY_CATALOG } },
          }),
        },
      ])}
      path="/data-catalog"
    >
      <CatalogPage />
    </Mocked>
  ),
};

/** The catalog call fails. */
export const LoadError: Story = {
  render: () => (
    <Mocked
      routes={catalogRoutes([
        {
          method: 'get',
          url: /\/data-catalog\/smus$/,
          respond: () => ({
            status: 500,
            body: { success: false, error: 'DataZone SearchListings timed out after 30s' },
          }),
        },
      ])}
      path="/data-catalog"
    >
      <CatalogPage />
    </Mocked>
  ),
};

/** The right pane alone, with more metadata forms than usual. */
export const DetailWithManyForms: Story = {
  render: () => (
    <Mocked routes={catalogRoutes()} path="/data-catalog">
      <div style={{ padding: 24, maxWidth: 960 }}>
        <AssetDetail asset={LONG_FORMS_ASSET} />
      </div>
    </Mocked>
  ),
};

/** The right pane alone, loading. */
export const DetailLoading: Story = {
  render: () => (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <AssetDetail loading />
    </div>
  ),
};

/** Lineage of a calculated field, both directions, starting from margin_pct. */
export const Lineage: Story = {
  render: () => (
    <ExpressionGraphDialog
      open
      onClose={() => {}}
      dataset={SALES_GOLD_DATASET}
      fieldName="margin_pct"
    />
  ),
};
