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
import { actorFromAuth, auditLog } from '../../../shared/services/audit/AuditLog';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { settingsStore } from '../../../shared/services/settings/SettingsStore';
import { logger } from '../../../shared/utils/logger';
import { type BuilderDataset, buildDefinition, type VisualSpec } from '../lib/definitionBuilder';
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
import type { PlannerService } from './planner/PlannerService';
import type { RebindService, TargetDataset } from './RebindService';

const NAME_MAX_LENGTH = 200;
const TAG_VALUE_MAX = 256;

export interface NewAssetRequest {
  assetType: AuthorableAssetType;
  name: string;
  datasets: Array<{ identifier: string; dataSetId: string }>;
  /** Visuals to build; when absent and `ask` is given, the planner proposes them. */
  visuals?: VisualSpec[];
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
    private readonly planner?: PlannerService
  ) {
    this.quickSightService = ClientFactory.getQuickSightService(accountId);
  }

  public preview(request: NewAssetRequest): Promise<NewAssetPreview> {
    return this.compose(request);
  }

  public async create(request: NewAssetRequest, auth?: AuthContext): Promise<NewAssetResult> {
    const name = request.name.trim();
    if (!name) {
      throw new ValidationError('A name is required');
    }
    if (name.length > NAME_MAX_LENGTH) {
      throw new ValidationError(`Name must be at most ${NAME_MAX_LENGTH} characters`);
    }
    const composed = await this.compose(request);
    if ((composed.definition.Sheets?.[0]?.Visuals?.length ?? 0) === 0) {
      throw new ValidationError('Nothing to create: no visual could be built');
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
    const newId = request.newAssetId?.trim() || randomUUID();
    logger.info('Creating asset from scratch', {
      assetType: request.assetType,
      name,
      datasets: request.datasets.length,
      visuals: composed.visuals.length,
      template: request.template?.assetId,
    });

    let written: { assetId: string; arn: string; versionNumber?: number };
    if (request.assetType === 'analysis') {
      const created = await this.quickSightService.createAnalysis({
        analysisId: newId,
        name,
        definition: composed.definition as any,
        permissions,
        themeArn: composed.themeArn,
      });
      written = { assetId: created.analysisId, arn: created.arn };
    } else {
      const created = await this.quickSightService.createDashboard({
        dashboardId: newId,
        name,
        definition: composed.definition as any,
        permissions,
        themeArn: composed.themeArn,
      });
      const match = (created.versionArn as string | undefined)?.match(/\/version\/(\d+)$/);
      written = {
        assetId: created.dashboardId,
        arn: created.arn,
        versionNumber: match?.[1] ? Number.parseInt(match[1], 10) : undefined,
      };
    }

    let folderId: string | undefined;
    if (request.folderId) {
      await this.quickSightService.createFolderMembership(
        request.folderId,
        written.assetId,
        request.assetType === 'dashboard' ? 'DASHBOARD' : 'ANALYSIS'
      );
      folderId = request.folderId;
    }
    await this.recordProvenance(request.assetType, written.assetId, name, composed, auth);
    return {
      assetType: request.assetType,
      ...written,
      name,
      changes: composed.changes,
      warnings: composed.warnings,
      folderId,
    };
  }

  private async compose(request: NewAssetRequest): Promise<NewAssetPreview> {
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
    let proposal: NewAssetPreview['proposal'];
    if (visuals.length === 0 && request.ask?.trim()) {
      if (!this.planner) {
        throw new ValidationError('An ask needs the planner, which is not configured');
      }
      const planned = await this.planner.planVisuals(request.ask, datasets);
      visuals = planned.visuals;
      proposal = { reason: planned.reason, model: planned.model };
    }

    const built = buildDefinition({ datasets, visuals, sheetName: request.sheetName });
    const changes: DefinitionChange[] = [
      {
        kind: 'visual',
        description: `Built ${built.definition.Sheets[0].Visuals.length} visual${built.definition.Sheets[0].Visuals.length === 1 ? '' : 's'} on ${datasets.map((d) => d.identifier).join(', ')}`,
      },
    ];
    const warnings = [...built.warnings];
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
      definition,
      outline: buildOutline(definition),
      changes,
      warnings,
      visuals,
      ...(proposal ? { proposal } : {}),
      ...(themeArn ? { themeArn } : {}),
    };
  }

  private async recordProvenance(
    assetType: AuthorableAssetType,
    assetId: string,
    name: string,
    composed: NewAssetPreview,
    auth?: AuthContext
  ): Promise<void> {
    if (!auth) return;
    const { actor, channel } = actorFromAuth(auth);
    await auditLog.record({
      actor,
      channel,
      action: 'authoring.create',
      assetType,
      assetId,
      assetName: name,
      details: { visuals: composed.visuals.length, changes: composed.changes.length },
    });
    if (settingsStore.get('provenance.tagAssets') === false) return;
    try {
      await this.quickSightService.tagResource(assetType, assetId, [
        {
          key: 'portal:authored-by',
          value: `${actor.kind}:${actor.label}`.slice(0, TAG_VALUE_MAX),
        },
        { key: 'portal:channel', value: channel },
        { key: 'portal:at', value: new Date().toISOString() },
      ]);
    } catch (error) {
      logger.warn('Provenance tags could not be written', { assetType, assetId, error });
    }
  }
}
