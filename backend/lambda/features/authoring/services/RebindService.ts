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

import type { AuthContext } from '../../../shared/auth';
import { ValidationError } from '../../../shared/errors/ValidationError';
import type { AssetExportData } from '../../../shared/models/asset-export.model';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import type { S3Service } from '../../../shared/services/aws/S3Service';
import { ASSET_TYPES_PLURAL } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import { normalizePermissionsArray } from '../../../shared/utils/permissions';
import { resolveColumns, type TargetColumn } from '../lib/columnResolution';
import { crossDatasetFilterColumns, crossDatasetFilterWarnings } from '../lib/crossDatasetFilters';
import {
  collectDefinitionDatasets,
  unresolvedCalculatedFieldColumns,
} from '../lib/definitionColumns';
import { applyOps, type DefinitionChange, type DefinitionOp } from '../lib/definitionOps';
import { buildOutline } from '../lib/definitionOutline';
import {
  type RebindSpec,
  rebindDefinition,
  withAddedCalculatedFields,
} from '../lib/definitionRebind';
import { applyRepairs } from '../lib/definitionRepairs';
import { applyTemplate } from '../lib/definitionTemplate';
import { applyCastRenames, applyTypeRules, castPlan } from '../lib/definitionTypeRules';
import { buildRepairPlan, type RepairPlan, type RepairTarget } from '../lib/repairPlan';
import type {
  AddedCalculatedField,
  ApplyRequest,
  ApplyResult,
  AuthorableAssetType,
  DatasetRebindPlan,
  DefinitionDataset,
  PreviewRequest,
  RebindPlan,
  RebindPreview,
  RebindRequest,
} from '../types';
import { createAsset, recordProvenance, updateAsset } from './assetWriter';
import { audienceFor, fileInFolders } from './audience';

const NAME_MAX_LENGTH = 200;

interface LoadedDefinition {
  name: string;
  definition: Record<string, any>;
  themeArn?: string;
  dashboardPublishOptions?: any;
  /** QuickSight's own errors on the asset, when it reports any. */
  errors?: Array<{ Type?: string; Message?: string; ViolatedEntities?: Array<{ Path?: string }> }>;
}

interface LoadedTemplate {
  request: NonNullable<PreviewRequest['template']>;
  definition: Record<string, any>;
  themeArn?: string;
  columnsByIdentifier: Map<string, Set<string>>;
}

export interface TargetDataset {
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

  /** The sheets of the live definition, with ids, for editing and insights. */
  public async loadDefinitionOutline(assetType: AuthorableAssetType, assetId: string) {
    const loaded = await this.loadDefinition(assetType, assetId);
    return buildOutline(loaded.definition);
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
    request: PreviewRequest
  ): Promise<RebindPreview> {
    const loaded = await this.loadDefinition(assetType, assetId);
    const repaired = this.repair(loaded, request.repairs);
    const plan = await this.planAgainst(assetType, assetId, repaired.loaded, request.rebinds);
    const template = await this.loadTemplate(request.template, repaired.loaded.definition, plan);
    const currentColumns = await this.currentColumnsFor(request, plan);
    const { definition, changes, warnings, themeArn } = this.rewrite(
      repaired.loaded.definition,
      plan,
      request,
      template,
      currentColumns
    );
    const allWarnings = [
      ...warnings,
      ...(await this.addedFieldProblems(repaired.loaded.definition, plan, request)),
      ...(await this.crossDatasetWarnings(definition, plan)),
    ];
    return {
      plan,
      definition,
      changes: [...repaired.changes, ...changes],
      outline: buildOutline(definition),
      ...(allWarnings.length ? { warnings: allWarnings } : {}),
      ...(themeArn ? { themeArn } : {}),
    };
  }

  /**
   * Added calculated fields that read a column their dataset (after the
   * rebind) does not have. QuickSight fails the whole write over one, so
   * preview says so and apply refuses.
   */
  private async addedFieldProblems(
    definition: Record<string, any>,
    plan: RebindPlan,
    request: { addCalculatedFields?: AddedCalculatedField[] }
  ): Promise<string[]> {
    const added = request.addCalculatedFields ?? [];
    if (added.length === 0) {
      return [];
    }
    const names = new Map(plan.datasets.map((d) => [d.identifier, d.target.name]));
    return unresolvedCalculatedFieldColumns(
      added,
      definition,
      await this.columnsByIdentifier(definition, plan)
    ).map(
      (u) =>
        `Calculated field '${u.name}' reads ${u.columns.map((c) => `'${c}'`).join(', ')}, which ${names.get(u.identifier) ?? u.identifier} does not have.`
    );
  }

