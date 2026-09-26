import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assistantApi } from '@/shared/api';

import {
  answerTo,
  CONVERSATION_KEY,
  createdAsset,
  EMPTY_CONVERSATION,
  endsOnAPromise,
  followUpFor,
  historyOf,
  jobIdOf,
  loadConversation,
  MAX_ENTRIES,
  saveConversation,
  withAnswer,
  withPending,
  withQuestion,
  withRun,
  workingStateOf,
} from '../conversation';
import { useConversation } from '../useConversation';

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api')>();
  return { ...actual, assistantApi: { send: vi.fn(), waitForAnswer: vi.fn() } };
});

const ANSWER = {
  reply: 'Found it.',
  calls: [],
  actions: [],
  artifacts: [],
  model: { key: 'haiku-4-5', label: 'Claude Haiku 4.5', modelId: 'h' },
  usage: { inputTokens: 10, outputTokens: 5 },
  cost: 0.001,
  rounds: 1,
} as const;

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('conversation model', () => {
  it('round-trips through storage, and an empty one clears it', () => {
    const storage = memoryStorage();
    const c = withPending(withQuestion(EMPTY_CONVERSATION, 'hi'), 'assistant-1', 1000);
    saveConversation(storage, c);
    expect(loadConversation(storage)).toEqual(c);
    saveConversation(storage, EMPTY_CONVERSATION);
    expect(storage.data.has(CONVERSATION_KEY)).toBe(false);
    storage.setItem(CONVERSATION_KEY, '{not json');
    expect(loadConversation(storage)).toEqual(EMPTY_CONVERSATION);
    expect(loadConversation(undefined)).toEqual(EMPTY_CONVERSATION);
  });

  it('an answer clears the pending wait; history is text only and bounded', () => {
    const asked = withPending(withQuestion(EMPTY_CONVERSATION, 'hi'), 'j', 1);
    const answered = withAnswer(asked, ANSWER as never);
    expect(answered.pending).toBeUndefined();
    expect(historyOf(answered)).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: 'Found it.' },
    ]);
    let long = EMPTY_CONVERSATION;
    for (let i = 0; i < MAX_ENTRIES + 5; i += 1) {
      long = withQuestion(long, `q${i}`);
    }
    expect(long.entries).toHaveLength(MAX_ENTRIES);
    expect(long.entries[0]).toEqual({ role: 'user', text: 'q5' });
  });

  it('finds a job id in either envelope and tells the assistant how an action ended', () => {
    expect(jobIdOf({ success: true, jobId: 'bulk-1' })).toBe('bulk-1');
    expect(jobIdOf({ success: true, data: { jobId: 'planner-1' } })).toBe('planner-1');
    expect(jobIdOf({ success: true, data: {} })).toBeUndefined();
    const run = withRun(EMPTY_CONVERSATION, 'a1', { status: 'completed', result: { ok: 1 } }).runs
      .a1!;
    expect(followUpFor('Grant access', run)).toBe(
      '"Grant access" finished. Result: {"ok":1} What next?'
    );
    expect(followUpFor('Grant access', { status: 'failed', error: 'AccessDenied' })).toBe(
      '"Grant access" failed: AccessDenied. What next?'
    );
  });
});

describe('workingStateOf plans', () => {
  it('holds every plan drawn so far that says what it writes, latest last', () => {
    const plan = (id: string, build?: unknown) => ({
      id,
      kind: 'plan',
      title: `Plan ${id}`,
      ...(build ? { build } : {}),
    });
    let c = withAnswer(withQuestion(EMPTY_CONVERSATION, 'plan it'), {
      ...ANSWER,
      artifacts: [plan('p1', { create: { name: 'A' } }), { id: 'x', kind: 'lineage', title: 'm' }],
    } as never);
    c = withAnswer(withQuestion(c, 'and another'), {
      ...ANSWER,
      artifacts: [plan('no-build'), plan('p2', { edit: { assetId: 'd' } })],
    } as never);
    expect(workingStateOf(c).plans).toEqual([
      { id: 'p1', title: 'Plan p1', build: { create: { name: 'A' } } },
      { id: 'p2', title: 'Plan p2', build: { edit: { assetId: 'd' } } },
    ]);
    for (let i = 0; i < 12; i += 1) {
      c = withAnswer(c, { ...ANSWER, artifacts: [plan(`q${i}`, { create: {} })] } as never);
    }
    const plans = workingStateOf(c).plans;
    expect(plans).toHaveLength(5);
    expect(plans[plans.length - 1]!.id).toBe('q11');
  });
});

describe('endsOnAPromise', () => {
  it('spots an answer that stops on what it will do next, not a question back', () => {
    expect(
      endsOnAPromise('The planner failed. Let me check the exact column names and try again.')
    ).toBe(true);
    expect(endsOnAPromise("I'll preview it next")).toBe(true);
    expect(endsOnAPromise('Found 3. Let me know which one to copy.')).toBe(false);
    expect(endsOnAPromise('margin is revenue minus cost.')).toBe(false);
    expect(endsOnAPromise('I found the folder. Shall I add the analysis to it?')).toBe(true);
    expect(endsOnAPromise('Which folder, Sales or Finance?')).toBe(false);
  });
});

