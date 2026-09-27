import { describe, expect, it } from 'vitest';

import { ThemeParser } from '../ThemeParser';

describe('ThemeParser', () => {
  it('keeps what a theme looks like: its base, colors by order and by role, and font', () => {
    const metadata = new ThemeParser().extractThemeMetadata(
      { themeId: 'brand', name: 'Brand', arn: 'arn:theme/brand' },
      {
        ThemeId: 'brand',
        Name: 'Brand',
        Arn: 'arn:theme/brand',
        Version: {
          VersionNumber: 3,
          BaseThemeId: 'MIDNIGHT',
          Configuration: {
            DataColorPalette: { Colors: ['#0B6E4F', '#F2A541', 7] },
            UIColorPalette: { PrimaryBackground: '#111111', Accent: '#0B6E4F', Broken: null },
            Typography: { FontFamilies: [{ FontFamily: 'Inter' }] },
          },
        },
      }
    );
    expect(metadata).toMatchObject({
      assetId: 'brand',
      name: 'Brand',
      baseThemeId: 'MIDNIGHT',
      versionNumber: 3,
      dataColors: ['#0B6E4F', '#F2A541'],
      uiColors: { PrimaryBackground: '#111111', Accent: '#0B6E4F' },
      fontFamily: 'Inter',
    });
  });

  it('reads a theme QuickSight has not described yet from its summary alone', () => {
    const metadata = new ThemeParser().extractThemeMetadata({ themeId: 't', name: 'T' }, undefined);
    expect(metadata).toMatchObject({
      assetId: 't',
      name: 'T',
      baseThemeId: 'CLASSIC',
      dataColors: [],
    });
    expect(metadata).not.toHaveProperty('fontFamily');
  });
});
