/**
 * The MUI theme, built from the design tokens.
 *
 * Two rules keep the app consistent:
 *   1. Every colour comes from a token via `theme.vars.palette...`. No hex in
 *      components, no hard-coded rgba.
 *   2. The look is applied through component overrides here, so an existing
 *      screen picks up the new buttons, inputs, dialogs and tables without
 *      touching its code.
 *
 * `cssVariables` makes every palette value a CSS custom property and
 * `colorSchemes` gives the same theme a light and a dark answer; the top bar
 * toggles between them with `useColorScheme()`.
 */
import './mui-augmentation';

import { createTheme, type Theme } from '@mui/material/styles';

import { elevation, fontFamily, fontWeight, motion, radius, typeScale } from './tokens/scale';
import { darkColors, lightColors, type SemanticColors } from './tokens/semantic';

/** Palette with CSS variables when available, plain values otherwise (tests, SSR). */
export const pal = (theme: Theme) => (theme.vars ?? theme).palette;

/** `color-mix` keeps alpha tints working with CSS-variable colours. */
const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

const px = (n: number) => `${n}px`;

function paletteFor(c: SemanticColors, mode: 'light' | 'dark') {
  return {
    mode,
    primary: {
      main: c.brand.primary,
      light: c.brand.subtle,
      dark: c.brand.hover,
      contrastText: c.text.onBrand,
    },
    secondary: {
      main: c.text.secondary,
      light: c.surface.hover,
      dark: c.text.primary,
      contrastText: c.text.inverse,
    },
    error: { main: c.status.error.text, light: c.status.error.bg, dark: c.status.error.border },
    warning: {
      main: c.status.warning.text,
      light: c.status.warning.bg,
      dark: c.status.warning.border,
    },
    info: { main: c.status.info.text, light: c.status.info.bg, dark: c.status.info.border },
    success: {
      main: c.status.success.text,
      light: c.status.success.bg,
      dark: c.status.success.border,
    },
    background: { default: c.surface.page, paper: c.surface.container },
    text: {
      primary: c.text.primary,
      secondary: c.text.secondary,
      disabled: c.text.disabled,
      muted: c.text.muted,
      inverse: c.text.inverse,
      link: c.text.link,
      linkHover: c.text.linkHover,
      onBrand: c.text.onBrand,
    },
    divider: c.border.divider,
    action: {
      hover: c.surface.hover,
      selected: c.surface.selected,
      disabled: c.text.disabled,
      disabledBackground: c.surface.disabled,
      focus: tint(c.border.focus, 24),
    },
    surface: c.surface,
    line: c.border,
    brand: c.brand,
    tone: c.status,
    asset: c.asset,
  };
}

const heading = (scale: { size: number; lineHeight: number; weight: number }) => ({
  fontSize: px(scale.size),
  lineHeight: scale.lineHeight,
  fontWeight: scale.weight,
  letterSpacing: 0,
});

