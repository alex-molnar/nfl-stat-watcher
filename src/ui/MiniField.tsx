import type { CSSProperties } from 'react';
import type { GameInfo } from '../stats/scoreboard';
import type { Situation } from '../stats/types';
import { textOn } from './format';

export function MiniField({ game, situation }: { game: GameInfo; situation: Situation }) {
  const offense = game.home.id === situation.possessionTeamId ? game.home : game.away;
  const defense = offense === game.home ? game.away : game.home;
  const yards = Math.min(100, Math.max(0, situation.yardsToEndzone));
  // The offense always attacks to the right; each endzone is 10 of 120 yards.
  const x = 8.3333 + (100 - yards) * 0.83333;
  const style = {
    '--own': offense.color, '--own-ink': textOn(offense.color),
    '--opp': defense.color, '--opp-ink': textOn(defense.color),
  } as CSSProperties;
  return (
    <div className="field" role="img" aria-label={`${offense.abbr} has the ball, ${yards} ${yards === 1 ? 'yard' : 'yards'} from the end zone`} style={style}>
      <div className="ez l">{offense.abbr}</div>
      <div className="ez r">{defense.abbr}</div>
      <div className="rzone" />
      {/* A new key on change of possession makes the ball jump instead of glide. */}
      <div key={offense.id} className="ballrail" style={{ transform: `translateX(${x}%)` }}>
        <div className="los" />
        <div className="ball" />
      </div>
    </div>
  );
}
