import type { components } from '@shared/generated/types';

import { api as apiClient } from '../client';
import type { ApiResponse } from '../types';

/**
 * Data Catalog API - handles field catalog and visual field mapping operations
 */
export const dataCatalogApi = {
  // Get full catalog (no pagination)
  async getCatalog(): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>('/data-catalog/full');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch data catalog');
    }
    return response.data.data;
  },

  // Get data catalog with pagination
  async getDataCatalog(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    viewMode?: 'all' | 'fields' | 'calculated';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    tagKey?: string;
    tagValue?: string;
    includeTags?: string; // JSON stringified array of {key, value}
    excludeTags?: string; // JSON stringified array of {key, value}
    assetIds?: string; // JSON stringified array of asset IDs
    includeAnalyses?: boolean; // Source scope: include the authoring (analyses) layer
  }): Promise<any> {
    try {
      const response = await apiClient.get<ApiResponse<any>>('/data-catalog', {
        params,
        timeout: 120000, // 2 minutes timeout for data catalog operations
      });
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch data catalog');
      }
      return response.data.data;
    } catch (error: any) {
      // Handle timeout and gateway errors
      if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
        throw new Error(
          'The data catalog request timed out. Try reducing the page size or simplifying the sort operation.'
        );
      }
      throw error;
    }
  },

  // Get available tags for filtering
  async getAvailableTags(): Promise<{ key: string; value: string; count: number }[]> {
    const response =
      await apiClient.get<ApiResponse<{ key: string; value: string; count: number }[]>>(
        '/data-catalog/tags'
      );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch available tags');
    }
    return response.data.data || [];
  },

  // Get available assets for filtering
  async getAvailableAssets(): Promise<
    { id: string; name: string; type: string; fieldCount: number }[]
  > {
    const response =
      await apiClient.get<
        ApiResponse<{ id: string; name: string; type: string; fieldCount: number }[]>
      >('/data-catalog/assets');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch available assets');
    }
    return response.data.data || [];
  },

  // Force rebuild catalog
  async rebuildCatalog(): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>('/data-catalog/rebuild');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to rebuild data catalog');
    }
    return response.data.data;
  },

  // Get visual field catalog
  async getVisualFieldCatalog(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<any> {
    try {
      const response = await apiClient.get<ApiResponse<any>>('/data-catalog/visual-fields', {
        params,
        timeout: 120000, // 2 minutes timeout for data catalog operations
      });
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch visual field catalog');
      }
      return response.data.data;
    } catch (error: any) {
      // Handle timeout and gateway errors
      if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
        throw new Error(
          'The visual field catalog request timed out. Try reducing the page size or simplifying the sort operation.'
        );
      }
      throw error;
    }
  },

  // Force rebuild visual field catalog
  async rebuildVisualFieldCatalog(): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>('/data-catalog/visual-fields/rebuild');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to rebuild visual field catalog');
    }
    return response.data.data;
  },

  // Get visual field metadata
  async getVisualFieldMetadata(visualFieldId: string): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>(
      `/data-catalog/visual-field/${encodeURIComponent(visualFieldId)}`
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch visual field metadata');
    }
    return response.data.data;
  },

  // Update visual field metadata
  async updateVisualFieldMetadata(visualFieldId: string, metadata: any): Promise<any> {
    const response = await apiClient.put<ApiResponse<any>>(
      `/data-catalog/visual-field/${encodeURIComponent(visualFieldId)}`,
      metadata
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update visual field metadata');
    }
    return response.data.data;
  },
};

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
export type CatalogScope = 'smus' | 'outside' | 'all';

export interface FieldCatalogParams {
  projectId?: string;
  datasetId?: string;
  search?: string;
  conflictsOnly?: boolean;
  scope?: CatalogScope;
}

/**
 * The catalog field-first: every calculated field in the account grouped by
 * what it computes, its lineage, and the plain columns tied to SMUS.
 */
