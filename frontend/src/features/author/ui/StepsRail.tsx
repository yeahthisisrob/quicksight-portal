/**
 * The steps rail: numbered, current highlighted, done ticked, reachable
 * steps clickable. Vertical beside the panel; a horizontal stepper on
 * narrow screens.
 */
import { Check } from '@mui/icons-material';
import { alpha, Box, ButtonBase, Typography, useMediaQuery, useTheme } from '@mui/material';

import { AUTHOR_STEPS, type AuthorStep, type StepStatus } from '../model/authorFlow';

interface StepsRailProps {
  status: Record<AuthorStep, StepStatus>;
  onSelect: (step: AuthorStep) => void;
}

const BADGE = 28;

function Badge({ index, status }: { index: number; status: StepStatus }) {
  return (
    <Box
      sx={{
        width: BADGE,
        height: BADGE,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: '0.8125rem',
        fontWeight: 700,
        border: 2,
        borderColor: (t) => (status === 'locked' ? t.palette.divider : t.palette.primary.main),
        bgcolor: (t) =>
          status === 'current' || status === 'done' ? t.palette.primary.main : 'transparent',
        color: (t) =>
          status === 'current' || status === 'done'
            ? t.palette.primary.contrastText
            : status === 'locked'
              ? t.palette.text.disabled
              : t.palette.primary.main,
      }}
    >
      {status === 'done' ? <Check sx={{ fontSize: 16 }} /> : index + 1}
    </Box>
  );
}

export function StepsRail({ status, onSelect }: StepsRailProps) {
  const theme = useTheme();
  const horizontal = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      component="nav"
      aria-label="Author steps"
      sx={{
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        gap: horizontal ? 1 : 0.5,
        overflowX: horizontal ? 'auto' : 'visible',
        pb: horizontal ? 1 : 0,
      }}
    >
      {AUTHOR_STEPS.map((step, index) => {
        const s = status[step.id];
        const locked = s === 'locked';
        return (
          <ButtonBase
            key={step.id}
            disabled={locked}
            onClick={() => onSelect(step.id)}
            aria-current={s === 'current' ? 'step' : undefined}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              textAlign: 'left',
              px: 1.5,
              py: 1.25,
              borderRadius: 2,
              width: horizontal ? 'auto' : '100%',
              flexShrink: 0,
              justifyContent: 'flex-start',
              bgcolor: (t) =>
                s === 'current' ? alpha(t.palette.primary.main, 0.08) : 'transparent',
              '&:hover': {
                bgcolor: (t) => alpha(t.palette.primary.main, s === 'current' ? 0.12 : 0.05),
              },
              opacity: locked ? 0.6 : 1,
            }}
          >
            <Badge index={index} status={s} />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: s === 'current' ? 700 : 600, lineHeight: 1.2 }}
                noWrap
              >
                {step.label}
              </Typography>
              {!horizontal && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                  {step.hint}
                </Typography>
              )}
            </Box>
          </ButtonBase>
        );
      })}
    </Box>
  );
}