describe('useConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });
  afterEach(() => cleanup());

  it('sends the history with both models, shows each step, and keeps the answer', async () => {
    vi.mocked(assistantApi.send).mockResolvedValue('assistant-1');
    let release: (v: unknown) => void = () => undefined;
    vi.mocked(assistantApi.waitForAnswer).mockImplementation((_id, onProgress) => {
      onProgress?.({ message: 'Asking the planner' } as never);
      return new Promise((resolve) => {
        release = resolve;
      }) as never;
    });
    const { result } = renderHook(() => useConversation());
    act(() => result.current.ask('run the propose'));

    await waitFor(() => expect(result.current.status).toBe('Asking the planner'));
    expect(assistantApi.send).toHaveBeenCalledWith({
      messages: [{ role: 'user', text: 'run the propose' }],
      model: 'haiku-4-5',
      authoringModel: 'sonnet-4-6',
      threadId: expect.any(String),
      state: { drafts: [], ran: [], plans: [] },
    });
    expect(result.current.busy).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(CONVERSATION_KEY) ?? '{}').pending.jobId).toBe(
      'assistant-1'
    );

    await act(async () => release(ANSWER));
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.conversation.entries).toHaveLength(2);
    expect(result.current.status).toBeNull();
  });

  it('after a reload, picks the transcript back up and resumes waiting on the pending answer', async () => {
    window.localStorage.setItem(
      CONVERSATION_KEY,
      JSON.stringify(
        withPending(withQuestion(EMPTY_CONVERSATION, 'still there?'), 'assistant-9', 5)
      )
    );
    vi.mocked(assistantApi.waitForAnswer).mockResolvedValue(ANSWER as never);
    const { result } = renderHook(() => useConversation());

    expect(result.current.conversation.entries[0]).toEqual({ role: 'user', text: 'still there?' });
    await waitFor(() => expect(result.current.conversation.entries).toHaveLength(2));
    expect(assistantApi.waitForAnswer).toHaveBeenCalledWith('assistant-9', expect.any(Function));
    expect(assistantApi.send).not.toHaveBeenCalled();
  });

  it('keeps the question on failure so it can be retried, and starts over on reset', async () => {
    vi.mocked(assistantApi.send).mockResolvedValue('assistant-2');
    vi.mocked(assistantApi.waitForAnswer).mockRejectedValueOnce(new Error('The job failed'));
    const { result } = renderHook(() => useConversation());
    act(() => result.current.ask('hello'));
    await waitFor(() => expect(result.current.error).toBe('The job failed'));
    expect(result.current.conversation.entries).toEqual([{ role: 'user', text: 'hello' }]);

    vi.mocked(assistantApi.waitForAnswer).mockResolvedValue(ANSWER as never);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.conversation.entries).toHaveLength(2));

    act(() => result.current.reset());
    expect(result.current.conversation).toEqual(EMPTY_CONVERSATION);
    expect(window.localStorage.getItem(CONVERSATION_KEY)).toBeNull();
  });

  it('sends the working draft and what ran as state, not text, and answers a question with a resume entry', async () => {
    const answer = {
      ...(ANSWER as object),
      reply: 'Prepared.',
      actions: [
        {
          id: 'a1',
          title: 'Create the analysis',
          why: '',
          method: 'POST',
          path: '/api/authoring/new',
          body: { name: 'M' },
        },
        { id: 'a2', title: 'Share it', why: '', method: 'POST', path: '/api/x' },
      ],
    };
    let c = withAnswer(withQuestion(EMPTY_CONVERSATION, 'make it'), answer as never);
    expect(historyOf(c)[1]!.text).toBe('Prepared.');
    expect(workingStateOf(c)).toEqual({
      drafts: [
        {
          title: 'Create the analysis',
          method: 'POST',
          path: '/api/authoring/new',
          body: { name: 'M' },
        },
        { title: 'Share it', method: 'POST', path: '/api/x' },
      ],
      ran: [],
      plans: [],
    });
    c = withRun(c, 'a1', {
      status: 'completed',
      result: { assetType: 'analysis', assetId: 'an-9', name: 'Orders' },
    });
    expect(workingStateOf(c)).toEqual({
      drafts: [{ title: 'Share it', method: 'POST', path: '/api/x' }],
      ran: [
        {
          title: 'Create the analysis',
          method: 'POST',
          path: '/api/authoring/new',
          status: 'done',
          result: { assetType: 'analysis', assetId: 'an-9', name: 'Orders' },
        },
      ],
      plans: [],
    });
    expect(createdAsset(c.runs.a1!.result)).toEqual({
      assetType: 'analysis',
      assetId: 'an-9',
      name: 'Orders',
    });
    expect(createdAsset({ jobId: 'x' })).toBeUndefined();

    const answered = withQuestion(c, 'Orders (gold)', [
      { interruptId: 'i-1', status: 'resolved', payload: { selected: ['dataset:ds-gold'] } },
    ]);
    expect(answered.threadId).toBe(c.threadId);
    expect(answerTo(answered, 'i-1')).toMatchObject({ status: 'resolved' });
    expect(answerTo(answered, 'nope')).toBeUndefined();
  });

  it('answers a question: the labels become the message, the ids go back as resume', async () => {
    vi.mocked(assistantApi.send).mockResolvedValue('assistant-2');
    vi.mocked(assistantApi.waitForAnswer).mockImplementation(
      () => new Promise(() => undefined) as never
    );
    const { result } = renderHook(() => useConversation());
    const interrupt = {
      id: 'i-1',
      reason: 'input_required',
      message: 'Which dataset?',
      metadata: { options: [{ id: 'dataset:ds-gold', label: 'Orders (gold)' }] },
    };
    act(() => result.current.answer(interrupt as never, ['dataset:ds-gold']));
    await waitFor(() => expect(assistantApi.send).toHaveBeenCalled());
    const calls = vi.mocked(assistantApi.send).mock.calls;
    expect(calls[calls.length - 1]![0]).toMatchObject({
      messages: [{ role: 'user', text: 'Orders (gold)' }],
      resume: [
        { interruptId: 'i-1', status: 'resolved', payload: { selected: ['dataset:ds-gold'] } },
      ],
    });
  });
});