  /**
   * The template to migrate onto, with the columns every source identifier
   * has (after any rebind) so its controls can be rebound by column name.
   */
  private async loadTemplate(
    request: PreviewRequest['template'],
    definition: Record<string, any>,
    plan: RebindPlan
  ): Promise<LoadedTemplate | null> {
    if (!request) {
      return null;
    }
    const loaded = await this.loadDefinition(request.assetType, request.assetId);
    const columnsByIdentifier = await this.columnsByIdentifier(definition, plan);
    return {
      request,
      definition: loaded.definition,
      themeArn: loaded.themeArn,
      columnsByIdentifier,
    };
  }

  /**
   * Everything that stops QuickSight from writing this definition, each with
   * a fix. Read-only. `rebinds` names datasets already chosen for identifiers
   * whose own dataset is gone, so their columns can be checked too.
   */
  public async repairPlan(
    assetType: AuthorableAssetType,
    assetId: string,
    rebinds: RebindRequest[] = []
  ): Promise<RepairPlan> {
    const loaded = await this.loadDefinition(assetType, assetId);
    const datasets = collectDefinitionDatasets(loaded.definition);
    const chosen = new Map(rebinds.map((r) => [r.identifier, r.targetDataSetId]));
    const targets = new Map<string, RepairTarget | null>();
    await Promise.all(
      datasets.map(async (dataset) => {
        const dataSetId = chosen.get(dataset.identifier) ?? dataset.dataSetId;
        try {
          const target = await this.loadTargetDataset(dataSetId);
          targets.set(dataset.identifier, {
            dataSetId: target.dataSetId,
            name: target.name,
            columns: target.columns,
          });
        } catch (error) {
          logger.warn('Repair plan: dataset cannot be read', {
            assetType,
            assetId,
            dataSetId,
            error,
          });
          targets.set(dataset.identifier, null);
        }
      })
    );
    return buildRepairPlan({
      definition: loaded.definition,
      datasets,
      targets,
      quickSightErrors: loaded.errors,
    });
  }

  /** For column casts: the columns (with types) of the datasets being replaced. */
  private async currentColumnsFor(
    request: { typeRules?: PreviewRequest['typeRules'] },
    plan: RebindPlan
  ): Promise<Map<string, TargetColumn[]>> {
    const out = new Map<string, TargetColumn[]>();
    if (!request.typeRules?.casts) {
      return out;
    }
    for (const dataset of plan.datasets) {
      try {
        out.set(
          dataset.identifier,
          (await this.loadTargetDataset(dataset.current.dataSetId)).columns
        );
      } catch (error) {
        logger.warn('Casts: current dataset cannot be read', {
          dataSetId: dataset.current.dataSetId,
          error,
        });
      }
    }
    return out;
  }

  /** What every declared dataset has after the plan's rebinds, by identifier. */
  private async columnsByIdentifier(
    definition: Record<string, any>,
    plan: RebindPlan
  ): Promise<Map<string, Set<string>>> {
    const columnsByIdentifier = new Map<string, Set<string>>();
    const rebound = new Map(plan.datasets.map((d) => [d.identifier, d.target.dataSetId]));
    for (const dataset of collectDefinitionDatasets(definition)) {
      const dataSetId = rebound.get(dataset.identifier) ?? dataset.dataSetId;
      try {
        const columns = await this.loadTargetDataset(dataSetId);
        columnsByIdentifier.set(dataset.identifier, new Set(columns.columns.map((c) => c.name)));
      } catch {
        // Unreadable dataset: the columns the definition already reads are all we know.
        columnsByIdentifier.set(dataset.identifier, new Set(dataset.columns.map((c) => c.name)));
      }
    }
    return columnsByIdentifier;
  }

  /**
   * Cross-dataset filters apply by column name and skip datasets without
   * the column silently; say so whenever the result has any.
   */
  private async crossDatasetWarnings(
    definition: Record<string, any>,
    plan: RebindPlan
  ): Promise<string[]> {
    if (crossDatasetFilterColumns(definition).length === 0) {
      return [];
    }
    return crossDatasetFilterWarnings(definition, await this.columnsByIdentifier(definition, plan));
  }

  /** Repairs run on the loaded definition, before anything is planned. */
  private repair(
    loaded: LoadedDefinition,
    repairs: PreviewRequest['repairs']
  ): { loaded: LoadedDefinition; changes: DefinitionChange[] } {
    if (!repairs || repairs.length === 0) {
      return { loaded, changes: [] };
    }
    const result = applyRepairs(loaded.definition, repairs);
    return { loaded: { ...loaded, definition: result.definition }, changes: result.changes };
  }

