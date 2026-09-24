/**
 * DefinitionService - a definition the caller built themselves (an agent
 * that read the cached export and edited the JSON, say), checked against
 * the datasets it declares and published through the same write path as
 * every other authoring call: permissions and theme kept, the dashboard
 * version published, provenance recorded. Nothing is written by preview,
 * and apply refuses anything QuickSight would refuse, so a broken asset is
 * never left behind.
 */
import { randomUUID } from 'node:crypto';

import type { AuthContext } from '../../../shared/auth';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { logger } from '../../../shared/utils/logger';
import { crossDatasetFilterColumns, crossDatasetFilterWarnings } from '../lib/crossDatasetFilters';
import { collectDefinitionDatasets } from '../lib/definitionColumns';
import { buildOutline } from '../lib/definitionOutline';
import { buildRepairPlan, type RepairTarget } from '../lib/repairPlan';
import type {
  AuthorableAssetType,
  DefinitionApplyRequest,
  DefinitionApplyResult,
  DefinitionDatasetCheck,
  DefinitionPreview,
  NewDefinitionRequest,
} from '../types';
import { createAsset, recordProvenance, updateAsset } from './assetWriter';
import type { RebindService, TargetDataset } from './RebindService';

const NAME_MAX_LENGTH = 200;

export interface DefinitionTarget {
  assetType: AuthorableAssetType;
  assetId: string;
}

interface Checked {
  preview: DefinitionPreview;
  /** What every declared identifier could be read as, for the writer. */
  targets: Map<string, TargetDataset | null>;
}

/** The shape every definition needs before anything else is looked at. */
export function assertDefinitionShape(definition: unknown): Record<string, any> {
  if (typeof definition !== 'object' || definition === null || Array.isArray(definition)) {
    throw new ValidationError('definition must be a QuickSight definition object');
  }
  const d = definition as Record<string, any>;
  if (
    !Array.isArray(d.DataSetIdentifierDeclarations) ||
    d.DataSetIdentifierDeclarations.length === 0
  ) {
    throw new ValidationError(
      'definition.DataSetIdentifierDeclarations must name at least one dataset'
    );
  }
  if (!Array.isArray(d.Sheets) || d.Sheets.length === 0) {
    throw new ValidationError('definition.Sheets must have at least one sheet');
  }
  return d;
}

export class DefinitionService {
  private readonly quickSightService: QuickSightService;

  public constructor(
    accountId: string,
    private readonly rebindService: RebindService
  ) {
    this.quickSightService = ClientFactory.getQuickSightService(accountId);
  }

  /** Read-only: what QuickSight would refuse, and the sheets as they would be. */
  public async preview(definition: unknown): Promise<DefinitionPreview> {
    return (await this.check(assertDefinitionShape(definition))).preview;
  }

  /** Rewrite an existing asset with the definition, or create a copy from it. */
  public async apply(
    target: DefinitionTarget,
    request: DefinitionApplyRequest,
    auth?: AuthContext
  ): Promise<DefinitionApplyResult> {
    const definition = assertDefinitionShape(request.definition);
    const checked = await this.check(definition);
    this.assertApplicable(checked.preview);
    const loaded = await this.rebindService.loadDefinitionWithTheme(
      target.assetType,
      target.assetId
    );
    const name = this.resolveName(request.name, request.mode === 'clone' ? undefined : loaded.name);
    const themeArn = request.themeArn?.trim() || loaded.themeArn;
    const warnings = [...checked.preview.warnings];
    if (request.folderId && request.mode !== 'clone') {
      throw new ValidationError('A folder can only be chosen when creating a copy');
    }
    logger.info('Applying definition', {
      ...target,
      mode: request.mode,
      sheets: definition.Sheets.length,
      renamed: name !== loaded.name,
    });

    let written: { assetId: string; arn: string; versionNumber?: number };
    if (request.mode === 'update') {
      written = await updateAsset(this.quickSightService, {
        assetType: target.assetType,
        assetId: target.assetId,
        name,
        definition,
        themeArn,
        dashboardPublishOptions: loaded.dashboardPublishOptions,
      });
    } else {
      const from = request.permissionsFrom ?? target;
      const permissions = await this.rebindService.permissionsOf(from.assetType, from.assetId);
      if (!permissions) {
        warnings.push(
          `${from.assetId} has no permissions to inherit, so only account admins will see the copy.`
        );
      }
      written = await createAsset(this.quickSightService, {
        assetType: target.assetType,
        assetId: request.newAssetId?.trim() || randomUUID(),
        name,
        definition,
        permissions,
        themeArn,
        dashboardPublishOptions: loaded.dashboardPublishOptions,
      });
    }
    const folderId = await this.file(target.assetType, written.assetId, request.folderId);
    await recordProvenance(
      this.quickSightService,
      {
        action: request.mode === 'clone' ? 'authoring.clone' : 'authoring.update',
        assetType: target.assetType,
        assetId: written.assetId,
        name,
        details: { definition: true, sheets: definition.Sheets.length },
      },
      auth
    );
    return {
      assetType: target.assetType,
      ...written,
      name,
      mode: request.mode,
      ...(folderId ? { folderId } : {}),
      warnings,
    };
  }

