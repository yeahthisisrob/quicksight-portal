/**
 * Which model does the thinking. Authoring (the planner behind "describe
 * it" in the Studio and the propose calls) and the chat each have their own
 * choice, kept in the person's browser. Every option shows its list price
 * and a rough cost for a typical call, so the choice is made with the bill
 * in view.
 */
import { Alert, Box, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { assistantApi } from '@/shared/api';
import type { AiModel } from '@/shared/api/modules/assistant';
import { Container } from '@/shared/design-system';
import { useAiModel } from '@/shared/lib';

import { formatCost } from './costFormat';

const AI_MODELS_QUERY_KEY = ['assistant-models'] as const;

function ModelCard({
  model,
  selected,
  onSelect,
}: {
  model: AiModel;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Box
      role="radio"
      aria-checked={selected}
      aria-disabled={!model.available}
      tabIndex={model.available ? 0 : -1}
      onClick={() => model.available && onSelect()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && model.available) {
          e.preventDefault();
          onSelect();
        }
      }}
      sx={{
        border: 2,
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 2,
        p: 1.5,
        cursor: model.available ? 'pointer' : 'not-allowed',
        opacity: model.available ? 1 : 0.55,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {model.label}
        </Typography>
        {selected && <Chip size="small" color="primary" label="Selected" />}
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
        {model.bestFor}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        ~{formatCost(model.typicalCost.authoring)}
        <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>
          per ask
        </Typography>
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        ${model.price.input} in / ${model.price.output} out per 1M tokens
        {model.thinks ? ' · thinks first' : ''}
      </Typography>
      {!model.available && model.unavailableReason && (
        <Typography variant="caption" sx={{ color: 'warning.main' }}>
          {model.unavailableReason}
        </Typography>
      )}
    </Box>
  );
}

export function ModelPicker() {
  const catalog = useQuery({ queryKey: AI_MODELS_QUERY_KEY, queryFn: () => assistantApi.models() });
  const [authoring, setAuthoring] = useAiModel('authoring');
  const [chat, setChat] = useAiModel('chat');
  const models = catalog.data?.models ?? [];

  return (
    <Container
      header="Models"
      description="Which model does the thinking. Your choice is kept in this browser and used by the Studio's planner, the chat, and the costs shown with each answer."
    >
      <Stack spacing={2}>
        {catalog.error && <Alert severity="warning">The model list could not be loaded.</Alert>}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Authoring: proposing rebinds, mapping columns, visuals from an ask
          </Typography>
          <Box
            role="radiogroup"
            aria-label="Authoring model"
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(5, minmax(0, 1fr))',
              },
              gap: 1.5,
            }}
          >
            {models.map((model) => (
              <ModelCard
                key={model.key}
                model={model}
                selected={authoring === model.key}
                onSelect={() => setAuthoring(model.key)}
              />
            ))}
          </Box>
        </Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <TextField
            select
            size="small"
            label="Chat"
            value={models.length ? chat : ''}
            onChange={(e) => setChat(e.target.value as typeof chat)}
            sx={{ minWidth: 280 }}
          >
            {models.map((model) => (
              <MenuItem key={model.key} value={model.key} disabled={!model.available}>
                {model.label} · ~{formatCost(model.typicalCost.chat)} a message
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {catalog.data?.note ??
              'List prices; Bedrock bills at its own rates, so these are rough.'}{' '}
            A chat message reads a few things and answers; the cheapest model is usually enough.
          </Typography>
        </Stack>
      </Stack>
    </Container>
  );
}
