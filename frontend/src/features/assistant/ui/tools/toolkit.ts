/**
 * The assistant's tool UIs, registered with assistant-ui's toolkit so the
 * thread renders each tool-call part natively. The assistant runs its
 * tools on the server; these entries only attach UI (render-only backend
 * tools), except the question, which is a human tool: it waits for the
 * person to supply the result.
 */
import type { Toolkit } from '@assistant-ui/react';

import { TOOL } from '../../model/thread';
import { ActionTool } from './ActionTool';
import { FieldsTool, LineageTool, PlanTool, WireframeTool } from './ArtifactTools';
import { QuestionTool } from './QuestionTool';

export const assistantToolkit: Toolkit = {
  [TOOL.wireframe]: { type: 'backend', render: WireframeTool },
  [TOOL.lineage]: { type: 'backend', render: LineageTool },
  [TOOL.plan]: { type: 'backend', render: PlanTool },
  [TOOL.fields]: { type: 'backend', render: FieldsTool },
  [TOOL.action]: { type: 'backend', display: 'standalone', render: ActionTool },
  [TOOL.question]: {
    type: 'human',
    description: 'Ask the person to choose between options before carrying on.',
    parameters: {
      type: 'object',
      properties: { interrupt: { type: 'object' } },
      required: ['interrupt'],
    },
    render: QuestionTool,
  },
};
