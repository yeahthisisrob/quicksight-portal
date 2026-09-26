import { describe, expect, it } from 'vitest';

import { EMPTY_CONVERSATION, withAnswer, withQuestion, withRun } from '../conversation';
import { answerMetaOf, resultTarget, TOOL, threadOf } from '../thread';

const BASE = {
  calls: [{ method: 'GET', path: '/api/search', status: 200, ok: true }],
  model: { key: 'haiku-4-5', label: 'Claude Haiku 4.5', modelId: 'h' },
  usage: { inputTokens: 10, outputTokens: 5 },
  cost: 0.001,
  rounds: 1,
  outcome: { type: 'success' },
};

const PLAN = { id: 'plan', kind: 'plan', title: 'Margin by region' };
const PREVIEW = { id: 'pv', kind: 'preview', title: 'Copy', path: '/api/x/preview' };
const QUESTION = {
  id: 'int-1',
  reason: 'input_required',
  message: 'Which dataset?',
  metadata: { options: [{ id: 'dataset:a', label: 'A' }] },
};

const ANSWER = {
  ...BASE,
  reply: 'Here is the plan.',
  artifacts: [PLAN, PREVIEW, { id: 'ln', kind: 'lineage', title: 'margin', fieldKey: 'k' }],
  actions: [
    { id: 'publish', title: 'Publish', why: '', method: 'POST', path: '/p', previewId: 'pv' },
    { id: 'create', title: 'Create', why: '', method: 'POST', path: '/c', planId: 'plan' },
  ],
};

/** A message's parts, loosely typed for reading in assertions. */
const partsOf = (m: ReturnType<typeof threadOf>[number] | undefined) =>
  (m?.content ?? []) as unknown as Array<Record<string, any>>;

function thread(answer: object, runs: Record<string, never> = {}) {
  let c = withAnswer(withQuestion(EMPTY_CONVERSATION, 'go'), answer as never);
  for (const [id, run] of Object.entries(runs)) c = withRun(c, id, run);
  return { c, messages: threadOf(c) };
}

describe('threadOf', () => {
  it('draws an answer as text, then each artifact as a tool call, a plan with its change under it', () => {
    const { messages } = thread(ANSWER);
    expect(messages[0]).toEqual({ id: 'u0', role: 'user', content: 'go' });
    const content = partsOf(messages[1]);
    expect(content.map((p) => p.toolName ?? p.type)).toEqual([
      'text',
      TOOL.plan,
      TOOL.action, // create, under its plan
      TOOL.lineage,
      TOOL.action, // publish, with its preview inside
    ]);
    expect(content[2]!.args.action.id).toBe('create');
    expect(content[4]!.args.preview.id).toBe('pv');
    expect(content[1]!.toolCallId).toBe('a1:plan');
    expect(answerMetaOf(messages[1]!.metadata?.custom)?.model.label).toBe('Claude Haiku 4.5');
  });

  it("gives an action its run as the tool call's result", () => {
    const { messages } = thread(ANSWER, { create: { status: 'completed' } as never });
    const content = partsOf(messages[1]);
    expect(content[2]!.result).toEqual({ status: 'completed' });
    expect(content[4]!.result).toBeUndefined();
  });

  it('asks a question as a human tool call; the reply is dropped when it only repeats it', () => {
    const asked = {
      ...BASE,
      reply: 'Which dataset?',
      artifacts: [],
      actions: [],
      outcome: { type: 'interrupt', interrupts: [QUESTION] },
    };
    const { c, messages } = thread(asked);
    const content = partsOf(messages[1]);
    expect(content).toHaveLength(1);
    expect(content[0]).toMatchObject({ toolName: TOOL.question, toolCallId: 'a1:int-1' });
    expect(content[0]!.result).toBeUndefined();

    const target = resultTarget(c, TOOL.question, 'a1:int-1', {
      interruptId: 'int-1',
      status: 'resolved',
      payload: { selected: ['dataset:a'], other: 'or B' },
    });
    expect(target).toMatchObject({ kind: 'answer', selected: ['dataset:a'], other: 'or B' });

    const answered = withQuestion(c, 'A', [
      { interruptId: 'int-1', status: 'resolved', payload: { selected: ['dataset:a'] } },
    ]);
    const after = partsOf(threadOf(answered)[1]);
    expect(after[0]!.result).toMatchObject({ interruptId: 'int-1', status: 'resolved' });
  });

  it('routes a run reported from the thread to the action it belongs to', () => {
    const { c } = thread(ANSWER);
    expect(resultTarget(c, TOOL.action, 'a1:create', { status: 'running', jobId: 'j' })).toEqual({
      kind: 'run',
      actionId: 'create',
      run: { status: 'running', jobId: 'j' },
    });
    expect(resultTarget(c, TOOL.plan, 'a1:plan', 'shown')).toEqual({ kind: 'none' });
    expect(resultTarget(c, TOOL.question, 'a1:missing', {})).toEqual({ kind: 'none' });
  });
});
