/**
 * NewAssetService - a dashboard or analysis from nothing: the datasets it
 * should read, the visuals it should show (given, or proposed by the
 * planner from an ask), optionally a template standard and type rules, and
 * an audience inherited from an existing asset. Same preview-then-create
 * shape as the rest of authoring; nothing is written by preview.
 */

import { randomUUID } from 'node:crypto';

import type { AuthContext } from '../../../shared/auth';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import {
  type FilterBarTemplate,
  FilterBarTemplateStore,
  filtersFromTemplate,
} from '../../../shared/services/templates/FilterBarTemplateStore';
import { logger } from '../../../shared/utils/logger';
import { datasetPermissionsFor } from '../../../shared/utils/permissions';
import {
  type BuilderDataset,
  buildDefinition,
  type FilterSpec,
  type VisualSpec,
} from '../lib/definitionBuilder';
import { unresolvedCalculatedFieldColumns } from '../lib/definitionColumns';
import type { DefinitionChange } from '../lib/definitionOps';
import { buildOutline } from '../lib/definitionOutline';
import { withAddedCalculatedFields } from '../lib/definitionRebind';
import { applyTemplate } from '../lib/definitionTemplate';
import { applyTypeRules } from '../lib/definitionTypeRules';
import type {
  AddedCalculatedField,
  AuthorableAssetType,
  SheetOutline,
  TemplateRequest,
  TypeRules,
} from '../types';
import { createAsset, recordProvenance } from './assetWriter';
import type { PlannerService } from './planner/PlannerService';
import type { RebindService, TargetDataset } from './RebindService';

const NAME_MAX_LENGTH = 200;

export interface NewAssetRequest {
  assetType: AuthorableAssetType;
  name: string;
  datasets: Array<{
    identifier: string;
    dataSetId: string;
    /**
     * Give the new asset's audience the same standing on this dataset. For
     * a dataset created for this asset, which nobody can see yet.
     */
    shareWithAudience?: boolean;
  }>;
  /** Visuals to build; when absent and `ask` is given, the planner proposes them. */
  visuals?: VisualSpec[];
  /** Columns the person filters on; each gets a control in the sheet's control bar. */
  filters?: FilterSpec[];
  /**
   * The filter bar template to start from; the organisation's default when
   * omitted, none with 'none'. Its controls come first, in its order and
   * widths; filters asked for besides follow.
   */
  filterBarTemplateId?: string;
  ask?: string;
  sheetName?: string;
  addCalculatedFields?: AddedCalculatedField[];
  template?: TemplateRequest;
  typeRules?: TypeRules;
  /** Inherit this asset's audience; defaults to the template's when one is given. */
  permissionsFrom?: { assetType: AuthorableAssetType; assetId: string };
  folderId?: string;
  newAssetId?: string;
}

export interface NewAssetPreview {
  definition: Record<string, any>;
  outline: SheetOutline[];
  changes: DefinitionChange[];
  warnings: string[];
  visuals: VisualSpec[];
  filters: FilterSpec[];
  proposal?: { reason: string; model: { provider: string; model: string } };
  themeArn?: string;
}

export interface NewAssetResult {
  assetType: AuthorableAssetType;
  assetId: string;
  name: string;
  arn: string;
  versionNumber?: number;
  changes: DefinitionChange[];
  warnings: string[];
  folderId?: string;
}

export class NewAssetService {
  private readonly quickSightService: QuickSightService;

  public constructor(
    accountId: string,
    private readonly rebindService: RebindService,
    private readonly planner?: PlannerService,
    private readonly filterBars: Pick<
      FilterBarTemplateStore,
      'get' | 'getDefault'
    > = new FilterBarTemplateStore()
  ) {
    this.quickSightService = ClientFactory.getQuickSightService(accountId);
  }

  public async preview(request: NewAssetRequest): Promise<NewAssetPreview> {
    return (await this.compose(request)).preview;
  }

