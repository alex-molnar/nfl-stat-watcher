import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import summary from '../test/fixtures/summary-pit-cle.json';
import { mahomes, opponent, pitDefense, profilesFixture, scoreboardFixture, warren } from '../test/data';
import { mockFetch } from '../test/mockFetch';
import { declineCamp, inHungarian, renderAt, seed } from '../test/render';
import { i18n } from '../i18n';
import { leadText } from './ScoreBar';
import { resultText } from './format';

beforeEach(declineCamp);

const routes = { scoreboard: scoreboardFixture, 'summary?event=401872964': summary };

describe('Players page in Hungarian', () => {
  it('names the page, the groups, the pause button and the points button', async () => {
    seed([warren, pitDefense, mahomes], profilesFixture);
    mockFetch(routes);
    await inHungarian();
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Lejátszott' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pihenőhét' })).toBeInTheDocument();
    expect(document.title).toBe('Játékosok · Stat Watch');
    expect(screen.getAllByRole('button', { name: /fantasy pont, .* részletezése/ }).length).toBe(3);
    const pause = screen.getByRole('button', { name: 'Élő frissítés szüneteltetése' });
    await userEvent.click(pause);
    expect(screen.getByRole('button', { name: 'Élő frissítés folytatása' })).toBeInTheDocument();
    expect(document.querySelector('main .page-note')).toHaveTextContent('Az élő frissítés szünetel. A látott számok elavultak lehetnek.');
  });

  it('shows the result of a played game and the stat labels in Hungarian', async () => {
    seed([warren, pitDefense, mahomes], profilesFixture);
    mockFetch(routes);
    await inHungarian();
    renderAt('/');
    await screen.findByRole('heading', { name: 'Lejátszott' });
    expect((await screen.findAllByText(/^(Győzelem|Vereség|Döntetlen) \d+-\d+, (otthon|idegenben), \w+ ellen$/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText('elkapott yard').length).toBeGreaterThan(0);
  });

  it('tells a first-time user to add a league, and links to Leagues', async () => {
    seed([], []);
    mockFetch(routes);
    await inHungarian();
    renderAt('/');
    expect((await screen.findAllByText('Játékosok követéséhez előbb adj hozzá egy pontozó ligát.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Irány a Ligák' })).toBeInTheDocument();
  });

  it('opens the add dialog in Hungarian', async () => {
    seed([warren], profilesFixture);
    mockFetch(routes);
    await inHungarian();
    renderAt('/');
    await userEvent.click((await screen.findAllByRole('button', { name: 'Játékos hozzáadása' }))[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Játékos vagy védelem hozzáadása' })).toBeInTheDocument();
    expect(within(dialog).getByRole('searchbox', { name: 'Keresés' })).toHaveAttribute('placeholder', 'Név vagy csapat, például Purdy vagy Bills');
    expect(within(dialog).getByText('Írj be legalább 2 betűt.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Bezárás' })).toBeInTheDocument();
  });
});

describe('Vs page in Hungarian', () => {
  it('names the columns, the league picker and the score bar', async () => {
    seed([warren, opponent(pitDefense)], profilesFixture);
    mockFetch(routes);
    await inHungarian();
    renderAt('/vs');
    expect(await screen.findByRole('region', { name: 'A te játékosaid' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Az ellenfél játékosai' })).toBeInTheDocument();
    expect(screen.getByLabelText('Párharc ligája')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Játékos hozzáadása a te oldaladhoz' }).length).toBe(1);
    expect(document.title).toBe('Párharc · Stat Watch');
    const bar = document.querySelector('.score-bar')!;
    expect(bar).toHaveTextContent(/^Te .* Ellenfél /);
  });
});

describe('texts built outside components, in Hungarian', () => {
  it('uses the current language', async () => {
    await inHungarian();
    expect(i18n.language).toBe('hu');
    expect(leadText(84.2, 71.8)).toBe('Te vezetsz 12.40 ponttal');
    expect(leadText(0, 0)).toBe('Döntetlen');
    const game = { home: { id: '1', abbr: 'PIT', score: 20 }, away: { id: '2', abbr: 'CLE', score: 24 } } as Parameters<typeof resultText>[0];
    expect(resultText(game, '1')).toBe('Vereség 20-24, otthon, CLE ellen');
    expect(resultText(game, '2')).toBe('Győzelem 24-20, idegenben, PIT ellen');
  });
});
