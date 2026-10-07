import { useEffect, useRef, useState } from 'react';
import { backdropClose } from './backdropClose';
import { DialogMascot, useHint } from './DialogMascot';
import { useTeams } from '../hooks/queries';
import { ALL_LEAGUES } from '../hooks/useMatchup';
import { setLeagueRemoveNonStarters, setLeagueTeam } from '../leagues/import';
import { EspnLoadError } from '../leagues/espn/client';
import { rosterBookmarklet } from '../leagues/espn/bookmarklet';
import { LineupError, fetchLeagueLineups, lineupsUrl, readLineups, type LeagueLineups, type Starter } from '../leagues/espn/lineup';
import type { Profile } from '../scoring/types';
import { planStarterImport, type StarterPlan } from '../leagues/starterPlan';
import { addEntry, followedStore, removeEntry, type Side } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import type { FollowedEntry } from '../storage/types';
import { useStore } from '../storage/useStore';
import { nameDisplayStore } from '../storage/nameDisplay';
import { displayName, textOn } from './format';
import { PrivateLeagueHelp } from './PrivateLeagueHelp';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Whose starters to bring in: mine, the opponent's in the current matchup, or both sides in one go. */
  side?: Side | 'both';
  /** A fixed league (vs mode), or ALL_LEAGUES to go through every imported league in turn. Without it the dialog offers every imported league. */
  profileId?: string;
}

/** The league an entry belongs to, in the league's colour: the colour guides the eye, the name carries the meaning. */
function LeagueChip({ profile }: { profile?: Profile }) {
  if (!profile) return null;
  return <> <span className="chip" style={profile.color ? { background: profile.color, color: textOn(profile.color) } : undefined}>{profile.name}</span></>;
}

/** One of the three preview lists. The sign and the word carry the meaning; the colour (green, red, none) reinforces it. */
function PlanList({ tone, title, entries, leagueOf }: { tone: 'added' | 'removed' | 'unchanged'; title: string; entries: FollowedEntry[]; leagueOf?: (entry: FollowedEntry) => Profile | undefined }) {
  const nameMode = useStore(nameDisplayStore);
  const sign = tone === 'added' ? '+' : tone === 'removed' ? '−' : '';
  return (
    <div className={`plan-list plan-${tone}`}>
      <h4>{title} ({entries.length})</h4>
      {entries.length === 0 ? <p className="muted">None</p> : (
        <ul className="starter-list">
          {entries.map((entry) => <li key={`${entry.kind}:${entry.espnId}`}>{sign && <b aria-hidden="true">{sign} </b>}{displayName(entry, nameMode)}{entry.position ? ` · ${entry.position}` : ''}{leagueOf && <LeagueChip profile={leagueOf(entry)} />}</li>)}
        </ul>
      )}
    </div>
  );
}

type Failure = { id: string; message: string; needsAccess: boolean };

