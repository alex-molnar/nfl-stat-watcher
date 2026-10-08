import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { normalizeEspnLeague } from '../leagues/espn/scoring';
import { parseEspnLeagueSettings } from '../leagues/espn/parse';
import settings from '../test/fixtures/espn-fantasy/public-settings-1900128084-2026.json';
import lineups from '../test/fixtures/espn-fantasy/public-lineups-1900128084-2026.json';
import standings from '../test/fixtures/standings.json';
import { scoreboardFixture } from '../test/data';
import { mockFetch, status } from '../test/mockFetch';
import { inHungarian, renderWithClient, seed } from '../test/render';
import { ImportStartersDialog } from './ImportStartersDialog';
import { SyncTourButton } from './SyncTourButton';

const draft = normalizeEspnLeague(parseEspnLeagueSettings(settings));
const league = { id: 'p1', name: 'Tapai', preset: 'custom' as const, values: draft.values, source: draft.source };
const routes = { scoreboard: scoreboardFixture, standings, 'leagues/1900128084?view=mRoster': lineups };
const open = () => renderWithClient(<MemoryRouter><ImportStartersDialog open onClose={() => {}} /></MemoryRouter>);

describe('sync starters in Hungarian', () => {
  it('shows the dialog, the preview and the result in Hungarian', async () => {
    mockFetch(routes);
    seed([], [league]);
    await inHungarian();
    open();
    expect(await screen.findByRole('heading', { name: 'A kezdőid szinkronizálása' })).toBeInTheDocument();
    await userEvent.selectOptions(await screen.findByLabelText('A csapatod ebben a ligában'), '1');
    const region = await screen.findByRole('region', { name: /Kezdők:/ });
    expect(within(region).getByRole('heading', { level: 3 })).toHaveTextContent(/\(11 kezdő\)/);
    expect(within(region).getByRole('heading', { name: 'Hozzáadandó (11)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Kezdők szinkronizálása' }));
    expect(await screen.findByText('Hozzáadva: 11 kezdő.')).toBeInTheDocument();
  });

  it('explains the private league and its bookmark in Hungarian', async () => {
    mockFetch({ ...routes, 'leagues/1900128084?view=mRoster': status(401) });
    seed([], [league]);
    await inHungarian();
    open();
    expect(await screen.findByText(/Ez a liga privát/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Könyvjelző létrehozása' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Szinkron' })).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'Könyvjelző másolása' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ugrás a ligához' })).toBeInTheDocument();
    expect(screen.getByLabelText('Keretadatok')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Hogyan?' })[0]!);
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('Könyvjelző létrehozása');
    expect(tip).toHaveTextContent('Szinkron');
  });

  it('shows the tour dialog in Hungarian with the Hungarian captions on by default', async () => {
    await inHungarian();
    renderWithClient(<SyncTourButton />);
    expect(screen.getByRole('button', { name: 'Videó megtekintése' })).toBeInTheDocument();
    const video = document.querySelector('video')!;
    expect(video).toHaveAttribute('aria-label', expect.stringContaining('Fumble megmutatja'));
    const tracks = [...video.querySelectorAll('track')];
    expect(tracks.map((track) => [track.srclang, track.label, track.default])).toEqual([['en', 'English', false], ['hu', 'Magyar', true]]);
    expect(screen.getByText('A hang angol, a feliratot bekapcsolhatod.')).toBeInTheDocument();
  });
});
