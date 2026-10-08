import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '../i18n';
import { backdropClose } from './backdropClose';
import { DialogMascot, useHint } from './DialogMascot';
import { useTeams } from '../hooks/queries';
import { ALL_LEAGUES } from '../hooks/useMatchup';
import { track } from '../metrics/track';
import { setLeagueRemoveNonStarters, setLeagueTeam } from '../leagues/import';
import { EspnLoadError } from '../leagues/espn/client';
import { rosterBookmarklet } from '../leagues/espn/bookmarklet';
import { LineupError, fetchLeagueLineups, lineupsUrl, readLineups, type LeagueLineups, type Starter } from '../leagues/espn/lineup';
import type { Profile } from '../scoring/types';
import { planStarterImport, starterEntry, type StarterPlan } from '../leagues/starterPlan';
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
  const { t } = useTranslation();
  const nameMode = useStore(nameDisplayStore);
  const sign = tone === 'added' ? '+' : tone === 'removed' ? '−' : '';
  return (
    <div className={`plan-list plan-${tone}`}>
      <h4>{t(($) => $.sync.dialog.planTitle, { title, count: entries.length })}</h4>
      {entries.length === 0 ? <p className="muted">{t(($) => $.sync.dialog.none)}</p> : (
        <ul className="starter-list">
          {entries.map((entry) => <li key={`${entry.kind}:${entry.espnId}`}>{sign && <b aria-hidden="true">{sign} </b>}{displayName(entry, nameMode)}{entry.position ? ` · ${entry.position}` : ''}{leagueOf && <LeagueChip profile={leagueOf(entry)} />}</li>)}
        </ul>
      )}
    </div>
  );
}

type Failure = { id: string; message: string; needsAccess: boolean };

