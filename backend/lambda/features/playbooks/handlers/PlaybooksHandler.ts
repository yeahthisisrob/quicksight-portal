/**
 * /playbooks: what there is, preview one, run a preview, read a job's rows.
 * Previews and runs are jobs (202 + jobId): they can take longer than a web
 * request, and the worker picks up where a paused one stopped.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { type AuthContext, actorLabel, requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { jobFactory } from '../../../shared/services/jobs/JobFactory';
import { type JobItemStatus, JobItemStore } from '../../../shared/services/jobs/JobItemStore';
import { JobRepository } from '../../../shared/services/jobs/JobRepository';
import { createResponse, errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { findPlaybook, listPlaybooks } from '../catalog';
import { gatesOf } from '../engine/gates';
import type { Playbook, PlaybookJobRequest, RunLimits } from '../types';

const ITEM_STATUSES = new Set<JobItemStatus>([
  'pending',
  'planned',
  'done',
  'failed',
  'skipped',
  'review',
]);
const MAX_PAGE = 500;
const MAX_CONCURRENCY = 10;

class BadRequest extends Error {}

function describe(playbook: Playbook) {
  return {
    id: playbook.id,
    title: playbook.title,
    description: playbook.description,
    category: playbook.category,
    params: playbook.params,
    gates: gatesOf(playbook),
    writes: playbook.writes,
    deletes: playbook.deletes === true,
  };
}

function playbookOf(event: APIGatewayProxyEvent): Playbook {
  const id = event.pathParameters?.playbookId ?? '';
  const playbook = findPlaybook(id);
  if (!playbook) {
    throw Object.assign(new BadRequest(`There is no playbook '${id}'`), {
      statusCode: STATUS_CODES.NOT_FOUND,
    });
  }
  return playbook;
}

function checkParams(playbook: Playbook, params: Record<string, unknown>): void {
  for (const param of playbook.params) {
    const value = params[param.key];
    if (param.required && (value === undefined || value === null || value === '')) {
      throw new BadRequest(`${param.label} is required`);
    }
  }
}

function limitsOf(raw: any): Partial<RunLimits> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const limits: Partial<RunLimits> = {};
  if (Number.isInteger(raw.concurrency)) {
    limits.concurrency = Math.min(MAX_CONCURRENCY, Math.max(1, raw.concurrency));
  }
  if (typeof raw.failureThreshold === 'number') {
    limits.failureThreshold = Math.min(1, Math.max(0, raw.failureThreshold));
  }
  if (Number.isInteger(raw.failureMinimum)) {
    limits.failureMinimum = Math.max(1, raw.failureMinimum);
  }
  return limits;
}

function jobAuth(user: AuthContext) {
  return {
    userId: user.userId,
    accountId: user.accountId,
    ...(user.email ? { email: user.email } : {}),
    ...(user.groups ? { groups: user.groups } : {}),
    ...(user.apiKey ? { apiKey: user.apiKey } : {}),
  };
}

export class PlaybooksHandler {
  private readonly accountId = process.env.AWS_ACCOUNT_ID || '';
  private readonly bucketName =
    process.env.BUCKET_NAME || `quicksight-metadata-bucket-${process.env.AWS_ACCOUNT_ID || ''}`;

  /** GET /playbooks */
  public async list(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      return successResponse(event, { success: true, data: listPlaybooks().map(describe) });
    } catch (error) {
      return this.fail(event, error, 'Could not list the playbooks');
    }
  }

  /** POST /playbooks/{playbookId}/preview { params, gates } */
  public async preview(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const playbook = playbookOf(event);
      const body = JSON.parse(event.body || '{}');
      const params = (body.params ?? {}) as Record<string, unknown>;
      checkParams(playbook, params);
      const request: PlaybookJobRequest = {
        mode: 'preview',
        playbookId: playbook.id,
        params,
        ...(body.gates ? { gates: body.gates } : {}),
      };
      return await this.start(event, user, request);
    } catch (error) {
      return this.fail(event, error, 'Could not start the preview');
    }
  }

  /**
   * POST /playbooks/{playbookId}/run { previewJobId, keys?, retryOf?, limits? }
   * The parameters are the preview's, read from its job: a run applies
   * exactly what was previewed.
   */
  public async run(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const playbook = playbookOf(event);
      const body = JSON.parse(event.body || '{}');
      const jobs = new JobRepository();
      const preview = await jobs.getJob(String(body.previewJobId ?? ''));
      if (preview?.playbook?.mode !== 'preview' || preview.playbook.playbookId !== playbook.id) {
        throw new BadRequest(`Run a preview of ${playbook.title} first, and pass its job id`);
      }
      if (preview.status !== 'completed') {
        throw new BadRequest('That preview has not finished');
      }
      if (body.retryOf !== undefined) {
        const earlier = await jobs.getJob(String(body.retryOf));
        if (earlier?.playbook?.mode !== 'run' || earlier.playbook.previewJobId !== preview.jobId) {
          throw new BadRequest('Only a run of this same preview can be retried');
        }
      }
      if (
        body.keys !== undefined &&
        !(Array.isArray(body.keys) && body.keys.every((k: unknown) => typeof k === 'string'))
      ) {
        throw new BadRequest('keys must be a list of item keys');
      }
      const limits = limitsOf(body.limits);
      const request: PlaybookJobRequest = {
        mode: 'run',
        playbookId: playbook.id,
        params: (preview.playbook.params ?? {}) as Record<string, unknown>,
        previewJobId: preview.jobId,
        ...(body.keys ? { keys: body.keys } : {}),
        ...(body.retryOf ? { retryOf: String(body.retryOf) } : {}),
        ...(limits ? { limits } : {}),
      };
      return await this.start(event, user, request);
    } catch (error) {
      return this.fail(event, error, 'Could not start the run');
    }
  }

  /** GET /playbooks/runs/{jobId}/items?status=&verdict=&cursor=&limit= */
  public async items(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const jobId = event.pathParameters?.jobId ?? '';
      const job = await new JobRepository().getJob(jobId);
      if (!job?.playbook) {
        throw Object.assign(new BadRequest(`No playbook job '${jobId}'`), {
          statusCode: STATUS_CODES.NOT_FOUND,
        });
      }
      const q = event.queryStringParameters ?? {};
      const status = q.status as JobItemStatus | undefined;
      if (status && !ITEM_STATUSES.has(status)) {
        throw new BadRequest(`Unknown status '${status}'`);
      }
      const verdict = q.verdict;
      if (verdict && !['change', 'review', 'skip'].includes(verdict)) {
        throw new BadRequest(`Unknown verdict '${verdict}'`);
      }
      const limit = q.limit ? Math.min(MAX_PAGE, Math.max(1, Number(q.limit) || 0)) : undefined;
      const page = await new JobItemStore().page(jobId, {
        ...(status ? { status } : {}),
        ...(verdict ? { verdict: verdict as 'change' | 'review' | 'skip' } : {}),
        ...(q.cursor ? { cursor: q.cursor } : {}),
        ...(limit ? { limit } : {}),
      });
      return successResponse(event, {
        success: true,
        data: {
          jobId,
          playbookId: job.playbook.playbookId,
          mode: job.playbook.mode,
          status: job.status,
          ...page,
        },
      });
    } catch (error) {
      return this.fail(event, error, 'Could not read the rows');
    }
  }

  private async start(
    event: APIGatewayProxyEvent,
    user: AuthContext,
    request: PlaybookJobRequest
  ): Promise<APIGatewayProxyResult> {
    const job = await jobFactory.createJob({
      jobType: 'playbook',
      accountId: this.accountId,
      bucketName: this.bucketName,
      userId: user.userId,
      startedBy: actorLabel(user),
      request,
      auth: jobAuth(user),
    });
    return createResponse(event, STATUS_CODES.ACCEPTED, {
      success: true,
      jobId: job.jobId,
      status: job.status,
    });
  }

  private fail(event: APIGatewayProxyEvent, error: unknown, fallback: string) {
    const status =
      (error as { statusCode?: number })?.statusCode ??
      (error instanceof BadRequest || error instanceof SyntaxError
        ? STATUS_CODES.BAD_REQUEST
        : STATUS_CODES.INTERNAL_SERVER_ERROR);
    if (status >= STATUS_CODES.INTERNAL_SERVER_ERROR) {
      logger.error(fallback, { error });
    }
    return errorResponse(event, status, (error as Error)?.message || fallback);
  }
}
