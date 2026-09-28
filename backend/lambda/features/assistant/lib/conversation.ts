/**
 * The page's history as a conversation a model accepts. The page keeps
 * every entry, so it can hold what a model refuses: an answer with no text
 * (it only drew a plan or ran a call), and two questions in a row (the run
 * between them failed). Bedrock rejects both - an empty message and
 * repeated roles - so blank entries are dropped, runs of one role are
 * joined, and the conversation starts and ends with the person. Pure.
 */
import type { ChatHistoryMessage } from '../types';

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 8_000;

export function conversationOf(history: ChatHistoryMessage[]): ChatHistoryMessage[] {
  const joined: ChatHistoryMessage[] = [];
  for (const { role, text } of history) {
    const clipped = text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!clipped) continue;
    const last = joined[joined.length - 1];
    if (last?.role === role) last.text = `${last.text}\n\n${clipped}`;
    else joined.push({ role, text: clipped });
  }
  const recent = joined.slice(-MAX_MESSAGES);
  while (recent[0]?.role === 'assistant') recent.shift();
  while (recent[recent.length - 1]?.role === 'assistant') recent.pop();
  return recent;
}