export function ImportStartersDialog({ open, onClose, side = 'mine', profileId: fixedId }: Props) {
  const { t } = useTranslation();
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
      (lineups) => {
        if (!controller.signal.aborted) track('sync_load', { result: 'ok' });
        setLineupsBy((current) => ({ ...current, [pendingId]: lineups }));
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        const needsAccess = cause instanceof EspnLoadError && cause.kind === 'access-denied';
        track('sync_load', { result: needsAccess ? 'private' : 'error' });
        setFailure({ id: pendingId, needsAccess, message: needsAccess ? i18n.t(($) => $.sync.dialog.privateLeague) : cause instanceof Error ? cause.message : i18n.t(($) => $.sync.dialog.loadFailed) });
      },
    );
    return () => controller.abort();
  }, [pendingId, leagueId, season]);

  // A pasted roster counts like a fetched one, so the loop moves on to the next league by itself.
  function pasted(text: string): string | null {
    try {
      const lineups = readLineups(text, leagueId!, season!);
      track('sync_load', { result: 'ok' });
      setLineupsBy((current) => ({ ...current, [pendingId!]: lineups }));
      return null;
    } catch (cause) {
      return cause instanceof LineupError || cause instanceof Error ? cause.message : i18n.t(($) => $.sync.dialog.readFailed);
    }
  }

  const both = side === 'both';
  const sides: Side[] = both ? ['mine', 'opponent'] : [side];
  const loaded = targets.flatMap((target) => (lineupsBy[target.id] ? [{ profile: target, lineups: lineupsBy[target.id]! }] : []));
  const removeOthers = targets.length > 0 && targets.every((target) => target.source?.removeNonStarters);
  const leagueOf = (entry: FollowedEntry) => profiles.find((candidate) => candidate.id === entry.profileId);
  const myTeamIn = (target: Profile, lineups: LeagueLineups) => (target.source?.teamId && lineups.teams.some((team) => team.id === target.source?.teamId) ? target.source.teamId : '');

  const toEntry = (starter: Starter, forSide: Side, target: Profile) => (teams.data ? starterEntry(starter, forSide, target.id, teams.data) : null);

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
  const sideLabel = (forSide: Side) => (forSide === 'mine' ? t(($) => $.sync.dialog.sideMine) : t(($) => $.sync.dialog.sideOpponent));

  /** What one side's plan does, in words: "Added 3 starters, 2 already followed." or "Added 3 starters, removed 1." */
  function describe(plan: StarterPlan) {
    const count = plan.added.length;
    const kept = plan.unchanged.length && !removeOthers ? plan.unchanged.length : 0;
    const removed = plan.removed.length;
    const showRemoved = removeOthers || removed > 0;
    if (kept && showRemoved) return t(($) => $.sync.dialog.summaryKeptRemoved, { count, kept, removed });
    if (kept) return t(($) => $.sync.dialog.summaryKept, { count, kept });
    if (showRemoved) return t(($) => $.sync.dialog.summaryRemoved, { count, removed });
    return t(($) => $.sync.dialog.summaryPlain, { count });
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
      ? applicable.map((panel) => t(($) => $.sync.dialog.sideSummary, { side: sideLabel(panel.side), summary: describe(panel.plan!) })).join(' ')
      : describe(applicable[0]!.plan!));
    track('sync', { side, leagues: everyLeague ? 'many' : 'one' });
    ref.current?.close(); // the native close runs onClose and returns focus to the button that opened the dialog
  }

  const heading = both ? t(($) => $.sync.dialog.headingAll) : side === 'opponent' ? t(($) => $.sync.dialog.headingOpponent) : t(($) => $.sync.dialog.headingMine);
  const mineHere = panels.find((panel) => panel.side === 'mine');
  const opponentHere = panels.find((panel) => panel.side === 'opponent');

  return (
    <>
    <dialog ref={ref} className={both ? 'sync-all' : undefined} aria-labelledby="starters-title" onClose={onClose} {...backdropClose}>
      <DialogMascot />
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="starters-title">{heading}</h2>
          <button type="button" className="close" aria-label={t(($) => $.sync.dialog.closeLabel)} onClick={onClose}>×</button>
        </div>
        {targets.length === 0 && <p className="muted">{t(($) => $.sync.dialog.noLeagues)}</p>}
        {profile && fixedId === undefined && imported.length > 1 && (
          <label className="field-label">
            {t(($) => $.sync.dialog.league)}
            <select value={everyLeague ? ALL_LEAGUES : profile.id} onChange={(event) => setChosenId(event.target.value)}>
              <option value={ALL_LEAGUES}>{t(($) => $.sync.dialog.all)}</option>
              {imported.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </select>
          </label>
        )}
        {pending && everyLeague && <p className="muted" role="status">{t(($) => $.sync.dialog.progress, { current: targets.indexOf(pending) + 1, total: targets.length, name: pending.name })}</p>}
        {pending && !failed && <p role="status">{t(($) => $.sync.dialog.loading)}</p>}
        {failed && pending && (
          <>
            <p className={failed.needsAccess ? undefined : 'error'} role={failed.needsAccess ? 'status' : 'alert'}>{failed.message}</p>
            {failed.needsAccess && leagueId && season && <PrivateLeagueHelp key={pending.id} url={lineupsUrl(leagueId, season)} what="rosters" leagueLabel={t(($) => $.sync.dialog.leagueLabel, { leagueId, season })} onImport={pasted} bookmarklet={rosterBookmarklet(leagueId, season)} espnPage={`https://fantasy.espn.com/football/league?leagueId=${leagueId}&seasonId=${season}`} />}
            {everyLeague && <button type="button" className="btn" onClick={() => setSkipped((current) => [...current, pending.id])}>{t(($) => $.sync.dialog.skip, { name: pending.name })}</button>}
          </>
        )}
        {!pending && loaded.map(({ profile: target, lineups }) => (
          <label key={target.id} className="field-label" data-camp="starters-team">
            {everyLeague ? t(($) => $.sync.dialog.teamIn, { name: target.name }) : t(($) => $.sync.dialog.teamHere)}
            <select {...hint(t(($) => $.sync.dialog.hintTeam))} value={myTeamIn(target, lineups)} onChange={(event) => { setStatus(''); if (event.target.value) setLeagueTeam(target.id, event.target.value); }}>
              <option value="">{t(($) => $.sync.dialog.chooseTeam)}</option>
              {lineups.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
        ))}
        {!pending && !everyLeague && mineHere?.has && opponentHere && !opponentHere.has && (
          <p className="muted">{t(($) => $.sync.dialog.bye)}</p>
        )}
        {!pending && hasTeam && (
          <label className="check-row" data-camp="starters-remove">
            <input type="checkbox" {...hint(t(($) => $.sync.dialog.hintRemove))} checked={removeOthers} onChange={(event) => targets.forEach((target) => setLeagueRemoveNonStarters(target.id, event.target.checked))} />
            {t(($) => $.sync.dialog.removeOthers)}
          </label>
        )}
        <div className={both ? 'plan-sides' : undefined}>
          {!pending && panels.filter((panel) => panel.has).map((panel) => (
            <section key={panel.side} aria-label={t(($) => $.sync.dialog.sectionLabel, { name: everyLeague ? (panel.side === 'mine' ? t(($) => $.sync.dialog.sideMineLower) : t(($) => $.sync.dialog.sideOpponentLower)) : panel.name })} className="plan">
              <h3>{t(($) => $.sync.dialog.panelTitle, { count: panel.starterCount, title: everyLeague ? sideLabel(panel.side) : both ? t(($) => $.sync.dialog.sideWithName, { side: sideLabel(panel.side), name: panel.name }) : panel.name })}</h3>
              {panel.starterCount === 0 && <p className="muted">{t(($) => $.sync.dialog.noStarters)}</p>}
              {panel.plan && (
                <>
                  <PlanList tone="added" title={t(($) => $.sync.dialog.toAdd)} entries={panel.plan.added} leagueOf={everyLeague ? leagueOf : undefined} />
                  <PlanList tone="removed" title={t(($) => $.sync.dialog.toRemove)} entries={panel.plan.removed} leagueOf={everyLeague ? leagueOf : undefined} />
                  <PlanList tone="unchanged" title={t(($) => $.sync.dialog.unchanged)} entries={panel.plan.unchanged} leagueOf={everyLeague ? leagueOf : undefined} />
                </>
              )}
            </section>
          ))}
        </div>
        {teams.isError && <p className="error" role="alert">{t(($) => $.sync.dialog.teamsUnavailable)}</p>}
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={onClose}>{both ? t(($) => $.sync.dialog.cancel) : t(($) => $.sync.dialog.close)}</button>
          <button type="button" className="btn btn-primary" data-camp="starters-sync" disabled={!!pending || !canSync} onClick={add}>
            {both ? t(($) => $.sync.dialog.syncAll) : t(($) => $.sync.dialog.syncStarters)}
          </button>
        </div>
      </div>
    </dialog>
    {/* Outside the dialog so the result is still announced after it has closed. */}
    <p className="sr" role="status" aria-live="polite">{status}</p>
    </>
  );
}
