/**
 * Small judgements about the assistant's own turns: whether an answer
 * stopped on a promise instead of doing the work, and how to name a step
 * for the person watching. Pure.
 */

/**
 * An answer that ends by announcing more work ("let me check the column
 * names and try again") instead of doing it. Nothing runs after an answer,
 * so the person is left waiting on a promise. "Let me know" is a question
 * back to the person, not a promise.
 */
const ANNOUNCES_MORE =
  /\b(let me(?! know)|i'll|i will|i am going to|i'm going to|next,? i|now i'll|i'll now|going to (check|try|look|run))\b[^.?!]*[.…:]?\s*$/i;

/** Said to the model, once, when its answer ended on a promise. */
export const CONTINUE_NUDGE =
  'You ended by saying what you will do next, but nothing runs after your answer ends. Do it now with the tools, in this answer. If something is blocking you, say what it is and what the person can do.';

export function announcesMore(text: string): boolean {
  const lastSentences = text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .slice(-2)
    .join(' ');
  return ANNOUNCES_MORE.test(lastSentences);
}

/** "GET /api/search?q=margin" -> "Searching", for the progress line. */
export function describeStep(method: string, path: string): string {
  const pathname = path.split('?')[0] ?? '';
  if (pathname === '/api/search' || pathname === '/api/context/search') return 'Searching';
  if (pathname.startsWith('/api/context/entities')) return 'Following the lineage';
  if (/\/propose$/.test(pathname)) return 'Asking the planner';
  if (/\/preview$/.test(pathname)) return 'Previewing the change';
  if (/\/plan$/.test(pathname)) return 'Checking columns';
  if (/\/cached$/.test(pathname)) return 'Reading the definition';
  if (/calculated-fields/.test(pathname)) return 'Tracing calculated fields';
  if (/\/columns$/.test(pathname)) return 'Reading dataset columns';
  if (pathname.startsWith('/api/data-catalog')) return 'Reading the catalog';
  if (pathname.startsWith('/api/jobs')) return 'Checking a job';
  return method === 'GET' ? 'Reading' : 'Working';
}
