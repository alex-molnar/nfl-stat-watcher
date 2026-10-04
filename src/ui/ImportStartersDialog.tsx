import { useEffect, useRef, useState } from 'react';
import { useTeams } from '../hooks/queries';
import { setLeagueTeam } from '../leagues/import';
import { EspnLoadError } from '../leagues/espn/client';
import { LineupError, fetchLeagueLineups, lineupsUrl, readLineups, type LeagueLineups, type Starter } from '../leagues/espn/lineup';
import { addEntry, followedStore, sameEntry, type Side } from '../storage/followed';
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
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const leagueId = source?.leagueId;
  const season = source?.season;
  useEffect(() => {
    setStatus('');
    if (!open || !leagueId || !season) return;
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
  const sideLabel = side === 'opponent' ? 'opponent' : 'your';

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

  function add() {
    const entries = starters.map(toEntry).filter((entry): entry is FollowedEntry => entry !== null);
    const fresh = entries.filter((entry) => !followed.some((existing) => sameEntry(existing, entry)));
    fresh.forEach(addEntry);
    const skipped = entries.length - fresh.length;
    setStatus(`Added ${fresh.length} ${fresh.length === 1 ? 'starter' : 'starters'}${skipped ? `, ${skipped} already followed` : ''}.`);
  }

  const label = profile ? `${profile.name}${source ? `, league ${source.leagueId}` : ''}` : '';
  const heading = side === 'opponent' ? 'Import opponent starters' : 'Import your starters';

  return (
    <dialog ref={ref} aria-labelledby="starters-title" onClose={onClose}>
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="starters-title">{heading}</h2>
          <button type="button" className="close" aria-label="Close import starters dialog" onClick={onClose}>×</button>
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
        {profile && <p className="muted">Starters in the current matchup of {label}, season {season}. Players already followed are skipped and nothing is removed.</p>}
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
          <section aria-label={`Starters for ${targetName}`}>
            <h3>{targetName} ({starters.length})</h3>
            {starters.length === 0 ? <p className="muted">No starters are set for this team.</p> : (
              <ul className="starter-list">
                {starters.map((starter) => <li key={`${starter.kind}:${starter.espnId}`}>{starter.name}{starter.position ? ` · ${starter.position}` : ''}</li>)}
              </ul>
            )}
          </section>
        )}
        {teams.isError && <p className="error" role="alert">NFL team data is unavailable, so starters cannot be added right now.</p>}
        <p className="muted msg" role="status" aria-live="polite">{status}</p>
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" disabled={starters.length === 0 || !teams.data} onClick={add}>
            Add {starters.length} {sideLabel} {starters.length === 1 ? 'starter' : 'starters'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
