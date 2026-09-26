/**
 * A question the assistant asked (an AG-UI `input_required` interrupt),
 * drawn as cards to click rather than prose to answer: each option with its
 * one-line description and, when it names a portal entity, the graph's
 * summary and a link to open it. Single choice answers on click; multiple
 * choice gathers ticks and sends; "something else" takes typed text. Once
 * answered, the choice stays visible and the cards are locked.
 */
import { CheckCircle, HelpOutlined, OpenInNew, RadioButtonUnchecked } from '@mui/icons-material';
import { Box, Button, Checkbox, Chip, Link, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';

import type {
  AgUiInterrupt,
  AgUiResumeEntry,
  AssistantQuestionOption,
} from '@/shared/api/modules/assistant';
import { pal } from '@/shared/design-system';

function entityKind(entityId: string | undefined): string | undefined {
  const kind = entityId?.split(':')[0];
  return kind ? kind.replace(/-/g, ' ') : undefined;
}

function OptionCard({
  option,
  selected,
  multi,
  locked,
  onClick,
}: {
  option: AssistantQuestionOption;
  selected: boolean;
  multi: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  const kind = entityKind(option.entityId);
  return (
    <Box
      role={multi ? 'checkbox' : 'button'}
      aria-checked={multi ? selected : undefined}
      aria-pressed={multi ? undefined : selected}
      tabIndex={locked ? -1 : 0}
      onClick={locked ? undefined : onClick}
      onKeyDown={(e) => {
        if (!locked && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      sx={(theme) => ({
        p: 1.25,
        minWidth: 0,
        border: 1,
        borderColor: selected ? 'primary.main' : pal(theme).line.divider,
        borderRadius: `${theme.shape.borderRadius}px`,
        bgcolor: selected ? pal(theme).surface.container : 'background.paper',
        cursor: locked ? 'default' : 'pointer',
        opacity: locked && !selected ? 0.55 : 1,
        transition: 'border-color 120ms, background-color 120ms',
        '&:hover': locked ? {} : { borderColor: 'primary.main' },
        '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
      })}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        {multi ? (
          <Checkbox size="small" checked={selected} tabIndex={-1} sx={{ p: 0, mt: '1px' }} />
        ) : selected ? (
          <CheckCircle fontSize="small" color="primary" sx={{ mt: '1px' }} />
        ) : (
          <RadioButtonUnchecked fontSize="small" sx={{ mt: '1px', color: 'text.disabled' }} />
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {option.label}
            </Typography>
            {kind && <Chip size="small" variant="outlined" label={kind} />}
          </Stack>
          {option.description && (
            <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
              {option.description}
            </Typography>
          )}
          {option.summary && (
            <Typography
              variant="caption"
              component="div"
              sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}
            >
              {option.summary}
            </Typography>
          )}
          {option.path && (
            <Link
              href={option.path}
              target="_blank"
              rel="noopener"
              variant="caption"
              onClick={(e) => e.stopPropagation()}
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
            >
              Open <OpenInNew sx={{ fontSize: 12 }} />
            </Link>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

export function QuestionCard({
  interrupt,
  answer,
  onAnswer,
}: {
  interrupt: AgUiInterrupt;
  /** The answer already given, if any: the card is then locked on it. */
  answer?: AgUiResumeEntry;
  /** Absent while the assistant is busy, or in a read-only view. */
  onAnswer?: (selected: string[], other?: string) => void;
}) {
  const options = interrupt.metadata?.options ?? [];
  const multi = interrupt.metadata?.multi === true;
  const allowOther = interrupt.metadata?.allowOther === true;
  const given = (answer?.payload ?? {}) as { selected?: string[]; other?: string };
  const locked = Boolean(answer) || !onAnswer;
  const [ticked, setTicked] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const chosen = answer ? (given.selected ?? []) : ticked;

  const pick = (id: string) => {
    if (multi) {
      setTicked((current) =>
        current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      );
    } else {
      onAnswer?.([id]);
    }
  };
  const canSend = ticked.length > 0 || other.trim() !== '';

  return (
    <Box
      sx={(theme) => ({
        p: 1.5,
        border: 1,
        borderColor: answer ? pal(theme).line.divider : 'primary.main',
        borderRadius: `${Number(theme.shape.borderRadius) * 1.5}px`,
      })}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <HelpOutlined fontSize="small" color={answer ? 'disabled' : 'primary'} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
          {interrupt.message}
        </Typography>
        {answer && (
          <Chip size="small" label={answer.status === 'cancelled' ? 'Dismissed' : 'Answered'} />
        )}
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(240px, 1fr))' },
        }}
      >
        {options.map((option) => (
          <OptionCard
            key={option.id}
            option={option}
            multi={multi}
            locked={locked}
            selected={chosen.includes(option.id)}
            onClick={() => pick(option.id)}
          />
        ))}
      </Box>
      {answer && given.other && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          Something else: {given.other}
        </Typography>
      )}
      {!locked && (allowOther || multi) && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ mt: 1, alignItems: { sm: 'center' } }}
        >
          {allowOther && (
            <TextField
              size="small"
              fullWidth
              placeholder="Something else"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSend) onAnswer?.(ticked, other);
              }}
            />
          )}
          {(multi || allowOther) && (
            <Button
              variant="contained"
              size="small"
              disabled={!canSend}
              onClick={() => onAnswer?.(ticked, other)}
              sx={{ flexShrink: 0 }}
            >
              Send
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );
}
