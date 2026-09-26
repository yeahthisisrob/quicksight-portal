/**
 * Which model does the thinking, picked inline in the composer the way chat
 * apps do it. Two pills: Chat (reads, finds, answers; the cheapest is usually
 * enough) and Builds (drafts what gets built; worth a stronger model). Each
 * opens a menu of models with a rough cost for that kind of work. The choice
 * is kept in the person's browser, so it follows them across the page.
 */
import { Stack } from '@mui/material';

import { ModelPill, useAiModels } from '@/entities/ai-model';

/** The composer's model pills: one for the chat, one for what it builds. */
export function ModelMenu() {
  const models = useAiModels();
  return (
    <Stack direction="row" spacing={0.75} sx={{ minWidth: 0 }}>
      <ModelPill work="chat" models={models} />
      <ModelPill work="authoring" models={models} />
    </Stack>
  );
}
