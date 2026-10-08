import { i18n } from '../../i18n';
import { lineupsUrl } from './lineup';

/** A text as a single-quoted JS string (JSON.stringify does the escaping), so the English code stays as it always was. */
const quote = (text: string) => `'${JSON.stringify(text).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;
/** A text with one value in it (at `marker`) as a JS expression: the pieces around the value are joined to `expression` with +. */
function withValue(text: string, marker: string, expression: string): string {
  const [before = '', after = ''] = text.split(marker);
  return [before && quote(before), expression, after && quote(after)].filter(Boolean).join('+');
}

/**
 * A bookmarklet the user runs on an ESPN fantasy tab while signed in. From a page on espn.com the roster request is
 * same-site, so the browser sends the user's own ESPN cookies, which a request from our site never gets. It cuts the
 * response (about 3 MB of player statistics) down to the fields the app reads, in the same shape ESPN uses, and puts
 * that on the clipboard to paste into the app. Nothing leaves the browser and no cookie is read.
 */
export function rosterBookmarklet(leagueId: string, season: string): string {
  if (!/^\d{1,20}$/.test(leagueId) || !/^\d{4}$/.test(season)) throw new Error('Invalid ESPN league ID or season');
  const url = lineupsUrl(leagueId, season);
  // The bookmark runs on ESPN's page, outside the site, so it carries its texts in the language the site has now.
  const value = '\u0001'; // stands in for the value, which only the bookmark knows
  const answered = withValue(i18n.t(($) => $.sync.bookmarklet.espnAnswered, { status: value }), value, 'r.status');
  const couldNot = withValue(i18n.t(($) => $.sync.bookmarklet.couldNotRead, { message: value }), value, 'e.message');
  const code = `(async()=>{try{
const r=await fetch(${JSON.stringify(url)},{credentials:'include'});
if(!r.ok)throw new Error(r.status===401||r.status===403?${quote(i18n.t(($) => $.sync.bookmarklet.cannotSee))}:${answered});
const j=await r.json();
const out={id:j.id,seasonId:j.seasonId,status:{currentMatchupPeriod:(j.status||{}).currentMatchupPeriod},
schedule:(j.schedule||[]).map(m=>({matchupPeriodId:m.matchupPeriodId,home:{teamId:(m.home||{}).teamId},away:m.away?{teamId:m.away.teamId}:undefined})),
teams:(j.teams||[]).map(t=>({id:t.id,name:t.name,roster:{entries:((t.roster||{}).entries||[]).map(e=>{const p=e.playerPoolEntry.player;return{lineupSlotId:e.lineupSlotId,playerPoolEntry:{player:{id:p.id,fullName:p.fullName,defaultPositionId:p.defaultPositionId,proTeamId:p.proTeamId}}}})}}))};
const text=JSON.stringify(out);
try{await navigator.clipboard.writeText(text);alert(${quote(i18n.t(($) => $.sync.bookmarklet.copied))})}
catch(e){prompt(${quote(i18n.t(($) => $.sync.bookmarklet.copyByHand))},text)}
}catch(e){alert(${couldNot})}})()`;
  return `javascript:${encodeURIComponent(code.replace(/\n/g, '')).replace(/'/g, '%27')}`;
}
