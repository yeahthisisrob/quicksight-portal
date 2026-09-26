import type { RouteHandler } from '../../../api/types';
import {
  FilterBarTemplateStore,
  validateFilterBarInput,
} from '../../../shared/services/templates/FilterBarTemplateStore';
import {
  VisualTemplateStore,
  validateVisualTemplateInput,
} from '../../../shared/services/templates/VisualTemplateStore';
import { DataCatalogHandler } from '../handlers/DataCatalogHandler';
import { TemplateLibraryHandler } from '../handlers/TemplateLibraryHandler';

const handler = new DataCatalogHandler();
const filterBars = new TemplateLibraryHandler(
  new FilterBarTemplateStore(),
  validateFilterBarInput,
  'filter bar'
);
const visuals = new TemplateLibraryHandler(
  new VisualTemplateStore(),
  validateVisualTemplateInput,
  'visual template'
);

export const dataCatalogRoutes: RouteHandler[] = [
  // Main data catalog endpoint with pagination
  {
    method: 'GET',
    path: '/data-catalog',
    handler: (event) => handler.getDataCatalogPaginated(event),
  },

  // Get available tags for filtering
  {
    method: 'GET',
    path: '/data-catalog/tags',
    handler: (event) => handler.getAvailableTags(event),
  },

  // Get available assets for filtering
  {
    method: 'GET',
    path: '/data-catalog/assets',
    handler: (event) => handler.getAvailableAssets(event),
  },

  // Catalog stats and summary
  {
    method: 'GET',
    path: '/data-catalog/stats',
    handler: (event) => handler.getCatalogStats(event),
  },
  {
    method: 'GET',
    path: '/data-catalog/full',
    handler: (event) => handler.getCatalogSummary(event),
  },
  {
    method: 'GET',
    path: '/data-catalog/fields',
    handler: (event) => handler.getFieldsPaginated(event),
  },
  {
    method: 'GET',
    path: '/data-catalog/visual-fields',
    handler: (event) => handler.getVisualFieldsPaginated(event),
  },
  {
    method: 'POST',
    path: '/data-catalog/visual-fields/rebuild',
    handler: (event) => handler.rebuildVisualFieldCatalog(event),
  },

  // Field metadata operations
  {
    method: 'GET',
    path: /^\/data-catalog\/field\/([^/]+)\/([^/]+)\/(.+)$/,
    handler: (event) => handler.getFieldMetadata(event),
  },
  {
    method: 'PUT',
    path: /^\/data-catalog\/field\/([^/]+)\/([^/]+)\/(.+)$/,
    handler: (event) => handler.updateFieldMetadata(event),
  },
  {
    method: 'POST',
    path: /^\/data-catalog\/field\/([^/]+)\/([^/]+)\/(.+)$/,
    handler: (event) => handler.addFieldTags(event),
  },
  {
    method: 'DELETE',
    path: /^\/data-catalog\/field\/([^/]+)\/([^/]+)\/(.+)$/,
    handler: (event) => handler.removeFieldTags(event),
  },

  // Search
  {
    method: 'POST',
    path: '/data-catalog/fields/search-by-tags',
    handler: (event) => handler.searchFieldsByTags(event),
  },

  // SMUS-first catalog
  {
    method: 'GET',
    path: '/data-catalog/smus',
    handler: (event) => handler.getSmusCatalog(event),
  },
  {
    method: 'GET',
    path: /^\/data-catalog\/smus\/([^/]+)$/,
    handler: (event) => handler.getSmusCatalogAsset(event),
  },

  // Field-first catalog: calculated fields, their lineage, and columns
  {
    method: 'GET',
    path: '/data-catalog/calculated-fields',
    handler: (event) => handler.getCalculatedFields(event),
  },
  {
    method: 'GET',
    path: /^\/data-catalog\/calculated-fields\/([^/]+)$/,
    handler: (event) => handler.getCalculatedField(event),
  },
  {
    method: 'GET',
    path: '/data-catalog/columns',
    handler: (event) => handler.getColumns(event),
  },

  // Calculated-field template library
  {
    method: 'GET',
    path: '/data-catalog/templates/calculated-fields',
    handler: (event) => handler.listCalculatedFieldTemplates(event),
  },
  {
    method: 'POST',
    path: '/data-catalog/templates/calculated-fields',
    handler: (event) => handler.createCalculatedFieldTemplate(event),
  },
  {
    method: 'PUT',
    path: /^\/data-catalog\/templates\/calculated-fields\/([^/]+)$/,
    handler: (event) => handler.updateCalculatedFieldTemplate(event),
  },
  {
    method: 'DELETE',
    path: /^\/data-catalog\/templates\/calculated-fields\/([^/]+)$/,
    handler: (event) => handler.deleteCalculatedFieldTemplate(event),
  },

  // Filter bar templates: the standard filters, order and widths of a control bar
  {
    method: 'GET',
    path: '/data-catalog/templates/filter-bars',
    handler: (event) => filterBars.list(event),
  },
  {
    method: 'POST',
    path: '/data-catalog/templates/filter-bars',
    handler: (event) => filterBars.create(event),
  },
  {
    method: 'PUT',
    path: /^\/data-catalog\/templates\/filter-bars\/([^/]+)$/,
    handler: (event) => filterBars.update(event),
  },
  {
    method: 'DELETE',
    path: /^\/data-catalog\/templates\/filter-bars\/([^/]+)$/,
    handler: (event) => filterBars.remove(event),
  },

  // Visual templates: visuals by column name, reusable on any dataset with those columns
  {
    method: 'GET',
    path: '/data-catalog/templates/visuals',
    handler: (event) => visuals.list(event),
  },
  {
    method: 'POST',
    path: '/data-catalog/templates/visuals',
    handler: (event) => visuals.create(event),
  },
  {
    method: 'PUT',
    path: /^\/data-catalog\/templates\/visuals\/([^/]+)$/,
    handler: (event) => visuals.update(event),
  },
  {
    method: 'DELETE',
    path: /^\/data-catalog\/templates\/visuals\/([^/]+)$/,
    handler: (event) => visuals.remove(event),
  },
];