  /** A new asset from the definition alone. */
  public async create(
    request: NewDefinitionRequest,
    auth?: AuthContext
  ): Promise<DefinitionApplyResult> {
    const definition = assertDefinitionShape(request.definition);
    const name = this.resolveName(request.name);
    const checked = await this.check(definition);
    this.assertApplicable(checked.preview);
    const warnings = [...checked.preview.warnings];
    const permissions = request.permissionsFrom
      ? await this.rebindService.permissionsOf(
          request.permissionsFrom.assetType,
          request.permissionsFrom.assetId
        )
      : undefined;
    if (!permissions) {
      warnings.push(
        'No audience was given (permissionsFrom), so only account admins will see this asset.'
      );
    }
    logger.info('Creating asset from a definition', {
      assetType: request.assetType,
      name,
      sheets: definition.Sheets.length,
    });
    const written = await createAsset(this.quickSightService, {
      assetType: request.assetType,
      assetId: request.newAssetId?.trim() || randomUUID(),
      name,
      definition,
      permissions,
      themeArn: request.themeArn?.trim() || undefined,
    });
    const folderId = await this.file(request.assetType, written.assetId, request.folderId);
    await recordProvenance(
      this.quickSightService,
      {
        action: 'authoring.create',
        assetType: request.assetType,
        assetId: written.assetId,
        name,
        details: { definition: true, sheets: definition.Sheets.length },
      },
      auth
    );
    return {
      assetType: request.assetType,
      ...written,
      name,
      mode: 'create',
      ...(folderId ? { folderId } : {}),
      warnings,
    };
  }

  /**
   * Every declared dataset read (live, or from its export), every referenced
   * column resolved against it, and the repair plan's issues on top: the
   * same checks the Author page runs, on a definition that came from
   * outside.
   */
  private async check(definition: Record<string, any>): Promise<Checked> {
    const datasets = collectDefinitionDatasets(definition);
    const targets = new Map<string, TargetDataset | null>();
    await Promise.all(
      datasets.map(async (dataset) => {
        try {
          targets.set(
            dataset.identifier,
            await this.rebindService.describeTargetDataset(dataset.dataSetId)
          );
        } catch (error) {
          logger.warn('Definition check: dataset cannot be read', {
            dataSetId: dataset.dataSetId,
            error,
          });
          targets.set(dataset.identifier, null);
        }
      })
    );
    const repairTargets = new Map<string, RepairTarget | null>(
      [...targets].map(([identifier, t]) => [
        identifier,
        t ? { dataSetId: t.dataSetId, name: t.name, columns: t.columns } : null,
      ])
    );
    const plan = buildRepairPlan({ definition, datasets, targets: repairTargets });
    const checks: DefinitionDatasetCheck[] = datasets.map((dataset) => {
      const target = targets.get(dataset.identifier) ?? null;
      const missing = plan.issues
        .filter((i) => i.kind === 'column-missing' && i.identifier === dataset.identifier)
        .map((i) => i.columnName)
        .filter((c): c is string => typeof c === 'string');
      return {
        identifier: dataset.identifier,
        dataSetId: dataset.dataSetId,
        ...(target ? { name: target.name } : {}),
        readable: target !== null,
        referenced: dataset.columns.length,
        missing,
      };
    });
    const warnings: string[] = [];
    if (crossDatasetFilterColumns(definition).length > 0) {
      const columnsByIdentifier = new Map<string, Set<string>>(
        datasets.map((d) => {
          const target = targets.get(d.identifier);
          return [d.identifier, new Set((target?.columns ?? d.columns).map((c) => c.name))];
        })
      );
      warnings.push(...crossDatasetFilterWarnings(definition, columnsByIdentifier));
    }
    return {
      preview: {
        datasets: checks,
        issues: plan.issues,
        summary: plan.summary,
        outline: buildOutline(definition),
        warnings,
        canApply: plan.issues.length === 0,
      },
      targets,
    };
  }

  private assertApplicable(preview: DefinitionPreview): void {
    if (preview.canApply) {
      return;
    }
    const problems = preview.issues.map((i) => i.message);
    throw new ValidationError(
      `QuickSight would refuse this definition (${problems.length} issue${problems.length === 1 ? '' : 's'}): ${problems.join(' ')} Preview it to see the proposed fixes.`
    );
  }

  private resolveName(requested: string | undefined, fallback?: string): string {
    const name = requested?.trim() || fallback?.trim();
    if (!name) {
      throw new ValidationError('A name is required');
    }
    if (name.length > NAME_MAX_LENGTH) {
      throw new ValidationError(`Name must be at most ${NAME_MAX_LENGTH} characters`);
    }
    return name;
  }

  private async file(
    assetType: AuthorableAssetType,
    assetId: string,
    folderId: string | undefined
  ): Promise<string | undefined> {
    if (!folderId) {
      return undefined;
    }
    await this.quickSightService.createFolderMembership(
      folderId,
      assetId,
      assetType === 'dashboard' ? 'DASHBOARD' : 'ANALYSIS'
    );
    return folderId;
  }
}