  /**
   * The whole rewrite, in order: rebinds, added calculated fields, edit
   * ops. Preview and apply share it so the mockup is exactly what gets
   * written.
   */
  private rewrite(
    source: Record<string, any>,
    plan: RebindPlan,
    request: {
      addCalculatedFields?: AddedCalculatedField[];
      ops?: DefinitionOp[];
      typeRules?: PreviewRequest['typeRules'];
    },
    template: LoadedTemplate | null = null,
    currentColumns: Map<string, TargetColumn[]> = new Map()
  ): {
    definition: Record<string, any>;
    changes: DefinitionChange[];
    warnings: string[];
    themeArn?: string;
  } {
    const changes: DefinitionChange[] = [];
    const warnings: string[] = [];
    let themeArn: string | undefined;
    const specs: RebindSpec[] = plan.datasets.map((d) => ({
      identifier: d.identifier,
      targetDataSetArn: d.target.dataSetArn,
      columnMap: this.effectiveColumnMap(d),
    }));
    for (const d of plan.datasets) {
      changes.push({
        kind: 'rebind',
        description: `${d.identifier} reads ${d.target.name} instead of ${d.current.dataSetId}`,
      });
      for (const [from, to] of Object.entries(this.effectiveColumnMap(d))) {
        changes.push({ kind: 'rename', description: `${d.identifier}: ${from} becomes ${to}` });
      }
    }
    let definition = rebindDefinition(source, specs);
    if (template) {
      const migrated = applyTemplate(definition, template.definition, {
        textBoxes: template.request.textBoxes,
        controls: template.request.controls,
        sheetNames: template.request.sheetNames,
        kpisFirst: template.request.kpisFirst,
        columnsByIdentifier: template.columnsByIdentifier,
        themeArn: template.request.theme === false ? undefined : template.themeArn,
      });
      definition = migrated.definition;
      changes.push(...migrated.changes);
      warnings.push(...migrated.warnings);
      themeArn = migrated.themeArn;
      if (themeArn) {
        changes.push({ kind: 'template', description: "Takes the template's theme" });
      }
    }
    let added = request.addCalculatedFields ?? [];
    if (request.typeRules?.casts) {
      const casts = castPlan(plan.datasets, currentColumns);
      applyCastRenames(definition, casts.renames);
      added = [...casts.addCalculatedFields, ...added];
      changes.push(...casts.changes);
      warnings.push(...casts.warnings);
    }
    definition = withAddedCalculatedFields(definition, added);
    for (const field of request.addCalculatedFields ?? []) {
      changes.push({
        kind: 'calculatedField',
        description: `Added calculated field ${field.name} on ${field.identifier}`,
      });
    }
    if (request.typeRules && (request.typeRules.chartFamily?.length || request.typeRules.kpi)) {
      const ruled = applyTypeRules(definition, request.typeRules, {
        templateKpiOptions: template ? templateKpiOptions(template.definition) : undefined,
      });
      definition = ruled.definition;
      changes.push(...ruled.changes);
      warnings.push(...ruled.warnings);
    }
    const edited = applyOps(definition, request.ops ?? []);
    return {
      definition: edited.definition,
      changes: [...changes, ...edited.changes],
      warnings,
      themeArn,
    };
  }

  /** A dataset's columns with their types, live or from its export. */
  public describeTargetDataset(dataSetId: string): Promise<TargetDataset> {
    return this.loadTargetDataset(dataSetId);
  }

  /** A dashboard or analysis definition with its theme, as authoring reads it. */
  public async loadDefinitionWithTheme(
    assetType: AuthorableAssetType,
    assetId: string
  ): Promise<{
    name: string;
    definition: Record<string, any>;
    themeArn?: string;
    dashboardPublishOptions?: any;
  }> {
    const loaded = await this.loadDefinition(assetType, assetId);
    return {
      name: loaded.name,
      definition: loaded.definition,
      themeArn: loaded.themeArn,
      dashboardPublishOptions: loaded.dashboardPublishOptions,
    };
  }

  /** The audience of an existing asset, for a new asset to inherit. */
  public permissionsOf(
    assetType: AuthorableAssetType,
    assetId: string
  ): Promise<any[] | undefined> {
    return this.sourcePermissions(assetType, assetId);
  }

  private recordProvenance(
    assetType: AuthorableAssetType,
    written: { assetId: string; name: string; arn?: string; folderIds?: string[] },
    request: ApplyRequest,
    changeCount: number,
    auth?: AuthContext
  ): Promise<void> {
    return recordProvenance(
      this.quickSightService,
      {
        action: request.mode === 'clone' ? 'authoring.clone' : 'authoring.update',
        assetType,
        assetId: written.assetId,
        name: written.name,
        arn: written.arn,
        folderIds: written.folderIds,
        details: {
          rebinds: request.rebinds.length,
          ops: request.ops?.length ?? 0,
          repairs: request.repairs?.length ?? 0,
          changes: changeCount,
        },
      },
      auth
    );
  }

