import { getVisualPropertyName, getVisualType, type VisualType } from '../../types/visualTypes';
import { logger } from '../../utils/logger';

export interface CalculatedField {
  name: string;
  expression: string;
  dataSetIdentifier?: string;
}

export interface Field {
  fieldId: string;
  fieldName: string;
  name?: string; // Frontend compatibility
  dataType?: string;
  type?: string; // Frontend compatibility
  dataSetIdentifier?: string;
}

export interface VisualFieldMapping {
  fieldId: string;
  fieldName: string; // Original field name from dataset
  displayName: string; // Display name in visual
  visualId: string;
  visualType: string;
  sheetId: string;
  sheetName?: string;
  dataSetIdentifier?: string;
  fieldRole?: string; // e.g., 'dimension', 'measure', 'category', 'value'
  axisLabel?: string; // Axis-specific label if different from display name
}

export interface DataSetInfo {
  identifier: string;
  arn?: string;
  name?: string;
}

export interface Parameter {
  name: string;
  type: string;
  defaultValue?: any;
}

export interface Filter {
  filterId: string;
  name?: string;
  scope?: string;
  dataSetIdentifier?: string;
}

export interface Sheet {
  sheetId: string;
  name?: string;
  visualCount: number;
  visuals?: Visual[];
}

export interface Visual {
  visualId: string;
  type: string;
  title?: string;
  sheetId?: string;
  sheetName?: string;
  hasTitle?: boolean;
}

export interface ParsedAssetInfo {
  calculatedFields: CalculatedField[];
  fields: Field[];
  visualFieldMappings?: VisualFieldMapping[]; // New field for visual display names
  dataSets: DataSetInfo[];
  parameters?: Parameter[];
  filters?: Filter[];
  sheets?: Sheet[];
  visuals?: Visual[];
  datasourceInfo?: {
    type?: string;
    status?: string;
    uploadSettings?: any;
  };
}

/**
 * Base parser capabilities - defines what components an asset type supports
 */
export interface ParserCapabilities {
  hasDataSets: boolean;
  hasCalculatedFields: boolean;
  hasParameters: boolean;
  hasFilters: boolean;
  hasSheets: boolean;
  hasVisuals: boolean;
  hasFields: boolean;
  hasDatasourceInfo: boolean;
}

/**
 * Abstract base class for asset parsers
 */
export abstract class BaseAssetParser {
  public abstract readonly assetType: string;
  public abstract readonly capabilities: ParserCapabilities;

