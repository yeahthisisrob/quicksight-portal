import type { components, paths } from '@shared/generated/types';

import { client, unwrap } from '../typed';

type CatalogSchemas = components['schemas'];
export type SmusCatalog = CatalogSchemas['SmusCatalog'];
export type SmusCatalogAssetSummary = CatalogSchemas['SmusCatalogAssetSummary'];
export type SmusCatalogAsset = CatalogSchemas['SmusCatalogAsset'];
export type CatalogDataset = CatalogSchemas['CatalogDataset'];
export type DatasetCatalogField = CatalogSchemas['DatasetCatalogField'];
export type GlossaryTerm = CatalogSchemas['GlossaryTerm'];
export type MetadataForm = CatalogSchemas['MetadataForm'];
export type PortalFieldMetadata = CatalogSchemas['PortalFieldMetadata'];
export type CalculatedFieldTemplate = CatalogSchemas['CalculatedFieldTemplate'];
export type CalculatedFieldTemplateInput = CatalogSchemas['CalculatedFieldTemplateInput'];
export type FilterBarTemplate = CatalogSchemas['FilterBarTemplate'];
export type FilterBarTemplateInput = CatalogSchemas['FilterBarTemplateInput'];
export type FilterBarControl = CatalogSchemas['FilterBarControl'];
export type VisualTemplate = CatalogSchemas['VisualTemplate'];
export type VisualTemplateInput = CatalogSchemas['VisualTemplateInput'];
export type TemplateVisual = CatalogSchemas['TemplateVisual'];
export type FieldVisualUsage = CatalogSchemas['FieldVisualUsage'];
export type FieldConflict = CatalogSchemas['FieldConflict'];
export type ExpressionVariant = CatalogSchemas['ExpressionVariant'];
export type SmusColumnLink = CatalogSchemas['SmusColumnLink'];
export type CalculatedFieldCatalog = CatalogSchemas['CalculatedFieldCatalog'];
export type CalculatedFieldSummary = CatalogSchemas['CalculatedFieldSummary'];
export type CalculatedFieldDetail = CatalogSchemas['CalculatedFieldDetail'];
export type CalculatedFieldRef = CatalogSchemas['CalculatedFieldRef'];
export type CatalogDatasetRef = CatalogSchemas['CatalogDatasetRef'];
export type CatalogListingRef = CatalogSchemas['CatalogListingRef'];
export type SmusColumnRef = CatalogSchemas['SmusColumnRef'];
export type LineageRead = CatalogSchemas['LineageRead'];
export type FieldLineage = CatalogSchemas['FieldLineage'];
export type FieldLineageNode = CatalogSchemas['FieldLineageNode'];
export type FieldLineageEdge = CatalogSchemas['FieldLineageEdge'];
export type SmusMatchType = CatalogSchemas['SmusMatchType'];
export type ColumnCatalog = CatalogSchemas['ColumnCatalog'];
export type ColumnCatalogItem = CatalogSchemas['ColumnCatalogItem'];
export type FieldUsedIn = CatalogSchemas['FieldUsedIn'];

/** Which datasets the field-first tabs read: see the API's scope parameter. */
export type CatalogScope = NonNullable<
  NonNullable<paths['/api/data-catalog/calculated-fields']['get']['parameters']['query']>['scope']
>;

export interface FieldCatalogParams {
  projectId?: string;
  datasetId?: string;
  search?: string;
  conflictsOnly?: boolean;
  scope?: CatalogScope;
}

export type SmusCatalogQuery = NonNullable<
  paths['/api/data-catalog/smus']['get']['parameters']['query']
>;

/**
 * The asset-first catalog's filters: tags in use across assets, with counts.
 */
export const dataCatalogApi = {
  async getAvailableTags() {
    return (
      unwrap(await client.GET('/api/data-catalog/tags'), 'Failed to fetch available tags') ?? []
    );
  },
};

/**
 * The catalog field-first: every calculated field in the account grouped by
 * what it computes, its lineage, and the plain columns tied to SMUS.
 */
export const fieldCatalogApi = {
  async calculatedFields(params: FieldCatalogParams = {}): Promise<CalculatedFieldCatalog> {
    return unwrap(
      await client.GET('/api/data-catalog/calculated-fields', {
        params: {
          query: {
            projectId: params.projectId || undefined,
            datasetId: params.datasetId || undefined,
            search: params.search || undefined,
            conflictsOnly: params.conflictsOnly || undefined,
            scope: params.scope || undefined,
          },
        },
      }),
      'Failed to load calculated fields'
    );
  },

  async calculatedField(key: string): Promise<CalculatedFieldDetail> {
    return unwrap(
      await client.GET('/api/data-catalog/calculated-fields/{key}', { params: { path: { key } } }),
      'Failed to load the calculated field'
    );
  },

  async columns(params: FieldCatalogParams = {}): Promise<ColumnCatalog> {
    return unwrap(
      await client.GET('/api/data-catalog/columns', {
        params: {
          query: {
            projectId: params.projectId || undefined,
            datasetId: params.datasetId || undefined,
            search: params.search || undefined,
            scope: params.scope || undefined,
          },
        },
      }),
      'Failed to load columns'
    );
  },
};

