/**
 * A theme as people and models describe it: a name, the QuickSight theme it
 * starts from, the colors data takes in order, the interface colors by
 * role, and a font. Checked here (every color a #RRGGBB hex, roles
 * QuickSight knows) before it becomes QuickSight's configuration, so a
 * model's proposal can never reach CreateTheme malformed.
 *
 * Pure.
 */
import { ValidationError } from '../../../shared/errors/ValidationError';
import { QUICKSIGHT_THEMES } from '../../../shared/services/aws/themeArn';

export interface ThemeDraft {
  name: string;
  baseThemeId: string;
  dataColors: string[];
  uiColors: Record<string, string>;
  fontFamily?: string;
}

/** The interface roles QuickSight themes color (UIColorPalette). */
export const UI_COLOR_ROLES = [
  'PrimaryForeground',
  'PrimaryBackground',
  'SecondaryForeground',
  'SecondaryBackground',
  'Accent',
  'AccentForeground',
  'Danger',
  'DangerForeground',
  'Warning',
  'WarningForeground',
  'Success',
  'SuccessForeground',
  'Dimension',
  'DimensionForeground',
  'Measure',
  'MeasureForeground',
] as const;

const HEX = /^#[0-9A-F]{6}$/;
const MAX_DATA_COLORS = 20;
const MIN_DATA_COLORS = 2;
const NAME_MAX = 512;

/** `#abc`, `abc123`, `#AbC123` -> `#AABBCC` / `#ABC123`; anything else is not a color. */
function hexOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let hex = value.trim().toUpperCase().replace(/^#/, '');
  if (/^[0-9A-F]{3}$/.test(hex)) hex = [...hex].map((c) => c + c).join('');
  return HEX.test(`#${hex}`) ? `#${hex}` : null;
}

/** A draft checked and normalised; refused, with every reason, when it cannot be used. */
export function normaliseThemeDraft(raw: unknown): ThemeDraft {
  const input = (raw ?? {}) as Record<string, unknown>;
  const problems: string[] = [];
  const name = String(input.name ?? '').trim();
  if (!name) problems.push('name is required');
  if (name.length > NAME_MAX) problems.push(`name is longer than ${NAME_MAX} characters`);
  const base = String(input.baseThemeId ?? 'CLASSIC')
    .trim()
    .toUpperCase();
  if (!(QUICKSIGHT_THEMES as readonly string[]).includes(base)) {
    problems.push(`baseThemeId must be one of ${QUICKSIGHT_THEMES.join(', ')}`);
  }
  const dataColors = (Array.isArray(input.dataColors) ? input.dataColors : []).map(hexOf);
  if (dataColors.some((c) => c === null)) problems.push('every data color must be a hex color');
  if (dataColors.length < MIN_DATA_COLORS || dataColors.length > MAX_DATA_COLORS) {
    problems.push(`between ${MIN_DATA_COLORS} and ${MAX_DATA_COLORS} data colors are needed`);
  }
  const uiColors: Record<string, string> = {};
  for (const [role, value] of Object.entries((input.uiColors ?? {}) as Record<string, unknown>)) {
    if (!(UI_COLOR_ROLES as readonly string[]).includes(role)) {
      problems.push(`${role} is not a color role QuickSight knows`);
      continue;
    }
    const hex = hexOf(value);
    if (hex) uiColors[role] = hex;
    else problems.push(`${role} must be a hex color`);
  }
  if (problems.length > 0)
    throw new ValidationError(`The theme cannot be used: ${problems.join('; ')}`);
  const fontFamily = typeof input.fontFamily === 'string' ? input.fontFamily.trim() : '';
  return {
    name,
    baseThemeId: base,
    dataColors: dataColors as string[],
    uiColors,
    ...(fontFamily ? { fontFamily } : {}),
  };
}

/** The draft as QuickSight's ThemeConfiguration. */
export function themeConfiguration(draft: ThemeDraft): Record<string, unknown> {
  return {
    DataColorPalette: { Colors: draft.dataColors },
    ...(Object.keys(draft.uiColors).length ? { UIColorPalette: draft.uiColors } : {}),
    ...(draft.fontFamily
      ? { Typography: { FontFamilies: [{ FontFamily: draft.fontFamily }] } }
      : {}),
  };
}

/** What a model is asked to answer with (the draft, as a JSON schema). */
export const THEME_DRAFT_SCHEMA = {
  type: 'object',
  required: ['name', 'baseThemeId', 'dataColors', 'uiColors'],
  properties: {
    name: { type: 'string', description: 'A short name for the theme' },
    baseThemeId: {
      type: 'string',
      enum: [...QUICKSIGHT_THEMES],
      description: 'CLASSIC for light backgrounds, MIDNIGHT for dark',
    },
    dataColors: {
      type: 'array',
      minItems: MIN_DATA_COLORS,
      maxItems: MAX_DATA_COLORS,
      items: { type: 'string', description: 'A #RRGGBB hex color' },
      description:
        'The colors data series take, most prominent first, distinguishable side by side',
    },
    uiColors: {
      type: 'object',
      description: `Interface colors by role (${UI_COLOR_ROLES.join(', ')}), each #RRGGBB`,
      properties: Object.fromEntries(UI_COLOR_ROLES.map((r) => [r, { type: 'string' }])),
    },
    fontFamily: {
      type: 'string',
      description: 'A web-safe font family, when the image implies one',
    },
    rationale: { type: 'string', description: 'One sentence: what in the image the theme follows' },
  },
} as const;
