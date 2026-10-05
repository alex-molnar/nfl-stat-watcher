import { useState } from 'react';
import { DAZN_REGION, parseDaznGameLink } from '../dazn/links';
import { useScoreboard, useTeams } from '../hooks/queries';
import type { GameInfo } from '../stats/scoreboard';
import { daznLinksStore, setManualLink } from '../storage/dazn';
import { useStore } from '../storage/useStore';

const STATE_LABEL = { pre: 'Upcoming', in: 'Live', post: 'Ended' } as const;

function GameRow({ game, title }: { game: GameInfo; title: string }) {
  const stored = useStore(daznLinksStore);
  const mine = stored.manual[game.eventId];
  const found = stored.links[game.eventId];
  const ended = game.state === 'post';
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  function save() {
    const path = parseDaznGameLink(text);
    if (!path) return setError('That is not a DAZN game link. Paste the address of the game page, like https://www.dazn.com/en-NL/home/…/…');
    setManualLink(game.eventId, path);
    setText('');
    setError('');
  }

  const current = mine ?? found;
  return (
    <li className={`dazn-game${ended ? ' ended' : ''}`} aria-disabled={ended || undefined}>
      <div className="dazn-game-head">
        <strong>{title}</strong>
        <span className="chip">{STATE_LABEL[game.state]}</span>
      </div>
      <p className="muted">
        {current ? <>{mine ? 'Your link' : 'Found by the sync'}: {ended ? current : <a href={`https://www.dazn.com/${DAZN_REGION}${current}`} target="_blank" rel="noreferrer">{current}</a>}</> : 'No link yet'}
      </p>
      <div className="dazn-game-edit">
        <label className="field-label">
          <span className="sr">DAZN link for {title}</span>
          <input type="url" placeholder="Paste a DAZN game link" aria-label={`DAZN link for ${title}`} value={text} disabled={ended} onChange={(event) => { setText(event.target.value); setError(''); }} />
        </label>
        <button type="button" className="btn press" disabled={ended || !text.trim()} onClick={save}>Use this link</button>
        {mine && <button type="button" className="btn press" disabled={ended} onClick={() => setManualLink(game.eventId, null)}>Remove my link</button>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </li>
  );
}

/** This week's games with the DAZN link each one uses, and a way to set the link by hand. Ended games are shown but locked. */
export function DaznGameLinks() {
  const scoreboard = useScoreboard(true); // read once; this list is not worth polling
  const teams = useTeams();
  const name = (side: GameInfo['home']) => teams.data?.find((team) => team.id === side.id)?.name ?? side.abbr;
  if (scoreboard.isError) return <p className="error" role="alert">Could not load this week's games.</p>;
  if (!scoreboard.data) return <p role="status">Loading games…</p>;
  return (
    <ul className="dazn-games">
      {scoreboard.data.map((game) => <GameRow key={game.eventId} game={game} title={`${name(game.away)} @ ${name(game.home)}`} />)}
    </ul>
  );
}
