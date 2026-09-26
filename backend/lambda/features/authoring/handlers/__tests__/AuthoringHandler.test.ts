import type { APIGatewayProxyEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const preview = vi.fn();

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../../shared/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ email: 'a@example.com' }),
}));
vi.mock('../../services/RebindService', () => ({
  RebindService: vi.fn().mockImplementation(function () {
    return {};
  }),
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
    preview.mockReset().mockResolvedValue({ definition: {} });
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
});
