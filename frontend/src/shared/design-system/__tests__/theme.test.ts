import { describe, expect, it } from 'vitest';

import { createAppTheme } from '../createAppTheme';
import { darkColors, lightColors, type SemanticColors } from '../tokens/semantic';

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;
const AA_LARGE = 3;

describe.each<[string, SemanticColors]>([
  ['light', lightColors],
  ['dark', darkColors],
])('%s scheme contrast', (_name, c) => {
  it('body text reads on the page and on containers', () => {
    expect(contrast(c.text.primary, c.surface.page)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(c.text.primary, c.surface.container)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(c.text.secondary, c.surface.container)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('the primary action and links read on containers', () => {
    expect(contrast(c.brand.primary, c.surface.container)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(c.text.link, c.surface.container)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(c.text.onBrand, c.brand.primary)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('text on the inverse (top bar) surface reads', () => {
    expect(contrast(c.text.inverse, c.surface.inverse)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('every status colour reads on its own tinted background', () => {
    for (const tone of Object.values(c.status)) {
      expect(contrast(tone.text, tone.bg)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('every asset colour reads on its subtle background, at least at large size', () => {
    for (const asset of Object.values(c.asset)) {
      expect(contrast(asset.strong, asset.subtle)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast(asset.main, asset.subtle)).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });
});

describe('createAppTheme', () => {
  const built = createAppTheme();
  // `colorSchemes` is on the runtime theme but not on MUI's `Theme` type.
  const theme = built as typeof built & {
    colorSchemes?: Record<'light' | 'dark', { palette: typeof built.palette } | undefined>;
  };

  it('exposes both colour schemes as CSS variables', () => {
    expect(theme.colorSchemes?.light).toBeDefined();
    expect(theme.colorSchemes?.dark).toBeDefined();
    expect(theme.vars?.palette.surface.page).toMatch(/^var\(--/);
    expect(theme.vars?.palette.brand.primary).toMatch(/^var\(--/);
    expect(theme.vars?.palette.tone.error.text).toMatch(/^var\(--/);
    expect(theme.vars?.palette.asset.dashboard.main).toMatch(/^var\(--/);
  });

  it('resolves the light scheme to the light tokens and the dark scheme to the dark tokens', () => {
    expect(theme.colorSchemes?.light?.palette.surface.page).toBe(lightColors.surface.page);
    expect(theme.colorSchemes?.dark?.palette.surface.page).toBe(darkColors.surface.page);
    expect(theme.colorSchemes?.dark?.palette.text.primary).toBe(darkColors.text.primary);
  });

  it('uses the token type scale and radius', () => {
    expect(theme.typography.fontFamily).toContain('Open Sans');
    expect(theme.typography.h2.fontSize).toBe('24px');
    expect(theme.shape.borderRadius).toBe(8);
  });
});
