/**
 * Which model does the thinking, picked inline in the composer the way chat
 * apps do it. Two pills: Chat (reads, finds, answers; the cheapest is usually
 * enough) and Builds (drafts what gets built; worth a stronger model). Each
 * opens a menu of models with a rough cost for that kind of work. The choice
 * is kept in the person's browser, so it follows them across the page.
 */
import { AutoAwesome, ChatBubbleOutlineOutlined, Check, ExpandMore } from '@mui/icons-material';
import {
  Box,
  ButtonBase,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useId, useState } from 'react';

import { assistantApi } from '@/shared/api';
import type { AiModel, AiModelKey } from '@/shared/api/modules/assistant';
import { pal } from '@/shared/design-system';
import { useAiModel } from '@/shared/lib';

import { formatCost } from './costFormat';

const AI_MODELS_QUERY_KEY = ['assistant-models'] as const;

type Work = 'chat' | 'authoring';

const WORK: Record<Work, { name: string; hint: string; icon: ReactNode; per: string }> = {
  chat: {
    name: 'Chat',
    hint: 'Chat: reads, finds and answers. The cheapest is usually enough.',
    icon: <ChatBubbleOutlineOutlined sx={{ fontSize: 16 }} />,
    per: 'a message',
  },
  authoring: {
    name: 'Builds',
    hint: 'Builds: drafts what gets built (visuals, filters, controls, interactions). Worth a stronger model.',
    icon: <AutoAwesome sx={{ fontSize: 16 }} />,
    per: 'a build',
  },
};

/** "Claude Haiku 4.5" reads as "Haiku 4.5" in a pill. */
function shortName(model: AiModel | undefined, key: AiModelKey): string {
  return model ? model.label.replace(/^Claude\s+/, '') : key;
}

function ModelPill({ work, models }: { work: Work; models: AiModel[] }) {
  const [selected, setSelected] = useAiModel(work);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const menuId = useId();
  const { name, hint, icon, per } = WORK[work];
  const current = models.find((m) => m.key === selected);
  const short = shortName(current, selected);

  return (
    <>
      <Tooltip title={hint} disableInteractive>
        <ButtonBase
          aria-label={`${name} model: ${short}`}
          aria-haspopup="menu"
          aria-controls={anchor ? menuId : undefined}
          aria-expanded={anchor ? 'true' : undefined}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={(theme) => ({
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            minWidth: 0,
            height: 28,
            px: { xs: 0.75, sm: 1 },
            borderRadius: 999,
            border: `1px solid ${pal(theme).line.default}`,
            color: 'text.secondary',
            typography: 'caption',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            transition: 'border-color 120ms, background-color 120ms',
            '&:hover': { bgcolor: pal(theme).surface.hover, color: 'text.primary' },
            '&:focus-visible': { outline: `2px solid ${pal(theme).line.focus}`, outlineOffset: 1 },
          })}
        >
          <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0 }}>
            {icon}
          </Box>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            {name} ·
          </Box>
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {short}
          </Box>
          <ExpandMore sx={{ fontSize: 16, flexShrink: 0, display: { xs: 'none', sm: 'block' } }} />
        </ButtonBase>
      </Tooltip>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 340, maxWidth: 'calc(100vw - 32px)' } } }}
      >
        <Typography
          variant="caption"
          component="div"
          sx={{ px: 2, pt: 0.5, pb: 1, color: 'text.secondary' }}
        >
          {hint}
        </Typography>
        {models.map((model) => (
          <MenuItem
            key={model.key}
            selected={model.key === selected}
            disabled={!model.available}
            onClick={() => {
              setSelected(model.key);
              setAnchor(null);
            }}
            sx={{ alignItems: 'flex-start', whiteSpace: 'normal' }}
          >
            <ListItemIcon sx={{ mt: 0.25 }}>
              {model.key === selected && <Check fontSize="small" color="primary" />}
            </ListItemIcon>
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {model.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                    ~{formatCost(model.typicalCost[work])} {per}
                  </Typography>
                </Stack>
              }
              secondary={
                model.available ? model.bestFor : (model.unavailableReason ?? model.bestFor)
              }
              slotProps={{ secondary: { variant: 'caption', component: 'div' } }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/** The composer's model pills: one for the chat, one for what it builds. */
export function ModelMenu() {
  const catalog = useQuery({ queryKey: AI_MODELS_QUERY_KEY, queryFn: () => assistantApi.models() });
  const models = catalog.data?.models ?? [];
  return (
    <Stack direction="row" spacing={0.75} sx={{ minWidth: 0 }}>
      <ModelPill work="chat" models={models} />
      <ModelPill work="authoring" models={models} />
    </Stack>
  );
}
