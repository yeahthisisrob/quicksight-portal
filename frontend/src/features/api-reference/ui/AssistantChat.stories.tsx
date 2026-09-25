import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { type MockRoute, mockApi } from '../../../../.storybook/mocks/api';
import { assistantRoutes, SCRIPTED_ANSWER } from './__stories__/assistant';
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

export const Models: Story = {
  name: 'The model picker',
  render: () => <ModelPicker />,
};
