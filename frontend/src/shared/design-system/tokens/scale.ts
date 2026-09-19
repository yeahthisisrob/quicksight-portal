/** Non-colour tokens: spacing, radius, elevation, type scale, motion, layout. */

/** Raw px steps. In `sx`, prefer MUI's `theme.spacing(n)` (8px units). */
export const space = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
} as const;

/** Containers are 16, inputs and list items 8, badges 4, buttons pill. */
export const radius = {
  none: 0,
  badge: 4,
  input: 8,
  item: 8,
  container: 16,
  pill: 20,
  full: 9999,
} as const;

/** Elevation stays flat; shadows only lift popovers and dialogs. */
export const elevation = {
  none: 'none',
  container: '0 1px 1px 0 rgba(0, 7, 22, 0.08), 0 1px 1px 0 rgba(0, 7, 22, 0.04)',
  popover: '0 4px 20px 1px rgba(0, 7, 22, 0.16)',
  dialog: '0 8px 32px 0 rgba(0, 7, 22, 0.24)',
} as const;

export const fontFamily = {
  body: '"Open Sans", "Helvetica Neue", Roboto, Arial, sans-serif',
  mono: '"JetBrains Mono", "Roboto Mono", Menlo, Consolas, monospace',
} as const;

/** Sizes in px at a 16px root; line heights are unitless. */
export const typeScale = {
  displayL: { size: 42, lineHeight: 48 / 42, weight: 700 },
  headingXl: { size: 24, lineHeight: 30 / 24, weight: 700 },
  headingL: { size: 20, lineHeight: 24 / 20, weight: 700 },
  headingM: { size: 18, lineHeight: 22 / 18, weight: 700 },
  headingS: { size: 16, lineHeight: 20 / 16, weight: 700 },
  headingXs: { size: 14, lineHeight: 18 / 14, weight: 700 },
  bodyM: { size: 14, lineHeight: 20 / 14, weight: 400 },
  bodyS: { size: 12, lineHeight: 16 / 12, weight: 400 },
  label: { size: 12, lineHeight: 16 / 12, weight: 700 },
  code: { size: 13, lineHeight: 18 / 13, weight: 400 },
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const motion = {
  duration: { fast: 90, normal: 165, slow: 250 },
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    enter: 'cubic-bezier(0, 0, 0.2, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

export const layout = {
  topBarHeight: 48,
  sidebarWidth: 240,
  sidebarCollapsedWidth: 64,
  contentMaxWidth: 1600,
} as const;
