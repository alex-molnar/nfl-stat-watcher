import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { applyLanguage, languageStore } from '../i18n';
import { reloadAllStores } from '../storage/store';
import { profilesFixture } from '../test/data';
import { inHungarian, renderAt, seed } from '../test/render';

const setCamp = (phase: string, step = 0, sub = 0) => {
  localStorage.setItem('nflsw:v1:camp', JSON.stringify({ phase, step, sub }));
  reloadAllStores();
};
const camp = () => screen.getByRole('region', { name: 'Újonctábor' });

describe('Rookie camp in Hungarian', () => {
  beforeEach(inHungarian);

  it('offers the camp in the welcome dialog, and the dialog mascot says each button’s hint', async () => {
    renderAt('/');
    const dialog = await screen.findByRole('dialog', { name: 'Szia, Fumble vagyok!' }, { timeout: 3000 });
    expect(dialog).toHaveAccessibleDescription(/szemüveges focilabda.*edzőtáboromhoz/);
    expect(within(dialog).getByRole('button', { name: 'Irány az edzőtábor' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Kihagyom, és kikapcsolom: Fumble' })).toBeInTheDocument();
    await userEvent.hover(within(dialog).getByRole('button', { name: 'Kihagyom' }));
    await waitFor(() => expect(dialog.querySelector('.perch-say')).toHaveTextContent('Később a Beállításokból elindíthatod.'));
  });

  it('says a drill’s step in a speech bubble with Hungarian buttons', async () => {
    seed([], profilesFixture);
    setCamp('running', 1);
    renderAt('/');
    expect(camp()).toHaveTextContent('Második gyakorlat: kövess egy játékost. Nyomd meg a Játékos hozzáadása gombot.');
    expect(camp()).toHaveTextContent('Fumble · gyakorlat: 2 / 6');
    expect(within(camp()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Gyakorlat kihagyása', 'Kilépés a táborból']);
  });

  it('updates the open bubble when the language changes', async () => {
    seed([], profilesFixture);
    setCamp('running', 1);
    renderAt('/');
    expect(camp()).toHaveTextContent('Második gyakorlat');
    await act(async () => { languageStore.set('en'); await applyLanguage(); });
    const english = screen.getByRole('region', { name: 'Rookie camp' });
    expect(english).toHaveTextContent('Second drill: follow a player. Press Add player.');
    expect(within(english).getByRole('button', { name: 'Skip drill' })).toBeInTheDocument();
  });

  it('congratulates in the finish dialog', async () => {
    seed([], profilesFixture);
    setCamp('finished');
    renderAt('/');
    const dialog = await screen.findByRole('dialog', { name: 'Touchdown!' });
    expect(dialog).toHaveAccessibleDescription('Ennyi volt a gyakorlás. Mostantól a csapat tagja vagy! A Beállításokban bármikor újra végigcsinálhatod.');
    expect(within(dialog).getByRole('button', { name: 'Kész' })).toBeInTheDocument();
  });
});
