import { CloudTrailClient } from '@aws-sdk/client-cloudtrail';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { CloudTrailAdapter } from '../../../adapters/aws/CloudTrailAdapter';
import { CloudWatchAdapter } from '../../../adapters/aws/CloudWatchAdapter';
import { aiModelViews, isAiModelKey } from '../../../shared/ai/modelCatalog';
import { actorLabel, requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { CacheService } from '../../../shared/services/cache/CacheService';
import { jobFactory } from '../../../shared/services/jobs/JobFactory';
import { createResponse, errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { ActivityService } from '../../activity/services/ActivityService';
import { GroupService } from '../../organization/services/GroupService';
import { parseOps } from '../lib/definitionOps';
import { parseRepairs } from '../lib/definitionRepairs';
import { DefinitionService } from '../services/DefinitionService';
import { InsightsService } from '../services/InsightsService';
import { type NewAssetRequest, NewAssetService } from '../services/NewAssetService';
import { createPlannerModel } from '../services/planner/createPlannerModel';
import { PlannerService } from '../services/planner/PlannerService';
import { RebindService } from '../services/RebindService';
import {
  type ApplyRequest,
  type AuthorableAssetType,
  isAuthorableAssetType,
  type RebindRequest,
  type TemplateRequest,
  type TypeRules,
} from '../types';

const APPLY_MODES = new Set(['update', 'clone']);

type Target = { assetType: AuthorableAssetType; assetId: string };

export class AuthoringHandler {
  private readonly accountId: string;

  public constructor() {
    this.accountId = process.env.AWS_ACCOUNT_ID || '';
  }

  /** GET /authoring/{assetType}/{assetId}/datasets */
  public async getDatasets(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const target = this.target(event);
      const result = await this.service().describeDatasets(target.assetType, target.assetId);
      return successResponse(event, { success: true, data: result });
    } catch (error: any) {
      logger.error('Describe definition datasets failed', { error });
      return this.failure(event, error, 'Failed to read the definition');
    }
  }

  /** POST /authoring/{assetType}/{assetId}/repair/plan */
  public async planRepair(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const target = this.target(event);
      const body = this.parseBody(event);
      const plan = await this.service().repairPlan(
        target.assetType,
        target.assetId,
        this.parseRebinds(body.rebinds ?? [])
      );
      return successResponse(event, { success: true, data: plan });
    } catch (error: any) {
      logger.error('Plan repair failed', { error });
      return this.failure(event, error, 'Failed to plan the repair');
    }
  }

  /** POST /authoring/{assetType}/{assetId}/rebind/plan */
  public async planRebind(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const target = this.target(event);
      const { rebinds } = this.parseBody(event);
      const plan = await this.service().plan(
        target.assetType,
        target.assetId,
        this.parseRebinds(rebinds)
      );
      return successResponse(event, { success: true, data: plan });
    } catch (error: any) {
      logger.error('Plan rebind failed', { error });
      return this.failure(event, error, 'Failed to plan the rebind');
    }
  }

  /** GET /authoring/{assetType}/{assetId}/insights */
  public async getInsights(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const target = this.target(event);
      const region = process.env.AWS_REGION || 'us-east-1';
      const cacheService = CacheService.getInstance();
      const activity = new ActivityService(
        cacheService,
        new CloudTrailAdapter(new CloudTrailClient({ region }), region),
        new GroupService()
      );
      const service = new InsightsService(activity, this.service(), new CloudWatchAdapter(region));
      const data = await service.get(target.assetType, target.assetId);
      return successResponse(event, { success: true, data });
    } catch (error: any) {
      logger.error('Insights failed', { error });
      return this.failure(event, error, 'Failed to load insights');
    }
  }

  /** POST /authoring/{assetType}/{assetId}/rebind/preview */
  public async previewRebind(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const target = this.target(event);
      const body = this.parseBody(event);
      const preview = await this.service().preview(target.assetType, target.assetId, {
        rebinds: this.parseRebinds(body.rebinds ?? []),
        addCalculatedFields: this.parseAddedFields(body.addCalculatedFields),
        ops: parseOps(body.ops),
        repairs: parseRepairs(body.repairs),
        template: this.parseTemplate(body.template),
        typeRules: this.parseTypeRules(body.typeRules),
      });
      return successResponse(event, { success: true, data: preview });
    } catch (error: any) {
      logger.error('Preview rebind failed', { error });
      return this.failure(event, error, 'Failed to preview the rebind');
    }
  }

  /** POST /authoring/{assetType}/{assetId}/rebind */
  public async applyRebind(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const target = this.target(event);
      const request = this.parseApplyRequest(this.parseBody(event));

      logger.info('Rebind requested', {
        user: user.email,
        ...target,
        mode: request.mode,
        rebinds: request.rebinds.length,
      });
      const result = await this.service().apply(target.assetType, target.assetId, request, user);
      return successResponse(event, { success: true, data: result });
    } catch (error: any) {
      logger.error('Apply rebind failed', { error });
      // QuickSight's own rejection is the useful message when the definition
      // does not validate against the new dataset.
      return this.failure(event, error, 'Failed to apply the rebind');
    }
  }

  /**
   * POST /authoring/definition/preview and
   * POST /authoring/{assetType}/{assetId}/definition/preview
   *
   * The caller's own definition, checked the way the Author page checks
   * everything: datasets read, columns resolved, issues with fixes.
   */
  public async previewDefinition(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const body = this.parseBody(event);
      const preview = await this.definitionService().preview(body.definition);
      return successResponse(event, { success: true, data: preview });
    } catch (error: any) {
      logger.error('Preview definition failed', { error });
      return this.failure(event, error, 'Failed to check the definition');
    }
  }

  /** POST /authoring/{assetType}/{assetId}/definition */
  public async applyDefinition(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const target = this.target(event);
      const body = this.parseBody(event);
      const mode = body.mode;
      if (typeof mode !== 'string' || !APPLY_MODES.has(mode)) {
        throw badRequest("mode must be 'update' or 'clone'");
      }
      logger.info('Definition apply requested', { user: user.email, ...target, mode });
      const result = await this.definitionService().apply(
        target,
        {
          definition: body.definition as Record<string, any>,
          mode: mode as 'update' | 'clone',
          name: this.optionalString(body, 'name'),
          newAssetId: this.optionalString(body, 'newAssetId'),
          folderId: this.optionalString(body, 'folderId'),
          themeArn: this.optionalString(body, 'themeArn'),
          permissionsFrom: this.parsePermissionsFrom(body.permissionsFrom),
        },
        user
      );
      return successResponse(event, { success: true, data: result });
    } catch (error: any) {
      logger.error('Apply definition failed', { error });
      return this.failure(event, error, 'Failed to write the definition');
    }
  }

  /** POST /authoring/definition - a new asset from a definition alone. */
  public async createFromDefinition(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const body = this.parseBody(event);
      if (typeof body.assetType !== 'string' || !isAuthorableAssetType(body.assetType)) {
        throw badRequest("assetType must be 'dashboard' or 'analysis'");
      }
      if (typeof body.name !== 'string' || !body.name.trim()) {
        throw badRequest('name is required');
      }
      logger.info('Create from definition requested', {
        user: user.email,
        assetType: body.assetType,
      });
      const result = await this.definitionService().create(
        {
          assetType: body.assetType,
          name: body.name,
          definition: body.definition as Record<string, any>,
          newAssetId: this.optionalString(body, 'newAssetId'),
          folderId: this.optionalString(body, 'folderId'),
          themeArn: this.optionalString(body, 'themeArn'),
          permissionsFrom: this.parsePermissionsFrom(body.permissionsFrom),
        },
        user
      );
      return successResponse(event, { success: true, data: result });
    } catch (error: any) {
      logger.error('Create from definition failed', { error });
      return this.failure(event, error, 'Failed to create the asset');
    }
  }

  /** POST /authoring/{assetType}/{assetId}/propose */
  public async propose(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const target = this.target(event);
      const body = this.parseBody(event);
      if (typeof body.ask !== 'string') {
        throw badRequest('ask must be a string');
      }
      const candidateDataSetIds = body.candidateDataSetIds;
      if (
        candidateDataSetIds !== undefined &&
        (!Array.isArray(candidateDataSetIds) ||
          candidateDataSetIds.some((id) => typeof id !== 'string'))
      ) {
        throw badRequest('candidateDataSetIds must be an array of strings');
      }

      logger.info('Proposal requested', { user: user.email, ...target });
      // The model can think for longer than the API gateway allows, so the
      // ask runs as a job and the proposal is its result.
      const queued = await jobFactory.createJob({
        jobType: 'planner',
        accountId: this.accountId,
        bucketName: process.env.BUCKET_NAME || `quicksight-metadata-bucket-${this.accountId}`,
        userId: user.userId,
        startedBy: actorLabel(user),
        model: this.parseModel(body.model),
        request: {
          kind: 'propose',
          ...target,
          ask: body.ask,
          candidateDataSetIds: candidateDataSetIds as string[] | undefined,
        },
      });
      return createResponse(event, STATUS_CODES.ACCEPTED, { success: true, data: queued });
    } catch (error: any) {
      logger.error('Propose failed', { error });
      return this.failure(event, error, 'Failed to queue the proposal');
    }
  }

  /** POST /authoring/new/propose - the planner proposes visuals, as a job. */
  public async proposeNew(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const body = this.parseBody(event);
      const request = this.parseNewAssetRequest(body);
      if (!request.ask?.trim()) {
        throw badRequest('ask is required: what the visuals should show, in your words');
      }
      logger.info('Visual proposal requested', {
        user: user.email,
        datasets: request.datasets.length,
      });
      const queued = await jobFactory.createJob({
        jobType: 'planner',
        accountId: this.accountId,
        bucketName: process.env.BUCKET_NAME || `quicksight-metadata-bucket-${this.accountId}`,
        userId: user.userId,
        startedBy: actorLabel(user),
        model: this.parseModel(body.model),
        request: { kind: 'new-visuals', newAsset: { ...request, visuals: undefined } },
      });
      return createResponse(event, STATUS_CODES.ACCEPTED, { success: true, data: queued });
    } catch (error: any) {
      logger.error('Propose visuals failed', { error });
      return this.failure(event, error, 'Failed to queue the proposal');
    }
  }

  /** An ask with no visuals means the planner, which only runs as a job. */
  private assertNoAskInline(request: NewAssetRequest): void {
    if ((request.visuals?.length ?? 0) === 0 && request.ask?.trim()) {
      throw badRequest(
        'An ask runs through the planner as a job: POST /authoring/new/propose, poll GET /jobs/{jobId}, then read GET /jobs/{jobId}/result and send its visuals here.'
      );
    }
  }

  /**
   * GET /authoring/datasets/{dataSetId}/columns
   *
   * The columns a dataset exposes, for building an asset that does not exist
   * yet and so has no definition to read them from. Live first, falling back
   * to the export, exactly as a rebind target is resolved.
   */
  public async getDatasetColumns(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const dataSetId = event.pathParameters?.dataSetId;
      if (!dataSetId) {
        throw badRequest('Dataset id is required');
      }
      const dataset = await this.service().describeTargetDataset(dataSetId);
      return successResponse(event, {
        success: true,
        data: {
          dataSetId: dataset.dataSetId,
          name: dataset.name,
          columns: dataset.columns,
        },
      });
    } catch (error: any) {
      logger.error('Describe dataset columns failed', { error });
      return this.failure(event, error, 'Failed to read the dataset');
    }
  }

  /** POST /authoring/new/preview */
  public async previewNew(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const request = this.parseNewAssetRequest(this.parseBody(event));
      this.assertNoAskInline(request);
      const preview = await this.newAssetService(request).preview(request);
      return successResponse(event, { success: true, data: preview });
    } catch (error: any) {
      logger.error('Preview new asset failed', { error });
      return this.failure(event, error, 'Failed to preview the new asset');
    }
  }

  /** POST /authoring/new */
  public async createNew(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const request = this.parseNewAssetRequest(this.parseBody(event));
      this.assertNoAskInline(request);
      logger.info('Create from scratch requested', {
        user: user.email,
        assetType: request.assetType,
      });
      const result = await this.newAssetService(request).create(request, user);
      return successResponse(event, { success: true, data: result });
    } catch (error: any) {
      logger.error('Create new asset failed', { error });
      return this.failure(event, error, 'Failed to create the asset');
    }
  }

  private newAssetService(request: NewAssetRequest): NewAssetService {
    const rebind = this.service();
    const planner = request.ask ? new PlannerService(rebind, createPlannerModel()) : undefined;
    return new NewAssetService(this.accountId, rebind, planner);
  }

  private parseNewAssetRequest(body: Record<string, unknown>): NewAssetRequest {
    if (typeof body.assetType !== 'string' || !isAuthorableAssetType(body.assetType)) {
      throw badRequest("assetType must be 'dashboard' or 'analysis'");
    }
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw badRequest('name is required');
    }
    const datasets = body.datasets;
    if (
      !Array.isArray(datasets) ||
      datasets.length === 0 ||
      datasets.some(
        (d) =>
          typeof d !== 'object' ||
          d === null ||
          typeof d.identifier !== 'string' ||
          typeof d.dataSetId !== 'string' ||
          (d.shareWithAudience !== undefined && typeof d.shareWithAudience !== 'boolean')
      )
    ) {
      throw badRequest(
        'datasets must be a non-empty array of { identifier, dataSetId, shareWithAudience? }'
      );
    }
    const visuals = body.visuals;
    if (
      visuals !== undefined &&
      (!Array.isArray(visuals) ||
        visuals.some(
          (v) =>
            typeof v !== 'object' ||
            v === null ||
            typeof v.type !== 'string' ||
            typeof v.identifier !== 'string' ||
            !Array.isArray(v.values)
        ))
    ) {
      throw badRequest('visuals must be an array of { type, title, identifier, values[] }');
    }
    if (body.ask !== undefined && typeof body.ask !== 'string') {
      throw badRequest('ask must be a string');
    }
    const permissionsFrom = body.permissionsFrom as Record<string, unknown> | undefined;
    if (
      permissionsFrom !== undefined &&
      (typeof permissionsFrom !== 'object' ||
        permissionsFrom === null ||
        typeof permissionsFrom.assetType !== 'string' ||
        !isAuthorableAssetType(permissionsFrom.assetType) ||
        typeof permissionsFrom.assetId !== 'string')
    ) {
      throw badRequest('permissionsFrom needs assetType and assetId');
    }
    // The contract checked the whole body at the API boundary, so the whole
    // body is the request; only fields that need normalising are re-read.
    // (Re-picking fields one by one is how filters went missing.)
    return {
      ...(body as Partial<NewAssetRequest>),
      assetType: body.assetType,
      name: body.name,
      datasets: datasets as NewAssetRequest['datasets'],
      visuals: visuals as NewAssetRequest['visuals'],
      ask: body.ask as string | undefined,
      sheetName: typeof body.sheetName === 'string' ? body.sheetName : undefined,
      addCalculatedFields: this.parseAddedFields(body.addCalculatedFields),
      template: this.parseTemplate(body.template),
      typeRules: this.parseTypeRules(body.typeRules),
      permissionsFrom: permissionsFrom as NewAssetRequest['permissionsFrom'],
      folderId: typeof body.folderId === 'string' ? body.folderId.trim() || undefined : undefined,
      newAssetId: typeof body.newAssetId === 'string' ? body.newAssetId : undefined,
    };
  }

  private service(): RebindService {
    return new RebindService(this.accountId);
  }

  /** A catalog model key the stack can serve, or undefined for the configured default. */
  private parseModel(raw: unknown): string | undefined {
    if (raw === undefined || raw === null || raw === '') {
      return undefined;
    }
    if (!isAiModelKey(raw)) {
      throw badRequest(
        `model must be one of: ${aiModelViews()
          .map((m) => m.key)
          .join(', ')}`
      );
    }
    const view = aiModelViews().find((m) => m.key === raw);
    if (!view?.available) {
      throw badRequest(
        `${view?.label ?? raw} is not available here. ${view?.unavailableReason ?? ''}`.trim()
      );
    }
    return raw;
  }

  private definitionService(): DefinitionService {
    return new DefinitionService(this.accountId, this.service());
  }

  private optionalString(body: Record<string, unknown>, key: string): string | undefined {
    const value = body[key];
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'string') {
      throw badRequest(`${key} must be a string`);
    }
    return value;
  }

  private parsePermissionsFrom(
    raw: unknown
  ): { assetType: AuthorableAssetType; assetId: string } | undefined {
    if (raw === undefined || raw === null) {
      return undefined;
    }
    const from = raw as Record<string, unknown>;
    if (
      typeof from !== 'object' ||
      typeof from.assetType !== 'string' ||
      !isAuthorableAssetType(from.assetType) ||
      typeof from.assetId !== 'string'
    ) {
      throw badRequest('permissionsFrom needs assetType and assetId');
    }
    return { assetType: from.assetType, assetId: from.assetId };
  }

  private target(event: APIGatewayProxyEvent): Target {
    const { assetType, assetId } = event.pathParameters || {};
    if (!assetType || !isAuthorableAssetType(assetType)) {
      throw badRequest('Asset type must be analysis or dashboard');
    }
    if (!assetId) {
      throw badRequest('Asset id is required');
    }
    return { assetType, assetId };
  }

  private parseBody(event: APIGatewayProxyEvent): Record<string, unknown> {
    try {
      const body = JSON.parse(event.body || '{}');
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        throw badRequest('Request body must be a JSON object');
      }
      return body;
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode) {
        throw error;
      }
      throw badRequest('Request body is not valid JSON');
    }
  }

  private parseRebinds(raw: unknown): RebindRequest[] {
    if (!Array.isArray(raw)) {
      throw badRequest('rebinds must be an array');
    }
    return raw.map((item, index) => {
      const entry = (item ?? {}) as Record<string, unknown>;
      if (typeof entry.identifier !== 'string' || !entry.identifier.trim()) {
        throw badRequest(`rebinds[${index}].identifier is required`);
      }
      if (typeof entry.targetDataSetId !== 'string' || !entry.targetDataSetId.trim()) {
        throw badRequest(`rebinds[${index}].targetDataSetId is required`);
      }
      const columnMap = entry.columnMap;
      if (columnMap !== undefined) {
        if (typeof columnMap !== 'object' || columnMap === null || Array.isArray(columnMap)) {
          throw badRequest(`rebinds[${index}].columnMap must be an object of strings`);
        }
        for (const [from, to] of Object.entries(columnMap)) {
          if (typeof to !== 'string' || !to.trim()) {
            throw badRequest(`rebinds[${index}].columnMap['${from}'] must be a column name`);
          }
        }
      }
      return {
        identifier: entry.identifier.trim(),
        targetDataSetId: entry.targetDataSetId.trim(),
        columnMap: columnMap as Record<string, string> | undefined,
      };
    });
  }

  private parseApplyRequest(body: Record<string, unknown>): ApplyRequest {
    const mode = body.mode;
    if (typeof mode !== 'string' || !APPLY_MODES.has(mode)) {
      throw badRequest("mode must be 'update' or 'clone'");
    }
    if (body.name !== undefined && typeof body.name !== 'string') {
      throw badRequest('name must be a string');
    }
    if (body.newAssetId !== undefined && typeof body.newAssetId !== 'string') {
      throw badRequest('newAssetId must be a string');
    }
    if (body.folderId !== undefined && typeof body.folderId !== 'string') {
      throw badRequest('folderId must be a string');
    }
    return {
      mode: mode as ApplyRequest['mode'],
      rebinds: this.parseRebinds(body.rebinds ?? []),
      name: body.name as string | undefined,
      newAssetId: body.newAssetId as string | undefined,
      addCalculatedFields: this.parseAddedFields(body.addCalculatedFields),
      ops: parseOps(body.ops),
      repairs: parseRepairs(body.repairs),
      template: this.parseTemplate(body.template),
      typeRules: this.parseTypeRules(body.typeRules),
      folderId: (body.folderId as string | undefined)?.trim() || undefined,
    };
  }

  private parseTypeRules(raw: unknown): TypeRules | undefined {
    if (raw === undefined || raw === null) {
      return undefined;
    }
    if (typeof raw !== 'object') {
      throw badRequest('typeRules must be an object');
    }
    const r = raw as Record<string, unknown>;
    const chartFamily = r.chartFamily;
    if (chartFamily !== undefined) {
      if (
        !Array.isArray(chartFamily) ||
        chartFamily.some(
          (x) =>
            typeof x !== 'object' ||
            x === null ||
            typeof x.from !== 'string' ||
            typeof x.to !== 'string'
        )
      ) {
        throw badRequest('typeRules.chartFamily must be an array of { from, to }');
      }
    }
    for (const flag of ['kpi', 'casts'] as const) {
      if (r[flag] !== undefined && typeof r[flag] !== 'boolean') {
        throw badRequest(`typeRules.${flag} must be a boolean`);
      }
    }
    return {
      chartFamily: chartFamily as TypeRules['chartFamily'],
      kpi: r.kpi as boolean | undefined,
      casts: r.casts as boolean | undefined,
    };
  }

  private parseTemplate(raw: unknown): TemplateRequest | undefined {
    if (raw === undefined || raw === null) {
      return undefined;
    }
    if (typeof raw !== 'object') {
      throw badRequest('template must be an object');
    }
    const t = raw as Record<string, unknown>;
    if (
      (t.assetType !== 'dashboard' && t.assetType !== 'analysis') ||
      typeof t.assetId !== 'string' ||
      !t.assetId
    ) {
      throw badRequest("template needs assetType ('dashboard' or 'analysis') and assetId");
    }
    for (const flag of ['textBoxes', 'controls', 'sheetNames', 'kpisFirst', 'theme'] as const) {
      if (t[flag] !== undefined && typeof t[flag] !== 'boolean') {
        throw badRequest(`template.${flag} must be a boolean`);
      }
    }
    return {
      assetType: t.assetType,
      assetId: t.assetId,
      textBoxes: t.textBoxes as boolean | undefined,
      controls: t.controls as boolean | undefined,
      sheetNames: t.sheetNames as boolean | undefined,
      kpisFirst: t.kpisFirst as boolean | undefined,
      theme: t.theme as boolean | undefined,
    };
  }

  private parseAddedFields(added: unknown) {
    if (added !== undefined && !Array.isArray(added)) {
      throw badRequest('addCalculatedFields must be an array');
    }
    return (added ?? []).map((item: unknown, index: number) => {
      const entry = (item ?? {}) as Record<string, unknown>;
      for (const key of ['identifier', 'name', 'expression'] as const) {
        if (typeof entry[key] !== 'string' || !(entry[key] as string).trim()) {
          throw badRequest(`addCalculatedFields[${index}].${key} is required`);
        }
      }
      return {
        identifier: (entry.identifier as string).trim(),
        name: (entry.name as string).trim(),
        expression: (entry.expression as string).trim(),
        templateId: typeof entry.templateId === 'string' ? entry.templateId : undefined,
      };
    });
  }

  private failure(
    event: APIGatewayProxyEvent,
    error: any,
    fallback: string
  ): APIGatewayProxyResult {
    return errorResponse(
      event,
      error?.statusCode || STATUS_CODES.BAD_REQUEST,
      error?.message || fallback
    );
  }
}

function badRequest(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: STATUS_CODES.BAD_REQUEST });
}
