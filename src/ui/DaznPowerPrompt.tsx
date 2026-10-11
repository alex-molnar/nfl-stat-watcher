import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { closeGameWindow, openGameWindows, planPower, readOpened, writeOpened } from '../dazn/power';
import { useScoreboard } from '../hooks/queries';
import { daznEnabledStore, daznLinksStore, daznModeStore, daznPathFor } from '../storage/dazn';
import { useStore } from '../storage/useStore';
import { usePaused } from './PauseButton';

/** Power mode: asks before opening a window per live game, and closes the window of a game that ended. */
function PowerWatcher() {
  const { t } = useTranslation();
  const games = useScoreboard(usePaused()).data;
  const links = useStore(daznLinksStore);
  const [opened, setOpened] = useState(readOpened);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [blocked, setBlocked] = useState(0);
  const pathOf = (eventId: string) => daznPathFor(links, eventId);
  const { offer, close } = games ? planPower(games, pathOf, new Set(opened), new Set(dismissed)) : { offer: [], close: [] };

  const closing = close.join(',');
  useEffect(() => {
    if (!closing) return;
    closing.split(',').forEach(closeGameWindow);
    const next = readOpened().filter((id) => !closing.split(',').includes(id));
    writeOpened(next);
    setOpened(next);
  }, [closing]);

  if (offer.length === 0) return null;
  const names = offer.map((game) => `${game.away.abbr} @ ${game.home.abbr}`).join(', ');

  function openAll() {
    const result = openGameWindows(offer, pathOf);
    const next = [...readOpened(), ...result.opened];
    writeOpened(next);
    setOpened(next);
    setBlocked(result.blocked.length);
  }

  return (
    <section className="power-prompt" aria-label={t(($) => $.dazn.power.label)}>
      <p aria-live="polite">
        {t(($) => $.dazn.power.offer, { count: offer.length, names })}
        {blocked > 0 && <> {t(($) => $.dazn.power.blocked, { count: blocked })}</>}
      </p>
      <div className="power-actions">
        <button type="button" className="btn btn-primary press" onClick={openAll}>{t(($) => $.dazn.power.open)}</button>
        <button type="button" className="btn press" onClick={() => { setDismissed((ids) => [...ids, ...offer.map((game) => game.eventId)]); setBlocked(0); }}>{t(($) => $.dazn.power.notNow)}</button>
      </div>
    </section>
  );
}

/** Mounts the watcher only in power mode, so nothing extra is fetched otherwise. */
export function DaznPowerPrompt() {
  const enabled = useStore(daznEnabledStore);
  const mode = useStore(daznModeStore);
  return enabled && mode === 'power' ? <PowerWatcher /> : null;
}
