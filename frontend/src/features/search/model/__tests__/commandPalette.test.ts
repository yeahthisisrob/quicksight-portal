import { describe, expect, it } from 'vitest';

import { isPaletteHotkey } from '../commandPalette';

describe('isPaletteHotkey', () => {
  it('is Cmd+K or Ctrl+K, either case, not while held', () => {
    expect(isPaletteHotkey({ key: 'k', metaKey: true, ctrlKey: false, repeat: false })).toBe(true);
    expect(isPaletteHotkey({ key: 'K', metaKey: false, ctrlKey: true, repeat: false })).toBe(true);
    expect(isPaletteHotkey({ key: 'k', metaKey: true, ctrlKey: false, repeat: true })).toBe(false);
  });

  it('ignores a plain k and other chords', () => {
    expect(isPaletteHotkey({ key: 'k', metaKey: false, ctrlKey: false, repeat: false })).toBe(
      false
    );
    expect(isPaletteHotkey({ key: 'p', metaKey: true, ctrlKey: false, repeat: false })).toBe(false);
  });
});
