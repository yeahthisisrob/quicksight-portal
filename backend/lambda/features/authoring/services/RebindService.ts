/**
 * RebindService - point a dashboard or analysis at different datasets.
 *
 * Plan, then apply. `plan` is read-only and says exactly what would change
 * and whether the target datasets can satisfy the definition. `apply` runs
 * the same plan again and refuses unless every column resolves, so a caller
 * cannot push a definition QuickSight would reject half-way through.
 *
 * Definitions are read live (DescribeAnalysisDefinition /
 * DescribeDashboardDefinition), never from the cache, for the same reason
 * RenameService and DatasetSourceService do: the cache can be stale and an
 * Update* call replaces the whole definition. Target dataset columns are read
 * live too, with the S3 export as a fallback for datasets QuickSight cannot
 * describe (uploaded flat files).
 *
 * The transforms themselves live in ../lib and are pure; this class only
 * fetches, orchestrates and writes.
 */

import { randomUUID } from 'node:crypto';

import { ValidationError } from '../../../shared/errors/ValidationError';
import type { AssetExportData } from '../../../shared/models/asset-export.model';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import type { S3Service } from '../../../shared/services/aws/S3Service';
import { ASSET_TYPES_PLURAL } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import { normalizePermissionsArray } from '../../../shared/utils/permissions';
import { resolveColumns, type TargetColumn } from '../lib/columnResolution';
import { collectDefinitionDatasets } from '../lib/definitionColumns';
import { type RebindSpec, rebindDefinition } from '../lib/definitionRebind';
import type {
  AddedCalculatedField,
  ApplyRequest,
  ApplyResult,
  AuthorableAssetType,
  DatasetRebindPlan,
  DefinitionDataset,
  RebindPlan,
  RebindRequest,
} from '../types';

const NAME_MAX_LENGTH = 200;

interface LoadedDefinition {
  name: string;
  definition: Record<string, any>;
  themeArn?: string;
  dashboardPublishOptions?: any;
}

interface TargetDataset {
  dataSetId: string;
  dataSetArn: string;
  name: string;
  columns: TargetColumn[];
}

export interface DefinitionDatasets {
  assetType: AuthorableAssetType;
  assetId: string;
  name: string;
  datasets: DefinitionDataset[];
}

export class RebindService {
  private readonly bucketName: string;
  private readonly quickSightService: QuickSightService;
  private readonly s3Service: S3Service;

  public constructor(accountId: string) {
    this.quickSightService = ClientFactory.getQuickSightService(accountId);
    this.s3Service = ClientFactory.getS3Service();
    this.bucketName = process.env.BUCKET_NAME || `quicksight-metadata-bucket-${accountId}`;
  }

  /** The datasets a definition declares and the columns it reads from each. */
  public async describeDatasets(
    assetType: AuthorableAssetType,
    assetId: string
  ): Promise<DefinitionDatasets> {
    const loaded = await this.loadDefinition(assetType, assetId);
    return {
      assetType,
      assetId,
      name: loaded.name,
      datasets: collectDefinitionDatasets(loaded.definition),
    };
  }

  /** Read-only. What a rebind would change and whether it can be applied. */
  public async plan(
    assetType: AuthorableAssetType,
    assetId: string,
    rebinds: RebindRequest[]
  ): Promise<RebindPlan> {
    const loaded = await this.loadDefinition(assetType, assetId);
    return await this.planAgainst(assetType, assetId, loaded, rebinds);
  }

  /**
   * The plan plus the definition exactly as apply would write it, without
   * writing. Only resolved renames are applied, so a preview never shows a
   * result that apply would refuse.
   */
  public async preview(
    assetType: AuthorableAssetType,
    assetId: string,
    rebinds: RebindRequest[]
  ): Promise<{ plan: RebindPlan; definition: Record<string, any> }> {
    const loaded = await this.loadDefinition(assetType, assetId);
    const plan = await this.planAgainst(assetType, assetId, loaded, rebinds);
    const specs: RebindSpec[] = plan.datasets.map((d) => ({
      identifier: d.identifier,
      targetDataSetArn: d.target.dataSetArn,
      columnMap: this.effectiveColumnMap(d),
    }));
    return { plan, definition: rebindDefinition(loaded.definition, specs) };
  }

