import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DAZN_REGION, parseDaznGameLink } from '../dazn/links';
import { useScoreboard, useTeams } from '../hooks/queries';
import type { GameInfo } from '../stats/scoreboard';
import { daznLinksStore, setManualLink } from '../storage/dazn';
import { useStore } from '../storage/useStore';

function GameRow({ game, title }: { game: GameInfo; title: string }) {
  const { t } = useTranslation();
  const stored = useStore(daznLinksStore);
  const mine = stored.manual[game.eventId];
  const found = stored.links[game.eventId];
  const ended = game.state === 'post';
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  function save() {
    const path = parseDaznGameLink(text);
    if (!path) return setError(t(($) => $.dazn.games.invalid));
    setManualLink(game.eventId, path);
    setText('');
    setError('');
  }

  const current = mine ?? found;
  return (
    <li className={`dazn-game${ended ? ' ended' : ''}`} aria-disabled={ended || undefined}>
      <div className="dazn-game-head">
        <strong>{title}</strong>
        <span className="chip">{t(($) => $.dazn.games.states[game.state])}</span>
      </div>
      <p className="muted">
        {current ? <>{mine ? t(($) => $.dazn.games.yourLink) : t(($) => $.dazn.games.foundLink)}: {ended ? current : <a href={`https://www.dazn.com/${DAZN_REGION}${current}`} target="_blank" rel="noreferrer">{current}</a>}</> : t(($) => $.dazn.games.noLink)}
      </p>
      <div className="dazn-game-edit">
        <label className="field-label">
          <span className="sr">{t(($) => $.dazn.games.linkFor, { title })}</span>
          <input type="url" placeholder={t(($) => $.dazn.games.placeholder)} aria-label={t(($) => $.dazn.games.linkFor, { title })} value={text} disabled={ended} onChange={(event) => { setText(event.target.value); setError(''); }} />
        </label>
        <button type="button" className="btn press" disabled={ended || !text.trim()} onClick={save}>{t(($) => $.dazn.games.use)}</button>
        {mine && <button type="button" className="btn press" disabled={ended} onClick={() => setManualLink(game.eventId, null)}>{t(($) => $.dazn.games.remove)}</button>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </li>
  );
}

/** This week's games with the DAZN link each one uses, and a way to set the link by hand. Ended games are shown but locked. */
export function DaznGameLinks() {
  const { t } = useTranslation();
  const scoreboard = useScoreboard(true); // read once; this list is not worth polling
  const teams = useTeams();
  const name = (side: GameInfo['home']) => teams.data?.find((team) => team.id === side.id)?.name ?? side.abbr;
  if (scoreboard.isError) return <p className="error" role="alert">{t(($) => $.dazn.games.loadFailed)}</p>;
  if (!scoreboard.data) return <p role="status">{t(($) => $.dazn.games.loading)}</p>;
  return (
    <ul className="dazn-games">
      {scoreboard.data.map((game) => <GameRow key={game.eventId} game={game} title={`${name(game.away)} @ ${name(game.home)}`} />)}
    </ul>
  );
}
