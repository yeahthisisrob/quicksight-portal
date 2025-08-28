import { useEffect, useState, useRef } from 'react';

/**
 * Hook to calculate available height for a component based on its position in the viewport
 * This helps tables and other components use maximum available space
 */
export const useAvailableHeight = (offset: number = 20) => {
  const [availableHeight, setAvailableHeight] = useState<string>('auto');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const topOffset = rect.top;
        const bottomPadding = offset; // Small padding at bottom
        const height = window.innerHeight - topOffset - bottomPadding;
        setAvailableHeight(`${height}px`);
      }
    };

    // Calculate on mount and resize
    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    
    // Recalculate after a short delay to account for any layout shifts
    const timer = setTimeout(calculateHeight, 100);

    return () => {
      window.removeEventListener('resize', calculateHeight);
      clearTimeout(timer);
    };
  }, [offset]);

  return { containerRef, availableHeight };
};