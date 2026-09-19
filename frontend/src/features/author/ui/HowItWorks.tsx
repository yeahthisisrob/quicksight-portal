/**
 * A collapsible explanation of the flow, one sentence a step. Open by
 * default until a source is chosen, then out of the way.
 */
import { ExpandMore, HelpOutlined } from '@mui/icons-material';
import { Box, ButtonBase, Collapse, Typography } from '@mui/material';
import { useState } from 'react';

import { pal } from '@/shared/design-system';

const STEPS: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: 'Start from what works',
    text: 'Pick a dashboard or analysis; templates and the most viewed ones come first, and slow or failing visuals are flagged before you copy them.',
  },
  {
    title: 'Point it at your data',
    text: 'Choose the datasets the copy should read from, or describe the change in words and let the planner pick them and match the columns.',
  },
  {
    title: 'See and shape the result',
    text: 'The mockup draws the result before it exists; click any card to retitle, retype, move, resize, duplicate or remove it, and every edit is listed in plain language.',
  },
  {
    title: 'Publish into the right place',
    text: 'Create the copy in a folder of your choice, or apply the change in place, and pick up the new asset straight away.',
  },
];

export function HowItWorks({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box
      data-testid="how-it-works"
      sx={(theme) => ({
        border: `1px solid ${pal(theme).line.default}`,
        borderRadius: 2,
        bgcolor: pal(theme).surface.container,
      })}
    >
      <ButtonBase
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        sx={{
          width: '100%',
          justifyContent: 'flex-start',
          gap: 1,
          px: 2,
          py: 1.25,
          borderRadius: 2,
        }}
      >
        <HelpOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography variant="subtitle2" sx={{ flex: 1, textAlign: 'left' }}>
          How this works
        </Typography>
        <ExpandMore
          fontSize="small"
          sx={{
            color: 'text.secondary',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms',
          }}
        />
      </ButtonBase>
      <Collapse in={open}>
        <Box
          component="ol"
          sx={{
            m: 0,
            px: 2,
            pb: 2,
            pl: 4.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            columnGap: 3,
            rowGap: 1,
          }}
        >
          {STEPS.map((step) => (
            <Typography key={step.title} component="li" variant="body2" sx={{ pl: 0.5 }}>
              <Box component="span" sx={{ fontWeight: 600 }}>
                {step.title}.
              </Box>{' '}
              <Box component="span" sx={{ color: 'text.secondary' }}>
                {step.text}
              </Box>
            </Typography>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
