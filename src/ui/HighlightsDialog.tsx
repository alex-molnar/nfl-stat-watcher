import { useEffect, useRef, useState } from 'react';
import type { Highlight } from '../stats/types';

interface Props {
  open: boolean;
  onClose: () => void;
  playerName: string;
  clips: Highlight[];
  onWatched: (id: string) => void;
}

const length = (seconds?: number) => (seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '');
const clock = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/** Plays a clip inside the site when ESPN gives a video file, and sends the user to the clip's page in a new window when it does not. */
export function HighlightsDialog({ open, onClose, playerName, clips, onWatched }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playing = clips.find((clip) => clip.id === playingId && clip.mp4);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setPlayingId(null);
      // One clip needs no choosing: start it straight away.
      const only = clips.length === 1 ? clips[0] : undefined;
      if (only?.mp4) { setPlayingId(only.id); onWatched(only.id); }
    }
    if (!open && dialog.open) dialog.close();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- starts once per opening

  function choose(clip: Highlight) {
    onWatched(clip.id);
    if (clip.mp4) setPlayingId(clip.id);
    else if (clip.page) window.open(clip.page, '_blank', 'noopener,noreferrer');
  }

  return (
    <dialog ref={ref} className="hl-dlg" aria-labelledby="hl-title" onClose={() => { setPlayingId(null); onClose(); }}>
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="hl-title">Highlights, {playerName}</h2>
          <button type="button" className="close" aria-label="Close highlights" onClick={onClose}>×</button>
        </div>
        {playing && (
          <figure className="hl-player">
            {/* key restarts the video when another clip is chosen */}
            <video key={playing.id} src={playing.mp4} poster={playing.thumbnail} controls autoPlay playsInline preload="auto" aria-label={playing.headline} />
            <figcaption>{playing.headline}</figcaption>
          </figure>
        )}
        <ul className="hl-list">
          {clips.map((clip) => (
            <li key={clip.id}>
              <button type="button" className={`hl-item${clip.id === playingId ? ' on' : ''}`} aria-current={clip.id === playingId || undefined} onClick={() => choose(clip)}>
                {clip.thumbnail && <img src={clip.thumbnail} alt="" loading="lazy" />}
                <span className="hl-text">
                  <b>{clip.headline}</b>
                  <small>{[clock(clip.publishedAt), length(clip.duration), clip.mp4 ? '' : 'Opens ESPN in a new window'].filter(Boolean).join(' · ')}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
