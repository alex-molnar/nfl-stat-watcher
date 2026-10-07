import { useLayoutEffect, useRef, type RefObject } from 'react';

/** A non-interactive copy demonstrates dragging the real bookmark to the browser toolbar. */
export function BookmarkDragGuide({ anchor }: { anchor: RefObject<HTMLAnchorElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const overlay = ref.current;
    const button = anchor.current;
    if (!overlay || !button) return;
    overlay.showPopover?.();
    const position = () => {
      const rect = button.getBoundingClientRect();
      overlay.style.setProperty('--drag-left', `${rect.left}px`);
      overlay.style.setProperty('--drag-top', `${rect.top}px`);
      overlay.style.setProperty('--drag-rise', `${12 - rect.top}px`);
      overlay.style.setProperty('--drag-width', `${rect.width}px`);
      overlay.style.setProperty('--drag-height', `${rect.height}px`);
      // The overlay remains in the top layer but only demonstrates a visible button.
      overlay.style.visibility = rect.bottom > 0 && rect.top < window.innerHeight ? 'visible' : 'hidden';
    };
    position();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(position) : undefined;
    observer?.observe(button);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [anchor]);

  return (
    <div ref={ref} popover="manual" className="bookmark-drag-guide" aria-hidden="true">
      <span className="bookmark-drag-target">Bookmarks bar</span>
      <div className="bookmark-drag-copy">
        <span className="btn btn-primary bm-link">Sync</span>
        <svg className="bookmark-drag-cursor" width="26" height="32" viewBox="0 0 26 32" fill="none">
          <path d="M3 2v23l6-6 5 11 5-2-5-10h9L3 2Z" fill="white" stroke="#132016" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
