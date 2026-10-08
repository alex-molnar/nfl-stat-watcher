import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { freshness, useAthlete, useGameSummary, useLeagueInjuries } from '../hooks/queries';
import { useCelebration } from '../hooks/useCelebration';
import { useHighlights } from '../hooks/useHighlights';
import { HighlightsDialog } from './HighlightsDialog';
import { isSeen, markSeen, subscribeSeen } from './seenHighlights';
import { scoreEntry } from '../scoring/score';
import type { Profile } from '../scoring/types';
import type { GameInfo } from '../stats/scoreboard';
import { entryKey, sideOf, updateEntryTeam } from '../storage/followed';
import type { FollowedEntry } from '../storage/types';
import { Bump } from './Bump';
import { MiniField } from './MiniField';
import { injuryLabel, injuryOf, injuryTone, isOut } from '../stats/injury';
import { onRightSide } from '../stats/liveOrder';
import { nameDisplayStore } from '../storage/nameDisplay';
import { useStore } from '../storage/useStore';
import { displayName, isOffense, isRedZone, kickoffText, resultText, statLine, textOn } from './format';

interface Props {
  entry: FollowedEntry;
  game: GameInfo | null;
  profiles: Profile[];
  hasSchedule: boolean;
  paused?: boolean;
  /** Off on the Vs page: a League select that moves a card on change would pull it out of the matchup mid-keypress. */
  movable?: boolean;
  onMove?: (entry: FollowedEntry, toProfileId: string) => void;
  onRemove: (entry: FollowedEntry, button: HTMLElement) => void;
}

/** The long takeover is for scores; the other big plays get a shorter one. */
const LONG = new Set(['td', 'fg', 'tdallowed', 'missfg', 'intthrown', 'fumblelost']);
/** Eighteen sparks fanned out from the card centre, spread evenly with a few different distances. */
const SPARKS: CSSProperties[] = Array.from({ length: 18 }, (_, i) => ({ '--a': `${i * 20}deg`, '--d': `${95 + (i % 3) * 38}px` }) as CSSProperties);

