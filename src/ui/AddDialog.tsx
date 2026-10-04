import { useEffect, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getAthlete } from '../espn/client';
import type { EspnTeamRef } from '../espn/types';
import { useDebounced, usePlayerSearch, useTeams } from '../hooks/queries';
import { addEntry, followedStore } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import type { FollowedEntry } from '../storage/types';

export function AddDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const profiles = useStore(profilesStore);
  const followed = useStore(followedStore);
  const [query, setQuery] = useState('');
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '');
  const term = useDebounced(query.trim(), 300);
  const search = usePlayerSearch(term);
  const teams = useTeams();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
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

  const isFollowed = (kind: FollowedEntry['kind'], espnId: string) =>
    followed.some((f) => f.kind === kind && f.espnId === espnId && f.profileId === profileId);

  function addPlayer(index: number) {
    const a = details[index]?.data?.athlete;
    if (!a?.team) return;
    addEntry({ kind: 'player', espnId: a.id, name: a.displayName, teamId: a.team.id, teamAbbr: a.team.abbreviation, position: a.position?.abbreviation ?? '', jersey: a.jersey, profileId });
  }

  function addDefense(t: EspnTeamRef) {
    addEntry({ kind: 'defense', espnId: t.id, name: t.displayName, teamId: t.id, teamAbbr: t.abbreviation, position: 'D/ST', profileId });
  }

  // aria-disabled, not disabled, so focus stays on the button after it is pressed.
  const addButton = (name: string, meta: string, done: boolean, disabled: boolean, onClick: () => void) => (
    <button
      type="button"
      className="add press"
      aria-disabled={done || disabled || undefined}
      onClick={() => { if (!done && !disabled) onClick(); }}
      aria-label={done ? `${name} added` : `Add ${name}, ${meta}`}
    >
      {done ? 'Added' : 'Add'}
    </button>
  );

  let message: string | null = null;
  if (term.length < 2) message = 'Type at least 2 letters.';
  else if (search.isError || teams.isError) message = 'Search is unavailable right now. Try again in a moment.';
  else if (!search.isFetching && hits.length === 0 && defenses.length === 0) message = `No NFL player or team matches "${term}".`;

  const searching = term.length >= 2 && search.isFetching;
  const count = hits.length + defenses.length;
  const summary = message ?? (searching ? 'Searching' : `${count} ${count === 1 ? 'result' : 'results'}`);

  return (
    <dialog ref={ref} aria-labelledby="add-title" onClose={onClose}>
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="add-title">Add a player or defense</h2>
          <button type="button" className="close" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <label className="field-label">
          Search
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or team, for example Purdy or Bills" autoComplete="off" ref={inputRef} />
        </label>
        <label className="field-label">
          League
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <p role="status" className={message ? 'muted msg' : 'sr'}>{summary}</p>
        <ul className="results">
          {defenses.map((t) => (
            <li key={`d${t.id}`}>
              <span className="r"><b>{t.displayName}</b><small>Team defense</small></span>
              {addButton(t.displayName, 'team defense', isFollowed('defense', t.id), false, () => addDefense(t))}
            </li>
          ))}
          {hits.map((h, i) => {
            const a = details[i]?.data?.athlete;
            const meta = details[i]?.isPending ? 'Loading team' : a?.team ? `${a.team.abbreviation} ${a.position?.abbreviation ?? ''}`.trim() : 'Free agent';
            return (
              <li key={`p${h.id}`}>
                <span className="r"><b>{h.displayName}</b><small>{meta}</small></span>
                {addButton(h.displayName, meta, isFollowed('player', h.id), !a?.team, () => addPlayer(i))}
              </li>
            );
          })}
        </ul>
      </div>
    </dialog>
  );
}