  public async create(request: NewAssetRequest, auth?: AuthContext): Promise<NewAssetResult> {
    const name = request.name.trim();
    if (!name) {
      throw new ValidationError('A name is required');
    }
    if (name.length > NAME_MAX_LENGTH) {
      throw new ValidationError(`Name must be at most ${NAME_MAX_LENGTH} characters`);
    }
    const { preview: composed, blocking } = await this.compose(request);
    if ((composed.definition.Sheets?.[0]?.Visuals?.length ?? 0) === 0) {
      throw new ValidationError('Nothing to create: no visual could be built');
    }
    if (blocking.length > 0) {
      throw new ValidationError(blocking.join(' '));
    }
    const from = request.permissionsFrom ?? request.template;
    const permissions = from
      ? await this.rebindService.permissionsOf(from.assetType, from.assetId)
      : undefined;
    if (!permissions) {
      composed.warnings.push(
        'No audience was given (permissionsFrom or a template), so only account admins will see this asset.'
      );
    }
    await this.shareDatasets(request, permissions, composed.warnings);
    const newId = request.newAssetId?.trim() || randomUUID();
    logger.info('Creating asset from scratch', {
      assetType: request.assetType,
      name,
      datasets: request.datasets.length,
      visuals: composed.visuals.length,
      template: request.template?.assetId,
    });

    const written = await createAsset(this.quickSightService, {
      assetType: request.assetType,
      assetId: newId,
      name,
      definition: composed.definition,
      permissions,
      themeArn: composed.themeArn,
    });

    let folderId: string | undefined;
    if (request.folderId) {
      await this.quickSightService.createFolderMembership(
        request.folderId,
        written.assetId,
        request.assetType === 'dashboard' ? 'DASHBOARD' : 'ANALYSIS'
      );
      folderId = request.folderId;
    }
    await this.recordProvenance(request.assetType, written, name, composed, auth, folderId);
    return {
      assetType: request.assetType,
      ...written,
      name,
      changes: composed.changes,
      warnings: composed.warnings,
      folderId,
    };
  }

  /**
   * A dataset created for this asset is visible to nobody until someone
   * shares it. The audience the asset inherits gets the same standing on
   * it (owners own, viewers read) before the asset is written, so the first
   * person to open the asset finds its data. A failed grant is a warning:
   * the asset is still worth creating.
   */
  private async shareDatasets(
    request: NewAssetRequest,
    permissions: any[] | undefined,
    warnings: string[]
  ): Promise<void> {
    const toShare = request.datasets.filter((d) => d.shareWithAudience);
    if (toShare.length === 0) {
      return;
    }
    const grants = datasetPermissionsFor(permissions);
    if (grants.length === 0) {
      warnings.push(
        `${toShare.length === 1 ? 'A dataset' : `${toShare.length} datasets`} created for this asset ${toShare.length === 1 ? 'has' : 'have'} no audience either; share ${toShare.length === 1 ? 'it' : 'them'} from Assets or give the asset an audience.`
      );
      return;
    }
    for (const dataset of toShare) {
      try {
        await this.quickSightService.updateDataSetPermissions(dataset.dataSetId, grants);
      } catch (error) {
        logger.warn('Dataset could not be shared with the audience', {
          dataSetId: dataset.dataSetId,
          error,
        });
        warnings.push(
          `Dataset ${dataset.identifier} could not be shared with the audience, so they will not see its data until it is.`
        );
      }
    }
  }

