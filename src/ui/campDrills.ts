/**
 * The drills of Rookie camp, as data. A drill is a list of steps on the real pages; the engine (`RookieCamp.tsx`) walks them, rings what a step
 * points at, and moves on when the user has done what it asks. To add a drill, or a step to one, add it here: a step is one thing said, one
 * place highlighted and one way of being done. Controls the camp points at carry a `data-camp` attribute where a class would be brittle.
 */

import { i18n } from '../i18n';
import { endCamp, patchCamp } from '../storage/camp';

export type Page = '/' | '/leagues' | '/vs';
/** A line said or a label shown: a text, or a function that looks up the text in the language at the moment it is shown (the drill table holds functions, so a language change shows). */
export type Said = string | (() => string);
export const said = (text: Said) => (typeof text === 'function' ? text() : text);
export interface Facts { leagues: number; followed: number; path: string; /** A league imported from ESPN exists (the practice league is not one). */ imported: boolean; /** The practice league is there. */ practice: boolean }

/** What a step can look at: the state, the page (`q`), and a note that lasts for as long as the step does (`memo`). */
export interface Ctx { facts: Facts; q: (selector: string) => Element | null; memo: Record<string, unknown> }

export interface Step {
  /** What is said; it can depend on the state (the player drill names the practice player when there is a practice league). */
  text: string | ((facts: Facts) => string);
  /** The page this step's controls are on, when it is not the drill's; elsewhere the camp points at that page's tab and says `go`. */
  on?: Page;
  go?: Said;
  /** Not a ring and a card but a dialog in the middle of the screen (`CampTour`), for explaining a whole page: the text, and the `next` button. */
  modal?: boolean;
  /** The step's controls come and go (a result is loading, a box shows only sometimes): while none is on the page the card stays away, and the mascot stays in the dialog. */
  wait?: boolean;
  /** What the step points at: one ring around all of them (those that are on the page now), and they are what can be pressed. */
  target: string[];
  /** More that stays pressable without being ringed. */
  also?: string[];
  /** A click on the dimmed area around the dialog stays allowed, for a step about closing it. */
  backdrop?: boolean;
  /** What must be on the page for the step to make sense, if it is not the first target. Gone for a moment: the camp steps back to the one that brings it up (or on, for an `optional` step). */
  needs?: string;
  optional?: boolean;
  /** A button on the card that moves on, with this label. The user is never forced to do what the step suggests. */
  next?: Said;
  /** Done by a click on this; with `dialog` only once a dialog really opened from it. */
  press?: string;
  dialog?: boolean;
  /** Done when this becomes true (it is looked at about five times a second). */
  when?: (c: Ctx) => boolean;
  /** Passed over, at once, when this is true. */
  skipIf?: (c: Ctx) => boolean;
  /** Back to the step before when this is true (the user undid what brought them here). */
  back?: (c: Ctx) => boolean;
  /** While `when` is true the user is doing something other than what is asked: the mascot says `text` instead, and looks worried. */
  nudge?: { when: (c: Ctx) => boolean; text: (facts: Facts) => string };
}

export interface Drill {
  /** Where the drill's controls live; elsewhere the camp points at that page's tab and says `go`. No page: the control is the tab itself. */
  on?: Page;
  go?: Said;
  /** The whole drill is passed over, at once, when this is true: it has nothing to work on. */
  skipIf?: (facts: Facts) => boolean;
  /** Offers a ready-made league on the first step, for a user who would rather not import one just to practise. */
  practice?: boolean;
  steps: Step[];
}

export const stepText = (step: Step, facts: Facts) => (typeof step.text === 'function' ? step.text(facts) : step.text);

/** Where a step's controls are: its own page, else the drill's. */
export const stepOn = (drill: Drill, step: Step) => step.on ?? drill.on;

/** On to the next drill, or to the congratulation after the last. */
export const toNextDrill = (step: number) => patchCamp(step + 1 >= DRILLS.length ? { phase: 'finished', step: 0, sub: 0 } : { phase: 'running', step: step + 1, sub: 0 });

