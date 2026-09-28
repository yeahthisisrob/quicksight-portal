/**
 * What the page sends becomes a conversation Bedrock accepts, whatever the
 * page kept: "okay run it" after an answer that only drew a plan used to
 * reach the model as an empty assistant message, and Bedrock refused it.
 */
import { describe, expect, it } from 'vitest';

import { conversationOf } from '../lib/conversation';

const user = (text: string) => ({ role: 'user' as const, text });
const assistant = (text: string) => ({ role: 'assistant' as const, text });

describe('the history sent to the model', () => {
  it('drops an answer with no text, and joins the questions it separated', () => {
    expect(conversationOf([user('plan the rename'), assistant(''), user('okay run it')])).toEqual([
      user('plan the rename\n\nokay run it'),
    ]);
  });

  it('joins two questions in a row, as after a run that failed', () => {
    expect(
      conversationOf([
        user('delete idle readers'),
        assistant('Here is the plan.'),
        user('go'),
        user('go?'),
      ])
    ).toEqual([user('delete idle readers'), assistant('Here is the plan.'), user('go\n\ngo?')]);
  });

  it('starts and ends with the person, as a model requires', () => {
    expect(conversationOf([assistant('Hello'), user('hi'), assistant('Hi.')])).toEqual([
      user('hi'),
    ]);
  });

  it('keeps the most recent twenty and clips long messages', () => {
    const long = conversationOf(
      Array.from({ length: 30 }, (_, i) => (i % 2 ? assistant(`a${i}`) : user(`u${i}`))).concat(
        user('x'.repeat(10_000))
      )
    );
    expect(long.length).toBeLessThanOrEqual(20);
    expect(long[0]?.role).toBe('user');
    expect(long.at(-1)?.text.length).toBeLessThanOrEqual(8_000 + 'u28\n\n'.length);
  });
});
