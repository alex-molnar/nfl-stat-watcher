import { Trans, useTranslation } from 'react-i18next';
import { Header } from './Header';
import { usePageTitle } from './usePageTitle';

const ISSUES = 'https://github.com/alex-molnar/nfl-stat-watcher/issues';

/** The privacy notice. Keep it in step with src/metrics/events.ts and docs/metrics/metrics.md: what is counted there is what is promised here. */
export function PrivacyPage() {
  const { t } = useTranslation();
  usePageTitle(t(($) => $.privacy.title));
  return (
    <>
      <Header />
      <main className="wrap privacy-page">
        <h2 className="section-title" tabIndex={-1} data-page-title>{t(($) => $.privacy.title)}</h2>
        <p>{t(($) => $.privacy.intro, { date: t(($) => $.privacy.lastUpdatedDate) })}</p>

        <h3>{t(($) => $.privacy.browser.heading)}</h3>
        <p>{t(($) => $.privacy.browser.saved)}</p>
        <p>{t(($) => $.privacy.browser.private)}</p>

        <h3>{t(($) => $.privacy.counts.heading)}</h3>
        <p>{t(($) => $.privacy.counts.intro)}</p>
        <ul>
          <li>{t(($) => $.privacy.counts.page)}</li>
          <li>{t(($) => $.privacy.counts.device)}</li>
          <li>{t(($) => $.privacy.counts.league)}</li>
          <li>{t(($) => $.privacy.counts.help)}</li>
          <li>{t(($) => $.privacy.counts.speed)}</li>
          <li>{t(($) => $.privacy.counts.open)}</li>
        </ul>
        <p>{t(($) => $.privacy.counts.totals)}</p>
        <p><Trans t={t} i18nKey={($) => $.privacy.counts.optOut} components={{ code: <code /> }} /></p>

        <h3>{t(($) => $.privacy.logs.heading)}</h3>
        <p>{t(($) => $.privacy.logs.body)}</p>

        <h3>{t(($) => $.privacy.others.heading)}</h3>
        <p><Trans t={t} i18nKey={($) => $.privacy.others.espn} components={{ strong: <strong /> }} /></p>
        <p><Trans t={t} i18nKey={($) => $.privacy.others.fonts} components={{ strong: <strong /> }} /></p>

        <h3>{t(($) => $.privacy.rights.heading)}</h3>
        <p><Trans t={t} i18nKey={($) => $.privacy.rights.body} components={{ a: <a href={ISSUES} target="_blank" rel="noreferrer" /> }} /></p>
      </main>
    </>
  );
}
