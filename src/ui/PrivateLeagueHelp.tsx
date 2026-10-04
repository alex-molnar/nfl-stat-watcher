import { useState } from 'react';

/** Private leagues need the user's own ESPN session, which the app never sees: the user copies the page text across. */
export function PrivateLeagueHelp({ url, what, leagueLabel, onImport }: {
  url: string | null;
  what: 'settings' | 'rosters';
  leagueLabel: string;
  /** Returns an error message, or null when the pasted text was accepted. */
  onImport: (text: string) => string | null;
}) {
  const [text, setText] = useState('');
  const [problem, setProblem] = useState('');
  const kept = what === 'settings' ? 'Only scoring and lineup settings are kept' : 'Only starting lineups and matchup pairings are kept';
  return (
    <details className="private-help" open>
      <summary>Import {leagueLabel} from your own ESPN session</summary>
      <ol>
        <li>Stay signed in to ESPN in this browser{url ? <>, then <a href={url} target="_blank" rel="noreferrer">open this league’s {what} data</a> in a new tab</> : ''}.</li>
        <li>Select everything on that page (Cmd or Ctrl plus A), copy it and paste it below. {kept}; nothing leaves your browser.</li>
      </ol>
      <label className="field-label">
        {what === 'settings' ? 'Settings' : 'Rosters'} JSON for {leagueLabel}
        <textarea rows={4} value={text} onChange={(event) => { setText(event.target.value); setProblem(''); }} placeholder="Paste the copied ESPN data here" />
      </label>
      {problem && <p className="error" role="alert">{problem}</p>}
      <button type="button" className="btn" disabled={!text.trim()} onClick={() => setProblem(onImport(text) ?? '')}>Use pasted {what} for {leagueLabel}</button>
    </details>
  );
}
