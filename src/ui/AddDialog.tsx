import { useEffect, useRef, useState } from 'react';
import { backdropClose } from './backdropClose';
import { DialogMascot, useHint } from './DialogMascot';
import { useQueries } from '@tanstack/react-query';
import { getAthlete } from '../espn/client';
import { CAMP_PROFILE_ID } from '../espn/campSandbox';
import type { EspnTeamRef } from '../espn/types';
import { useDebounced, usePlayerSearch, useTeams } from '../hooks/queries';
import { addEntry, followedStore, sameEntry, type Side } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { nameDisplayStore } from '../storage/nameDisplay';
import { useStore } from '../storage/useStore';
import { displayName } from './format';
import type { FollowedEntry } from '../storage/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Which side new entries join. Without it (Players page) cards join your side and the title says nothing about sides. */
  side?: Side;
  /** A fixed league (vs mode): hides the league select and names the side and league in the title. */
  profileId?: string;
}

export function AddDialog({ open, onClose, side, profileId: fixedProfileId }: Props) {
  const hint = useHint();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const profiles = useStore(profilesStore);
  const followed = useStore(followedStore);
  const nameMode = useStore(nameDisplayStore);
  const [query, setQuery] = useState('');
  const [chosenId, setChosenId] = useState(profiles[0]?.id ?? '');
  const profileId = fixedProfileId ?? chosenId;
  const sideField = side === 'opponent' ? { side: 'opponent' as const } : {}; // mine stays without the key
  const title =
    fixedProfileId !== undefined
      ? `Add to ${side === 'opponent' ? 'opponent side' : 'your side'}, ${profiles.find((p) => p.id === fixedProfileId)?.name ?? ''}`
      : side ? `Add to ${side === 'opponent' ? 'opponent side' : 'your side'}, choose a league` : 'Add a player or defense';
  const term = useDebounced(query.trim(), 300);
  const search = usePlayerSearch(term);
  const teams = useTeams();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery(''); // each opening starts clean, not with the other side's last search
      if (profilesStore.get().some((p) => p.id === CAMP_PROFILE_ID)) setChosenId(CAMP_PROFILE_ID); // Rookie camp's practice league is what the player drill asks for
      dialog.showModal();
      inputRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const hits = search.data ?? [];
  const details = useQueries({
    queries: hits.map((h) => ({ queryKey: ['athlete', h.id], queryFn: () => getAthlete(h.id), staleTime: Infinity, retry: 1 })),
  });
  const lower = term.toLowerCase();
  const defenses: EspnTeamRef[] =
    term.length >= 2
      ? (teams.data ?? []).filter((t) => [t.displayName, t.location, t.name, t.abbreviation].some((s) => s?.toLowerCase().includes(lower)))
      : [];

  // Same side and league only, so a player already on the other side can still be added.
  const isFollowed = (kind: FollowedEntry['kind'], espnId: string) =>
    followed.some((f) => sameEntry(f, { kind, espnId, profileId, ...sideField }));

  function addPlayer(index: number) {
    const a = details[index]?.data?.athlete;
    if (!a?.team) return;
    addEntry({ kind: 'player', espnId: a.id, name: a.displayName, teamId: a.team.id, teamAbbr: a.team.abbreviation, position: a.position?.abbreviation ?? '', jersey: a.jersey, profileId, ...sideField });
  }

  function addDefense(t: EspnTeamRef) {
    addEntry({ kind: 'defense', espnId: t.id, name: t.displayName, teamId: t.id, teamAbbr: t.abbreviation, position: 'D/ST', profileId, ...sideField });
  }

  const shown = (name: string) => displayName({ kind: 'player', name }, nameMode);

  // aria-disabled, not disabled, so focus stays on the button after it is pressed.
  const addButton = (name: string, meta: string, done: boolean, disabled: boolean, onClick: () => void, result?: string) => (
    <button
      type="button"
      className="add press"
      data-result={result}
      aria-disabled={done || disabled || undefined}
      onClick={() => { if (!done && !disabled) onClick(); }}
      aria-label={done ? `${name} added` : `Add ${name}, ${meta}`}
    >
      {done ? 'Added' : 'Add'}
    </button>
  );

  let message: string | null = null;
  const nothing = !search.isFetching && hits.length === 0 && defenses.length === 0;
  if (term.length < 2) message = 'Type at least 2 letters.';
  else if (search.isError) {
    message = defenses.length > 0
      ? 'Player search is unavailable right now. Showing team defenses only.'
      : 'Search is unavailable right now. Try again in a moment.';
  } else if (teams.isError) {
    if (nothing) message = `Team defenses are unavailable right now. No NFL player matches "${term}".`;
    else if (!search.isFetching) message = 'Team defenses are unavailable right now. Showing players only.';
  } else if (nothing) message = `No NFL player or team matches "${term}".`;

  const searching = term.length >= 2 && search.isFetching;
  const count = hits.length + defenses.length;
  const summary = message ?? (searching ? 'Searching' : `${count} ${count === 1 ? 'result' : 'results'}`);

  return (
    <dialog ref={ref} aria-labelledby="add-title" onClose={onClose} {...backdropClose}>
      <DialogMascot />
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="add-title">{title}</h2>
          <button type="button" className="close" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <label className="field-label" data-camp="add-dialog-search">
          Search
          <input type="search" {...hint("Type a player's name, or a team to follow its defense.")} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or team, for example Purdy or Bills" autoComplete="off" ref={inputRef} />
        </label>
        {fixedProfileId === undefined && (
          <label className="field-label" data-camp="add-dialog-league">
            League
            <select {...hint("Which league's scoring counts this player's points.")} value={chosenId} onChange={(e) => setChosenId(e.target.value)}>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <p role="status" className={message ? 'muted msg' : 'sr'}>{summary}</p>
        <ul className="results" data-camp="add-dialog-results">
          {defenses.map((t) => (
            <li key={`d${t.id}`}>
              <span className="r"><b>{t.displayName}</b><small>Team defense</small></span>
              {addButton(t.displayName, 'team defense', isFollowed('defense', t.id), false, () => addDefense(t))}
            </li>
          ))}
          {hits.map((h, i) => {
            const a = details[i]?.data?.athlete;
            const meta = details[i]?.isPending
              ? 'Loading team'
              : details[i]?.isError
                ? 'Details unavailable'
                : a?.team
                  ? `${a.team.abbreviation} ${a.position?.abbreviation ?? ''}`.trim()
                  : 'Free agent';
            return (
              <li key={`p${h.id}`}>
                <span className="r"><b>{shown(h.displayName)}</b><small>{meta}</small></span>
                {addButton(shown(h.displayName), meta, isFollowed('player', h.id), !a?.team, () => addPlayer(i), h.displayName)}
              </li>
            );
          })}
        </ul>
      </div>
    </dialog>
  );
}
