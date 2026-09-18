import { describe, expect, it } from 'vitest';

import { readLabel, snippet, stripHtml } from '../text';

describe('stripHtml', () => {
  it('removes tags, decodes entities and collapses whitespace', () => {
    expect(stripHtml('<visual-title>Revenue &amp; margin <b>by  region</b></visual-title>')).toBe(
      'Revenue & margin by region'
    );
    expect(stripHtml('a&nbsp;b &lt;c&gt; &quot;d&quot; &#39;e&#39; &unknown;')).toBe(
      'a b <c> "d" \'e\' &unknown;'
    );
  });

  it('is empty for non-strings', () => {
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml(42)).toBe('');
  });
});

describe('readLabel', () => {
  it('prefers plain text, falls back to stripped rich text', () => {
    expect(readLabel({ FormatText: { PlainText: 'Plain' } })).toEqual({
      text: 'Plain',
      hidden: false,
    });
    expect(readLabel({ FormatText: { RichText: '<p>Rich</p>' } })).toEqual({
      text: 'Rich',
      hidden: false,
    });
  });

  it('reports hidden titles and treats blank text as absent', () => {
    expect(readLabel({ Visibility: 'HIDDEN', FormatText: { PlainText: 'x' } })).toEqual({
      text: 'x',
      hidden: true,
    });
    expect(readLabel({ FormatText: { PlainText: '   ' } })).toEqual({
      text: undefined,
      hidden: false,
    });
    expect(readLabel(undefined)).toEqual({ text: undefined, hidden: false });
  });
});

describe('snippet', () => {
  it('shortens long text box content', () => {
    const long = `<block>${'word '.repeat(40)}</block>`;
    const result = snippet(long);
    expect(result?.length).toBe(80);
    expect(result?.endsWith('…')).toBe(true);
  });

  it('returns undefined for empty content', () => {
    expect(snippet('<block></block>')).toBeUndefined();
  });
});