  /**
   * The preview, plus what would stop a create: things QuickSight would
   * refuse the whole asset over, which a preview only warns about.
   */
  private async compose(
    request: NewAssetRequest
  ): Promise<{ preview: NewAssetPreview; blocking: string[] }> {
    if (request.datasets.length === 0) {
      throw new ValidationError('At least one dataset is required');
    }
    const seen = new Set<string>();
    const datasets: BuilderDataset[] = [];
    const targets = new Map<string, TargetDataset>();
    for (const entry of request.datasets) {
      if (!entry.identifier || seen.has(entry.identifier)) {
        throw new ValidationError(
          `Dataset identifiers must be unique and non-empty ('${entry.identifier}')`
        );
      }
      seen.add(entry.identifier);
      const target = await this.rebindService.describeTargetDataset(entry.dataSetId);
      targets.set(entry.identifier, target);
      datasets.push({
        identifier: entry.identifier,
        dataSetArn: target.dataSetArn,
        columns: target.columns,
      });
    }

    let visuals = request.visuals ?? [];
    let filters = request.filters ?? [];
    let proposal: NewAssetPreview['proposal'];
    if (visuals.length === 0 && request.ask?.trim()) {
      if (!this.planner) {
        throw new ValidationError('An ask needs the planner, which is not configured');
      }
      const planned = await this.planner.planVisuals(request.ask, datasets);
      visuals = planned.visuals;
      // Filters the caller gave win over the planner's.
      filters = filters.length > 0 ? filters : (planned.filters ?? []);
      proposal = { reason: planned.reason, model: planned.model };
    }

    const bar = await this.filterBar(request.filterBarTemplateId, datasets);
    filters = [
      ...bar.filters,
      ...filters.filter(
        (f) => !bar.filters.some((b) => b.column.toLowerCase() === f.column.toLowerCase())
      ),
    ];

    const built = buildDefinition({ datasets, visuals, filters, sheetName: request.sheetName });
    const changes: DefinitionChange[] = [
      {
        kind: 'visual',
        description: `Built ${built.definition.Sheets[0].Visuals.length} visual${built.definition.Sheets[0].Visuals.length === 1 ? '' : 's'} on ${datasets.map((d) => d.identifier).join(', ')}`,
      },
    ];
    const warnings = [...bar.warnings, ...built.warnings];
    let definition = built.definition;
    let themeArn: string | undefined;

    if (request.template) {
      const template = await this.rebindService.loadDefinitionWithTheme(
        request.template.assetType,
        request.template.assetId
      );
      const columnsByIdentifier = new Map(
        [...targets].map(([identifier, t]) => [identifier, new Set(t.columns.map((c) => c.name))])
      );
      const migrated = applyTemplate(definition, template.definition, {
        textBoxes: request.template.textBoxes,
        controls: request.template.controls,
        sheetNames: request.template.sheetNames,
        kpisFirst: request.template.kpisFirst,
        columnsByIdentifier,
        themeArn: request.template.theme === false ? undefined : template.themeArn,
      });
      definition = migrated.definition;
      changes.push(...migrated.changes);
      warnings.push(...migrated.warnings);
      themeArn = migrated.themeArn;
    }

    const added = request.addCalculatedFields ?? [];
    // QuickSight checks every expression against the dataset when the asset
    // is written and fails the whole write on one unknown column, so a
    // field that reads what the dataset does not have blocks the create.
    const blocking = unresolvedCalculatedFieldColumns(
      added,
      definition,
      new Map([...targets].map(([id, t]) => [id, new Set(t.columns.map((c) => c.name))]))
    ).map(
      (u) =>
        `Calculated field '${u.name}' reads ${u.columns.map((c) => `'${c}'`).join(', ')}, which ${targets.get(u.identifier)?.name ?? u.identifier} does not have.`
    );
    warnings.push(...blocking);
    definition = withAddedCalculatedFields(definition, added);
    for (const field of added) {
      changes.push({
        kind: 'calculatedField',
        description: `Added calculated field ${field.name} on ${field.identifier}`,
      });
    }
    if (request.typeRules && (request.typeRules.chartFamily?.length || request.typeRules.kpi)) {
      const ruled = applyTypeRules(definition, request.typeRules);
      definition = ruled.definition;
      changes.push(...ruled.changes);
      warnings.push(...ruled.warnings);
    }

    return {
      preview: {
        definition,
        outline: buildOutline(definition),
        changes,
        warnings,
        visuals,
        filters,
        ...(proposal ? { proposal } : {}),
        ...(themeArn ? { themeArn } : {}),
      },
      blocking,
    };
  }

  /** The filter bar template's controls on these datasets, and what it could not place. */
  private async filterBar(
    templateId: string | undefined,
    datasets: BuilderDataset[]
  ): Promise<{ filters: FilterSpec[]; warnings: string[] }> {
    if (templateId === 'none') {
      return { filters: [], warnings: [] };
    }
    let template: FilterBarTemplate | null = null;
    try {
      template = templateId
        ? await this.filterBars.get(templateId)
        : await this.filterBars.getDefault();
    } catch (error) {
      logger.warn('Filter bar template could not be read', { templateId, error });
    }
    if (!template) {
      return {
        filters: [],
        warnings: templateId ? [`No filter bar template '${templateId}'; built without one.`] : [],
      };
    }
    const { filters, skipped } = filtersFromTemplate(template, datasets);
    return {
      filters,
      warnings: skipped.length
        ? [
            `Filter bar '${template.name}': ${skipped.join(', ')} ${skipped.length === 1 ? 'is' : 'are'} not on these datasets, so ${skipped.length === 1 ? 'it was' : 'they were'} left out.`,
          ]
        : [],
    };
  }

  private recordProvenance(
    assetType: AuthorableAssetType,
    written: { assetId: string; arn: string },
    name: string,
    composed: NewAssetPreview,
    auth?: AuthContext,
    folderId?: string
  ): Promise<void> {
    return recordProvenance(
      this.quickSightService,
      {
        action: 'authoring.create',
        assetType,
        assetId: written.assetId,
        arn: written.arn,
        folderId,
        name,
        details: { visuals: composed.visuals.length, changes: composed.changes.length },
      },
      auth
    );
  }
}
