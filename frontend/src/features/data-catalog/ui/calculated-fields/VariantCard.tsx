/**
 * One variant of a calculated field's name: its expression, and where it is
 * defined only when asked. The detail pane and the variants dialog both lay
 * these out side by side.
 */
import { Box, Button, Collapse, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import type { CalculatedFieldDetail } from '@/shared/api/modules/data-catalog';
import { pal } from '@/shared/design-system';

import { AssetRefGrid } from './AssetRefGrid';
import { ClampedExpression } from './Expression';

export type FieldVariant = CalculatedFieldDetail['variants'][number];

function VariantCard({
  variant,
  current,
  onOpen,
}: {
  variant: FieldVariant;
  current: boolean;
  onOpen: () => void;
}) {
  const [where, setWhere] = useState(false);
  return (
    <Box
      sx={(theme) => ({
        p: 1.5,
        minWidth: 0,
        border: `1px solid ${current ? pal(theme).brand.primary : pal(theme).line.divider}`,
        borderRadius: `${theme.shape.borderRadius}px`,
        bgcolor: current ? pal(theme).surface.selected : undefined,
      })}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary' }}>
          {current ? 'This one · ' : ''}defined in {variant.definedIn.length}{' '}
          {variant.definedIn.length === 1 ? 'asset' : 'assets'}
        </Typography>
        <Button size="small" onClick={() => setWhere((v) => !v)}>
          {where ? 'Hide where' : 'Show where'}
        </Button>
        {!current && (
          <Button size="small" onClick={onOpen}>
            Open
          </Button>
        )}
      </Stack>
      <ClampedExpression expression={variant.expression} />
      <Collapse in={where} unmountOnExit>
        <Box sx={{ mt: 1 }}>
          <AssetRefGrid assets={variant.definedIn} />
        </Box>
      </Collapse>
    </Box>
  );
}

/** The variants side by side, each card its own height. */
export function VariantGrid({
  variants,
  currentKey,
  onOpen,
}: {
  variants: FieldVariant[];
  currentKey?: string;
  onOpen: (key: string) => void;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          md: 'repeat(auto-fill, minmax(280px, 1fr))',
        },
        // Each card its own height: a one-line variant does not stretch to a long one.
        alignItems: 'start',
        gap: 1.5,
      }}
    >
      {variants.map((variant) => (
        <VariantCard
          key={variant.key}
          variant={variant}
          current={variant.key === currentKey}
          onOpen={() => onOpen(variant.key)}
        />
      ))}
    </Box>
  );
}
