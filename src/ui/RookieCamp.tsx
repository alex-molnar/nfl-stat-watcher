import { useEffect, useReducer, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { campStore, endCamp, startCamp } from '../storage/camp';
import { followedStore, sideOf } from '../storage/followed';
import { mascotEnabledStore, mascotNameStore } from '../storage/mascot';
import { profilesStore } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import { dialogsOpen, subscribeDialogs } from './dialogsOpen';
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
}

export const DRILLS: Drill[] = [
  { on: '/leagues', target: '[data-camp="add-league"]', go: 'First drill: a league. Open Leagues and set one up.', text: 'First drill: set up a league. Press Add a league, or Import leagues if you play on ESPN.', done: (f) => f.leagues > 0 },
  { on: '/', target: '[data-camp="add-player"]', go: 'Second drill: follow a player. Open Players.', text: 'Second drill: follow a player. Press Add player and pick someone from your league.', done: (f) => f.followed > 0 },
  { target: '.nav a[href="/vs"]', text: 'Third drill: pit two sides against each other. Open Vs Mode.', done: (f) => f.path === '/vs' },
  { on: '/', target: '.hl-btn', go: 'Last drill: watch a highlight. Open Players.', text: 'Last drill: big plays get a ▶ Highlights button on a player’s card. Open one when you see it, or skip this drill.', clicked: '.hl-btn' },
];

const CARD_W = 340;
const GAP = 14;
const MARGIN = 12;
const NARROW = 700; // px of window width below which the page stacks its controls

/** Where the card goes: beside the control it talks about (below it, or above when there is no room), else the bottom corner. On a narrow screen it would cover the controls around the one it points at, so it stays at the bottom and only the ring marks the control. */
export function placeCard(target: DOMRect | null, vw: number, vh: number): { left: number; top?: number; bottom?: number; width: number } {
  const width = vw < NARROW ? vw - 2 * MARGIN : CARD_W;
  if (!target || vw < NARROW) return { left: vw - width - MARGIN, bottom: MARGIN, width };
  const left = Math.max(MARGIN, Math.min(target.left, vw - width - MARGIN));
  return target.bottom + GAP + 190 < vh ? { left, top: target.bottom + GAP, width } : { left, bottom: vh - target.top + GAP, width };
}

const navLink = (page: string) => `.nav a[href="${page}"]`;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Finds the control the current drill points at, and follows it as the page moves, scrolls and changes. */
function useTarget(selector: string | null) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!selector) { setRect(null); return; }
    let seen: Element | null = null;
    const measure = () => {
      const el = document.querySelector(selector);
      if (el !== seen) {
        seen = el;
        if (el && !reduced()) el.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); // a control below the fold is brought into view once
      }
      const next = el?.getBoundingClientRect() ?? null;
      setRect((prev) => (prev && next && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height ? prev : next));
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
  return rect;
}

/**
 * Rookie camp: the mascot coaches a first practice of a few drills, each done by the user on the real page. A ring marks the control, the
 * mascot's speech card (no second mascot of its own: the page and the header already show one) sits beside it, and the next drill starts only once the user has really done the thing. It follows the user from page to page and
 * is offered once to a user with no league. With the mascot off in Settings it is neither offered nor run.
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
  const drill = phase === 'running' && mascotOn ? DRILLS[step] : undefined;
  const facts: Facts = { leagues: profiles.length, followed: profiles.length ? followed.filter((e) => sideOf(e) === 'mine').length : 0, path: pathname };

  const advance = () => campStore.set(step + 1 >= DRILLS.length ? { phase: 'finished', step: 0 } : { phase: 'running', step: step + 1 });
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
  const rect = useTarget(drill ? (here ? drill.target : navLink(drill.on!)) : null);

  const offer = phase === 'idle' && profiles.length === 0;
  if (!mascotOn || inDialog || !(offer || phase === 'finished' || drill)) return null;

  let text: string;
  let buttons: ReactNode;
  if (offer) {
    text = 'Want a quick practice? Four short drills and you know your way around.';
    buttons = (
      <>
        <button type="button" className="btn btn-primary press" onClick={startCamp}>Start</button>
        <button type="button" className="btn press" onClick={() => endCamp('declined')}>No thanks</button>
      </>
    );
  } else if (phase === 'finished') {
    text = 'That is practice done. You are on the team! You can take it again from Settings any time.';
    buttons = <button type="button" className="btn btn-primary press" onClick={() => endCamp('done')}>Done</button>;
  } else {
    text = here ? drill!.text : drill!.go!;
    buttons = (
      <>
        <button type="button" className="btn press" onClick={advance}>Skip drill</button>
        <button type="button" className="btn press" onClick={() => endCamp('declined')}>Leave camp</button>
      </>
    );
  }

  const pos = placeCard(drill ? rect : null, window.innerWidth, window.innerHeight);
  const pad = 6;
  return (
    <>
      {drill && rect && <div className="camp-ring" aria-hidden="true" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + 2 * pad, height: rect.height + 2 * pad }} />}
      <section className="camp" aria-label="Rookie camp" style={pos}>
        <div className="camp-body">
          <p className="camp-name">{name}{drill && <span className="muted"> · drill {step + 1} of {DRILLS.length}</span>}</p>
          {/* A polite live region: each new drill is announced once, whole, however it is typed on screen. */}
          <p className="camp-text" aria-live="polite"><TypedText text={text} /></p>
          <div className="bubble-actions">{buttons}</div>
        </div>
      </section>
    </>
  );
}
