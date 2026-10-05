import { useEffect, useRef, useState } from 'react';
import { backdropClose } from './backdropClose';
import { useTeams } from '../hooks/queries';
import { setLeagueRemoveNonStarters, setLeagueTeam } from '../leagues/import';
import { EspnLoadError } from '../leagues/espn/client';
import { LineupError, fetchLeagueLineups, lineupsUrl, readLineups, type LeagueLineups, type Starter } from '../leagues/espn/lineup';
import { planStarterImport } from '../leagues/starterPlan';
import { addEntry, followedStore, removeEntry, type Side } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import type { FollowedEntry } from '../storage/types';
import { useStore } from '../storage/useStore';
import { PrivateLeagueHelp } from './PrivateLeagueHelp';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Whose starters to bring in: mine, or the opponent's in the current matchup. */
  side?: Side;
  /** A fixed league (vs mode). Without it the dialog offers every imported league. */
  profileId?: string;
}

type Load = { state: 'idle' | 'loading' } | { state: 'ready'; lineups: LeagueLineups } | { state: 'error'; message: string; needsAccess: boolean };

/** One of the three preview lists. The sign and the word carry the meaning; the colour (green, red, none) reinforces it. */
function PlanList({ tone, title, entries }: { tone: 'added' | 'removed' | 'unchanged'; title: string; entries: FollowedEntry[] }) {
  const sign = tone === 'added' ? '+' : tone === 'removed' ? '−' : '';
  return (
    <div className={`plan-list plan-${tone}`}>
      <h4>{title} ({entries.length})</h4>
      {entries.length === 0 ? <p className="muted">None</p> : (
        <ul className="starter-list">
          {entries.map((entry) => <li key={`${entry.kind}:${entry.espnId}`}>{sign && <b aria-hidden="true">{sign} </b>}{entry.name}{entry.position ? ` · ${entry.position}` : ''}</li>)}
        </ul>
      )}
    </div>
  );
}

