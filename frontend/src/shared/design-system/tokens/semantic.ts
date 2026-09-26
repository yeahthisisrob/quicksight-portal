/**
 * Semantic colour tokens, one set per colour scheme.
 *
 * Name things by what they are for, never by what they look like: a component
 * asks for `text.secondary` or `status.error.text` and gets the right value
 * in light and dark. These feed the MUI theme (createAppTheme) and are the
 * only place a hex value belongs.
 */
import { type AssetHueKey, assetHue, blue, green, grey, red, yellow } from './palette';

export interface StatusColor {
  /** Icon and text. */
  text: string;
  /** Tinted background for alerts and badges. */
  bg: string;
  border: string;
}

export interface AssetColor {
  main: string;
  /** Tinted background behind an asset chip or an active nav item. */
  subtle: string;
  /** Text on the subtle background. */
  strong: string;
}

export interface SemanticColors {
  surface: {
    /** The page canvas behind containers. */
    page: string;
    /** Containers, cards, dialogs, table bodies. */
    container: string;
    /** Hovered rows and items. */
    hover: string;
    /** Selected rows and active items. */
    selected: string;
    /** Popovers and menus, lifted above containers. */
    raised: string;
    /** The dark top bar. */
    inverse: string;
    /** Scrims behind dialogs. */
    backdrop: string;
    /** Input fields. */
    input: string;
    /** Disabled controls. */
    disabled: string;
  };
  border: {
    /** Container and input outlines. */
    default: string;
    /** Rows, section separators. */
    divider: string;
    /** Emphasised outlines (hovered inputs, table headers). */
    strong: string;
    /** Keyboard focus ring. */
    focus: string;
  };
  text: {
    primary: string;
    secondary: string;
    /** Placeholders and hints. */
    muted: string;
    disabled: string;
    /** Text on the inverse surface. */
    inverse: string;
    link: string;
    linkHover: string;
    /** Text on a primary button. */
    onBrand: string;
  };
  brand: {
    primary: string;
    hover: string;
    active: string;
    /** Tinted brand background (active nav item, selected segment). */
    subtle: string;
  };
  status: {
    success: StatusColor;
    error: StatusColor;
    warning: StatusColor;
    info: StatusColor;
    pending: StatusColor;
    stopped: StatusColor;
  };
  asset: Record<AssetHueKey, AssetColor>;
}

const lightAssets: Record<AssetHueKey, AssetColor> = { ...assetHue };

/** Dark scheme lifts each asset hue toward its tint so it reads on dark surfaces. */
const darkAssets: Record<AssetHueKey, AssetColor> = {
  dashboard: { main: '#69C24E', subtle: '#173418', strong: '#B8F0A6' },
  analysis: { main: '#B48CF0', subtle: '#2B1F45', strong: '#DCC9FB' },
  dataset: { main: '#539FE5', subtle: '#0F2D4A', strong: '#B5D6F4' },
  datasource: { main: '#E9A15A', subtle: '#3F2A12', strong: '#F8D9B3' },
  folder: { main: '#A6B4C5', subtle: '#2A3441', strong: '#D8DFE8' },
  user: { main: '#E884BF', subtle: '#3F1F31', strong: '#F8C9E3' },
  group: { main: '#4DC1BC', subtle: '#11302F', strong: '#B5EAE7' },
  namespace: { main: '#C48AE3', subtle: '#331F41', strong: '#E7CDF5' },
  public: { main: '#6FA9EA', subtle: '#152B47', strong: '#C4DBF6' },
};

export const lightColors: SemanticColors = {
  surface: {
    page: grey[100],
    container: grey[0],
    hover: grey[50],
    selected: blue[100],
    raised: grey[0],
    inverse: grey[900],
    backdrop: 'rgba(15, 27, 42, 0.6)',
    input: grey[0],
    disabled: grey[100],
  },
  border: {
    default: grey[300],
    divider: grey[150],
    strong: grey[400],
    focus: blue[500],
  },
  text: {
    primary: grey[950],
    secondary: grey[600],
    muted: grey[500],
    disabled: grey[400],
    inverse: grey[50],
    link: blue[500],
    linkHover: blue[600],
    onBrand: grey[0],
  },
  brand: {
    primary: blue[500],
    hover: blue[600],
    active: blue[700],
    subtle: blue[100],
  },
  status: {
    success: { text: green[500], bg: green[100], border: green[500] },
    error: { text: red[500], bg: red[100], border: red[500] },
    warning: { text: yellow[500], bg: yellow[100], border: yellow[500] },
    info: { text: blue[500], bg: blue[100], border: blue[500] },
    pending: { text: grey[600], bg: grey[100], border: grey[400] },
    stopped: { text: grey[600], bg: grey[100], border: grey[400] },
  },
  asset: lightAssets,
};

export const darkColors: SemanticColors = {
  surface: {
    page: grey[900],
    container: grey[850],
    hover: '#1F2B3A',
    selected: '#173553',
    raised: '#1F2B3A',
    inverse: grey[950],
    backdrop: 'rgba(0, 7, 22, 0.7)',
    input: grey[850],
    disabled: '#1A2533',
  },
  border: {
    default: '#414D5C',
    divider: '#2A3746',
    strong: '#5F6B7A',
    focus: blue[400],
  },
  text: {
    primary: '#E9EBED',
    secondary: '#A9B4C1',
    muted: '#8D99A8',
    disabled: '#5F6B7A',
    // The top bar stays dark in the dark scheme, so its text stays light.
    inverse: '#E9EBED',
    link: blue[300],
    linkHover: '#B5D6F4',
    onBrand: grey[950],
  },
  brand: {
    primary: blue[300],
    hover: '#B5D6F4',
    active: blue[400],
    subtle: '#173553',
  },
  status: {
    success: { text: '#69C24E', bg: '#173418', border: '#69C24E' },
    error: { text: '#F08A8A', bg: '#3D1414', border: '#F08A8A' },
    warning: { text: '#F2C94C', bg: '#3D3110', border: '#F2C94C' },
    info: { text: blue[300], bg: '#173553', border: blue[300] },
    pending: { text: '#A9B4C1', bg: '#1F2B3A', border: '#5F6B7A' },
    stopped: { text: '#A9B4C1', bg: '#1F2B3A', border: '#5F6B7A' },
  },
  asset: darkAssets,
};
