/**
 * What the assistant says it is doing while an answer is being worked on,
 * and since when. The thread's running message reads it; it lives outside
 * the runtime because it comes from the job's progress, not a message.
 */
import { createContext, useContext } from 'react';

interface ChatStatus {
  status: string | null;
  /** When the answer was asked for (ms), for the elapsed time. */
  since?: number;
}

export const ChatStatusContext = createContext<ChatStatus>({ status: null });

export const useChatStatus = () => useContext(ChatStatusContext);
