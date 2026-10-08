import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/** Under every page: the one link that has to be reachable from anywhere. */
export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="wrap site-foot">
      <Link to="/privacy">{t(($) => $.shell.footer.privacy)}</Link>
    </footer>
  );
}
