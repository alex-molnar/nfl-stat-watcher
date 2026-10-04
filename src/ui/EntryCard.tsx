import { useEffect, useState, type CSSProperties } from 'react';
import { freshness, useAthlete, useGameSummary } from '../hooks/queries';
import { scoreEntry } from '../scoring/score';
import type { Profile } from '../scoring/types';
import type { GameInfo } from '../stats/scoreboard';
import { updateEntryTeam } from '../storage/followed';
import type { FollowedEntry } from '../storage/types';
import { Bump } from './Bump';
import { MiniField } from './MiniField';
import { isRedZone, kickoffText, resultText, statLine, textOn } from './format';

interface Props {
  entry: FollowedEntry;
  game: GameInfo | null;
  profiles: Profile[];
  hasSchedule: boolean;
  paused?: boolean;
  onMove: (entry: FollowedEntry, toProfileId: string) => void;
  onRemove: (entry: FollowedEntry, button: HTMLElement) => void;
}

export const entryKey = (e: Pick<FollowedEntry, 'kind' | 'espnId' | 'profileId'>) => `${e.kind}:${e.espnId}:${e.profileId}`;

const sign = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(2)}`;

export function EntryCard({ entry, game, profiles, hasSchedule, paused = false, onMove, onRemove }: Props) {
  const summary = useGameSummary(game, paused);
  const athlete = useAthlete(entry.kind === 'player' ? entry.espnId : undefined);
  const [open, setOpen] = useState(false);

  // Keep the stored team current, for example after a trade.
  useEffect(() => {
    const a = athlete.data?.athlete;
    if (!a?.team) return;
    const position = a.position?.abbreviation ?? entry.position;
    if (a.team.id !== entry.teamId || position !== entry.position) {
      updateEntryTeam(entry.espnId, { teamId: a.team.id, teamAbbr: a.team.abbreviation, position, jersey: a.jersey });
    }
  }, [athlete.data, entry.espnId, entry.teamId, entry.position]);

  const profile = profiles.find((p) => p.id === entry.profileId) ?? profiles[0]!;
  const stats = summary.data;
  const result = scoreEntry(entry, stats, profile.values);
  const total = result.total.toFixed(2);
  const items = statLine(entry, stats);
  const live = game?.state === 'in';
  const redZone = isRedZone(entry, game, stats);
  const home = game?.home.id === entry.teamId;
  const us = game ? (home ? game.home : game.away) : null;
  const them = game ? (home ? game.away : game.home) : null;
  const color = us?.color ?? '#555555';
  const versus = them ? `${home ? 'vs' : 'at'} ${them.abbr}` : null;
  const note = freshness(summary.isError, summary.dataUpdatedAt);
  const situation = live ? stats?.situation : null;
  const role = entry.kind === 'defense' ? 'Team defense' : entry.position;

  let status: string;
  if (!game) status = hasSchedule ? 'Bye week' : 'Game status unavailable';
  else if (game.state === 'post') status = resultText(game, entry.teamId);
  else if (game.state === 'pre') status = `Kickoff ${kickoffText(game.kickoff)}`;
  else status = `Q${game.period} ${game.clock}, ${game.away.abbr} ${game.away.score} at ${game.home.abbr} ${game.home.score}`;

  return (
    <li
      data-entry={entryKey(entry)}
      className={`card${live ? ' live' : ''}${redZone ? ' is-rz' : ''}`}
      style={{ '--team': color, '--team-ink': textOn(color) } as CSSProperties}
    >
      <div className="hd">
        <div className="badge" aria-hidden="true">{entry.teamAbbr}</div>
        <div className="id">
          <h3 className="nm">{entry.name}</h3>
          <div className="sub">
            <span>{`${entry.teamAbbr} ${role}${versus ? `, ${versus}` : ''}`}</span>
            <span className="chip">{profile.name}</span>
          </div>
        </div>
        <button
          type="button"
          className="pts press"
          aria-expanded={open}
          aria-label={`${total} fantasy pts, ${profile.name} breakdown`}
          onClick={() => setOpen((o) => !o)}
        >
          <Bump value={total} />
          <span>fantasy pts</span>
        </button>
      </div>

      {game && situation ? (
        <>
          <MiniField game={game} situation={situation} />
          <div className="dd">
            <span><b>Q{game.period} {game.clock}</b>, {game.away.abbr} {game.away.score} at {game.home.abbr} {game.home.score}</span>
            <span>
              {redZone && <span className="rzt">Red zone </span>}
              {situation.downDistanceText}
            </span>
          </div>
          <div className="dd"><span>{situation.lastPlayText}</span></div>
        </>
      ) : (
        <div className="score">{status}</div>
      )}

      <div className="stats">
        {items.length > 0 ? (
          items.map((s) => (
            <div className="stat" key={s.label}>
              <Bump value={s.value} />
              <span>{s.label}</span>
            </div>
          ))
        ) : (
          <div className="stat"><span>{game?.state === 'pre' ? 'No stats until kickoff' : 'No stats'}</span></div>
        )}
      </div>

      {open && (
        <dl className="brk">
          {result.breakdown.length > 0 ? (
            result.breakdown.map((l) => (
              <div key={l.label}><dt>{l.label}</dt><dd>{sign(l.points)}</dd></div>
            ))
          ) : (
            <div><dt>No points yet</dt><dd>0.00</dd></div>
          )}
        </dl>
      )}

      {note && <p className="note">{note}</p>}

      <div className="ft">
        <label>
          League
          <select value={profile.id} onChange={(e) => onMove(entry, e.target.value)}>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <button type="button" className="rm" onClick={(e) => onRemove(entry, e.currentTarget)} aria-label={`Remove ${entry.name} from ${profile.name}`}>
          Remove
        </button>
      </div>
    </li>
  );
}