const sign = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(2)}`;

export function EntryCard({ entry, game, profiles, hasSchedule, paused = false, movable = true, onMove, onRemove }: Props) {
  const { t } = useTranslation();
  const name = displayName(entry, useStore(nameDisplayStore));
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
  const leagueInjuries = useLeagueInjuries(paused).data;
  const injury = entry.kind === 'player' ? injuryOf(entry.espnId, stats, leagueInjuries) : undefined;
  const out = isOut(injury); // a player ruled out never counts as on the field or in the red zone
  const redZone = isRedZone(entry, game, stats) && !out;
  const celebration = useCelebration(entry, stats, live);
  const clips = useHighlights(entry, stats);
  const [watching, setWatching] = useState(false);
  const unseen = useSyncExternalStore(subscribeSeen, () => clips.filter((clip) => !isSeen(clip.id)).length);
  const home = game?.home.id === entry.teamId;
  const us = game ? (home ? game.home : game.away) : null;
  const them = game ? (home ? game.away : game.home) : null;
  const color = us?.color ?? '#555555';
  const versus = them ? (home ? t(($) => $.shell.entry.versusHome, { opponent: them.abbr }) : t(($) => $.shell.entry.versusAway, { opponent: them.abbr })) : null;
  const note = paused ? null : freshness(summary.isError, summary.dataUpdatedAt); // nothing retries while paused
  const situation = live ? stats?.situation : null;
  const onField = !!situation && !out && onRightSide(entry, situation);
  const role = entry.kind === 'defense' ? t(($) => $.shell.entry.teamDefense) : entry.position;
  const opposing = sideOf(entry) === 'opponent'; // opponent cards never move between leagues

  let status: string;
  const scoreValues = game ? { period: game.period, clock: game.clock, away: game.away.abbr, awayScore: game.away.score, home: game.home.abbr, homeScore: game.home.score } : {};
  if (!game) status = hasSchedule ? t(($) => $.shell.entry.bye) : t(($) => $.shell.entry.statusUnavailable);
  else if (game.state === 'post') status = resultText(game, entry.teamId);
  else if (game.state === 'pre') status = t(($) => $.shell.entry.kickoff, { time: kickoffText(game.kickoff) });
  else status = t(($) => $.shell.entry.live, scoreValues);

  return (
    <li
      data-entry={entryKey(entry)}
      className={`card${live ? ' live' : ''}${onField && !redZone ? ' on-field' : ''}${redZone ? ' is-rz' : ''}${paused ? ' still' : ''}`}
      style={{ '--team': color, '--team-ink': textOn(color) } as CSSProperties}
    >
      {celebration && (celebration.event.tier === 'big' ? (
        <>
          <span key={`fx-${celebration.id}`} className={`celebrate celebrate-${celebration.event.kind}${LONG.has(celebration.event.kind) ? ' celebrate-long' : ''}${celebration.event.tone === 'bad' ? ' tone-bad' : ''}`} aria-hidden="true">
            {celebration.event.kind === 'td' && SPARKS.map((spark, i) => <i key={i} style={spark} />)}
            <span className="celebrate-word" style={{ '--chars': celebration.event.label.length } as CSSProperties}>{celebration.event.label}</span>
          </span>
          <span key={`tag-${celebration.id}`} className={`play-tag play-late play-${celebration.event.kind}${celebration.event.tone === 'bad' ? ' tone-bad' : ''}`} aria-hidden="true">{celebration.event.label}</span>
        </>
      ) : (
        <>
          <span key={`ring-${celebration.id}`} className={`burst burst-${celebration.event.kind}${celebration.event.tone === 'bad' ? ' tone-bad' : ''}`} aria-hidden="true" />
          <span key={`tag-${celebration.id}`} className={`play-tag play-${celebration.event.kind}${celebration.event.tone === 'bad' ? ' tone-bad' : ''}`} aria-hidden="true">{celebration.event.label}</span>
        </>
      ))}
      <span className="sr" aria-live="polite" aria-atomic="true">{celebration ? t(($) => $.shell.entry.celebration, { name, label: celebration.event.label.toLowerCase() }) : ''}</span>
      <div className="hd">
        <h3 className="nm">{name}</h3>
        <button
          type="button"
          className="pts press"
          aria-expanded={open}
          aria-label={profile.source?.issues.length ? t(($) => $.shell.entry.ptsLabelWarnings, { total, league: profile.name, n: profile.source.issues.length }) : t(($) => $.shell.entry.ptsLabel, { total, league: profile.name })}
          onClick={() => setOpen((o) => !o)}
        >
          <Bump value={total} />
          <span>{t(($) => $.shell.entry.fantasyPts)}</span>
        </button>
        <div className="badge" aria-hidden="true">{entry.teamAbbr}</div>
        <div className="sub">
          <span>{versus ? t(($) => $.shell.entry.subVersus, { team: entry.teamAbbr, role, versus }) : t(($) => $.shell.entry.sub, { team: entry.teamAbbr, role })}</span>
          {onField && <span className="sr">{entry.kind === 'defense' || !isOffense(entry.position) ? t(($) => $.shell.entry.defenseOnField) : t(($) => $.shell.entry.offenseOnField)}</span>}
        </div>
        <span className="chip league-chip" style={profile.color ? { background: profile.color, color: textOn(profile.color) } : undefined}>{profile.name}</span>
        {injury && <div className="inj-row"><span className={`inj inj-${injuryTone(injury)}`}>{injuryLabel(injury)}</span></div>}
      </div>

      {game && situation ? (
        <>
          <MiniField game={game} situation={situation} />
          <div className="dd">
            <span><Trans t={t} i18nKey={($) => $.shell.entry.liveBold} values={scoreValues} components={{ b: <b /> }} /></span>
            <span>
              {redZone && <span className="rzt">{t(($) => $.shell.entry.redZone)}{' '}</span>}
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
          <div className="stat"><span>{game?.state === 'pre' ? t(($) => $.shell.entry.noStatsPre) : t(($) => $.shell.entry.noStats)}</span></div>
        )}
      </div>

      {open && (
        <dl className="brk">
          {result.breakdown.length > 0 ? (
            result.breakdown.map((l) => (
              <div key={l.label}><dt>{l.label}</dt><dd>{sign(l.points)}</dd></div>
            ))
          ) : (
            <div><dt>{t(($) => $.shell.entry.noPoints)}</dt><dd>0.00</dd></div>
          )}
        </dl>
      )}

      {open && profile.source?.issues.length ? (
        <details className="compat-warning" open>
          <summary>{t(($) => $.shell.entry.importedLimits, { n: profile.source.issues.length })}</summary>
          <ul>{profile.source.issues.map((issue, index) => <li key={`${issue.providerKeys[0]}-${index}`}>{issue.message}</li>)}</ul>
        </details>
      ) : null}

      {note && <p className="note">{note}</p>}

      <div className="ft">
        {clips.length > 0 && (
          <button type="button" className={`hl-btn press${unseen ? ' fresh' : ''}`} onClick={() => setWatching(true)} aria-label={unseen ? t(($) => $.shell.entry.highlightsNewLabel, { name, n: clips.length }) : t(($) => $.shell.entry.highlightsLabel, { name, n: clips.length })}>
            <span aria-hidden="true">▶</span><span className="hl-word" aria-hidden="true"> {t(($) => $.shell.entry.highlightsWord)}</span> {clips.length}{unseen > 0 && <i className="hl-dot" aria-hidden="true" />}
          </button>
        )}
        {movable && !opposing && (
          <label>
            {t(($) => $.shell.entry.league)}
            <select aria-label={t(($) => $.shell.entry.leagueFor, { name })} value={profile.id} onChange={(e) => onMove?.(entry, e.target.value)}>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <button
          type="button"
          className="rm"
          onClick={(e) => onRemove(entry, e.currentTarget)}
          aria-label={opposing ? t(($) => $.shell.entry.removeOpponentLabel, { name, league: profile.name }) : t(($) => $.shell.entry.removeLabel, { name, league: profile.name })}
        >
          {t(($) => $.shell.entry.remove)}
        </button>
      </div>
      {clips.length > 0 && <HighlightsDialog open={watching} onClose={() => setWatching(false)} playerName={name} clips={clips} onWatched={markSeen} />}
    </li>
  );
}
