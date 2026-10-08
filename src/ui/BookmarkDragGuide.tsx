import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

/** A non-interactive copy demonstrates dragging the real bookmark to the browser toolbar. */
export function BookmarkDragGuide({ anchor }: { anchor: RefObject<HTMLAnchorElement | null> }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const overlay = ref.current;
    const button = anchor.current;
    if (!overlay || !button) return;
    const copy = overlay.querySelector<HTMLElement>('.bookmark-drag-copy');
    if (!copy) return;
    overlay.showPopover?.();
    const motion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : undefined;
    let animation: Animation | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const repeat = () => {
      if (motion?.matches || typeof copy.animate !== 'function') return;
      const rect = button.getBoundingClientRect();
      const container = button.closest('.dlg')?.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && rect.top >= (container?.top ?? 0) && rect.bottom <= (container?.bottom ?? window.innerHeight);
      if (!visible) { timer = setTimeout(repeat, 1000); return; }
      overlay.style.setProperty('--drag-width', `${rect.width}px`);
      overlay.style.setProperty('--drag-height', `${rect.height}px`);
      const from = `translate(${rect.left}px, ${rect.top}px)`;
      const to = `translate(${rect.left}px, 8px)`;
      // Explicit viewport coordinates are measured for each drag, after the dialog has settled.
      animation = copy.animate([
        { transform: from, opacity: 0, offset: 0 },
        { transform: from, opacity: .95, offset: .1 },
        { transform: from, opacity: .95, offset: .2, easing: 'cubic-bezier(.4, 0, .2, 1)' },
        { transform: to, opacity: .95, offset: .82 },
        { transform: to, opacity: 0, offset: 1 },
      ], { duration: 2800, fill: 'none' });
      animation.onfinish = () => { timer = setTimeout(repeat, 2600); };
    };
    const restart = () => {
      clearTimeout(timer);
      animation?.cancel();
      timer = setTimeout(repeat, 700);
    };
    restart();
    motion?.addEventListener('change', restart);
    window.addEventListener('resize', restart);
    window.addEventListener('scroll', restart, true);
    return () => {
      clearTimeout(timer);
      animation?.cancel();
      motion?.removeEventListener('change', restart);
      window.removeEventListener('resize', restart);
      window.removeEventListener('scroll', restart, true);
    };
  }, [anchor]);

  return (
    <div ref={ref} popover="manual" className="bookmark-drag-guide" aria-hidden="true">
      <div className="bookmark-drag-copy">
        <span className="btn btn-primary bm-link">{t(($) => $.sync.help.bookmarkLabel)}</span>
        <svg className="bookmark-drag-cursor" width="26" height="32" viewBox="0 0 26 32" fill="none">
          <path d="M3 2v23l6-6 5 11 5-2-5-10h9L3 2Z" fill="white" stroke="#132016" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
