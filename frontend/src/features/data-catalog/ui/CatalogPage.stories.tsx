import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { type MockRoute, mockApi } from '../../../../.storybook/mocks/api';
import { LONG_FORMS_ASSET, SALES_ASSET, SALES_GOLD_DATASET } from './__stories__/fixtures';
import { catalogRoutes } from './__stories__/routes';
import { AssetDetail } from './AssetDetail';
import { CatalogPage } from './CatalogPage';
import ExpressionGraphDialog from './dialogs/ExpressionGraphDialog';
import { TemplateLibraryDialog } from './templates/TemplateLibraryDialog';

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
  const [restore] = useState(() => mockApi(r));
  useEffect(() => restore, [restore]);
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

/** Two projects, the first selected, one asset open with two linked datasets. */
export const Loaded: Story = {
  render: () => (
    <Mocked
      routes={catalogRoutes()}
      path="/data-catalog?project=proj-analytics-prod&asset=lst-sales-gold"
    >
      <CatalogPage />
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

/** SMUS is not set up: the page points at Settings. */
export const NotConfigured: Story = {
  render: () => (
    <Mocked
      routes={catalogRoutes([
        {
          method: 'get',
          url: /\/data-catalog\/smus$/,
          respond: () => ({
            body: { success: true, data: { configured: false, ...EMPTY_CATALOG } },
          }),
        },
      ])}
      path="/data-catalog"
    >
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

/** The right pane alone, the normal case. */
export const Detail: Story = {
  render: () => (
    <Mocked routes={catalogRoutes()} path="/data-catalog">
      <div style={{ padding: 24, maxWidth: 960 }}>
        <AssetDetail asset={SALES_ASSET} />
      </div>
    </Mocked>
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

/** The saved calculated-field templates. */
export const TemplateLibrary: Story = {
  render: () => (
    <Mocked routes={catalogRoutes()} path="/data-catalog">
      <TemplateLibraryDialog open onClose={() => {}} />
    </Mocked>
  ),
};
