import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent, within } from 'storybook/test';

import { MockedApi } from '../../../../.storybook/mocks/api';
import type { ActionRun, ConversationEntry } from '../model/conversation';
import {
  assistantRoutes,
  MARKDOWN_ANSWER,
  PLANNED_ANSWER,
  QUESTION_ANSWER,
  SCRIPTED_ANSWER,
  WIREFRAME_ANSWER,
} from './__stories__/assistant';
import { AssistantChat } from './AssistantChat';
import { ModelPicker } from './ModelPicker';

const KEY = 'qsp.assistant.conversation.v1';

/** Seeds the conversation the chat picks up from the browser, as after a reload. */
function seeded(
  turns: Array<[question: string, answer?: { reply: string }]>,
  options: { runs?: Record<string, ActionRun>; pendingSince?: number } = {}
): Decorator {
  const entries: ConversationEntry[] = turns.flatMap(([question, answer]) => [
    { role: 'user', text: question },
    ...(answer ? [{ role: 'assistant', text: answer.reply, result: answer } as never] : []),
  ]);
  return (Story) => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        threadId: 'story-thread',
        entries,
        runs: options.runs ?? {},
        ...(options.pendingSince
          ? { pending: { jobId: 'assistant-working', since: options.pendingSince } }
          : {}),
      })
    );
    return <Story />;
  };
}

/**
 * Ask the portal, on assistant-ui. Each answer is text plus tool calls: a
 * wireframe, a lineage or a plan drawn as a compact card that expands, a
 * prepared change to run, or a question to answer.
 */
const meta: Meta<typeof AssistantChat> = {
  title: 'Features/Author/Assistant chat',
  component: AssistantChat,
  parameters: { layout: 'padded' },
  decorators: [
    // Stories share one origin: start each from an empty conversation (a
    // story that needs one seeds it inside this).
    (Story) => {
      window.localStorage.removeItem(KEY);
      return <Story />;
    },
    (Story) => (
      <MockedApi routes={assistantRoutes()}>
        <div style={{ maxWidth: 1000 }}>
          <Story />
        </div>
      </MockedApi>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Before the first message: a welcome and suggestions that send on click. */
export const Welcome: Story = { name: 'Welcome, with suggestions' };

/** A reply as markdown: a table, a list, inline code, a code block, a quote; it ends on a promise, so Continue is offered. */
export const MarkdownReply: Story = {
  name: 'A markdown reply, stopped on a promise',
  decorators: [seeded([['Which dashboards read orders gold?', MARKDOWN_ANSWER]])],
};

/** A preview drawn as a compact card; Expand opens the full, interactive wireframe. */
export const Wireframe: Story = {
  name: 'A wireframe: compact, then expanded',
  decorators: [seeded([['Copy sales overview onto sales gold', WIREFRAME_ANSWER]])],
  play: async () => {
    const card = await screen.findByTestId('artifact-card');
    await within(card).findByText(/visual|table|chart|KPI/i);
    await userEvent.click(within(card).getByRole('button', { name: 'Expand' }));
    const dialog = await screen.findByRole('dialog');
    await expect(
      (await within(dialog).findAllByTestId(/^wireframe-element-/)).length
    ).toBeGreaterThan(0);
  },
};

/** Plans before it builds: the plan (with who drew it and what it writes), the change under it, then the field verdicts. */
export const Plan: Story = {
  name: 'A plan, its change, and the field verdicts',
  decorators: [seeded([['Margin by region on the governed orders data', PLANNED_ANSWER]])],
};

/** A lineage it traced, and a publish prepared with its preview inside, to confirm and run. */
export const PreparedAction: Story = {
  name: 'A prepared change with its preview',
  decorators: [
    seeded([['Where does margin come from, and copy sales overview to gold', SCRIPTED_ANSWER]]),
  ],
};

/** After Run: one create finished (what it made, its warnings), one still following its job. */
export const ActionsRun: Story = {
  name: 'Changes run: one finished, one following its job',
  decorators: [
    seeded(
      [
        ['Margin by region on the governed orders data', PLANNED_ANSWER],
        ['Now copy sales overview to gold', SCRIPTED_ANSWER],
      ],
      {
        runs: {
          'act-plan': {
            status: 'completed',
            result: {
              assetType: 'analysis',
              assetId: 'margin-by-region',
              name: 'Margin by region',
              warnings: [
                'Filter on revenue left out: a number filter needs min and max for its slider.',
              ],
            },
          },
          'act-1': { status: 'running', jobId: 'grant-7', message: 'Queued' },
        },
      }
    ),
  ],
};

/** Asks instead of guessing: a human-in-the-loop tool call waiting for a pick. */
export const Question: Story = {
  name: 'A question awaiting an answer',
  decorators: [seeded([['Build margin by region', QUESTION_ANSWER]])],
};

/** Waiting on an answer: what it is doing and for how long, and Stop in the composer. */
export const Running: Story = {
  name: 'Running: the assistant says what it is doing',
  decorators: [
    seeded([['Run the propose for sales overview onto gold']], {
      pendingSince: Date.now() - 23_000,
    }),
  ],
};

export const Models: Story = {
  name: 'The model picker',
  render: () => <ModelPicker />,
};