export const fieldCatalogApi = {
  async calculatedFields(params: FieldCatalogParams = {}): Promise<CalculatedFieldCatalog> {
    const response = await apiClient.get<ApiResponse<CalculatedFieldCatalog>>(
      '/data-catalog/calculated-fields',
      {
        params: {
          projectId: params.projectId || undefined,
          datasetId: params.datasetId || undefined,
          search: params.search || undefined,
          conflictsOnly: params.conflictsOnly ? 'true' : undefined,
          scope: params.scope || undefined,
        },
      }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to load calculated fields');
    }
    return response.data.data;
  },

  async calculatedField(key: string): Promise<CalculatedFieldDetail> {
    const response = await apiClient.get<ApiResponse<CalculatedFieldDetail>>(
      `/data-catalog/calculated-fields/${encodeURIComponent(key)}`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to load the calculated field');
    }
    return response.data.data;
  },

  async columns(params: FieldCatalogParams = {}): Promise<ColumnCatalog> {
    const response = await apiClient.get<ApiResponse<ColumnCatalog>>('/data-catalog/columns', {
      params: {
        projectId: params.projectId || undefined,
        datasetId: params.datasetId || undefined,
        search: params.search || undefined,
        scope: params.scope || undefined,
      },
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to load columns');
    }
    return response.data.data;
  },
};

/**
 * The calculated-field template library: expressions worth reusing across
 * datasets, kept by the portal because SMUS has no home for them.
 */
export const calculatedFieldTemplatesApi = {
  async list(): Promise<CalculatedFieldTemplate[]> {
    const response = await apiClient.get<ApiResponse<{ templates: CalculatedFieldTemplate[] }>>(
      '/data-catalog/templates/calculated-fields'
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to load the template library');
    }
    return response.data.data.templates;
  },

  async create(input: CalculatedFieldTemplateInput): Promise<CalculatedFieldTemplate> {
    const response = await apiClient.post<ApiResponse<CalculatedFieldTemplate>>(
      '/data-catalog/templates/calculated-fields',
      input
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to save the template');
    }
    return response.data.data;
  },

  async update(
    templateId: string,
    input: CalculatedFieldTemplateInput
  ): Promise<CalculatedFieldTemplate> {
    const response = await apiClient.put<ApiResponse<CalculatedFieldTemplate>>(
      `/data-catalog/templates/calculated-fields/${encodeURIComponent(templateId)}`,
      input
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update the template');
    }
    return response.data.data;
  },

  async remove(templateId: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse<unknown>>(
      `/data-catalog/templates/calculated-fields/${encodeURIComponent(templateId)}`
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete the template');
    }
  },
};

/**
 * The SMUS-first catalog: published assets in the selected projects with
 * what SMUS owns (terms, forms, columns) and what only QuickSight knows
 * (datasets, calculated fields, usage).
 */
export const smusCatalogApi = {
  async list(params?: {
    search?: string;
    term?: string;
    projectId?: string;
    /** 'projects' skips the field index: only the project list with counts. */
    scope?: 'projects' | 'full';
  }): Promise<SmusCatalog> {
    const response = await apiClient.get<ApiResponse<SmusCatalog>>('/data-catalog/smus', {
      params,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to load the catalog');
    }
    return response.data.data;
  },

  async get(listingId: string): Promise<SmusCatalogAsset> {
    const response = await apiClient.get<ApiResponse<SmusCatalogAsset>>(
      `/data-catalog/smus/${encodeURIComponent(listingId)}`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to load the asset');
    }
    return response.data.data;
  },
};

/**
 * A template library (filter bars, visuals): list, save (create or
 * update), remove. One factory, one path per kind.
 */
function templateLibraryApi<T, Input>(path: string, noun: string) {
  return {
    async list(): Promise<T[]> {
      const response = await apiClient.get<ApiResponse<{ templates: T[] }>>(path);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || `Failed to load the ${noun}s`);
      }
      return response.data.data.templates;
    },

    async save(templateId: string | undefined, input: Input): Promise<T> {
      const response = templateId
        ? await apiClient.put<ApiResponse<T>>(`${path}/${encodeURIComponent(templateId)}`, input)
        : await apiClient.post<ApiResponse<T>>(path, input);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || `Failed to save the ${noun}`);
      }
      return response.data.data;
    },

    async remove(templateId: string): Promise<void> {
      const response = await apiClient.delete<ApiResponse<unknown>>(
        `${path}/${encodeURIComponent(templateId)}`
      );
      if (!response.data.success) {
        throw new Error(response.data.error || `Failed to delete the ${noun}`);
      }
    },
  };
}

export type TemplateLibraryApi<T, Input> = ReturnType<typeof templateLibraryApi<T, Input>>;

/** The standard filters, order and widths of a sheet's control bar; the default starts every built analysis. */
export const filterBarTemplatesApi = templateLibraryApi<FilterBarTemplate, FilterBarTemplateInput>(
  '/data-catalog/templates/filter-bars',
  'filter bar'
);

/** Visuals by column name, reusable on any dataset with those columns. */
export const visualTemplatesApi = templateLibraryApi<VisualTemplate, VisualTemplateInput>(
  '/data-catalog/templates/visuals',
  'visual template'
);
