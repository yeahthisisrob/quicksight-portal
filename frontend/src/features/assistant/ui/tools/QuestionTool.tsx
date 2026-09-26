/**
 * ask_person: the run paused on a question (an AG-UI input_required
 * interrupt), drawn as a human-in-the-loop tool call. It waits for a
 * result; picking an option adds it (`addResult`), which the chat turns
 * into the person's message and the resume entry the next run carries on
 * from. Once answered, the result is the answer and the card is locked.
 */
import { type ToolCallMessagePartComponent, useAuiState } from '@assistant-ui/react';

import type { AgUiResumeEntry } from '@/shared/api/modules/assistant';

import type { QuestionArgs } from '../../model/thread';
import { QuestionCard } from '../QuestionCard';

export const QuestionTool: ToolCallMessagePartComponent<QuestionArgs, AgUiResumeEntry> = ({
  args,
  result,
  addResult,
}) => {
  const busy = useAuiState((s) => s.thread.isRunning);
  const interrupt = args?.interrupt;
  if (!interrupt) return null;
  return (
    <QuestionCard
      interrupt={interrupt}
      answer={result}
      onAnswer={
        busy
          ? undefined
          : (selected, other) =>
              addResult({
                interruptId: interrupt.id,
                status: 'resolved',
                payload: { selected, ...(other?.trim() ? { other: other.trim() } : {}) },
              })
      }
    />
  );
};