/** The practice league is wanted from here to the end of the camp. */
export const choosePractice = () => patchCamp({ practice: true });

/**
 * Skip drill. Open dialogs are closed first (the next drill may ask for a tab that is dead behind a modal dialog); skipping the league drill is choosing
 * the practice league, because the drills after it need a league to work on.
 */
export function skipDrill(step: number) {
  closeOpenDialogs();
  if (DRILLS[step]?.practice) choosePractice();
  toNextDrill(step);
}

/** Leave camp. Open dialogs are closed too: the camp is gone, and with it the card, so a dialog left open would be the only thing on the page. */
export function leaveCamp() {
  closeOpenDialogs();
  endCamp('declined');
}

/**
 * Closes every open dialog. A dialog whose owner keeps it open by state reopens on the next render unless that owner hears about the close first, and
 * the browser sends the `close` event only a moment later: so it is sent now too (an owner hearing it twice just sets its state to closed twice; the
 * tour's own dialog moves the camp one step on, which the move that follows overrides).
 */
function closeOpenDialogs() {
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((d) => { d.close(); d.dispatchEvent(new Event('close')); });
}

/** True once the control's value is not what it was when the step began. */
export const changed = (selector: string) => (c: Ctx) => {
  const el = c.q(selector) as HTMLInputElement | null;
  if (!el) return false;
  if (!('seed' in c.memo)) c.memo.seed = el.value;
  return el.value !== c.memo.seed;
};

const HL_CLOSE = 'dialog.hl-dlg[open] .close';
const SEARCH = '[data-camp="add-dialog-search"]';
const IMPORT_LINKS = '[data-camp="import-links"]';
const IMPORT_SEASON = '[data-camp="import-season"]';
const STARTERS_TITLE = '#starters-title';
const STARTERS_TEAM = '[data-camp="starters-team"]';
/** A practice card without its footer: the ring covers it, but its Remove and League controls stay dead. */
const CARD_LIVE = ['[data-entry^="player:camp-live-qb:"] .hd', '[data-entry^="player:camp-live-qb:"] .stats'];
const CARD_PRE = ['[data-entry^="player:camp-pre-rb:"] .hd', '[data-entry^="player:camp-pre-rb:"] .stats'];
const CARD_FINAL = ['[data-entry^="player:camp-final-wr:"] .hd', '[data-entry^="player:camp-final-wr:"] .stats'];
/** The player drill 2 asks for: the practice player with the practice league, else a real one. */
const asked = (f: Facts) => (f.practice ? { full: 'jalen whitmore', surname: 'whitmore', say: 'Whitmore' } : { full: 'drake maye', surname: 'maye', say: 'Maye' });
const typed = (c: Ctx) => ((c.q(`${SEARCH} input`) as HTMLInputElement | null)?.value ?? '').trim().toLowerCase();
/** The search field holds the asked name's surname: done typing it. */
const typedAsked = (c: Ctx) => typed(c).includes(asked(c.facts).surname);
/** Something else is in the field: not the name, not a start of it (so typing "Whit" is fine), not a longer form of it. */
const typedOther = (c: Ctx) => { const v = typed(c); return v !== '' && !asked(c.facts).full.includes(v) && !v.includes(asked(c.facts).surname); };
const searchNudge = { when: typedOther, text: (f: Facts) => i18n.t(($) => $.camp.drills.player.nudge, { player: asked(f).say }) };
const addDialogOpen = (c: Ctx) => !!c.q(`dialog[open] ${SEARCH}`);

