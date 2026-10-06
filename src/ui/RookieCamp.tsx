import { useEffect, useLayoutEffect, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { campStore, endCamp } from '../storage/camp';
import { addDemoLeague } from '../storage/demoLeague';
import { followedStore, sideOf } from '../storage/followed';
import { mascotEnabledStore, mascotNameStore } from '../storage/mascot';
import { profilesStore } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import { dialogsOpen, registerCampMascot, subscribeDialogs } from './dialogsOpen';
import { Mascot, SEAT_Y } from './Mascot';
import { isMascotFlying, subscribeMascotFlight } from './mascotFlight';
import { TypedText } from './TypedText';

interface Facts { leagues: number; followed: number; path: string }

interface Drill {
  /** Where the control for this drill lives; elsewhere the camp points at that page's tab instead. No page: the control is the tab itself. */
  on?: '/' | '/leagues';
  target: string;
  text: string;
  /** What is said while the user is on another page than `on`. */
  go?: string;
  /** Done by the state alone, or by pressing something that matches `clicked`. */
  done?: (facts: Facts) => boolean;
  clicked?: string;
  /** Offers a ready-made league, for a user who has none and would rather not import one just to practise. */
  practice?: boolean;
}

export const DRILLS: Drill[] = [
  { on: '/leagues', target: '[data-camp="add-league"]', go: 'First drill: a league. Open Leagues and set one up.', text: 'First drill: set up a league. Press Add a league, or Import leagues if you play on ESPN.', done: (f) => f.leagues > 0, practice: true },
  { on: '/', target: '[data-camp="add-player"]', go: 'Second drill: follow a player. Open Players.', text: 'Second drill: follow a player. Press Add player and pick someone from your league.', done: (f) => f.followed > 0 },
  { target: '.nav a[href="/vs"]', text: 'Third drill: pit two sides against each other. Open Vs Mode.', done: (f) => f.path === '/vs' },
  { on: '/', target: '.hl-btn', go: 'Last drill: watch a highlight. Open Players.', text: 'Last drill: big plays get a ▶ Highlights button on a player’s card. Open one when you see it, or skip this drill.', clicked: '.hl-btn' },
];

const CARD_W = 340;
const GAP = 14;
const SIZE = 72; // px: the mascot sits on the card's top edge like in a dialog, seated, with its legs hanging into the card
const PERCH = Math.round((SEAT_Y / 200) * SIZE); // how far it rises above that edge, so a card put below a control leaves room for it
const MARGIN = 12;
const CARD_H = 190; // about how tall the card is
const HEADER = 120; // px from the top: above this a control is in the header, which has other controls beside it
const BESIDE_MAX = 300; // a control wider than this is a row or a panel, and the card goes below it
const NARROW = 700; // px of window width below which the page stacks its controls

/**
 * Where the card goes: beside the control it talks about, else the bottom corner. A small control in the page (a menu button) gets the card to its
 * right, so it does not cover the controls under it; one in the header gets it below, with room for the mascot on its edge, or above when there is no room.
 * On a narrow screen the card would cover the controls around the one it points at, so it stays at the bottom and only the ring marks the control.
 */
export function placeCard(target: DOMRect | null, vw: number, vh: number): { left: number; top?: number; bottom?: number; width: number } {
  const width = vw < NARROW ? vw - 2 * MARGIN : CARD_W;
  if (!target || vw < NARROW) return { left: vw - width - MARGIN, bottom: MARGIN, width };
  if (target.top > HEADER && target.width <= BESIDE_MAX && target.right + GAP + width + MARGIN <= vw) {
    return { left: target.right + GAP, top: Math.max(MARGIN + PERCH, Math.min(target.top, vh - CARD_H - MARGIN)), width };
  }
  const left = Math.max(MARGIN, Math.min(target.left, vw - width - MARGIN));
  return target.bottom + GAP + PERCH + CARD_H < vh ? { left, top: target.bottom + GAP + PERCH, width } : { left, bottom: vh - target.top + GAP, width };
}

const navLink = (page: string) => `.nav a[href="${page}"]`;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Finds the control the current drill points at, and follows it as the page moves, scrolls and changes. It also says which selector the rectangle
 * was measured for: the mascot only jumps once the card has its new place, or it would fly to where the card was.
 */
function useTarget(selector: string | null) {
  const [found, setFound] = useState<{ selector: string | null; rect: DOMRect | null }>({ selector: null, rect: null });
  useEffect(() => {
    if (!selector) { setFound({ selector: null, rect: null }); return; }
    let seen: Element | null = null;
    const measure = () => {
      const el = document.querySelector(selector);
      if (el !== seen) {
        seen = el;
        if (el && !reduced()) el.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); // a control below the fold is brought into view once
      }
      const next = el?.getBoundingClientRect() ?? null;
      setFound((prev) => {
        const same = prev.selector === selector && (prev.rect && next ? prev.rect.left === next.left && prev.rect.top === next.top && prev.rect.width === next.width && prev.rect.height === next.height : prev.rect === next);
        return same ? prev : { selector, rect: next };
      });
    };
    measure();
    const timer = setInterval(measure, 250); // the page changes under it (a route, a list loading), so it keeps looking
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      clearInterval(timer);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [selector]);
  return found;
}

const CHEER_MS = 1800; // how long the mascot looks pleased after a drill
const TOUCHDOWN_MS = 2600; // how long "Touchdown!" stays up

/** Two small hops, on the mascot's perch. Transform only. */
function hop(el: HTMLElement | null) {
  if (!el || reduced() || typeof el.animate !== 'function') return;
  el.animate(
    [
      { transform: 'translateY(0)', easing: 'cubic-bezier(.23, 1, .32, 1)' },
      { transform: 'translateY(-26px)', offset: 0.22, easing: 'cubic-bezier(.55, 0, 1, .45)' },
      { transform: 'translateY(0)', offset: 0.44, easing: 'cubic-bezier(.23, 1, .32, 1)' },
      { transform: 'translateY(-16px)', offset: 0.68, easing: 'cubic-bezier(.55, 0, 1, .45)' },
      { transform: 'translateY(0)' },
    ],
    { duration: 760 },
  );
}

/**
 * Rookie camp: the mascot coaches a first practice of a few drills, each done by the user on the real page. A ring marks the control, the
 * mascot sits on the edge of its speech card beside it, and the next drill starts only once the user has really done the thing. It follows the user from page to page and
 * is offered once to a user with no league, by the welcome dialog (`CampWelcome`). The mascot is the one mascot: while the camp shows it the page's own step aside, it jumps from drill to drill (the card
 * moves, and a new mascot at the new place is matched with the one leaving the old, like between pages), looks pleased when a drill is done, worried when about to leave or skip,
 * and on finishing hops and says "Touchdown!". With the mascot off in Settings it is neither offered nor run.
 */
export function RookieCamp() {
  const { phase, step } = useStore(campStore);
  const mascotOn = useStore(mascotEnabledStore);
  const name = useStore(mascotNameStore);
  const profiles = useStore(profilesStore);
  const followed = useStore(followedStore);
  const { pathname } = useLocation();
  const [, resized] = useReducer((n: number) => n + 1, 0); // the card's place depends on the window's size
  useEffect(() => {
    window.addEventListener('resize', resized);
    return () => window.removeEventListener('resize', resized);
  }, []);
  const inDialog = useSyncExternalStore(subscribeDialogs, dialogsOpen, () => false); // a dialog has the mascot now
  const flying = useSyncExternalStore(subscribeMascotFlight, isMascotFlying, () => false);
  const perch = useRef<HTMLDivElement>(null);
  const [cheer, setCheer] = useState(false); // a drill was just done
  const [worried, setWorried] = useState(false); // the pointer or focus is on Skip or Leave
  const [touchdown, setTouchdown] = useState(false);
  const hopped = useRef(false);
  const drill = phase === 'running' && mascotOn ? DRILLS[step] : undefined;
  const facts: Facts = { leagues: profiles.length, followed: profiles.length ? followed.filter((e) => sideOf(e) === 'mine').length : 0, path: pathname };

  // Drills already done are passed over in one move: two quick moves would send two mascots jumping at once.
  const advance = (cheered = true) => {
    if (cheered) setCheer(true);
    let next = step + 1;
    while (next < DRILLS.length && DRILLS[next]!.done?.(facts)) next++;
    campStore.set(next >= DRILLS.length ? { phase: 'finished', step: 0 } : { phase: 'running', step: next });
  };
  // A drill that is already done (the user did it before, or while it was waiting) is skipped over.
  const satisfied = !!drill?.done?.(facts);
  useEffect(() => { if (satisfied) advance(); }); // eslint-disable-line react-hooks/exhaustive-deps -- advance reads the same step

  const clicked = drill?.clicked;
  useEffect(() => {
    if (!clicked) return;
    const press = (event: MouseEvent) => { if ((event.target as Element | null)?.closest(clicked)) advance(); };
    document.addEventListener('click', press);
    return () => document.removeEventListener('click', press);
  }); // eslint-disable-line react-hooks/exhaustive-deps -- advance reads the same step

  const here = !drill?.on || drill.on === pathname;
  const { selector: measured, rect } = useTarget(drill ? (here ? drill.target : navLink(drill.on!)) : null);

  const finished = phase === 'finished' && mascotOn;
  const wants = mascotOn && (finished || !!drill);
  const visible = wants && !inDialog;

  useEffect(() => setWorried(false), [phase, step]); // the button that worried it is gone, and a mouse-leave will not be sent
  useEffect(() => {
    if (!cheer) return;
    const timer = setTimeout(() => setCheer(false), CHEER_MS);
    return () => clearTimeout(timer);
  }, [cheer]);
  // The page's own mascots step aside from the moment this one is there, in the same commit, so the one mascot jumps from the page onto the card.
  // They stay aside while a dialog has it: the camp holds its place, or the page's would appear for a moment when the dialog closes.
  useLayoutEffect(() => (wants ? registerCampMascot() : undefined), [wants]);

  // The celebration waits for the mascot to land on the card, then it hops once and says "Touchdown!".
  useEffect(() => {
    if (!finished) { hopped.current = false; setTouchdown(false); return; }
    if (!visible || measured !== null || flying || isMascotFlying() || hopped.current) return; // measured: the card has moved to its resting place, so the jump there has begun
    hopped.current = true;
    setTouchdown(true);
    hop(perch.current);
    const timer = setTimeout(() => setTouchdown(false), TOUCHDOWN_MS);
    return () => clearTimeout(timer);
  }, [finished, visible, measured, flying]);

  // A drill's card waits for the first look at its control, or the mascot would land in the corner first and jump again.
  if (!visible || (drill && measured === null)) return null;

  // Hovering or focusing what ends the practice early makes the mascot worried.
  const wary = { onMouseEnter: () => setWorried(true), onMouseLeave: () => setWorried(false), onFocus: () => setWorried(true), onBlur: () => setWorried(false) };
  let text: string;
  let buttons: ReactNode;
  if (phase === 'finished') {
    text = 'That is practice done. You are on the team! You can take it again from Settings any time.';
    buttons = <button type="button" className="btn btn-primary press" onClick={() => endCamp('done')}>Done</button>;
  } else {
    text = here ? drill!.text : drill!.go!;
    buttons = (
      <>
        {drill!.practice && <button type="button" className="btn press" onClick={addDemoLeague}>Use a practice league</button>}
        <button type="button" className="btn press" {...wary} onClick={() => advance(false)}>Skip drill</button>
        <button type="button" className="btn press" {...wary} onClick={() => endCamp('declined')}>Leave camp</button>
      </>
    );
  }

  // `rect` and `measured` change together, so the card never moves a step ahead of its mascot's key.
  const pos = placeCard(rect, window.innerWidth, window.innerHeight);
  const pad = 6;
  return (
    <>
      {drill && rect && <div className="camp-ring" aria-hidden="true" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + 2 * pad, height: rect.height + 2 * pad }} />}
      <section className={`camp${flying ? ' waiting' : ''}`} aria-label="Rookie camp" style={pos}>
        {/* Keyed by where the card was measured for: a new place is a new mascot, matched with the old one, so it jumps. */}
        <div ref={perch} className="dialog-perch">
          <Mascot key={measured ?? 'none'} size={SIZE} seated entrance={false} worried={worried} happy={!worried && (cheer || finished)} className="perch-mascot" style={{ top: -PERCH }} />
          {touchdown && !flying && <div className="perch-say" aria-hidden="true"><div className="perch-bubble camp-td"><TypedText text="Touchdown!" /></div></div>}
        </div>
        <div className="camp-body">
          <p className="camp-name">{name}{drill && <span className="muted"> · drill {step + 1} of {DRILLS.length}</span>}</p>
          {/* A polite live region: each new drill is announced once, whole, however it is typed on screen. */}
          <p className="camp-text" aria-live="polite"><TypedText text={text} hold={flying} /></p>
          <div className="bubble-actions">{buttons}</div>
        </div>
      </section>
    </>
  );
}