/**
 * The calculated-field template library: expressions worth reusing across
 * datasets, kept by the portal because SMUS has no home for them.
 */
export const calculatedFieldTemplatesApi = {
  async list(): Promise<CalculatedFieldTemplate[]> {
    return unwrap(
      await client.GET('/api/data-catalog/templates/calculated-fields'),
      'Failed to load the template library'
    ).templates;
  },

  async create(input: CalculatedFieldTemplateInput): Promise<CalculatedFieldTemplate> {
    return unwrap(
      await client.POST('/api/data-catalog/templates/calculated-fields', { body: input }),
      'Failed to save the template'
    );
  },

  async update(
    templateId: string,
    input: CalculatedFieldTemplateInput
  ): Promise<CalculatedFieldTemplate> {
    return unwrap(
      await client.PUT('/api/data-catalog/templates/calculated-fields/{templateId}', {
        params: { path: { templateId } },
        body: input,
      }),
      'Failed to update the template'
    );
  },

  async remove(templateId: string): Promise<void> {
    unwrap(
      await client.DELETE('/api/data-catalog/templates/calculated-fields/{templateId}', {
        params: { path: { templateId } },
      }),
      'Failed to delete the template'
    );
  },
};

/**
 * The SMUS-first catalog: published assets in the selected projects with
 * what SMUS owns (terms, forms, columns) and what only QuickSight knows
 * (datasets, calculated fields, usage).
 */
export const smusCatalogApi = {
  /** `scope: 'projects'` skips the field index: only the project list with counts. */
  async list(params: SmusCatalogQuery = {}): Promise<SmusCatalog> {
    return unwrap(
      await client.GET('/api/data-catalog/smus', { params: { query: params } }),
      'Failed to load the catalog'
    );
  },

  async get(listingId: string): Promise<SmusCatalogAsset> {
    return unwrap(
      await client.GET('/api/data-catalog/smus/{listingId}', { params: { path: { listingId } } }),
      'Failed to load the asset'
    );
  },
};

/** A template library (filter bars, visuals): list, save (create or update), remove. */
export interface TemplateLibraryApi<T, Input> {
  list(): Promise<T[]>;
  save(templateId: string | undefined, input: Input): Promise<T>;
  remove(templateId: string): Promise<void>;
}

/** The standard filters, order and widths of a sheet's control bar; the default starts every built analysis. */
export const filterBarTemplatesApi: TemplateLibraryApi<FilterBarTemplate, FilterBarTemplateInput> =
  {
    async list() {
      return unwrap(
        await client.GET('/api/data-catalog/templates/filter-bars'),
        'Failed to load the filter bars'
      ).templates;
    },

    async save(templateId, input) {
      return unwrap(
        templateId
          ? await client.PUT('/api/data-catalog/templates/filter-bars/{templateId}', {
              params: { path: { templateId } },
              body: input,
            })
          : await client.POST('/api/data-catalog/templates/filter-bars', { body: input }),
        'Failed to save the filter bar'
      );
    },

    async remove(templateId) {
      unwrap(
        await client.DELETE('/api/data-catalog/templates/filter-bars/{templateId}', {
          params: { path: { templateId } },
        }),
        'Failed to delete the filter bar'
      );
    },
  };

/** Visuals by column name, reusable on any dataset with those columns. */
export const visualTemplatesApi: TemplateLibraryApi<VisualTemplate, VisualTemplateInput> = {
  async list() {
    return unwrap(
      await client.GET('/api/data-catalog/templates/visuals'),
      'Failed to load the visual templates'
    ).templates;
  },

  async save(templateId, input) {
    return unwrap(
      templateId
        ? await client.PUT('/api/data-catalog/templates/visuals/{templateId}', {
            params: { path: { templateId } },
            body: input,
          })
        : await client.POST('/api/data-catalog/templates/visuals', { body: input }),
      'Failed to save the visual template'
    );
  },

  async remove(templateId) {
    unwrap(
      await client.DELETE('/api/data-catalog/templates/visuals/{templateId}', {
        params: { path: { templateId } },
      }),
      'Failed to delete the visual template'
    );
  },
};
