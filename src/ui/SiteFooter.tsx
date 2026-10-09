import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/** Site-wide privacy, profile and support links. */
export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="wrap site-foot">
      <div className="site-foot-links">
        <Link to="/privacy">{t(($) => $.shell.footer.privacy)}</Link>
        <a href="https://github.com/alex-molnar" target="_blank" rel="noreferrer">
          {t(($) => $.shell.footer.github)}
        </a>
        <a href="mailto:molnar.alex98@gmail.com">
          {t(($) => $.shell.footer.email)}
        </a>
      </div>
      <a
        className="btn btn-primary site-foot-coffee"
        href="https://ko-fi.com/R5H524XXQ8"
        target="_blank"
        rel="noreferrer"
      >
        <span aria-hidden="true">☕</span>
        {t(($) => $.shell.footer.buyMeCoffee)}
      </a>
    </footer>
  );
}
