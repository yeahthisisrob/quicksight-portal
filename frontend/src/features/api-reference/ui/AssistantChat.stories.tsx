import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { type MockRoute, mockApi } from '../../../../.storybook/mocks/api';
import {
  assistantRoutes,
  DATASET_QUESTION,
  PLANNED_ANSWER,
  QUESTION_ANSWER,
  SCRIPTED_ANSWER,
} from './__stories__/assistant';
import { AnswerView, AssistantChat } from './AssistantChat';
import { ModelPicker } from './ModelPicker';

function Mocked({ routes, children }: { routes: MockRoute[]; children: React.ReactNode }) {
  const [restore] = useState(() => mockApi(routes));
  useEffect(() => restore, [restore]);
  return <>{children}</>;
}

/**
 * Ask the portal. Click a suggestion: the assistant reads, draws a
 * calculated field's lineage, previews a copy as a wireframe, and prepares
 * the publish beside it for you to confirm and run.
 */
const meta: Meta<typeof AssistantChat> = {
  title: 'Features/Author/Assistant chat',
  component: AssistantChat,
  parameters: { layout: 'padded' },
  decorators: [
    // Stories share one origin: start each from an empty conversation (the
    // Working story seeds its own inside this).
    (Story) => {
      window.localStorage.removeItem('qsp.assistant.conversation.v1');
      return <Story />;
    },
    (Story) => (
      <Mocked routes={assistantRoutes()}>
        <div style={{ maxWidth: 1100 }}>
          <Story />
        </div>
      </Mocked>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { name: 'Suggestions, before the first message' };

/** A finished answer: the lineage it traced, the preview drawn, and the publish beside it. */
export const Answered: Story = {
  name: 'An answer: lineage, a previewed copy, and Run to confirm',
  render: () => <AnswerView result={SCRIPTED_ANSWER as never} />,
};

/** Plans before it builds: the lineage from the SMUS listing, the field verdicts, then the change. */
export const Planned: Story = {
  name: 'A plan on the governed dataset, with field verdicts',
  render: () => <AnswerView result={PLANNED_ANSWER as never} />,
};

/** Asks instead of guessing: the options are cards, each with what the portal knows about it. */
export const AsksAQuestion: Story = {
  name: 'Asks a question: options as cards',
  render: () => <AnswerView result={QUESTION_ANSWER as never} onAnswer={() => undefined} />,
};

/** After the answer: the choice stays, locked. */
export const QuestionAnswered: Story = {
  name: 'A question already answered',
  render: () => (
    <AnswerView
      result={QUESTION_ANSWER as never}
      answerFor={(id) =>
        id === DATASET_QUESTION.id
          ? {
              interruptId: id,
              status: 'resolved',
              payload: { selected: ['dataset:ds-orders-gold'] },
            }
          : undefined
      }
    />
  ),
};

/** The same answer after Run: the card follows the job it started, then says how it ended. */
export const ActionRunning: Story = {
  name: 'An action following its job',
  render: () => (
    <AnswerView
      result={SCRIPTED_ANSWER as never}
      runs={{ 'act-1': { status: 'running', jobId: 'grant-7', message: 'Queued' } }}
      onRun={() => undefined}
      onFollowUp={() => undefined}
    />
  ),
};

export const ActionDone: Story = {
  name: 'An action that finished, ready to hand back',
  render: () => (
    <AnswerView
      result={SCRIPTED_ANSWER as never}
      runs={{
        'act-1': {
          status: 'completed',
          jobId: 'grant-7',
          result: { assetId: 'sales-overview-gold', granted: 5 },
        },
      }}
      onRun={() => undefined}
      onFollowUp={() => undefined}
    />
  ),
};

/** A create that finished: what it made, a way to open it, and what it warned about. */
export const Created: Story = {
  name: 'A create that finished: the new analysis, and its warnings',
  render: () => (
    <AnswerView
      result={PLANNED_ANSWER as never}
      runs={{
        'act-plan': {
          status: 'completed',
          result: {
            assetType: 'analysis',
            assetId: 'margin-by-region',
            name: 'Margin by region',
            arn: 'arn:aws:quicksight:us-east-1:1:analysis/margin-by-region',
            changes: [],
            warnings: [
              'Filter on revenue left out: a number filter needs min and max for its slider.',
            ],
            folderId: 'shared-sales',
          },
        },
      }}
      onRun={() => undefined}
      onFollowUp={() => undefined}
    />
  ),
};

/** Waiting on an answer: what it is doing, and for how long. */
export const Working: Story = {
  name: 'Working: the assistant says what it is doing',
  decorators: [
    (Story) => {
      window.localStorage.setItem(
        'qsp.assistant.conversation.v1',
        JSON.stringify({
          version: 1,
          entries: [{ role: 'user', text: 'Run the propose for sales overview onto gold' }],
          pending: { jobId: 'assistant-working', since: Date.now() - 23_000 },
          runs: {},
        })
      );
      return <Story />;
    },
  ],
};

/** An answer that stopped on what it would do next: the chat says nothing is running and offers to continue. */
export const StoppedOnAPromise: Story = {
  name: 'Stopped on a promise: nothing running, Continue',
  decorators: [
    (Story) => {
      window.localStorage.setItem(
        'qsp.assistant.conversation.v1',
        JSON.stringify({
          version: 1,
          entries: [
            { role: 'user', text: 'Run the propose for sales overview onto gold' },
            {
              role: 'assistant',
              text: 'The planner could not map order_date. Let me check the exact column names and try a simpler approach.',
              result: {
                ...SCRIPTED_ANSWER,
                reply:
                  'The planner could not map order_date. Let me check the exact column names and try a simpler approach.',
                artifacts: [],
                actions: [],
              },
            },
          ],
          runs: {},
        })
      );
      return <Story />;
    },
  ],
};

export const Models: Story = {
  name: 'The model picker',
  render: () => <ModelPicker />,
};
