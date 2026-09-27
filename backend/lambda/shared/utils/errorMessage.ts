/** What went wrong, as text: an Error's message, or anything else as a string. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
