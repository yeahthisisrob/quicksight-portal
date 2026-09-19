/**
 * Extra palette groups the theme exposes on top of MUI's defaults.
 *
 * With CSS variables enabled these become `--mui-palette-surface-page` and
 * friends, and `theme.vars.palette.surface.page` in code, resolving per
 * colour scheme. Components should reach for these before inventing a hex.
 */
import type { AssetColor, SemanticColors, StatusColor } from './tokens/semantic';

declare module '@mui/material/styles' {
  interface Palette {
    surface: SemanticColors['surface'];
    line: SemanticColors['border'];
    brand: SemanticColors['brand'];
    tone: Record<keyof SemanticColors['status'], StatusColor>;
    asset: Record<keyof SemanticColors['asset'], AssetColor>;
  }
  interface TypeText {
    /** Placeholders and hints. */
    muted: string;
    /** Text on the inverse (dark top bar) surface. */
    inverse: string;
    link: string;
    linkHover: string;
    /** Text on a primary button. */
    onBrand: string;
  }
  interface PaletteOptions {
    surface?: SemanticColors['surface'];
    line?: SemanticColors['border'];
    brand?: SemanticColors['brand'];
    tone?: Record<keyof SemanticColors['status'], StatusColor>;
    asset?: Record<keyof SemanticColors['asset'], AssetColor>;
  }
}
