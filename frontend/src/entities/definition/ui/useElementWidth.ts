import { type RefObject, useLayoutEffect, useState } from 'react';

/**
 * The current rendered width of an element, tracked with ResizeObserver.
 * Grid rows are kept square-ish and free-form canvases are scaled from it.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>, fallback: number): number {
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setWidth(node.clientWidth || fallback);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, fallback]);

  return width;
}
