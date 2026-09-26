/**
 * Compatibility aliases for the pre-token design system.
 *
 * Everything here is @deprecated. The values are now derived from the tokens
 * in ./tokens so old call sites keep the new look, but they resolve to the
 * LIGHT scheme only - a component still using them will not follow dark
 * mode. Migrate to the MUI theme (`theme.vars.palette.*`, `theme.spacing()`,
 * `theme.shape.borderRadius`) or, outside MUI, to `@/shared/design-system/tokens`.
 * The README has the mapping.
 */
import { alpha } from '@mui/material';

import { assetHue } from './tokens/palette';
import { fontFamily as fontFamilyTokens, motion, radius, space } from './tokens/scale';
import { lightColors } from './tokens/semantic';

const assetTriplet = (key: keyof typeof assetHue) => ({
  main: assetHue[key].main,
  light: assetHue[key].subtle,
  dark: assetHue[key].strong,
});

/**
 * @deprecated Use `theme.vars.palette` (brand, tone, asset, surface, line) or
 * `@/shared/design-system/tokens`. Light scheme only.
 */
export const colors = {
  primary: {
    main: lightColors.brand.primary,
    light: '#89BDEE',
    dark: lightColors.brand.hover,
  },
  assetTypes: {
    dashboard: assetTriplet('dashboard'),
    analysis: assetTriplet('analysis'),
    dataset: assetTriplet('dataset'),
    datasource: assetTriplet('datasource'),
    folder: assetTriplet('folder'),
    user: assetTriplet('user'),
    group: assetTriplet('group'),
    namespace: assetTriplet('namespace'),
    public: assetTriplet('public'),
  },
  status: {
    success: lightColors.status.success.text,
    successLight: '#8CEB9C',
    successDark: '#00580E',
    warning: lightColors.status.warning.text,
    warningLight: '#FFE457',
    warningDark: '#5F4404',
    error: lightColors.status.error.text,
    errorLight: '#FFB2B2',
    errorDark: '#8C0F0F',
    info: lightColors.status.info.text,
    infoLight: '#89BDEE',
    infoDark: lightColors.brand.hover,
  },
  neutral: {
    50: '#FBFBFB',
    100: '#F2F3F3',
    200: '#E9EBED',
    300: '#C6C6CD',
    400: '#8D99A8',
    500: '#7D8998',
    600: '#5F6B7A',
    700: '#414D5C',
    800: '#232F3E',
    900: '#000716',
  },
  background: {
    default: lightColors.surface.container,
    paper: lightColors.surface.hover,
    subtle: lightColors.surface.page,
    hover: '#E9EBED',
  },
};

/** @deprecated Use `theme.spacing(n)` in sx, or `space` from tokens for raw px. */
export const spacing = {
  xs: space.xs,
  sm: space.s,
  md: space.l,
  lg: space.xxl,
  xl: space.xxxl,
  xxl: 48,
};

/** @deprecated Use `theme.typography` variants, or `typeScale` / `fontFamily` from tokens. */
export const typography = {
  fontFamily: {
    primary: fontFamilyTokens.body,
    monospace: fontFamilyTokens.mono,
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

/** @deprecated Use `radius` from tokens (badge 4, input 8, container 16, pill 20). */
export const borderRadius = {
  sm: radius.badge,
  md: radius.input,
  lg: 12,
  xl: radius.container,
  full: '9999px',
};

/** @deprecated Use `theme.transitions` or `motion` from tokens. */
const transitions = {
  fast: `${motion.duration.fast}ms`,
  normal: `${motion.duration.normal}ms`,
  slow: `${motion.duration.slow}ms`,
  easing: {
    easeInOut: motion.easing.standard,
    easeOut: motion.easing.enter,
    easeIn: motion.easing.exit,
  },
};

/** @deprecated The theme's component overrides apply these automatically. */
export const components = {
  dialog: {
    borderRadius: radius.container,
    maxHeight: '80vh',
  },
  chip: {
    height: {
      small: 20,
      medium: 24,
      large: 32,
    },
  },
  paper: {
    hover: {
      transform: 'translateX(4px)',
      transition: `all ${transitions.normal} ${transitions.easing.easeInOut}`,
    },
  },
  /** Bordered container used by page containers and asset tables. */
  container: {
    borderRadius: `${radius.container}px`,
    overflow: 'hidden' as const,
    boxShadow: `0 1px 3px ${alpha(colors.neutral[900], 0.05)}, 0 1px 2px ${alpha(colors.neutral[900], 0.1)}`,
    border: `1px solid ${colors.neutral[200]}`,
    bgcolor: 'background.paper',
  },
};
