import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  qs: { createTheme: vi.fn() },
  owner: vi.fn(),
  freshness: vi.fn(),
}));

vi.mock('../../../../shared/services/aws/ClientFactory', () => ({
  ClientFactory: { getQuickSightService: () => mocks.qs },
}));
vi.mock('../../../../shared/services/cache/assetFreshness', () => ({
  keepCacheFresh: mocks.freshness,
}));
vi.mock('../../../../shared/services/identity/IdentityResolver', () => ({
  quickSightUserFor: mocks.owner,
}));
vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import type { PlannerModel } from '../planner/PlannerModel';
import { ThemeService } from '../ThemeService';

const IMAGE = { format: 'png' as const, bytes: new Uint8Array([137, 80, 78, 71]) };

function modelAnswering(output: unknown) {
  const complete = vi.fn(async () => ({ output, model: 'claude-test' }));
  return { model: { complete } as unknown as PlannerModel, complete };
}

describe('ThemeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.qs.createTheme.mockResolvedValue({ arn: 'arn:aws:quicksight:us-east-1:1:theme/x' });
  });

  it('sends the picture to the model and checks what comes back', async () => {
    const { model, complete } = modelAnswering({
      name: 'Acme',
      baseThemeId: 'midnight',
      dataColors: ['#0b6e4f', 'f2a541', '#abc'],
      uiColors: { PrimaryBackground: '#111111', Sparkle: '#FFFFFF' },
      rationale: 'The logo is green on black.',
    });
    const proposal = await new ThemeService('1').propose(model, IMAGE, 'lead with the green');

    const request = (complete.mock.calls[0] as unknown as [Record<string, any>])[0];
    expect(request.images).toEqual([IMAGE]);
    expect(request.user).toContain('lead with the green');
    // Normalised: upper-case hex, short hex expanded, base upper-cased, unknown role dropped.
    expect(proposal).toEqual({
      draft: {
        name: 'Acme',
        baseThemeId: 'MIDNIGHT',
        dataColors: ['#0B6E4F', '#F2A541', '#AABBCC'],
        uiColors: { PrimaryBackground: '#111111' },
      },
      rationale: 'The logo is green on black.',
      model: 'claude-test',
    });
  });

  it('refuses a proposal that is not a theme, with the reasons', async () => {
    const { model } = modelAnswering({ name: '', dataColors: ['red'] });
    await expect(new ThemeService('1').propose(model, IMAGE)).rejects.toThrow(
      /name is required.*every data color must be a hex color/
    );
  });

  it('creates the theme owned by whoever asked, and keeps the cache fresh', async () => {
    mocks.owner.mockResolvedValue({ userName: 'pat', arn: 'arn:user/pat' });
    const created = await new ThemeService('1').create(
      {
        name: 'Acme Brand!',
        dataColors: ['#0B6E4F', '#F2A541'],
        uiColors: { Accent: '#0B6E4F' },
        fontFamily: 'Inter',
      },
      { email: 'pat@example.com' } as never
    );

    const params = mocks.qs.createTheme.mock.calls[0]![0];
    expect(params.themeId).toMatch(/^acme-brand-[0-9a-f]{6}$/);
    expect(params).toMatchObject({
      name: 'Acme Brand!',
      baseThemeId: 'CLASSIC',
      configuration: {
        DataColorPalette: { Colors: ['#0B6E4F', '#F2A541'] },
        UIColorPalette: { Accent: '#0B6E4F' },
        Typography: { FontFamilies: [{ FontFamily: 'Inter' }] },
      },
    });
    expect(params.permissions[0].Principal).toBe('arn:user/pat');
    expect(params.permissions[0].Actions).toContain('quicksight:UpdateTheme');
    expect(created.warnings).toEqual([]);
    expect(mocks.freshness).toHaveBeenCalledWith([
      { assetType: 'theme', assetId: params.themeId, name: 'Acme Brand!' },
    ]);
  });

  it('still creates a theme nobody matched, and says it has no owner yet', async () => {
    mocks.owner.mockResolvedValue(undefined);
    const created = await new ThemeService('1').create({ name: 'x', dataColors: ['#000', '#fff'] });
    expect(mocks.qs.createTheme.mock.calls[0]![0]).not.toHaveProperty('permissions');
    expect(created.warnings[0]).toContain('no owner');
  });
});