export function ImportStartersDialog({ open, onClose, side = 'mine', profileId: fixedId }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const profiles = useStore(profilesStore);
  const followed = useStore(followedStore);
  const teams = useTeams();
  const imported = profiles.filter((profile) => profile.source);
  const [chosenId, setChosenId] = useState('');
  const profile = imported.find((candidate) => candidate.id === (fixedId ?? chosenId)) ?? imported[0];
  const source = profile?.source;
  const [load, setLoad] = useState<Load>({ state: 'idle' });
  const [status, setStatus] = useState('');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setStatus('');
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The choice is remembered per league on its profile; the default is to only add.
  const removeOthers = !!source?.removeNonStarters;
  const leagueId = source?.leagueId;
  const season = source?.season;
  useEffect(() => {
    if (!open || !leagueId || !season) return; // closing keeps the last result, which is announced outside the dialog
    const controller = new AbortController();
    setLoad({ state: 'loading' });
    fetchLeagueLineups(leagueId, season, controller.signal).then(
      (lineups) => setLoad({ state: 'ready', lineups }),
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        const needsAccess = cause instanceof EspnLoadError && cause.kind === 'access-denied';
        setLoad({ state: 'error', needsAccess, message: needsAccess ? 'This league is private. Copy its rosters from your signed-in ESPN tab to continue.' : cause instanceof Error ? cause.message : 'Could not load this league.' });
      },
    );
    return () => controller.abort();
  }, [open, leagueId, season]);

  function pasted(text: string): string | null {
    try {
      setLoad({ state: 'ready', lineups: readLineups(text, leagueId!, season!) });
      return null;
    } catch (cause) {
      return cause instanceof LineupError || cause instanceof Error ? cause.message : 'Could not read those rosters.';
    }
  }

  const lineups = load.state === 'ready' ? load.lineups : null;
  const myTeam = lineups && source?.teamId && lineups.teams.some((team) => team.id === source.teamId) ? source.teamId : '';
  const targetTeam = side === 'mine' ? myTeam : myTeam ? lineups?.opponentOf[myTeam] ?? '' : '';
  const targetName = lineups?.teams.find((team) => team.id === targetTeam)?.name;
  const starters = lineups && targetTeam ? lineups.starters[targetTeam] ?? [] : [];
  const sideField = side === 'opponent' ? { side: 'opponent' as const } : {};

  function toEntry(starter: Starter): FollowedEntry | null {
    const nfl = teams.data?.find((team) => team.id === starter.nflTeamId);
    if (!nfl || !profile) return null;
    return {
      kind: starter.kind,
      espnId: starter.espnId,
      name: starter.kind === 'defense' ? nfl.displayName : starter.name,
      teamId: nfl.id,
      teamAbbr: nfl.abbreviation,
      position: starter.position,
      profileId: profile.id,
      ...sideField,
    };
  }

  // Null until the NFL teams are known: without them no starter can become a card, and everything would look removed.
  const incoming = teams.data ? starters.map(toEntry).filter((entry): entry is FollowedEntry => entry !== null) : null;
  const plan = incoming && profile ? planStarterImport(incoming, followed, profile.id, side, removeOthers) : null;

  function add() {
    if (!plan) return;
    plan.removed.forEach(removeEntry);
    plan.added.forEach(addEntry);
    const parts = [`Added ${plan.added.length} ${plan.added.length === 1 ? 'starter' : 'starters'}`];
    if (plan.unchanged.length && !removeOthers) parts.push(`${plan.unchanged.length} already followed`);
    if (removeOthers) parts.push(`removed ${plan.removed.length}`);
    setStatus(`${parts.join(', ')}.`);
    ref.current?.close(); // the native close runs onClose and returns focus to the button that opened the dialog
  }

  const label = profile ? `${profile.name}${source ? `, league ${source.leagueId}` : ''}` : '';
  const heading = side === 'opponent' ? 'Sync opponent starters' : 'Sync your starters';

  return (
    <>
    <dialog ref={ref} aria-labelledby="starters-title" onClose={onClose} {...backdropClose}>
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="starters-title">{heading}</h2>
          <button type="button" className="close" aria-label="Close sync starters dialog" onClick={onClose}>×</button>
        </div>
        {!profile && <p className="muted">Import an ESPN league in Settings first. Starters come from its current matchup.</p>}
        {profile && fixedId === undefined && imported.length > 1 && (
          <label className="field-label">
            League
            <select value={profile.id} onChange={(event) => setChosenId(event.target.value)}>
              {imported.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </select>
          </label>
        )}
        {profile && <p className="muted">Starters in the current matchup of {label}, season {season}. Players already followed are skipped. Nothing is removed unless you tick the box below.</p>}
        {load.state === 'loading' && <p role="status">Loading rosters…</p>}
        {load.state === 'error' && (
          <>
            <p className="error" role="alert">{load.message}</p>
            {load.needsAccess && leagueId && season && <PrivateLeagueHelp url={lineupsUrl(leagueId, season)} what="rosters" leagueLabel={`league ${leagueId}, season ${season}`} onImport={pasted} />}
          </>
        )}
        {lineups && (
          <label className="field-label">
            Your team in this league
            <select value={myTeam} onChange={(event) => { setStatus(''); if (profile && event.target.value) setLeagueTeam(profile.id, event.target.value); }}>
              <option value="">Choose your team</option>
              {lineups.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
        )}
        {lineups && myTeam && side === 'opponent' && !targetTeam && <p className="muted">Your team has no opponent in the current matchup period (a bye).</p>}
        {lineups && targetTeam && (
          <label className="check-row">
            <input type="checkbox" checked={removeOthers} onChange={(event) => { if (profile) setLeagueRemoveNonStarters(profile.id, event.target.checked); }} />
            Remove every non starter player
          </label>
        )}
        {lineups && targetTeam && (
          <section aria-label={`Starters for ${targetName}`} className="plan">
            <h3>{targetName} ({starters.length} {starters.length === 1 ? 'starter' : 'starters'})</h3>
            {starters.length === 0 && <p className="muted">No starters are set for this team.</p>}
            {plan && (
              <>
                <PlanList tone="added" title="To be added" entries={plan.added} />
                <PlanList tone="removed" title="To be removed" entries={plan.removed} />
                <PlanList tone="unchanged" title="Unchanged" entries={plan.unchanged} />
              </>
            )}
          </section>
        )}
        {teams.isError && <p className="error" role="alert">NFL team data is unavailable, so starters cannot be added right now.</p>}
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" disabled={starters.length === 0 || !teams.data} onClick={add}>
            Sync starters
          </button>
        </div>
      </div>
    </dialog>
    {/* Outside the dialog so the result is still announced after it has closed. */}
    <p className="sr" role="status" aria-live="polite">{status}</p>
    </>
  );
}
