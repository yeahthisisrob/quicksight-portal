/**
 * Text helpers for definition content.
 *
 * QuickSight stores rich titles and text boxes as HTML fragments
 * (`<visual-title>Sales <b>by region</b></visual-title>`). The wireframe
 * shows words, not markup.
 */

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/** Strip tags, decode the common entities and collapse whitespace. */
export function stripHtml(input: unknown): string {
  if (typeof input !== 'string') return '';
  const withoutTags = input.replace(/<[^>]*>/g, ' ');
  const decoded = withoutTags.replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity] ?? entity);
  return decoded.replace(/\s+/g, ' ').trim();
}

/**
 * A visual's Title/Subtitle block: `{ Visibility, FormatText: { PlainText | RichText } }`.
 * Returns the text and whether QuickSight hides it.
 */
export function readLabel(block: any): { text?: string; hidden: boolean } {
  const hidden = block?.Visibility === 'HIDDEN';
  const format = block?.FormatText;
  const text = format?.PlainText ?? (format?.RichText ? stripHtml(format.RichText) : undefined);
  const trimmed = typeof text === 'string' ? text.trim() : undefined;
  return { text: trimmed || undefined, hidden };
}

const MAX_SNIPPET = 80;

/** First line of a text box, shortened so it fits a card header. */
export function snippet(html: unknown): string | undefined {
  const text = stripHtml(html);
  if (!text) return undefined;
  return text.length > MAX_SNIPPET ? `${text.slice(0, MAX_SNIPPET - 1)}…` : text;
}