export const DRILLS: Drill[] = [
  {
    on: '/leagues',
    go: () => i18n.t(($) => $.camp.drills.league.go),
    practice: true,
    steps: [
      { target: ['[data-camp="add-league"]'], press: '[data-camp="add-league"]', text: () => i18n.t(($) => $.camp.drills.league.add) },
      { target: ['[data-camp="league-name"]'], next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.league.name) },
      { target: ['[data-camp="league-color"]'], next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.league.color) },
      { target: ['[data-camp="league-preset"]'], next: () => i18n.t(($) => $.camp.next), when: changed('[data-camp="league-preset"] select'), text: () => i18n.t(($) => $.camp.drills.league.preset) },
      { target: ['[data-camp="league-apply"]'], press: '[data-camp="league-apply"]', next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.league.apply) },
      { target: ['.profile-form .box-body .num-field'], next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.league.rules) },
      { target: ['.profile-form .box-body .rule-toggle'], next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.league.toggle) },
      { target: ['.save-actions .btn-primary'], press: '.save-actions .btn-primary', needs: '[data-camp="league-name"]', text: () => i18n.t(($) => $.camp.drills.league.save) },
    ],
  },
  {
    on: '/',
    go: () => i18n.t(($) => $.camp.drills.player.go),
    steps: [
      { target: ['[data-camp="add-player"]'], when: addDialogOpen, text: () => i18n.t(($) => $.camp.drills.player.add) },
      {
        target: [SEARCH, '[data-camp="add-dialog-league"]'],
        when: typedAsked,
        nudge: searchNudge,
        text: (f) => (f.practice ? i18n.t(($) => $.camp.drills.player.searchPractice, { player: 'Whitmore' }) : i18n.t(($) => $.camp.drills.player.search, { player: 'Maye' })),
      },
      {
        target: ['.results button[data-result="Jalen Whitmore"], .results button[data-result="Drake Maye"], .results button.add:not([aria-disabled])'],
        needs: '[data-camp="add-dialog-results"]',
        when: (c) => !!c.q('.results button.add[aria-label$=" added"]'),
        back: (c) => !typedAsked(c), // the query was changed away from the name: back to the search step, which says what to search for
        text: (f) => f.practice ? i18n.t(($) => $.camp.drills.player.foundPractice, { player: 'Jalen Whitmore' }) : i18n.t(($) => $.camp.drills.player.found, { player: 'Drake Maye' }),
      },
      {
        target: ['dialog[open] .close'],
        backdrop: true,
        needs: '[data-camp="add-dialog-results"]',
        when: (c) => !addDialogOpen(c),
        text: () => i18n.t(($) => $.camp.drills.player.close),
      },
    ],
  },
  {
    skipIf: (f) => f.leagues === 0, // there is no matchup to look at without a league
    steps: [
      { target: ['.nav a[href="/vs"]'], when: (c) => c.facts.path === '/vs', text: () => i18n.t(($) => $.camp.drills.vs.open) },
      { on: '/vs', go: () => i18n.t(($) => $.camp.drills.vs.back), modal: true, target: [], next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.vs.intro) },
      { on: '/vs', go: () => i18n.t(($) => $.camp.drills.vs.back), target: ['.vs-league'], next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.vs.league) },
      { on: '/vs', go: () => i18n.t(($) => $.camp.drills.vs.back), target: ['.score-bar'], next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.vs.score) },
      { on: '/vs', go: () => i18n.t(($) => $.camp.drills.vs.back), target: ['[data-camp="vs-add-mine"]'], next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.vs.addMine) },
      { on: '/vs', go: () => i18n.t(($) => $.camp.drills.vs.back), target: ['[data-camp="vs-add-opponent"]'], next: () => i18n.t(($) => $.camp.completeDrill), text: () => i18n.t(($) => $.camp.drills.vs.addOpponent) },
    ],
  },
  {
    on: '/leagues',
    go: () => i18n.t(($) => $.camp.drills.import.go),
    steps: [
      { target: ['[data-camp="import-leagues"]'], press: '[data-camp="import-leagues"]', dialog: true, text: () => i18n.t(($) => $.camp.drills.import.open) },
      {
        target: [IMPORT_LINKS, IMPORT_SEASON],
        needs: IMPORT_LINKS,
        when: (c) => {
          const box = c.q(`${IMPORT_LINKS} textarea`);
          if (document.activeElement !== box) c.memo.away = true;
          return document.activeElement === box && !!c.memo.away; // focus came back to it: it was clicked
        },
        press: IMPORT_LINKS,
        text: () => i18n.t(($) => $.camp.drills.import.link),
      },
      { target: ['[data-camp="import-load"]'], also: [IMPORT_LINKS, IMPORT_SEASON], needs: IMPORT_LINKS, when: (c) => !!c.q('.import-results'), text: () => i18n.t(($) => $.camp.drills.import.load) },
      {
        target: ['.private-help'],
        wait: true,
        needs: IMPORT_LINKS,
        skipIf: (c) => !!c.q('.import-preview'),
        text: () => i18n.t(($) => $.camp.drills.import.private),
      },
      { target: ['.import-preview > p:nth-of-type(1)', '.import-preview > p:nth-of-type(2)'], wait: true, needs: IMPORT_LINKS, next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.import.preview) },
      { target: ['.import-issues ul', '.import-issues legend'], wait: true, needs: '.import-preview', skipIf: (c) => !c.q('.import-issues'), next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.import.issues) },
      {
        target: ['.import-issues label'],
        wait: true,
        needs: '.import-preview',
        skipIf: (c) => !c.q('.import-issues'),
        when: (c) => !!(c.q('.import-issues input[type="checkbox"]') as HTMLInputElement | null)?.checked,
        text: () => i18n.t(($) => $.camp.drills.import.accept),
      },
      { target: ['[data-camp="import-commit"]'], needs: IMPORT_LINKS, press: '[data-camp="import-commit"]', text: () => i18n.t(($) => $.camp.drills.import.commit) },
    ],
  },
  {
    on: '/',
    go: () => i18n.t(($) => $.camp.drills.sync.go),
    skipIf: (f) => !f.imported, // starters come from an ESPN league; the practice league has none
    steps: [
      { target: ['[data-camp="sync-starters"]'], press: '[data-camp="sync-starters"]', dialog: true, text: () => i18n.t(($) => $.camp.drills.sync.open) },
      { target: ['.private-help'], wait: true, needs: STARTERS_TITLE, skipIf: (c) => !!c.q(STARTERS_TEAM), text: () => i18n.t(($) => $.camp.drills.sync.private) },
      { target: [STARTERS_TEAM], wait: true, needs: STARTERS_TITLE, when: (c) => !!(c.q(`${STARTERS_TEAM} select`) as HTMLSelectElement | null)?.value, text: () => i18n.t(($) => $.camp.drills.sync.team) },
      { target: ['[data-camp="starters-remove"]'], wait: true, needs: STARTERS_TITLE, next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.sync.remove) },
      { target: ['dialog[open] section.plan'], wait: true, needs: STARTERS_TITLE, next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.sync.plan) },
      { target: ['[data-camp="starters-sync"]'], needs: STARTERS_TITLE, press: '[data-camp="starters-sync"]', text: () => i18n.t(($) => $.camp.drills.sync.sync) },
    ],
  },
  {
    on: '/',
    go: () => i18n.t(($) => $.camp.drills.highlight.go),
    // The camp's league holds three practice players for this drill (`storage/campLeague.ts`): one playing now, one still to play, one with a final score and a clip.
    steps: [
      { target: CARD_LIVE, wait: true, optional: true, next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.highlight.live) },
      { target: CARD_PRE, wait: true, optional: true, next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.highlight.pre) },
      { target: CARD_FINAL, wait: true, optional: true, next: () => i18n.t(($) => $.camp.next), text: () => i18n.t(($) => $.camp.drills.highlight.final) },
      { target: ['.hl-btn'], press: '.hl-btn', dialog: true, text: () => i18n.t(($) => $.camp.drills.highlight.button) },
      {
        target: [HL_CLOSE],
        backdrop: true,
        needs: HL_CLOSE,
        when: (c) => !c.q('dialog.hl-dlg[open]'),
        text: () => i18n.t(($) => $.camp.drills.highlight.close),
      },
    ],
  },
];
