import { lineupsUrl } from './lineup';

/**
 * A bookmarklet the user runs on an ESPN fantasy tab while signed in. From a page on espn.com the roster request is
 * same-site, so the browser sends the user's own ESPN cookies, which a request from our site never gets. It cuts the
 * response (about 3 MB of player statistics) down to the fields the app reads, in the same shape ESPN uses, and puts
 * that on the clipboard to paste into the app. Nothing leaves the browser and no cookie is read.
 */
export function rosterBookmarklet(leagueId: string, season: string): string {
  if (!/^\d{1,20}$/.test(leagueId) || !/^\d{4}$/.test(season)) throw new Error('Invalid ESPN league ID or season');
  const url = lineupsUrl(leagueId, season);
  const code = `(async()=>{try{
const r=await fetch(${JSON.stringify(url)},{credentials:'include'});
if(!r.ok)throw new Error(r.status===401||r.status===403?'this ESPN account cannot see the league (are you signed in?)':'ESPN answered '+r.status);
const j=await r.json();
const out={id:j.id,seasonId:j.seasonId,status:{currentMatchupPeriod:(j.status||{}).currentMatchupPeriod},
schedule:(j.schedule||[]).map(m=>({matchupPeriodId:m.matchupPeriodId,home:{teamId:(m.home||{}).teamId},away:m.away?{teamId:m.away.teamId}:undefined})),
teams:(j.teams||[]).map(t=>({id:t.id,name:t.name,roster:{entries:((t.roster||{}).entries||[]).map(e=>{const p=e.playerPoolEntry.player;return{lineupSlotId:e.lineupSlotId,playerPoolEntry:{player:{id:p.id,fullName:p.fullName,defaultPositionId:p.defaultPositionId,proTeamId:p.proTeamId}}}})}}))};
const text=JSON.stringify(out);
try{await navigator.clipboard.writeText(text);alert('Stat Watch: lineups copied. Go back to Stat Watch and paste them.')}
catch(e){prompt('Stat Watch: copy this text (Ctrl or Cmd + C), then paste it in Stat Watch.',text)}
}catch(e){alert('Stat Watch could not read the league: '+e.message)}})()`;
  return `javascript:${encodeURIComponent(code.replace(/\n/g, '')).replace(/'/g, '%27')}`;
}
