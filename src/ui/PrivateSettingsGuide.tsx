import { useLayoutEffect, useRef, type RefObject } from 'react';
import { mascotEnabledStore, mascotNameStore } from '../storage/mascot';
import { useStore } from '../storage/useStore';
import { Mascot } from './Mascot';
import { TypedText } from './TypedText';

export type PrivateHelpMode = 'settings' | 'bookmark' | 'rosters';
const HELP: Record<PrivateHelpMode, { title: string; intro: string; steps: string[] }> = {
  settings: {
    title: 'Copy settings', intro: 'Stay signed in to ESPN, then follow these steps:',
    steps: ['Click Open Settings to open your league’s data.', 'Select all with Ctrl+A (Cmd+A on Mac), then copy with Ctrl+C (Cmd+C).', 'Return here and paste into the settings box. I’ll check it for you!'],
  },
  bookmark: {
    title: 'Create bookmark', intro: 'Let’s save a shortcut that copies your league’s rosters:',
    steps: [
      'Show your browser’s bookmarks bar, then drag Sync onto it.',
      'If you prefer, press Copy bookmark. Create a bookmark in your browser and paste the copied script into its address or URL field.',
      'Open your league on ESPN while signed in, click your saved bookmark, then come back here and paste the copied data into the input.',
    ],
  },
  rosters: {
    title: 'Copy roster data', intro: 'Stay signed in to your league in this browser, then open Go to league source:',
    steps: ['Select everything on the source page with Ctrl+A (Cmd+A on Mac).', 'Copy with Ctrl+C (Cmd+C on Mac), then return here and paste into the input.', 'Only starting lineups and matchup pairings are kept; nothing leaves your browser.'],
  },
};

/** A compact hint beside its trigger, above the import dialog without taking focus. */
export function PrivateSettingsGuide({ id, anchor, mode = 'settings' }: { id: string; anchor: RefObject<HTMLButtonElement | null>; mode?: PrivateHelpMode }) {
  const ref = useRef<HTMLDivElement>(null);
  const name = useStore(mascotNameStore);
  const mascotOn = useStore(mascotEnabledStore);
  const help = HELP[mode];

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
        <b>{name} · {help.title}</b>
      </div>
      <p><TypedText text={help.intro} /></p>
      <ol>
        {help.steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
    </div>
  );
}