  /** Re-plan, refuse anything unresolved, then write to QuickSight. */
  public async apply(
    assetType: AuthorableAssetType,
    assetId: string,
    request: ApplyRequest,
    auth?: AuthContext
  ): Promise<ApplyResult> {
    const original = await this.loadDefinition(assetType, assetId);
    const repaired = this.repair(original, request.repairs);
    const loaded = repaired.loaded;
    const plan = await this.planAgainst(assetType, assetId, loaded, request.rebinds);
    this.assertApplicable(plan);
    const fieldProblems = await this.addedFieldProblems(loaded.definition, plan, request);
    if (fieldProblems.length > 0) {
      throw new ValidationError(fieldProblems.join(' '));
    }

    const name = this.resolveName(request, loaded.name);
    const template = await this.loadTemplate(request.template, loaded.definition, plan);
    const currentColumns = await this.currentColumnsFor(request, plan);
    const rewritten = this.rewrite(loaded.definition, plan, request, template, currentColumns);
    const definition = rewritten.definition;
    const changes = [...repaired.changes, ...rewritten.changes];
    const applyWarnings = [
      ...rewritten.warnings,
      ...(await this.crossDatasetWarnings(definition, plan)),
    ];
    const target: LoadedDefinition = rewritten.themeArn
      ? { ...loaded, themeArn: rewritten.themeArn }
      : loaded;
    if (request.folderId && request.mode !== 'clone') {
      throw new ValidationError('A folder can only be chosen when creating a copy');
    }

    logger.info('Applying rebind', {
      assetType,
      assetId,
      mode: request.mode,
      rebinds: plan.datasets.length,
      ops: request.ops?.length ?? 0,
      repairs: request.repairs?.length ?? 0,
      template: request.template?.assetId,
      renamed: name !== loaded.name,
    });

    let written: { assetId: string; arn: string; versionNumber?: number };
    let filed: string[] = [];
    if (request.mode === 'clone') {
      // A copy keeps the source's audience, adds its builder as owner, and is filed.
      const audience = await audienceFor(
        assetType,
        await this.sourcePermissions(assetType, assetId),
        auth,
        request.folderId
      );
      applyWarnings.push(...audience.warnings);
      written = await this.clone(
        assetType,
        request.newAssetId,
        name,
        definition,
        target,
        audience.permissions
      );
      const filing = await fileInFolders(
        this.quickSightService,
        audience.folderIds,
        written.assetId,
        assetType
      );
      filed = filing.filed;
      applyWarnings.push(...filing.warnings);
    } else {
      written = await this.update(assetType, assetId, name, definition, target);
    }

    await this.recordProvenance(
      assetType,
      { assetId: written.assetId, name, arn: written.arn, folderIds: filed },
      request,
      changes.length,
      auth
    );

    return {
      assetType,
      ...written,
      name,
      mode: request.mode,
      plan,
      changes,
      folderIds: filed,
      ...(applyWarnings.length ? { warnings: applyWarnings } : {}),
    };
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
    const edits =
      request.rebinds.length +
      (request.ops?.length ?? 0) +
      (request.repairs?.length ?? 0) +
      (request.template ? 1 : 0) +
      (request.typeRules ? 1 : 0) +
      (request.addCalculatedFields?.length ?? 0);
    if (request.mode === 'update' && !name && edits === 0) {
      throw new ValidationError('Nothing to do: no rebinds, no edits and no new name');
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
      errors: Array.isArray(current.Errors) ? current.Errors : undefined,
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

  private update(
    assetType: AuthorableAssetType,
    assetId: string,
    name: string,
    definition: Record<string, any>,
    loaded: LoadedDefinition
  ): Promise<{ assetId: string; arn: string; versionNumber?: number }> {
    return updateAsset(this.quickSightService, {
      assetType,
      assetId,
      name,
      definition,
      themeArn: loaded.themeArn,
      dashboardPublishOptions: loaded.dashboardPublishOptions,
    });
  }

  private clone(
    assetType: AuthorableAssetType,
    requestedId: string | undefined,
    name: string,
    definition: Record<string, any>,
    loaded: LoadedDefinition,
    permissions: any[] | undefined
  ): Promise<{ assetId: string; arn: string; versionNumber?: number }> {
    return createAsset(this.quickSightService, {
      assetType,
      assetId: requestedId?.trim() || randomUUID(),
      name,
      definition,
      permissions,
      themeArn: loaded.themeArn,
      dashboardPublishOptions: loaded.dashboardPublishOptions,
    });
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

/** The KPI options of the template's first KPI, the standard every KPI takes. */
function templateKpiOptions(definition: Record<string, any>): Record<string, any> | undefined {
  for (const sheet of definition.Sheets ?? []) {
    for (const wrapper of sheet.Visuals ?? []) {
      const options = wrapper?.KPIVisual?.ChartConfiguration?.KPIOptions;
      if (options) {
        return options;
      }
    }
  }
  return undefined;
}
