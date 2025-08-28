# Design System Quick Reference

## Importing Design Tokens

```typescript
import { colors, spacing, typography, borderRadius, shadows } from '@/shared/design-system/theme';
```

## Using Asset Colors

```typescript
// Get colors for a specific asset type
const dashboardColors = colors.assetTypes.dashboard;
// dashboardColors.main - Primary color
// dashboardColors.light - Light variant
// dashboardColors.dark - Dark variant
```

## Using Spacing

Material-UI uses 8px as the base spacing unit. Convert our spacing values:

```typescript
sx={{ 
  p: spacing.md / 8,  // 16px / 8 = 2 spacing units
  mb: spacing.lg / 8, // 24px / 8 = 3 spacing units
}}
```

## Typography

```typescript
sx={{
  fontSize: typography.fontSize.base,
  fontWeight: typography.fontWeight.semibold,
  fontFamily: typography.fontFamily.monospace,
}}
```

## Reusable Components

### AssetChip
```typescript
import { AssetChip } from '@/shared/ui/AssetChip';

// Basic usage
<AssetChip type="DASHBOARD" />

// With count
<AssetChip type="ANALYSIS" count={5} />

// Outlined variant
<AssetChip type="DATASET" variant="outlined" />
```

## Component Patterns

### Consistent Dialog Styling
```typescript
<Dialog
  PaperProps={{
    sx: {
      borderRadius: `${borderRadius.lg}px`,
      maxHeight: '80vh',
    }
  }}
>
```

### Hover Effects
```typescript
sx={{
  transition: 'all 0.2s',
  '&:hover': {
    transform: 'translateX(4px)',
    backgroundColor: alpha(colorConfig.main, 0.05),
  }
}}
```

## Storybook

View all design system components and patterns:

```bash
npm run storybook
```

Navigate to:
- **Shared/Design System/Theme** - View all design tokens
- **Shared/UI/AssetChip** - Reusable asset type component
- **Features/Organization/FolderMembersDialog** - Example of design system usage