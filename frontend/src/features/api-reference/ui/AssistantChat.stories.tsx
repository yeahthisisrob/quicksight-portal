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

export const Models: Story = {
  name: 'The model picker',
  render: () => <ModelPicker />,
};
