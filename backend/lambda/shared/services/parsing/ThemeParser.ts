/**
 * A custom theme as the cache keeps it: what it starts from, its version,
 * the colors data takes, the interface colors by role and its font. Enough
 * to show it as swatches and to judge a new one against it; the full
 * configuration stays in the export file.
 */
import type { AssetExportData } from '../../models/asset-export.model';
import { ASSET_TYPES } from '../../types/assetTypes';
import { BaseAssetParser, type ParserCapabilities } from './BaseAssetParser';

export interface ThemeMetadata {
  assetId: string;
  name: string;
  arn: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  baseThemeId: string;
  versionNumber?: number;
  dataColors: string[];
  uiColors: Record<string, string>;
  fontFamily?: string;
}

export class ThemeParser extends BaseAssetParser {
  public readonly assetType = ASSET_TYPES.theme;

  public readonly capabilities: ParserCapabilities = {
    hasDataSets: false,
    hasCalculatedFields: false,
    hasParameters: false,
    hasFilters: false,
    hasSheets: false,
    hasVisuals: false,
    hasFields: false,
    hasDatasourceInfo: false,
  };

  protected override extractDefinition(definition: any): any {
    return definition;
  }

  public extractThemeMetadata(listData: any, describeData: any): ThemeMetadata {
    const version = describeData?.Version ?? {};
    const configuration = version.Configuration ?? {};
    const uiColors = Object.fromEntries(
      Object.entries(configuration.UIColorPalette ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    );
    return {
      assetId: describeData?.ThemeId ?? listData?.ThemeId ?? listData?.themeId,
      name: describeData?.Name ?? listData?.Name ?? listData?.name,
      arn: describeData?.Arn ?? listData?.Arn ?? listData?.arn,
      createdTime: describeData?.CreatedTime ?? listData?.CreatedTime ?? listData?.createdTime,
      lastUpdatedTime:
        describeData?.LastUpdatedTime ?? listData?.LastUpdatedTime ?? listData?.lastUpdatedTime,
      baseThemeId: version.BaseThemeId ?? 'CLASSIC',
      ...(typeof version.VersionNumber === 'number'
        ? { versionNumber: version.VersionNumber }
        : {}),
      dataColors: (configuration.DataColorPalette?.Colors ?? []).filter(
        (c: unknown): c is string => typeof c === 'string'
      ),
      uiColors,
      ...(configuration.Typography?.FontFamilies?.[0]?.FontFamily
        ? { fontFamily: configuration.Typography.FontFamilies[0].FontFamily }
        : {}),
    };
  }

  public extractMetadata(assetData: AssetExportData): ThemeMetadata {
    return this.extractThemeMetadata(
      assetData.apiResponses?.list?.data,
      assetData.apiResponses?.describe?.data
    );
  }
}