export function ImportStartersDialog({ open, onClose, side = 'mine', profileId: fixedId }: Props) {
  const hint = useHint();
  const ref = useRef<HTMLDialogElement>(null);
  const profiles = useStore(profilesStore);
  const followed = useStore(followedStore);
  const teams = useTeams();
  const imported = profiles.filter((profile) => profile.source);
  const [chosenId, setChosenId] = useState('');
  const everyLeague = (fixedId ?? chosenId) === ALL_LEAGUES;
  const profile = imported.find((candidate) => candidate.id === (fixedId ?? chosenId)) ?? imported[0];
  // The leagues being synced: one, or all of them in turn. Each is loaded (or pasted) before the preview shows.
  const targets = everyLeague ? imported : profile ? [profile] : [];
  const [lineupsBy, setLineupsBy] = useState<Record<string, LeagueLineups>>({});
  const [skipped, setSkipped] = useState<string[]>([]);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [status, setStatus] = useState('');
  const pending = open ? targets.find((target) => !lineupsBy[target.id] && !skipped.includes(target.id)) : undefined;
  const failed = pending && failure?.id === pending.id ? failure : null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setStatus('');
      setLineupsBy({}); // every opening reads the rosters afresh
      setSkipped([]);
      setFailure(null);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const pendingId = pending?.id;
  const leagueId = pending?.source?.leagueId;
  const season = pending?.source?.season;
  useEffect(() => {
    if (!pendingId || !leagueId || !season) return; // closing keeps the last result, which is announced outside the dialog
    const controller = new AbortController();
    fetchLeagueLineups(leagueId, season, controller.signal).then(
      (lineups) => setLineupsBy((current) => ({ ...current, [pendingId]: lineups })),
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        const needsAccess = cause instanceof EspnLoadError && cause.kind === 'access-denied';
        setFailure({ id: pendingId, needsAccess, message: needsAccess ? 'This league is private, and the requested data cannot be obtained automatically. There are two ways to set it up. Via a bookmark, or copying the data manually.' : cause instanceof Error ? cause.message : 'Could not load this league.' });
      },
    );
    return () => controller.abort();
  }, [pendingId, leagueId, season]);

  // A pasted roster counts like a fetched one, so the loop moves on to the next league by itself.
  function pasted(text: string): string | null {
    try {
      const lineups = readLineups(text, leagueId!, season!);
      setLineupsBy((current) => ({ ...current, [pendingId!]: lineups }));
      return null;
    } catch (cause) {
      return cause instanceof LineupError || cause instanceof Error ? cause.message : 'Could not read those rosters.';
    }
  }

  const both = side === 'both';
  const sides: Side[] = both ? ['mine', 'opponent'] : [side];
  const loaded = targets.flatMap((target) => (lineupsBy[target.id] ? [{ profile: target, lineups: lineupsBy[target.id]! }] : []));
  const removeOthers = targets.length > 0 && targets.every((target) => target.source?.removeNonStarters);
  const leagueOf = (entry: FollowedEntry) => profiles.find((candidate) => candidate.id === entry.profileId);
  const myTeamIn = (target: Profile, lineups: LeagueLineups) => (target.source?.teamId && lineups.teams.some((team) => team.id === target.source?.teamId) ? target.source.teamId : '');

  function toEntry(starter: Starter, forSide: Side, target: Profile): FollowedEntry | null {
    const nfl = teams.data?.find((team) => team.id === starter.nflTeamId);
    if (!nfl) return null;
    return {
      kind: starter.kind,
      espnId: starter.espnId,
      name: starter.kind === 'defense' ? nfl.displayName : starter.name,
      teamId: nfl.id,
      teamAbbr: nfl.abbreviation,
      position: starter.position,
      profileId: target.id,
      ...(forSide === 'opponent' ? { side: 'opponent' as const } : {}),
    };
  }

  // One panel per side being synced. Each gathers every loaded league: whose team it is there, their starters
  // and what the import would do to that side. With several leagues the lists are the leagues' plans put together.
  const panels = sides.map((forSide) => {
    const parts = loaded.map(({ profile: target, lineups }) => {
      const mine = myTeamIn(target, lineups);
      const team = forSide === 'mine' ? mine : mine ? lineups.opponentOf[mine] ?? '' : '';
      const starters = team ? lineups.starters[team] ?? [] : [];
      // Null until the NFL teams are known: without them no starter can become a card, and everything would look removed.
      const incoming = teams.data ? starters.map((starter) => toEntry(starter, forSide, target)).filter((entry): entry is FollowedEntry => entry !== null) : null;
      const plan = incoming ? planStarterImport(incoming, followed, target.id, forSide, !!target.source?.removeNonStarters) : null;
      return { team, name: lineups.teams.find((candidate) => candidate.id === team)?.name, starters, plan };
    });
    const plans = parts.map((part) => part.plan);
    const plan: StarterPlan | null = teams.data && plans.every((p) => p) ? {
      added: plans.flatMap((p) => p!.added),
      removed: plans.flatMap((p) => p!.removed),
      unchanged: plans.flatMap((p) => p!.unchanged),
    } : null;
    return { side: forSide, has: parts.some((part) => part.team), name: parts[0]?.name, starterCount: parts.reduce((total, part) => total + part.starters.length, 0), plan };
  });
  const hasTeam = panels.some((panel) => panel.has);
  const canSync = !!teams.data && panels.some((panel) => panel.starterCount > 0);
  const sideLabel = (forSide: Side) => (forSide === 'mine' ? 'Your side' : 'Opponent side');

  /** What one side's plan does, in words: "Added 3 starters, 2 already followed" or "Added 3 starters, removed 1". */
  function describe(plan: StarterPlan) {
    const parts = [`Added ${plan.added.length} ${plan.added.length === 1 ? 'starter' : 'starters'}`];
    if (plan.unchanged.length && !removeOthers) parts.push(`${plan.unchanged.length} already followed`);
    if (removeOthers || plan.removed.length) parts.push(`removed ${plan.removed.length}`);
    return parts.join(', ');
  }

  function add() {
    const applicable = panels.filter((panel) => panel.plan);
    if (applicable.length === 0) return;
    // Every side and league is applied in this one go, removals before additions.
    for (const panel of applicable) {
      panel.plan!.removed.forEach(removeEntry);
      panel.plan!.added.forEach(addEntry);
    }
    setStatus(both
      ? applicable.map((panel) => `${sideLabel(panel.side)}: ${describe(panel.plan!)}.`).join(' ')
      : `${describe(applicable[0]!.plan!)}.`);
    ref.current?.close(); // the native close runs onClose and returns focus to the button that opened the dialog
  }

  const heading = both ? 'Sync all starters' : side === 'opponent' ? 'Sync opponent starters' : 'Sync your starters';
  const mineHere = panels.find((panel) => panel.side === 'mine');
  const opponentHere = panels.find((panel) => panel.side === 'opponent');

  return (
    <>
    <dialog ref={ref} className={both ? 'sync-all' : undefined} aria-labelledby="starters-title" onClose={onClose} {...backdropClose}>
      <DialogMascot />
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="starters-title">{heading}</h2>
          <button type="button" className="close" aria-label="Close sync starters dialog" onClick={onClose}>×</button>
        </div>
        {targets.length === 0 && <p className="muted">Import an ESPN league in Leagues first. Starters come from its current matchup.</p>}
        {profile && fixedId === undefined && imported.length > 1 && (
          <label className="field-label">
            League
            <select value={everyLeague ? ALL_LEAGUES : profile.id} onChange={(event) => setChosenId(event.target.value)}>
              <option value={ALL_LEAGUES}>All</option>
              {imported.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </select>
          </label>
        )}
        {pending && everyLeague && <p className="muted" role="status">League {targets.indexOf(pending) + 1} of {targets.length}: {pending.name}</p>}
        {pending && !failed && <p role="status">Loading rosters…</p>}
        {failed && pending && (
          <>
            <p className={failed.needsAccess ? undefined : 'error'} role={failed.needsAccess ? 'status' : 'alert'}>{failed.message}</p>
            {failed.needsAccess && leagueId && season && <PrivateLeagueHelp key={pending.id} url={lineupsUrl(leagueId, season)} what="rosters" leagueLabel={`league ${leagueId}, season ${season}`} onImport={pasted} bookmarklet={rosterBookmarklet(leagueId, season)} espnPage={`https://fantasy.espn.com/football/league?leagueId=${leagueId}&seasonId=${season}`} />}
            {everyLeague && <button type="button" className="btn" onClick={() => setSkipped((current) => [...current, pending.id])}>Skip {pending.name}</button>}
          </>
        )}
        {!pending && loaded.map(({ profile: target, lineups }) => (
          <label key={target.id} className="field-label" data-camp="starters-team">
            {everyLeague ? `Your team in ${target.name}` : 'Your team in this league'}
            <select {...hint('Pick your own fantasy team, so I know whose lineup to read. It is remembered for next time.')} value={myTeamIn(target, lineups)} onChange={(event) => { setStatus(''); if (event.target.value) setLeagueTeam(target.id, event.target.value); }}>
              <option value="">Choose your team</option>
              {lineups.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
        ))}
        {!pending && !everyLeague && mineHere?.has && opponentHere && !opponentHere.has && (
          <p className="muted">Your team has no opponent in the current matchup period (a bye).</p>
        )}
        {!pending && hasTeam && (
          <label className="check-row" data-camp="starters-remove">
            <input type="checkbox" {...hint('Players you follow in this league who are not in the lineup are removed too. Off, nothing is removed.')} checked={removeOthers} onChange={(event) => targets.forEach((target) => setLeagueRemoveNonStarters(target.id, event.target.checked))} />
            Remove every non starter player
          </label>
        )}
        <div className={both ? 'plan-sides' : undefined}>
          {!pending && panels.filter((panel) => panel.has).map((panel) => (
            <section key={panel.side} aria-label={`Starters for ${everyLeague ? sideLabel(panel.side).toLowerCase() : panel.name}`} className="plan">
              <h3>{everyLeague ? sideLabel(panel.side) : `${both ? `${sideLabel(panel.side)}: ` : ''}${panel.name}`} ({panel.starterCount} {panel.starterCount === 1 ? 'starter' : 'starters'})</h3>
              {panel.starterCount === 0 && <p className="muted">No starters are set for this team.</p>}
              {panel.plan && (
                <>
                  <PlanList tone="added" title="To be added" entries={panel.plan.added} leagueOf={everyLeague ? leagueOf : undefined} />
                  <PlanList tone="removed" title="To be removed" entries={panel.plan.removed} leagueOf={everyLeague ? leagueOf : undefined} />
                  <PlanList tone="unchanged" title="Unchanged" entries={panel.plan.unchanged} leagueOf={everyLeague ? leagueOf : undefined} />
                </>
              )}
            </section>
          ))}
        </div>
        {teams.isError && <p className="error" role="alert">NFL team data is unavailable, so starters cannot be added right now.</p>}
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={onClose}>{both ? 'Cancel' : 'Close'}</button>
          <button type="button" className="btn btn-primary" data-camp="starters-sync" disabled={!!pending || !canSync} onClick={add}>
            {both ? 'Sync all starters' : 'Sync starters'}
          </button>
        </div>
      </div>
    </dialog>
    {/* Outside the dialog so the result is still announced after it has closed. */}
    <p className="sr" role="status" aria-live="polite">{status}</p>
    </>
  );
}