  /** Re-plan, refuse anything unresolved, then write to QuickSight. */
  public async apply(
    assetType: AuthorableAssetType,
    assetId: string,
    request: ApplyRequest
  ): Promise<ApplyResult> {
    const loaded = await this.loadDefinition(assetType, assetId);
    const plan = await this.planAgainst(assetType, assetId, loaded, request.rebinds);
    this.assertApplicable(plan);

    const name = this.resolveName(request, loaded.name);
    const specs: RebindSpec[] = plan.datasets.map((d) => ({
      identifier: d.identifier,
      targetDataSetArn: d.target.dataSetArn,
      columnMap: this.effectiveColumnMap(d),
    }));
    const definition = withAddedCalculatedFields(
      rebindDefinition(loaded.definition, specs),
      request.addCalculatedFields ?? []
    );

    logger.info('Applying rebind', {
      assetType,
      assetId,
      mode: request.mode,
      rebinds: specs.length,
      renamed: name !== loaded.name,
    });

    const written =
      request.mode === 'clone'
        ? await this.clone(assetType, assetId, request.newAssetId, name, definition, loaded)
        : await this.update(assetType, assetId, name, definition, loaded);

    return { assetType, ...written, name, mode: request.mode, plan };
  }

  private async planAgainst(
    assetType: AuthorableAssetType,
    assetId: string,
    loaded: LoadedDefinition,
    rebinds: RebindRequest[]
  ): Promise<RebindPlan> {
    const declared = collectDefinitionDatasets(loaded.definition);
    const seen = new Set<string>();

    const datasets: DatasetRebindPlan[] = [];
    for (const rebind of rebinds) {
      const current = declared.find((d) => d.identifier === rebind.identifier);
      if (!current) {
        throw new ValidationError(
          `This ${assetType} has no dataset identifier '${rebind.identifier}'. ` +
            `Declared: ${declared.map((d) => d.identifier).join(', ') || 'none'}`
        );
      }
      if (seen.has(rebind.identifier)) {
        throw new ValidationError(`Dataset identifier '${rebind.identifier}' is rebound twice`);
      }
      seen.add(rebind.identifier);

      const target = await this.loadTargetDataset(rebind.targetDataSetId);
      const resolution = resolveColumns(current.columns, target.columns, rebind.columnMap ?? {});
      datasets.push({
        identifier: rebind.identifier,
        current: { dataSetId: current.dataSetId, dataSetArn: current.dataSetArn },
        target: {
          dataSetId: target.dataSetId,
          dataSetArn: target.dataSetArn,
          name: target.name,
          columnCount: target.columns.length,
        },
        columns: resolution.columns,
        unusedTargetColumns: resolution.unusedTargetColumns,
        summary: resolution.summary,
      });
    }

    return {
      assetType,
      assetId,
      name: loaded.name,
      datasets,
      canApply: datasets.every((d) => d.summary.missing === 0 && d.summary.suggested === 0),
    };
  }

  private assertApplicable(plan: RebindPlan): void {
    if (plan.canApply) {
      return;
    }
    const problems = plan.datasets.flatMap((d) =>
      d.columns
        .filter((c) => c.status === 'missing' || c.status === 'suggested')
        .map((c) =>
          c.suggestion
            ? `${d.identifier}.${c.name} (did you mean '${c.suggestion}'?)`
            : `${d.identifier}.${c.name}`
        )
    );
    throw new ValidationError(
      `The target dataset does not provide every column this definition uses. ` +
        `Add a columnMap entry for: ${problems.join(', ')}`
    );
  }