export function createAppTheme(): Theme {
  return createTheme({
    cssVariables: { colorSchemeSelector: 'data' },
    colorSchemes: {
      light: { palette: paletteFor(lightColors, 'light') },
      dark: { palette: paletteFor(darkColors, 'dark') },
    },
    shape: { borderRadius: radius.input },
    spacing: 8,
    typography: {
      fontFamily: fontFamily.body,
      fontSize: typeScale.bodyM.size,
      htmlFontSize: 16,
      h1: heading(typeScale.displayL),
      h2: heading(typeScale.headingXl),
      h3: heading(typeScale.headingL),
      h4: heading(typeScale.headingM),
      h5: heading(typeScale.headingS),
      h6: heading(typeScale.headingXs),
      subtitle1: { ...heading(typeScale.headingS), fontWeight: fontWeight.semibold },
      subtitle2: { ...heading(typeScale.headingXs), fontWeight: fontWeight.semibold },
      body1: heading(typeScale.bodyM),
      body2: heading(typeScale.bodyS),
      caption: { ...heading(typeScale.bodyS), fontWeight: fontWeight.regular },
      overline: { ...heading(typeScale.label), textTransform: 'none' },
      button: { ...heading(typeScale.bodyM), fontWeight: fontWeight.bold, textTransform: 'none' },
    },
    transitions: {
      duration: {
        shortest: motion.duration.fast,
        shorter: motion.duration.fast,
        short: motion.duration.normal,
        standard: motion.duration.normal,
        complex: motion.duration.slow,
        enteringScreen: motion.duration.normal,
        leavingScreen: motion.duration.fast,
      },
      easing: {
        easeInOut: motion.easing.standard,
        easeOut: motion.easing.enter,
        easeIn: motion.easing.exit,
        sharp: motion.easing.standard,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: (theme) => ({
          body: {
            backgroundColor: pal(theme).surface.page,
            color: pal(theme).text.primary,
            fontFeatureSettings: '"tnum"',
          },
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: pal(theme).line.default,
            borderRadius: radius.full,
            border: `2px solid ${pal(theme).surface.container}`,
          },
          // DataGrid is styled here rather than via its own theme key so the
          // header treatment follows the tokens without importing x-data-grid
          // types into the theme.
          '.MuiDataGrid-root': {
            border: 'none',
            fontFamily: fontFamily.body,
            '--DataGrid-rowBorderColor': pal(theme).line.divider,
          },
          '.MuiDataGrid-columnHeaders, .MuiDataGrid-columnHeader': {
            backgroundColor: pal(theme).surface.hover,
          },
          '.MuiDataGrid-columnHeaderTitle': {
            fontWeight: fontWeight.bold,
            fontSize: px(typeScale.bodyS.size),
            color: pal(theme).text.secondary,
          },
          '.MuiDataGrid-row:hover': { backgroundColor: pal(theme).surface.hover },
          '.MuiDataGrid-row.Mui-selected': { backgroundColor: pal(theme).surface.selected },
          '.MuiDataGrid-footerContainer': { borderTop: `1px solid ${pal(theme).line.divider}` },
        }),
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: radius.pill,
            fontWeight: fontWeight.bold,
            minHeight: 32,
            paddingInline: 20,
            paddingBlock: 4,
            '&:focus-visible': {
              outline: `2px solid ${pal(theme).line.focus}`,
              outlineOffset: 2,
            },
          }),
          sizeSmall: { minHeight: 28, paddingInline: 14, fontSize: px(typeScale.bodyS.size) },
          sizeLarge: { minHeight: 40, paddingInline: 24 },
          outlined: ({ theme }) => ({
            borderWidth: 2,
            borderColor: pal(theme).brand.primary,
            color: pal(theme).brand.primary,
            paddingInline: 18,
            '&:hover': {
              borderWidth: 2,
              borderColor: pal(theme).brand.hover,
              backgroundColor: pal(theme).brand.subtle,
              color: pal(theme).brand.hover,
            },
            '&.Mui-disabled': { borderWidth: 2 },
          }),
          text: ({ theme }) => ({
            color: pal(theme).brand.primary,
            '&:hover': { backgroundColor: pal(theme).brand.subtle },
          }),
        },
        variants: [
          {
            props: { variant: 'contained', color: 'primary' },
            style: ({ theme }) => ({
              '&:hover': { backgroundColor: pal(theme).brand.hover },
              '&:active': { backgroundColor: pal(theme).brand.active },
            }),
          },
          {
            props: { variant: 'outlined', color: 'inherit' },
            style: ({ theme }) => ({
              borderColor: pal(theme).line.default,
              color: pal(theme).text.primary,
              '&:hover': {
                borderColor: pal(theme).line.strong,
                backgroundColor: pal(theme).surface.hover,
              },
            }),
          },
        ],
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: radius.item,
            '&:focus-visible': { outline: `2px solid ${pal(theme).line.focus}` },
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: ({ theme, ownerState }) => ({
            borderRadius: radius.badge,
            fontWeight: fontWeight.semibold,
            fontSize: px(typeScale.bodyS.size),
            height: 24,
            // Only the neutral chip gets the quiet surface; a coloured filled
            // chip (info, success...) keeps MUI's colour so its text stays legible.
            ...(!ownerState.color || ownerState.color === 'default'
              ? { backgroundColor: pal(theme).surface.hover }
              : {}),
          }),
          sizeSmall: { height: 20 },
          outlined: ({ theme }) => ({
            borderColor: pal(theme).line.default,
            backgroundColor: 'transparent',
          }),
          label: { paddingInline: 8 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: radius.input,
            backgroundColor: pal(theme).surface.input,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: pal(theme).line.default },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: pal(theme).line.strong },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: pal(theme).brand.primary,
              borderWidth: 2,
            },
            '&.Mui-disabled': { backgroundColor: pal(theme).surface.disabled },
          }),
          input: { paddingBlock: 8 },
        },
      },
      MuiInputLabel: {
        styleOverrides: { root: { fontWeight: fontWeight.semibold } },
      },
      MuiFormHelperText: {
        styleOverrides: { root: { marginInline: 2 } },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none' },
          rounded: { borderRadius: radius.container },
          outlined: ({ theme }) => ({ borderColor: pal(theme).line.default }),
          elevation1: { boxShadow: elevation.container },
          elevation8: { boxShadow: elevation.popover },
          elevation24: { boxShadow: elevation.dialog },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: radius.container,
            border: `1px solid ${pal(theme).line.default}`,
            boxShadow: 'none',
          }),
        },
      },
      MuiAccordion: {
        defaultProps: { disableGutters: true, elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            border: `1px solid ${pal(theme).line.default}`,
            borderRadius: radius.container,
            '&::before': { display: 'none' },
            '&.Mui-expanded': { margin: 0 },
            '&:first-of-type, &:last-of-type': { borderRadius: radius.container },
          }),
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: radius.container, boxShadow: elevation.dialog },
        },
      },
      MuiBackdrop: {
        styleOverrides: {
          root: ({ theme }) => ({
            '&:not(.MuiBackdrop-invisible)': { backgroundColor: pal(theme).surface.backdrop },
          }),
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { ...heading(typeScale.headingL), padding: '20px 24px 12px' },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          dividers: ({ theme }) => ({
            borderTopColor: pal(theme).line.divider,
            borderBottomColor: pal(theme).line.divider,
          }),
        },
      },
      MuiDialogActions: {
        styleOverrides: { root: { padding: '16px 24px', gap: 8 } },
      },
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: radius.item,
            border: `1px solid ${pal(theme).line.default}`,
            boxShadow: elevation.popover,
            marginTop: 4,
          }),
          list: { padding: 4 },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: radius.badge,
            fontSize: px(typeScale.bodyM.size),
            minHeight: 36,
            '&:hover': { backgroundColor: pal(theme).surface.hover },
            '&.Mui-selected': {
              backgroundColor: pal(theme).brand.subtle,
              '&:hover': { backgroundColor: pal(theme).brand.subtle },
            },
          }),
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: radius.item,
            border: `1px solid ${pal(theme).line.default}`,
            boxShadow: elevation.popover,
          }),
          option: { minHeight: 36 },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: radius.item,
            border: `1px solid ${pal(theme).line.default}`,
            boxShadow: elevation.popover,
          }),
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: ({ theme }) => ({
            minHeight: 44,
            borderBottom: `1px solid ${pal(theme).line.divider}`,
          }),
          indicator: ({ theme }) => ({
            height: 3,
            borderRadius: '3px 3px 0 0',
            backgroundColor: pal(theme).brand.primary,
          }),
        },
      },
      MuiTab: {
        styleOverrides: {
          root: ({ theme }) => ({
            textTransform: 'none',
            fontWeight: fontWeight.bold,
            fontSize: px(typeScale.bodyM.size),
            minHeight: 44,
            paddingInline: 16,
            color: pal(theme).text.secondary,
            '&.Mui-selected': { color: pal(theme).brand.primary },
            '&:hover': { color: pal(theme).brand.hover },
          }),
        },
      },
      MuiAlert: {
        defaultProps: { variant: 'standard' },
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'solid',
            color: pal(theme).text.primary,
            alignItems: 'flex-start',
            fontSize: px(typeScale.bodyM.size),
          }),
        },
        variants: (['success', 'error', 'warning', 'info'] as const).map((severity) => ({
          props: { variant: 'standard' as const, severity },
          style: ({ theme }: { theme: Theme }) => ({
            backgroundColor: pal(theme).tone[severity].bg,
            borderColor: pal(theme).tone[severity].border,
            '& .MuiAlert-icon': { color: pal(theme).tone[severity].text },
          }),
        })),
      },
      MuiAlertTitle: {
        styleOverrides: { root: { fontWeight: fontWeight.bold, marginBottom: 2 } },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: ({ theme }) => ({
            backgroundColor: pal(theme).surface.inverse,
            color: pal(theme).text.inverse,
            fontSize: px(typeScale.bodyS.size),
            borderRadius: radius.item,
            padding: '6px 10px',
          }),
          arrow: ({ theme }) => ({ color: pal(theme).surface.inverse }),
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: ({ theme }) => ({ borderBottomColor: pal(theme).line.divider }),
          head: ({ theme }) => ({
            fontWeight: fontWeight.bold,
            fontSize: px(typeScale.bodyS.size),
            color: pal(theme).text.secondary,
            backgroundColor: pal(theme).surface.hover,
            borderBottomColor: pal(theme).line.default,
          }),
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: radius.item,
            '&.Mui-selected': {
              backgroundColor: pal(theme).brand.subtle,
              color: pal(theme).brand.primary,
              '& .MuiListItemIcon-root': { color: pal(theme).brand.primary },
              '&:hover': { backgroundColor: pal(theme).brand.subtle },
            },
            '&:focus-visible': { outline: `2px solid ${pal(theme).line.focus}`, outlineOffset: -2 },
          }),
        },
      },
      MuiLink: {
        defaultProps: { underline: 'hover' },
        styleOverrides: {
          root: ({ theme }) => ({
            color: pal(theme).text.link,
            fontWeight: fontWeight.semibold,
            '&:hover': { color: pal(theme).text.linkHover },
          }),
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'default' },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: pal(theme).surface.inverse,
            color: pal(theme).text.inverse,
            backgroundImage: 'none',
          }),
        },
      },
      MuiDivider: {
        styleOverrides: { root: ({ theme }) => ({ borderColor: pal(theme).line.divider }) },
      },
      MuiSwitch: {
        styleOverrides: {
          root: { padding: 8 },
          track: { borderRadius: radius.full },
        },
      },
      MuiSkeleton: {
        styleOverrides: { root: { borderRadius: radius.badge } },
      },
      MuiSnackbarContent: {
        styleOverrides: { root: { borderRadius: radius.item } },
      },
    },
  });
}
