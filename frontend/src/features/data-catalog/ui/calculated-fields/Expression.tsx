/**
 * A calculated field's expression, pretty-printed in a block; the clamped
 * form shows the first lines and offers the rest.
 */
import { Box, Button } from '@mui/material';
import { useState } from 'react';

import { pal } from '@/shared/design-system';

import { prettyExpression } from '../../model/fieldCatalog';

const EXPRESSION_LINES = 6;
const EXPRESSION_CHARS = 360;

export function Expression({ expression }: { expression: string }) {
  return (
    <Box
      component="pre"
      sx={(theme) => ({
        m: 0,
        px: 1.5,
        py: 1.25,
        fontFamily: 'monospace',
        fontSize: theme.typography.body2.fontSize,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        bgcolor: pal(theme).surface.hover,
        border: `1px solid ${pal(theme).line.divider}`,
        borderRadius: `${theme.shape.borderRadius}px`,
      })}
    >
      {prettyExpression(expression)}
    </Box>
  );
}

export function ClampedExpression({ expression }: { expression: string }) {
  const [all, setAll] = useState(false);
  const long =
    expression.split('\n').length > EXPRESSION_LINES || expression.length > EXPRESSION_CHARS;
  return (
    <Box>
      <Box
        sx={
          all || !long
            ? undefined
            : {
                maxHeight: `${EXPRESSION_LINES * 1.6}em`,
                overflow: 'hidden',
                maskImage: 'linear-gradient(black 70%, transparent)',
              }
        }
      >
        <Expression expression={expression} />
      </Box>
      {long && (
        <Button size="small" onClick={() => setAll((v) => !v)} sx={{ mt: 0.5 }}>
          {all ? 'Show less' : 'Show all'}
        </Button>
      )}
    </Box>
  );
}