  /** Only renames that actually resolved. Never sends a suggestion on its own. */
  private effectiveColumnMap(dataset: DatasetRebindPlan): Record<string, string> {
    const map: Record<string, string> = {};
    for (const column of dataset.columns) {
      if (column.status === 'mapped' && column.resolvedTo) {
        map[column.name] = column.resolvedTo;
      }
    }
    return map;
  }

  private resolveName(request: ApplyRequest, currentName: string): string {
    const name = request.name?.trim();
    if (request.mode === 'clone' && !name) {
      throw new ValidationError('A name is required to clone');
    }
    if (request.mode === 'update' && !name && request.rebinds.length === 0) {
      throw new ValidationError('Nothing to do: no rebinds and no new name');
    }
    if (name && name.length > NAME_MAX_LENGTH) {
      throw new ValidationError(`Name must be at most ${NAME_MAX_LENGTH} characters`);
    }
    return name || currentName;
  }

  // ---------------------------------------------------------------------------
  // QuickSight reads
  // ---------------------------------------------------------------------------

  private async loadDefinition(
    assetType: AuthorableAssetType,
    assetId: string
  ): Promise<LoadedDefinition> {
    const current =
      assetType === 'dashboard'
        ? await this.quickSightService.describeDashboardDefinition(assetId)
        : await this.quickSightService.describeAnalysisDefinition(assetId);

    if (!current?.Definition) {
      throw new ValidationError(
        `Could not load the ${assetType} definition from QuickSight for '${assetId}'`
      );
    }
    return {
      name: current.Name ?? assetId,
      definition: current.Definition,
      themeArn: current.ThemeArn,
      dashboardPublishOptions: current.DashboardPublishOptions,
    };
  }

  private async loadTargetDataset(dataSetId: string): Promise<TargetDataset> {
    const described = await this.describeDatasetOrExport(dataSetId);
    const outputColumns = described.OutputColumns;
    if (!Array.isArray(outputColumns) || !described.Arn) {
      throw new ValidationError(
        `Dataset '${dataSetId}' has no column information, so it cannot be a rebind target`
      );
    }
    return {
      dataSetId,
      dataSetArn: described.Arn,
      name: described.Name ?? dataSetId,
      columns: outputColumns
        .filter((c: any) => typeof c?.Name === 'string')
        .map((c: any) => ({ name: c.Name, type: c.Type })),
    };
  }

  /**
   * Live first. Flat-file datasets cannot be described through the API, but
   * their export (taken by the same means, at export time) may still carry
   * output columns, so fall back to it before giving up.
   */
  private async describeDatasetOrExport(dataSetId: string): Promise<Record<string, any>> {
    try {
      const live = await this.quickSightService.describeDataset(dataSetId);
      if (live?.OutputColumns) {
        return live;
      }
    } catch (error) {
      logger.warn('DescribeDataSet failed, falling back to the export', { dataSetId, error });
    }

    const key = `assets/${ASSET_TYPES_PLURAL.dataset}/${dataSetId}.json`;
    try {
      const exported = await this.s3Service.getObject<AssetExportData>(this.bucketName, key);
      return exported?.apiResponses?.describe?.data ?? {};
    } catch (error) {
      logger.warn('Dataset export not readable', { dataSetId, key, error });
      throw new ValidationError(`Dataset '${dataSetId}' was not found`);
    }
  }

  // ---------------------------------------------------------------------------
  // QuickSight writes
  // ---------------------------------------------------------------------------

