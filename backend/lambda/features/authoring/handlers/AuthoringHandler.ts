import { CloudTrailClient } from '@aws-sdk/client-cloudtrail';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { CloudTrailAdapter } from '../../../adapters/aws/CloudTrailAdapter';
import { CloudWatchAdapter } from '../../../adapters/aws/CloudWatchAdapter';
import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { CacheService } from '../../../shared/services/cache/CacheService';
import { errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { ActivityService } from '../../activity/services/ActivityService';
import { GroupService } from '../../organization/services/GroupService';
import { parseOps } from '../lib/definitionOps';
import { parseRepairs } from '../lib/definitionRepairs';
import { InsightsService } from '../services/InsightsService';
import { createPlannerModel } from '../services/planner/createPlannerModel';
import { PlannerService } from '../services/planner/PlannerService';
import { RebindService } from '../services/RebindService';
import {
  type ApplyRequest,
  type AuthorableAssetType,
  isAuthorableAssetType,
  type RebindRequest,
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
      const planner = new PlannerService(this.service(), createPlannerModel());
      const proposal = await planner.propose(target.assetType, target.assetId, {
        ask: body.ask,
        candidateDataSetIds: candidateDataSetIds as string[] | undefined,
      });
      return successResponse(event, { success: true, data: proposal });
    } catch (error: any) {
      logger.error('Propose failed', { error });
      return this.failure(event, error, 'Failed to build a proposal');
    }
  }

  private service(): RebindService {
    return new RebindService(this.accountId);
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
      folderId: (body.folderId as string | undefined)?.trim() || undefined,
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
