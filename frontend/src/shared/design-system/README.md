# Design system

The portal's look, as code. This folder is the standard new work follows and
the rest of the app migrates to. The direction is AWS Cloudscape, the design
system behind SageMaker Unified Studio: one strong blue for actions, cool
greys for chrome, white containers on a grey page, Open Sans, and status
colours that read at small sizes.

## Principles

1. **Colours come from tokens, through the theme.** A component never holds
   a hex. It asks the theme for a colour by purpose (`text.secondary`,
   `tone.error.text`, `asset.dashboard.main`) and gets the right value in
   light and dark.
2. **The look is applied by the theme, not by each screen.** Buttons,
   inputs, chips, dialogs, tabs, alerts and tables are styled in
   `createAppTheme.ts`, so an existing screen picks up the new look with no
   edits. Reach for a primitive before writing `sx`.
3. **Say what things are.** Containers have headers. Status has an icon and
   a word. Empty states say what would be here. Labels are bold, values are
   body text.
4. **Both schemes, always.** Dark mode is not a promise: every token has a
   dark value and the tests check contrast in both.

## Layout of this folder

```
tokens/           the source of truth
  palette.ts        raw colour scales - never used in components
  semantic.ts       colours by purpose, one set per scheme
  scale.ts          space, radius, elevation, type scale, motion, layout
createAppTheme.ts the MUI theme built from the tokens (CSS variables, light + dark)
mui-augmentation  the extra palette groups the theme exposes
components/       primitives (each with a story)
theme.ts          deprecated aliases for the pre-token exports
```

## Using the theme

```tsx
import { pal } from '@/shared/design-system';

<Box sx={(theme) => ({
  backgroundColor: pal(theme).surface.container,
  border: `1px solid ${pal(theme).line.default}`,
  color: pal(theme).text.secondary,
})} />
```

`pal(theme)` returns `theme.vars.palette` when CSS variables are on (always,
in the app) and `theme.palette` otherwise (tests). Palette groups:

| Group | What it is for |
| --- | --- |
| `brand.primary / hover / active / subtle` | The action colour and its tint |
| `surface.page / container / hover / selected / raised / inverse / input / disabled / backdrop` | Backgrounds |
| `line.default / divider / strong / focus` | Borders |
| `text.primary / secondary / muted / disabled / inverse / link / linkHover / onBrand` | Text |
| `tone.success / error / warning / info / pending / stopped` | `{ text, bg, border }` per status |
| `asset.dashboard / analysis / dataset / ...` | `{ main, subtle, strong }` per asset type |

MUI's own keys (`primary`, `error`, `background`, `text`, `divider`) map to
the same tokens, so `color="text.secondary"` and `bgcolor="background.paper"`
in `sx` are correct too.

Space, radius and type come from the theme as well: `theme.spacing(2)`,
`theme.shape.borderRadius` (8), `variant="h2"` (24px bold). For a raw
number outside MUI, import `tokens` and use `tokens.radius.container`,
`tokens.space.l`, `tokens.layout.topBarHeight`.

Tints: `tint(color, percent)` uses `color-mix`, so it works with
CSS-variable colours where `alpha()` does not.

## Primitives

All exported from `@/shared/design-system`. Stories under *Design System*.

| Component | Use it for |
| --- | --- |
| `Container` | Any surface with a header row: `header`, `description`, `actions`, `footer`, `variant="subtle"`, `disableContentPadding`, `fitHeight` |
| `PageHeader` | The top of a page: `title`, `description`, `counter`, `actions`, `breadcrumbs`, children for tabs |
| `StatusIndicator` | Icon + text for a state: `success`, `error`, `warning`, `info`, `pending`, `stopped`, `in-progress`, `loading` |
| `KeyValuePairs` | Labelled facts in a grid: `items`, `columns` |
| `EmptyState` | What a list shows instead of nothing: `title`, `description`, `icon`, `action` |
| `SegmentedControl` | A single choice between 2-5 short options |
| `TabBar` | Tabs that switch views of one page; sync `value` with `?tab=` |

`PageLayout` (in `shared/ui`) wraps `PageHeader` and is still fine to use.

## Dark mode

The theme is created with `cssVariables` and two `colorSchemes`. The top bar
toggles with `useColorScheme()` and MUI remembers the choice in
localStorage. In Storybook, the toolbar's theme switch sets
`data-mui-color-scheme` on `<html>`, which is what the variables key off.

A component follows dark mode for free as long as its colours come from the
theme. The deprecated aliases below do **not**: they resolve to the light
scheme only.

## Migrating from the old exports

`theme.ts` still exports `colors`, `spacing`, `typography`, `borderRadius`,
`shadows`, `transitions` and `components`, mapped onto the new tokens and
marked `@deprecated`. Replace as you touch a file:

| Old | New |
| --- | --- |
| `colors.primary.main` | `pal(theme).brand.primary` |
| `colors.assetTypes.dashboard.main / .light / .dark` | `pal(theme).asset.dashboard.main / .subtle / .strong` |
| `colors.status.error` | `pal(theme).tone.error.text` |
| `colors.neutral[200]` (a border) | `pal(theme).line.divider` or `.default` |
| `colors.neutral[600]` (text) | `pal(theme).text.secondary` |
| `colors.background.default` | `pal(theme).surface.container` |
| `spacing.md / 8` in `sx` | `2` (MUI units) |
| `typography.fontWeight.semibold` | `600`, or `variant="subtitle2"` |
| `borderRadius.lg` | `tokens.radius.container` or `theme.shape.borderRadius` |
| `shadows.md` | `tokens.elevation.container` |
| hand-rolled bordered `Paper` | `Container` |
| hand-rolled title row | `PageHeader` |
| coloured text for a state | `StatusIndicator` |

## Adding to the system

- A new colour: add it to `tokens/semantic.ts` for **both** schemes, expose it
  through `paletteFor` in `createAppTheme.ts` and, if it is a new group, the
  augmentation. The contrast test will tell you if it does not read.
- A new component look: a `styleOverrides` entry in `createAppTheme.ts`, so
  every instance changes at once.
- A new primitive: `components/<Name>.tsx` with JSDoc and a story, exported
  from `index.ts`, listed in the table above.

## Storybook

`just storybook`, then *Design System / Overview* for tokens and primitives
side by side, and *Design System / <Component>* for each primitive.
