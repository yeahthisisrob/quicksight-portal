/**
 * Open/close state for the command palette, plus the Cmd+K / Ctrl+K hotkey.
 * Lives in context so the top bar's search button and any page can open it;
 * outside a provider the hook is a no-op so components render alone.
 */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

interface CommandPaletteState {
  open: boolean;
  show: () => void;
  hide: () => void;
  toggle: () => void;
}

const noop = () => {};
const CommandPaletteContext = createContext<CommandPaletteState>({
  open: false,
  show: noop,
  hide: noop,
  toggle: noop,
});

/** True for Cmd+K on a Mac and Ctrl+K elsewhere, ignoring repeats. */
export function isPaletteHotkey(
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'repeat'>
): boolean {
  return !event.repeat && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isPaletteHotkey(event)) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  const value = useMemo(() => ({ open, show, hide, toggle }), [open, show, hide, toggle]);
  return <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>;
}

export function useCommandPalette(): CommandPaletteState {
  return useContext(CommandPaletteContext);
}