  private async update(
    assetType: AuthorableAssetType,
    assetId: string,
    name: string,
    definition: Record<string, any>,
    loaded: LoadedDefinition
  ): Promise<{ assetId: string; arn: string; versionNumber?: number }> {
    if (assetType === 'analysis') {
      const result = await this.quickSightService.updateAnalysis({
        analysisId: assetId,
        name,
        definition,
        themeArn: loaded.themeArn,
      });
      return { assetId, arn: result?.arn ?? result?.Arn ?? '' };
    }

    const updated = await this.quickSightService.updateDashboard({
      dashboardId: assetId,
      name,
      definition,
      themeArn: loaded.themeArn,
      dashboardPublishOptions: loaded.dashboardPublishOptions,
    });
    // UpdateDashboard only creates a draft; publish it or viewers see nothing new.
    const versionNumber = parseVersionNumber(updated?.versionArn ?? updated?.VersionArn);
    if (versionNumber === null) {
      throw new Error('Dashboard was updated but the new version could not be determined');
    }
    await this.quickSightService.updateDashboardPublishedVersion(assetId, versionNumber);
    return { assetId, arn: updated?.arn ?? updated?.Arn ?? '', versionNumber };
  }

  private async clone(
    assetType: AuthorableAssetType,
    sourceId: string,
    requestedId: string | undefined,
    name: string,
    definition: Record<string, any>,
    loaded: LoadedDefinition
  ): Promise<{ assetId: string; arn: string; versionNumber?: number }> {
    const newId = requestedId?.trim() || randomUUID();
    const permissions = await this.sourcePermissions(assetType, sourceId);

    if (assetType === 'analysis') {
      const created = await this.quickSightService.createAnalysis({
        analysisId: newId,
        name,
        definition: definition as any,
        permissions,
        themeArn: loaded.themeArn,
      });
      return { assetId: created.analysisId, arn: created.arn };
    }

    const created = await this.quickSightService.createDashboard({
      dashboardId: newId,
      name,
      definition: definition as any,
      permissions,
      themeArn: loaded.themeArn,
      dashboardPublishOptions: loaded.dashboardPublishOptions,
    });
    return {
      assetId: created.dashboardId,
      arn: created.arn,
      versionNumber: parseVersionNumber(created.versionArn) ?? undefined,
    };
  }

  /**
   * A clone keeps the source's audience. Without permissions a new asset is
   * visible to nobody, including the person who asked for it.
   */
  private async sourcePermissions(
    assetType: AuthorableAssetType,
    sourceId: string
  ): Promise<any[] | undefined> {
    const raw =
      assetType === 'dashboard'
        ? await this.quickSightService.describeDashboardPermissions(sourceId)
        : await this.quickSightService.describeAnalysisPermissions(sourceId);
    const permissions = normalizePermissionsArray(raw);
    return permissions.length > 0 ? permissions : undefined;
  }
}

/**
 * Add calculated fields (typically from the template library) to a
 * definition. Each is declared against a dataset identifier the definition
 * has; a name already declared there is refused rather than overwritten.
 */
export function withAddedCalculatedFields(
  definition: Record<string, any>,
  added: AddedCalculatedField[]
): Record<string, any> {
  if (added.length === 0) {
    return definition;
  }
  const identifiers = new Set<string>(
    (definition.DataSetIdentifierDeclarations ?? []).map((d: any) => d?.Identifier)
  );
  const existing = new Set<string>(
    (definition.CalculatedFields ?? []).map((f: any) => `${f?.DataSetIdentifier}::${f?.Name}`)
  );
  const fields = [...(definition.CalculatedFields ?? [])];
  for (const field of added) {
    if (!identifiers.has(field.identifier)) {
      throw new ValidationError(
        `Cannot add calculated field '${field.name}': no dataset identifier '${field.identifier}'`
      );
    }
    const key = `${field.identifier}::${field.name}`;
    if (existing.has(key)) {
      throw new ValidationError(
        `Calculated field '${field.name}' already exists on '${field.identifier}'`
      );
    }
    existing.add(key);
    fields.push({
      DataSetIdentifier: field.identifier,
      Name: field.name,
      Expression: field.expression,
    });
  }
  return { ...definition, CalculatedFields: fields };
}

function parseVersionNumber(versionArn?: string): number | null {
  const match = versionArn?.match(/\/version\/(\d+)$/);
  if (!match?.[1]) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}
