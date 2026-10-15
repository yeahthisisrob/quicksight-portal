import type { APIGatewayProxyEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const preview = vi.fn();
const createJob = vi.fn();

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../../shared/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'u-1', email: 'a@example.com' }),
  actorLabel: (auth: { email?: string; userId: string }) => auth.email ?? auth.userId,
}));
vi.mock('../../services/RebindService', () => ({
  RebindService: vi.fn().mockImplementation(function () {
    return {};
  }),
}));
vi.mock('../../../../shared/services/jobs/JobFactory', () => ({
  jobFactory: { createJob: (...args: unknown[]) => createJob(...args) },
}));
vi.mock('../../services/NewAssetService', () => ({
  NewAssetService: vi.fn().mockImplementation(function () {
    return { preview };
  }),
}));

import { AuthoringHandler } from '../AuthoringHandler';

const event = (body: unknown) =>
  ({
    httpMethod: 'POST',
    path: '/api/authoring/new/preview',
    headers: {},
    body: JSON.stringify(body),
  }) as unknown as APIGatewayProxyEvent;

describe('AuthoringHandler', () => {
  beforeEach(() => {
    // Shaped like the real NewAssetPreview: the response is held to the contract.
    preview.mockReset().mockResolvedValue({
      definition: {},
      visuals: [],
      filters: [],
      changes: [],
      outline: [],
      warnings: [],
    });
  });

  it('hands the whole new-asset body to the service: filters, their controls and visual actions survive', async () => {
    const body = {
      assetType: 'analysis',
      name: 'Orders',
      datasets: [{ identifier: 'orders', dataSetId: 'ds-1' }],
      visuals: [
        {
          key: 'detail',
          type: 'Table',
          title: 'Orders',
          identifier: 'orders',
          values: [{ column: 'revenue' }],
          actions: [{ kind: 'filter' }],
        },
      ],
      filters: [
        { identifier: 'orders', column: 'region', control: 'singleSelect', placement: 'canvas' },
      ],
      filterBarTemplateId: 'none',
      visualTemplates: [{ templateId: 't1', identifier: 'orders' }],
    };
    const response = await new AuthoringHandler().previewNew(event(body));
    expect(response.statusCode).toBe(200);
    expect(preview).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: body.filters,
        visuals: body.visuals,
        filterBarTemplateId: 'none',
        visualTemplates: body.visualTemplates,
      })
    );
  });

  it('queues a restore as a job, as the person asking, instead of running it inside the request', async () => {
    createJob
      .mockReset()
      .mockResolvedValue({ jobId: 'job-1', status: 'queued', message: 'queued' });
    const restoreEvent = {
      ...event({ ops: [], newAssetId: 'dash-2', name: 'Orders (restored)' }),
      path: '/api/authoring/dashboard/dash-1/restore',
      pathParameters: { assetType: 'dashboard', assetId: 'dash-1' },
    } as unknown as APIGatewayProxyEvent;
    const response = await new AuthoringHandler().restore(restoreEvent);
    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.body).data.jobId).toBe('job-1');
    expect(createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: 'planner',
        auth: expect.objectContaining({ email: 'a@example.com' }),
        request: expect.objectContaining({
          kind: 'restore',
          assetType: 'dashboard',
          assetId: 'dash-1',
          request: expect.objectContaining({ newAssetId: 'dash-2', name: 'Orders (restored)' }),
        }),
      })
    );
  });
});
