import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { mascotEnabledStore, mascotNameStore } from '../storage/mascot';
import { useStore } from '../storage/useStore';
import { Mascot } from './Mascot';
import { TypedText } from './TypedText';

export type PrivateHelpMode = 'settings' | 'bookmark' | 'rosters';

/** A compact hint beside its trigger, above the import dialog without taking focus. */
export function PrivateSettingsGuide({ id, anchor, mode = 'settings' }: { id: string; anchor: RefObject<HTMLButtonElement | null>; mode?: PrivateHelpMode }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const name = useStore(mascotNameStore);
  const mascotOn = useStore(mascotEnabledStore);
  const help = {
    settings: { title: t(($) => $.sync.guide.settings.title), intro: t(($) => $.sync.guide.settings.intro), steps: [t(($) => $.sync.guide.settings.step1), t(($) => $.sync.guide.settings.step2), t(($) => $.sync.guide.settings.step3)] },
    bookmark: { title: t(($) => $.sync.guide.bookmark.title), intro: t(($) => $.sync.guide.bookmark.intro), steps: [t(($) => $.sync.guide.bookmark.step1), t(($) => $.sync.guide.bookmark.step2), t(($) => $.sync.guide.bookmark.step3)] },
    rosters: { title: t(($) => $.sync.guide.rosters.title), intro: t(($) => $.sync.guide.rosters.intro), steps: [t(($) => $.sync.guide.rosters.step1), t(($) => $.sync.guide.rosters.step2), t(($) => $.sync.guide.rosters.step3)] },
  }[mode];

  useLayoutEffect(() => {
    const popup = ref.current;
    if (!popup) return;
    popup.showPopover?.();
    const position = () => {
      const button = anchor.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
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
  }, [anchor]);

  return (
    <div ref={ref} id={id} role="tooltip" popover="manual" className="private-settings-guide">
      <div className="private-settings-guide-head">
        {mascotOn && <Mascot size={48} entrance={false} />}
        <b>{t(($) => $.sync.guide.head, { name, title: help.title })}</b>
      </div>
      <p><TypedText text={help.intro} /></p>
      <ol>
        {help.steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
    </div>
  );
}
