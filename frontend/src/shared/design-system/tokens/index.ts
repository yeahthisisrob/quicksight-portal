/**
 * Design tokens - the single source of truth for how the portal looks.
 *
 *   tokens/palette.ts   raw colour scales (never used in components)
 *   tokens/semantic.ts  colours by purpose, per colour scheme
 *   tokens/scale.ts     space, radius, elevation, type scale, motion, layout
 *
 * Components consume tokens through the MUI theme (`theme.vars.palette...`,
 * `theme.spacing()`, `theme.shape`) so light and dark resolve automatically.
 * Import from here only for the rare non-MUI case: a canvas, an SVG, a
 * constant.
 */
export type { AssetHueKey } from './palette';
export { layout } from './scale';
