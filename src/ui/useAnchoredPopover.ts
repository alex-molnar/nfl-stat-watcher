import { useLayoutEffect, type RefObject } from 'react';

/** Shows a `popover="manual"` element in the top layer and keeps it under its anchor (above it when there is no room below). */
export function useAnchoredPopover(ref: RefObject<HTMLElement | null>, anchor: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const popup = ref.current;
    if (!popup) return;
    popup.showPopover?.();
    const position = () => {
      const target = anchor.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const width = popup.offsetWidth;
      const height = popup.offsetHeight;
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const top = rect.bottom + height + 10 <= window.innerHeight - 12 ? rect.bottom + 10 : Math.max(12, rect.top - height - 10);
      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [ref, anchor]);
}
