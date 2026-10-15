/**
 * What the assistant says it is doing while an answer is being worked on,
 * since when, and the steps it has taken so far. The thread's running
 * message reads it; it lives outside the runtime because it comes from the
 * job's progress and log, not a message.
 */
import { createContext, useContext } from 'react';

/** One step of the work in progress, as the job logged it. */
export interface ChatEvent {
  message: string;
  ms?: number;
  /** For a model turn: what it thought or said while it acted. */
  note?: string;
}

interface ChatStatus {
  status: string | null;
  /** When the answer was asked for (ms), for the elapsed time. */
  since?: number;
  events?: ChatEvent[];
}

export const ChatStatusContext = createContext<ChatStatus>({ status: null });

export const useChatStatus = () => useContext(ChatStatusContext);
