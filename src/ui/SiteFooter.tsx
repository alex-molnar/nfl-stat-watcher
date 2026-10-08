import { Link } from 'react-router';

/** Under every page: the one link that has to be reachable from anywhere. */
export function SiteFooter() {
  return (
    <footer className="wrap site-foot">
      <Link to="/privacy">Privacy</Link>
    </footer>
  );
}