  /**
   * Remove duplicate fields based on fieldId and dataSetIdentifier
   */
  protected deduplicateFields(fields: Field[]): Field[] {
    const seen = new Set<string>();
    return fields.filter((field) => {
      // First validate that the field has a valid name
      if (!this.isValidFieldName(field.fieldName)) {
        return false;
      }

      const key = `${field.fieldId}:${field.dataSetIdentifier || ''}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // =============================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // =============================================================================

  /**
   * Extract calculated fields from CalculatedFields array
   */
  protected extractCalculatedFieldsFromArray(definition: any): CalculatedField[] {
    if (!definition.CalculatedFields) {
      return [];
    }

    return definition.CalculatedFields.map((cf: any) => ({
      name: cf.Name,
      expression: cf.Expression,
      dataSetIdentifier: cf.DataSetIdentifier,
    }));
  }

  // =============================================================================
  // OPTIONAL METHODS - Override if asset type supports them
  // =============================================================================

  /**
   * Extract data sets from DataSetIdentifierDeclarations
   */
  protected extractDataSetsFromDeclarations(definition: any): DataSetInfo[] {
    if (!definition.DataSetIdentifierDeclarations) {
      return [];
    }

    return definition.DataSetIdentifierDeclarations.map((ds: any) => ({
      identifier: ds.Identifier,
      arn: ds.DataSetArn,
      name: ds.DataSetName,
    }));
  }
  /**
   * Extract the core definition from the asset definition
   */
  protected abstract extractDefinition(assetDefinition: any): any;
  /**
   * Extract field mapping from a single field configuration
   */
  protected extractFieldMappingFromField(
    fieldConfig: any,
    role: string
  ): VisualFieldMapping | null {
    if (!fieldConfig) {
      return null;
    }

    // Handle different field types
    const field =
      fieldConfig.CategoricalDimensionField ||
      fieldConfig.NumericalDimensionField ||
      fieldConfig.DateDimensionField ||
      fieldConfig.CategoricalMeasureField ||
      fieldConfig.NumericalMeasureField ||
      fieldConfig.DateMeasureField;

    if (!field || !field.Column) {
      return null;
    }

    // Always use the actual column name as the fieldName
    const fieldName = field.Column.ColumnName;

    if (!this.isValidFieldName(fieldName)) {
      return null;
    }

    // IMPORTANT: Never use the UUID-based FieldId as fieldId or displayName
    // The FieldId like "124a044b-84cb-49f9-97dd-af8c1348d107.order_date.1.1749742230850"
    // should never be exposed to users
    const fieldId = fieldName;

    // Extract display name from various sources
    let displayName = fieldName; // Default to field name

    // Check for custom display name in format configuration
    if (field.FormatConfiguration) {
      // Check for custom label in numeric format
      if (
        field.FormatConfiguration.NumberDisplayFormatConfiguration?.Prefix ||
        field.FormatConfiguration.NumberDisplayFormatConfiguration?.Suffix
      ) {
        const prefix = field.FormatConfiguration.NumberDisplayFormatConfiguration.Prefix || '';
        const suffix = field.FormatConfiguration.NumberDisplayFormatConfiguration.Suffix || '';
        displayName = `${prefix}${fieldName}${suffix}`.trim();
      }

      // Check for custom column name (often in table visuals)
      if (field.FormatConfiguration.ColumnName) {
        displayName = field.FormatConfiguration.ColumnName;
      }
    }

    // Check if the field has a custom label/alias in the field definition itself
    if (field.Label) {
      displayName = field.Label;
    }

    // IMPORTANT: Never use the FieldId as display name
    // The FieldId contains UUID-based identifiers that should not be shown to users
    if (field.FieldId) {
      // Ensure we never accidentally use the FieldId as displayName
      if (
        displayName === field.FieldId ||
        (displayName.includes('.') && displayName.includes('-'))
      ) {
        logger.debug(
          `Display name was set to FieldId format, reverting to column name: ${fieldName}`
        );
        displayName = fieldName;
      }
    }

    return {
      fieldId,
      fieldName,
      displayName,
      dataSetIdentifier: field.Column.DataSetIdentifier,
      visualId: '', // Will be set by caller
      visualType: '', // Will be set by caller
      sheetId: '', // Will be set by caller
      fieldRole: role,
    };
  }
  /**
   * Extract field mappings from field wells
   */
  protected extractFieldMappingsFromFieldWells(
    fieldWells: any,
    mappings: VisualFieldMapping[],
    sheetId: string,
    sheetName: string | undefined,
    visualType: string,
    visualId: string
  ): void {
    // Helper function to process field arrays
    const processFieldArray = (fields: any[], role: string): void => {
      if (!Array.isArray(fields)) {
        return;
      }

      fields.forEach((field) => {
        const mapping = this.extractFieldMappingFromField(field, role);
        if (mapping) {
          mappings.push({
            ...mapping,
            visualId,
            visualType,
            sheetId,
            sheetName,
            fieldRole: role,
          });
        }
      });
    };

    // Check various field well structures based on visual type
    const fieldWellsData =
      fieldWells.BarChartAggregatedFieldWells ||
      fieldWells.LineChartAggregatedFieldWells ||
      fieldWells.PieChartAggregatedFieldWells ||
      fieldWells.TableAggregatedFieldWells ||
      fieldWells.PivotTableAggregatedFieldWells ||
      fieldWells.ScatterPlotCategoricallyAggregatedFieldWells ||
      fieldWells.ComboChartAggregatedFieldWells ||
      fieldWells;

    // Common field types across visuals
    processFieldArray(fieldWellsData.Category, 'category');
    processFieldArray(fieldWellsData.Values, 'value');
    processFieldArray(fieldWellsData.SmallMultiples, 'small-multiple');
    processFieldArray(fieldWellsData.Color, 'color');

    // Table-specific
    processFieldArray(fieldWellsData.Values, 'measure');
    processFieldArray(fieldWellsData.GroupBy, 'dimension');

    // Pivot table specific
    processFieldArray(fieldWellsData.Rows, 'row');
    processFieldArray(fieldWellsData.Columns, 'column');

    // Line/Combo chart specific
    processFieldArray(fieldWellsData.LineValues, 'line-value');
    processFieldArray(fieldWellsData.BarValues, 'bar-value');
  }
  /**
   * Extract field mappings from a single visual
   */
  protected extractFieldMappingsFromVisual(
    visual: any,
    mappings: VisualFieldMapping[],
    sheetId: string,
    sheetName: string | undefined,
    visualType: string,
    visualId: string
  ): void {
    const visualData =
      visual.BarChartVisual ||
      visual.LineChartVisual ||
      visual.PieChartVisual ||
      visual.TableVisual ||
      visual.PivotTableVisual ||
      visual.KPIVisual ||
      visual.ScatterPlotVisual ||
      visual.ComboChartVisual ||
      {};

    // Extract from field wells
    const fieldWells =
      visualData.ChartConfiguration?.FieldWells || visualData.Configuration?.FieldWells;

    if (fieldWells) {
      // Extract field mappings from different sections of field wells
      this.extractFieldMappingsFromFieldWells(
        fieldWells,
        mappings,
        sheetId,
        sheetName,
        visualType,
        visualId
      );
    }

    // Also check axis configurations for custom labels
    const chartConfig = visualData.ChartConfiguration || visualData.Configuration;
    if (chartConfig) {
      // Check X-axis label
      if (chartConfig.XAxisDisplayOptions?.AxisLabel) {
        this.updateMappingWithAxisLabel(
          mappings,
          visualId,
          'x-axis',
          chartConfig.XAxisDisplayOptions.AxisLabel
        );
      }
      // Check Y-axis label
      if (chartConfig.YAxisDisplayOptions?.AxisLabel) {
        this.updateMappingWithAxisLabel(
          mappings,
          visualId,
          'y-axis',
          chartConfig.YAxisDisplayOptions.AxisLabel
        );
      }
    }
  }
  /**
   * Recursively extract field references from an object
   */
  protected extractFieldsFromObject(obj: any, fields: Field[]): void {
    if (!obj) {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item) => this.extractFieldsFromObject(item, fields));
    } else if (typeof obj === 'object') {
      // Check for column definitions
      if (obj.ColumnName && this.isValidFieldName(obj.ColumnName)) {
        fields.push({
          fieldId: obj.ColumnName, // Use column name as fieldId instead of UUID-based FieldId
          fieldName: obj.ColumnName,
          name: obj.ColumnName,
          dataSetIdentifier: obj.DataSetIdentifier,
        });
      }

      // Check for categorical/numerical/date dimensions and measures
      if (
        obj.CategoricalDimensionField ||
        obj.NumericalDimensionField ||
        obj.DateDimensionField ||
        obj.CategoricalMeasureField ||
        obj.NumericalMeasureField ||
        obj.DateMeasureField
      ) {
        const fieldObj =
          obj.CategoricalDimensionField ||
          obj.NumericalDimensionField ||
          obj.DateDimensionField ||
          obj.CategoricalMeasureField ||
          obj.NumericalMeasureField ||
          obj.DateMeasureField;

        if (fieldObj.Column?.ColumnName && this.isValidFieldName(fieldObj.Column.ColumnName)) {
          fields.push({
            fieldId: fieldObj.Column.ColumnName, // Always use column name as fieldId
            fieldName: fieldObj.Column.ColumnName,
            name: fieldObj.Column.ColumnName,
            dataSetIdentifier: fieldObj.Column.DataSetIdentifier,
          });
        }
      }

      // Recursively check other properties
      Object.values(obj).forEach((value) => this.extractFieldsFromObject(value, fields));
    }
  }
  /**
   * Extract fields from a single visual
   */
  protected extractFieldsFromVisual(visual: any, fields: Field[]): void {
    const visualData =
      visual.BarChartVisual ||
      visual.LineChartVisual ||
      visual.PieChartVisual ||
      visual.TableVisual ||
      visual.PivotTableVisual ||
      visual.KPIVisual ||
      visual.ScatterPlotVisual ||
      visual.ComboChartVisual ||
      {};

    // Extract from field wells
    const fieldWells =
      visualData.ChartConfiguration?.FieldWells ||
      visualData.Configuration?.FieldWells ||
      visualData.ConditionalFormatting?.ConditionalFormattingOptions;

    if (fieldWells) {
      this.extractFieldsFromObject(fieldWells, fields);
    }
  }
  /**
   * Extract fields from visuals
   */
  protected extractFieldsFromVisuals(definition: any): Field[] {
    if (!definition.Sheets) {
      return [];
    }

    const fields: Field[] = [];

    definition.Sheets.forEach((sheet: any) => {
      if (sheet.Visuals) {
        sheet.Visuals.forEach((visual: any) => {
          this.extractFieldsFromVisual(visual, fields);
        });
      }
    });

    // Remove duplicates and filter out fields with undefined names
    const uniqueFields = new Map<string, Field>();
    fields.forEach((field) => {
      if (field.fieldName && field.fieldName !== 'undefined') {
        const key = `${field.dataSetIdentifier || 'unknown'}:${field.fieldName}`;
        if (!uniqueFields.has(key)) {
          uniqueFields.set(key, field);
        }
      }
    });

    return Array.from(uniqueFields.values());
  }

  // =============================================================================
  // SHARED UTILITY METHODS
  // =============================================================================

  /**
   * Extract filters from FilterGroups
   */
  protected extractFiltersFromGroups(definition: any): Filter[] {
    if (!definition.FilterGroups) {
      return [];
    }

    const filters: Filter[] = [];

    definition.FilterGroups.forEach((fg: any) => {
      if (fg.Filters) {
        fg.Filters.forEach((filter: any) => {
          const filterInfo: Filter = {
            filterId: filter.FilterId || fg.FilterGroupId,
            scope: fg.Scope?.ScopeConfiguration?.SelectedSheets ? 'SELECTED_SHEETS' : 'ALL_VISUALS',
          };

          if (filter.CategoryFilter) {
            filterInfo.name = filter.CategoryFilter.Column?.ColumnName;
            filterInfo.dataSetIdentifier = filter.CategoryFilter.Column?.DataSetIdentifier;
          } else if (filter.NumericRangeFilter) {
            filterInfo.name = filter.NumericRangeFilter.Column?.ColumnName;
            filterInfo.dataSetIdentifier = filter.NumericRangeFilter.Column?.DataSetIdentifier;
          } else if (filter.TimeRangeFilter) {
            filterInfo.name = filter.TimeRangeFilter.Column?.ColumnName;
            filterInfo.dataSetIdentifier = filter.TimeRangeFilter.Column?.DataSetIdentifier;
          }

          filters.push(filterInfo);
        });
      }
    });

    return filters;
  }

  /**
   * Extract parameters from ParameterDeclarations
   */
  protected extractParametersFromDeclarations(definition: any): Parameter[] {
    if (!definition.ParameterDeclarations) {
      return [];
    }

    return definition.ParameterDeclarations.map((param: any) => {
      const paramInfo: Parameter = {
        name: param.Name,
        type: 'Unknown',
      };

      if (param.StringParameterDeclaration) {
        paramInfo.type = 'String';
        paramInfo.defaultValue = param.StringParameterDeclaration.DefaultValues?.StaticValues?.[0];
      } else if (param.IntegerParameterDeclaration) {
        paramInfo.type = 'Integer';
        paramInfo.defaultValue = param.IntegerParameterDeclaration.DefaultValues?.StaticValues?.[0];
      } else if (param.DecimalParameterDeclaration) {
        paramInfo.type = 'Decimal';
        paramInfo.defaultValue = param.DecimalParameterDeclaration.DefaultValues?.StaticValues?.[0];
      } else if (param.DateTimeParameterDeclaration) {
        paramInfo.type = 'DateTime';
        paramInfo.defaultValue =
          param.DateTimeParameterDeclaration.DefaultValues?.StaticValues?.[0];
      }

      return paramInfo;
    });
  }

  /**
   * Extract sheets and visuals from Sheets array
   */
  protected extractSheetsAndVisuals(definition: any): { sheets: Sheet[]; visuals: Visual[] } {
    if (!definition.Sheets) {
      return { sheets: [], visuals: [] };
    }

    const sheets: Sheet[] = [];
    const visuals: Visual[] = [];

    definition.Sheets.forEach((sheet: any) => {
      const sheetVisuals: Visual[] = [];

      if (sheet.Visuals) {
        sheet.Visuals.forEach((visual: any) => {
          const visualType = this.getVisualType(visual);
          const visualData = this.getVisualData(visual, visualType);
          const visualTitle = this.extractVisualTitle(visualData);

          const visualInfo: Visual = {
            visualId: visualData.VisualId || '',
            type: visualType,
            title: visualTitle,
            sheetId: sheet.SheetId,
            sheetName: sheet.Name,
            hasTitle: !!visualTitle,
          };

          sheetVisuals.push(visualInfo);
          visuals.push(visualInfo);
        });
      }

      const sheetInfo: Sheet = {
        sheetId: sheet.SheetId || '',
        name: sheet.Name,
        visualCount: sheet.Visuals?.length || 0,
        visuals: sheetVisuals,
      };
      sheets.push(sheetInfo);
    });

    return { sheets, visuals };
  }

  /**
   * Extract visual field mappings with display names
   */
  protected extractVisualFieldMappings(definition: any): VisualFieldMapping[] {
    if (!definition.Sheets) {
      return [];
    }

    const mappings: VisualFieldMapping[] = [];

    definition.Sheets.forEach((sheet: any) => {
      if (sheet.Visuals) {
        sheet.Visuals.forEach((visual: any) => {
          const visualType = this.getVisualType(visual);
          const visualId = visual.VisualId || '';

          this.extractFieldMappingsFromVisual(
            visual,
            mappings,
            sheet.SheetId,
            sheet.Name,
            visualType,
            visualId
          );

          // Remove per-visual logging - will log summary at end
        });
      }
    });

    // Visual field mappings collected
    return mappings;
  }

  /**
   * Extract visual title from visual data
   */
  protected extractVisualTitle(visualData: any): string | undefined {
    if (!visualData?.Title) {
      return undefined;
    }

    if (visualData.Title.Visibility === 'VISIBLE' && visualData.Title.FormatText?.PlainText) {
      return visualData.Title.FormatText.PlainText;
    }

    return undefined;
  }

  /**
   * Get the visual data object based on visual type
   */
  protected getVisualData(visual: any, visualType: string): any {
    const visualPropertyName = getVisualPropertyName(visualType as VisualType);
    return visualPropertyName ? visual[visualPropertyName] : visual;
  }

  /**
   * Determine visual type from visual object
   */
  protected getVisualType(visual: any): string {
    return getVisualType(visual);
  }

  /**
   * Validate that a field name is valid (not undefined, empty, or "undefined")
   */
  protected isValidFieldName(fieldName: any): boolean {
    return (
      fieldName !== undefined &&
      fieldName !== null &&
      typeof fieldName === 'string' &&
      fieldName.trim() !== '' &&
      fieldName !== 'undefined' &&
      fieldName !== 'null'
    );
  }

  /**
   * Main parse method - orchestrates the parsing process
   */
  public parse(assetDefinition: any): ParsedAssetInfo {
    const result: ParsedAssetInfo = {
      calculatedFields: [],
      fields: [],
      dataSets: [],
      parameters: [],
      filters: [],
      sheets: [],
      visuals: [],
    };

    try {
      // Extract core definition
      const definition = this.extractDefinition(assetDefinition);

      if (!definition) {
        logger.warn(`No definition found for ${this.assetType}`);
        return result;
      }

      // Parse each component based on capabilities
      if (this.capabilities.hasDataSets && this.parseDataSets) {
        result.dataSets = this.parseDataSets(definition);
      }

      if (this.capabilities.hasCalculatedFields && this.parseCalculatedFields) {
        result.calculatedFields = this.parseCalculatedFields(definition);
      }

      if (this.capabilities.hasParameters && this.parseParameters) {
        result.parameters = this.parseParameters(definition);
      }

      if (this.capabilities.hasFilters && this.parseFilters) {
        result.filters = this.parseFilters(definition);
      }

      if (this.capabilities.hasSheets && this.parseSheets) {
        result.sheets = this.parseSheets(definition);
      }

      if (this.capabilities.hasVisuals && this.parseVisuals) {
        result.visuals = this.parseVisuals(definition);
      }

      if (this.capabilities.hasFields && this.parseFields) {
        result.fields = this.parseFields(definition);
        // Remove duplicates
        result.fields = this.deduplicateFields(result.fields);
      }

      if (this.capabilities.hasDatasourceInfo && this.parseDatasourceInfo) {
        result.datasourceInfo = this.parseDatasourceInfo(definition);
      }
    } catch (error) {
      logger.error(`Error parsing ${this.assetType}:`, error);
    }

    return result;
  }

  protected parseCalculatedFields?(definition: any): CalculatedField[];

  protected parseDataSets?(definition: any): DataSetInfo[];

  protected parseDatasourceInfo?(definition: any): any;

  protected parseFields?(definition: any): Field[];

  protected parseFilters?(definition: any): Filter[];

  protected parseParameters?(definition: any): Parameter[];

  protected parseSheets?(definition: any): Sheet[];

  protected parseVisuals?(definition: any): Visual[];

  /**
   * Update mapping with axis label if applicable
   */
  protected updateMappingWithAxisLabel(
    mappings: VisualFieldMapping[],
    visualId: string,
    axisType: string,
    axisLabel: string
  ): void {
    // Find mappings for this visual that might correspond to this axis
    mappings.forEach((mapping) => {
      if (mapping.visualId === visualId) {
        // For x-axis, typically category fields
        if (
          axisType === 'x-axis' &&
          (mapping.fieldRole === 'category' || mapping.fieldRole === 'dimension')
        ) {
          mapping.axisLabel = axisLabel;
        } else if (
          // For y-axis, typically value/measure fields
          axisType === 'y-axis' &&
          (mapping.fieldRole === 'value' || mapping.fieldRole === 'measure')
        ) {
          mapping.axisLabel = axisLabel;
        }
      }
    });
  }
}
