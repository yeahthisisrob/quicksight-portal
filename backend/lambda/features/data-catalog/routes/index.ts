import { type RouteHandler } from '../../../api/types';
import { DataCatalogHandler } from '../handlers/DataCatalogHandler';

const handler = new DataCatalogHandler();

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

  // Semantic endpoints
  {
    method: 'GET',
    path: '/semantic/terms',
    handler: (event) => handler.getSemanticTerms(event),
  },
  {
    method: 'GET',
    path: '/semantic/mappings',
    handler: (event) => handler.getSemanticMappings(event),
  },
  {
    method: 'GET',
    path: '/semantic/stats',
    handler: (event) => handler.getSemanticStats(event),
  },
];
