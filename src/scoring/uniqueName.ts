import { i18n } from '../i18n';
import type { Profile } from './types';

/** A league name nobody else has (compared without case): "Office", then "Office 2", "Office 3". */
export function uniqueName(raw: string, others: Profile[]): string {
  const base = raw.trim() || i18n.t(($) => $.leagues.defaults.untitled);
  const taken = new Set(others.map((p) => p.name.toLowerCase()));
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} ${n}`;
  return name;
}
