import { useEffect, useLayoutEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router';
import { campStore, endCamp } from '../storage/camp';
import { addDemoLeague } from '../storage/demoLeague';
import { followedStore, sideOf } from '../storage/followed';
import { mascotEnabledStore, mascotNameStore } from '../storage/mascot';
import { profilesStore } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import { DRILLS, type Ctx, type Facts } from './campDrills';
import { dialogsOpen, registerCampMascot, subscribeDialogs } from './dialogsOpen';
import { Mascot, SEAT_Y } from './Mascot';
import { isMascotFlying, subscribeMascotFlight } from './mascotFlight';
import { TypedText } from './TypedText';

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
/** What is on the page and can be seen: a closed dialog's contents are in the document but not on the page. */
const onPage = (selector: string): Element | null => {
  const el = document.querySelector(selector);
  return el && !el.closest('dialog:not([open])') && (el.checkVisibility?.() ?? true) ? el : null;
};
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The smallest rectangle holding both. */
export function union(a: DOMRect, b: DOMRect): DOMRect {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  const right = Math.max(a.right, b.right);
  const bottom = Math.max(a.bottom, b.bottom);
  return { left, top, right, bottom, x: left, y: top, width: right - left, height: bottom - top } as DOMRect;
}

/**
 * Finds what the current step points at (the rectangle round all of the targets that are on the page) and follows it as the page moves, scrolls and
 * changes. `key` says which targets the rectangle was measured for: the mascot only jumps once the card has its new place, or it would fly to where
 * the card was. `present` is whether what the step needs (`needs`, else its first target) is on the page at all.
 */
function useTarget(targets: string[] | null, needs?: string) {
  const [found, setFound] = useState<{ key: string | null; rect: DOMRect | null; present: boolean }>({ key: null, rect: null, present: false });
  const key = targets ? targets.join('|') : null;
  const needsSelector = needs ?? targets?.[0];
  useEffect(() => {
    if (!targets) { setFound({ key: null, rect: null, present: false }); return; }
    let seen: Element | null = null;
    const measure = () => {
      const els = targets.map(onPage).filter((el): el is Element => !!el);
      if (els[0] !== seen) {
        seen = els[0] ?? null;
        if (seen && !reduced()) seen.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); // a control below the fold is brought into view once
      }
      const rects = els.map((el) => el.getBoundingClientRect());
      const next = rects.length ? rects.reduce(union) : null; // one ring around everything the step is about
      const present = !!needsSelector && !!onPage(needsSelector);
      setFound((prev) => {
        const same = prev.key === key && prev.present === present && (prev.rect && next ? prev.rect.left === next.left && prev.rect.top === next.top && prev.rect.width === next.width && prev.rect.height === next.height : prev.rect === next);
        return same ? prev : { key, rect: next, present };
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
  }, [key, needsSelector]); // eslint-disable-line react-hooks/exhaustive-deps -- `targets` is whatever `key` says
  return found;
}

const CHEER_MS = 1800; // how long the mascot looks pleased after a drill
const PRESS_MS = 2000; // how long a press on a step's button waits for the dialog it should open
const GRACE_MS = 700; // how long what a step needs may be off the page (a page changing, a list loading) before the camp steps back, or on for an optional step

/** The dialog on top, if one is open: the card goes into it, because a modal dialog blocks everything outside it and a card outside could not be pressed. */
const topDialog = () => Array.from(document.querySelectorAll('dialog[open]')).at(-1) ?? null;

/**
 * Rookie camp: the mascot coaches a first practice of a few drills, each a list of steps done by the user on the real page (`campDrills.ts`). A ring
 * marks what the step is about, the mascot sits on the edge of its speech card beside it, and the next step starts only once the user has really done
 * the thing, or pressed Next where nothing needs doing. While a step waits the page is dead except for what it points at, in dialogs too. It follows the
 * user from page to page, and is offered once to a user with no league, by the welcome dialog (`CampWelcome`). The mascot is the one mascot: while the camp
 * shows it the page's own step aside, it jumps from step to step (the card moves, and a new mascot at the new place is matched with the one leaving the old,
 * like between pages), looks pleased when a drill is done, worried when about to leave or skip, and on finishing hands over to the congratulation dialog
 * (`CampFinish`). When a step lives in a dialog the card is in that dialog and the mascot is on its edge like in any dialog. With the mascot off in
 * Settings it is neither offered nor run.
 */
export function RookieCamp() {
  const { phase, step, sub } = useStore(campStore);
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
  const [cheer, setCheer] = useState(false); // a drill was just done
  const [worried, setWorried] = useState(false); // the pointer or focus is on Skip or Leave
  const [pressed, setPressed] = useState(false); // the step's button was pressed and its dialog is on its way
  const running = phase === 'running' && mascotOn;
  const drill = running ? DRILLS[step] : undefined;
  const current = drill?.steps[sub];
  const facts: Facts = { leagues: profiles.length, followed: profiles.length ? followed.filter((e) => sideOf(e) === 'mine').length : 0, path: pathname };

  const here = !drill?.on || drill.on === pathname;
  // Elsewhere than the drill's page the camp points at that page's tab.
  const targets = current ? (here ? current.target : [navLink(drill!.on!)]) : null;
  const { key: measured, rect, present } = useTarget(targets, here ? current?.needs : undefined);

  // What the step has seen: a note it can keep (what a field held when it began), and that it has moved on, so two quick checks do not move two steps.
  const where = `${phase}:${step}:${sub}`;
  const memo = useRef<Record<string, unknown>>({});
  const moved = useRef('');
  useEffect(() => { memo.current = {}; moved.current = ''; setPressed(false); }, [where]);

  // Done with the drill: on to the next, or to the congratulation. Several drills never move at once (two moves would send two mascots jumping).
  const nextDrill = (cheered: boolean) => {
    if (moved.current === where) return;
    moved.current = where;
    if (cheered) setCheer(true);
    campStore.set(step + 1 >= DRILLS.length ? { phase: 'finished', step: 0, sub: 0 } : { phase: 'running', step: step + 1, sub: 0 });
  };
  const nextStep = (cheered: boolean) => {
    if (!drill || sub + 1 >= drill.steps.length) return nextDrill(cheered);
    if (moved.current === where) return;
    moved.current = where;
    campStore.set({ phase: 'running', step, sub: sub + 1 });
  };

  // A step that is done by what is on the page or in the state is looked at often; one that has nothing to wait for is passed over.
  useEffect(() => {
    if (!current || !here || measured === null) return;
    const ctx: Ctx = { facts, q: onPage, memo: memo.current };
    const check = () => {
      if (current.skipIf?.(ctx)) nextStep(false);
      else if (current.when?.(ctx)) nextStep(true);
    };
    check();
    const timer = setInterval(check, 200);
    return () => clearInterval(timer);
  }); // eslint-disable-line react-hooks/exhaustive-deps -- re-armed on every render, so it always sees this render's facts and step

  // What the step needs is not on the page (the dialog was closed, the editor went away): back to the step that brings it up, or on if it is optional.
  const gone = here && !!current && measured !== null && !present;
  useEffect(() => {
    if (!gone) return;
    const timer = setTimeout(() => {
      if (current?.optional) nextStep(false);
      else if (sub > 0) campStore.set({ phase: 'running', step, sub: sub - 1 });
    }, GRACE_MS);
    return () => clearTimeout(timer);
  }, [gone, where]); // eslint-disable-line react-hooks/exhaustive-deps -- the move reads this render's step

  const press = here ? current?.press : undefined;
  const opensDialog = !!current?.dialog;
  useEffect(() => {
    if (!press) return;
    const onClick = (event: MouseEvent) => {
      if (!(event.target as Element | null)?.closest(press)) return;
      if (opensDialog) setPressed(true);
      else nextStep(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }); // eslint-disable-line react-hooks/exhaustive-deps -- the move reads this render's step
  // A step done by opening a dialog (a highlight) is done once the dialog has the mascot: the card's mascot jumps into it like for any dialog, and the
  // congratulation (`CampFinish`) waits for that dialog to close. If no dialog came, the press is forgotten and the step stays as it was.
  useEffect(() => {
    if (!pressed) return;
    if (inDialog) { setPressed(false); nextStep(true); return; }
    const timer = setTimeout(() => setPressed(false), PRESS_MS);
    return () => clearTimeout(timer);
  }); // eslint-disable-line react-hooks/exhaustive-deps -- the move reads this render's step

  // While a step waits, the page is dead except for what it points at (and what it allows besides) and the camp's own card, in dialogs too: a closed
  // dialog is the user's to close with Escape, and the camp then steps back to the step that opens it. A click on the area around a dialog counts
  // only for a step about closing it.
  const guarding = !!current && measured !== null;
  useEffect(() => {
    if (!guarding || !targets) return;
    const allowed = ['.camp', ...targets, ...(here ? current?.also ?? [] : [])].join(', ');
    const backdrop = here && !!current?.backdrop;
    const guard = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return; // only what would press something
      const target = event.target as Element | null;
      if (target?.closest?.(allowed) || (backdrop && target instanceof HTMLDialogElement)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const events = ['pointerdown', 'mousedown', 'click', 'dblclick', 'auxclick', 'keydown'];
    events.forEach((type) => document.addEventListener(type, guard, true));
    return () => events.forEach((type) => document.removeEventListener(type, guard, true));
  }, [guarding, measured, current, here]); // eslint-disable-line react-hooks/exhaustive-deps -- `targets` is whatever `measured` says

  const wants = mascotOn && !!current;
  const visible = wants && !(pressed && inDialog); // pressed and a dialog is up: the step is done in a moment, the card is not shown for a frame

  useEffect(() => setWorried(false), [phase, step, sub]); // the button that worried it is gone, and a mouse-leave will not be sent
  useEffect(() => {
    if (!cheer) return;
    const timer = setTimeout(() => setCheer(false), CHEER_MS);
    return () => clearTimeout(timer);
  }, [cheer]);
  // The page's own mascots step aside from the moment this one is there, in the same commit, so the one mascot jumps from the page onto the card.
  // They stay aside while a dialog has it: the camp holds its place, or the page's would appear for a moment when the dialog closes.
  useLayoutEffect(() => (wants ? registerCampMascot() : undefined), [wants]);

  // A step's card waits for the first look at what it points at, or the mascot would land in the corner first and jump again.
  if (!visible || measured === null) return null;

  // Hovering or focusing what ends the practice early makes the mascot worried.
  const wary = { onMouseEnter: () => setWorried(true), onMouseLeave: () => setWorried(false), onFocus: () => setWorried(true), onBlur: () => setWorried(false) };
  const text = here ? current!.text : drill!.go!;
  const last = sub + 1 >= drill!.steps.length;
  const buttons = (
    <>
      {here && sub === 0 && drill!.practice && <button type="button" className="btn btn-primary press" onClick={() => { addDemoLeague(); nextDrill(true); }}>Use a practice league</button>}
      {here && current!.next && <button type="button" className="btn btn-primary press" onClick={() => nextStep(last)}>{last ? 'Complete drill' : current!.next}</button>}
      <button type="button" className="btn press" {...wary} onClick={() => nextDrill(false)}>Skip drill</button>
      <button type="button" className="btn btn-danger press" {...wary} onClick={() => endCamp('declined')}>Leave camp</button>
    </>
  );

  // `rect` and `measured` change together, so the card never moves a step ahead of its mascot's key.
  const pos = placeCard(rect, window.innerWidth, window.innerHeight);
  const pad = 6;
  const card = (
    <>
      {rect && <div className="camp-ring" aria-hidden="true" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + 2 * pad, height: rect.height + 2 * pad }} />}
      <section className={`camp${flying ? ' waiting' : ''}`} aria-label="Rookie camp" style={pos}>
        {/* The mascot is on the card when there is no dialog; in one he is on its edge. Keyed by where the card was measured for: a new place is a new mascot, matched with the old one, so it jumps. */}
        {!inDialog && (
          <div className="dialog-perch">
            <Mascot key={measured} size={SIZE} seated entrance={false} worried={worried} happy={!worried && cheer} className="perch-mascot" style={{ top: -PERCH }} />
          </div>
        )}
        <div className="camp-body">
          <p className="camp-name">{name}<span className="muted"> · drill {step + 1} of {DRILLS.length}</span></p>
          {/* A polite live region: each new step is announced once, whole, however it is typed on screen. */}
          <p className="camp-text" aria-live="polite"><TypedText text={text} hold={flying} /></p>
          <div className="bubble-actions">{buttons}</div>
        </div>
      </section>
    </>
  );
  return createPortal(card, (inDialog ? topDialog() : null) ?? document.body);
}
