/**
 * The drills of Rookie camp, as data. A drill is a list of steps on the real pages; the engine (`RookieCamp.tsx`) walks them, rings what a step
 * points at, and moves on when the user has done what it asks. To add a drill, or a step to one, add it here: a step is one thing said, one
 * place highlighted and one way of being done. Controls the camp points at carry a `data-camp` attribute where a class would be brittle.
 */

import { endCamp, patchCamp } from '../storage/camp';

export type Page = '/' | '/leagues' | '/vs';
export interface Facts { leagues: number; followed: number; path: string; /** A league imported from ESPN exists (the practice league is not one). */ imported: boolean; /** The practice league is there. */ practice: boolean }

/** What a step can look at: the state, the page (`q`), and a note that lasts for as long as the step does (`memo`). */
export interface Ctx { facts: Facts; q: (selector: string) => Element | null; memo: Record<string, unknown> }

export interface Step {
  /** What is said; it can depend on the state (the player drill names the practice player when there is a practice league). */
  text: string | ((facts: Facts) => string);
  /** The page this step's controls are on, when it is not the drill's; elsewhere the camp points at that page's tab and says `go`. */
  on?: Page;
  go?: string;
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
  next?: string;
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
  go?: string;
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
const searchNudge = { when: typedOther, text: (f: Facts) => `That is a good one, but for this drill search for ${asked(f).say}.` };
const addDialogOpen = (c: Ctx) => !!c.q(`dialog[open] ${SEARCH}`);

export const DRILLS: Drill[] = [
  {
    on: '/leagues',
    go: 'First drill: a league. Open Leagues and set one up.',
    practice: true,
    steps: [
      { target: ['[data-camp="add-league"]'], press: '[data-camp="add-league"]', text: 'First drill: set up a league. Press Add a league and I will show you around the editor. Alternatively use a practice league, to get things going.' },
      { target: ['[data-camp="league-name"]'], next: 'Next', text: 'This is your new league. Give it a name; the one it has on ESPN works well. Press Next when you are done.' },
      { target: ['[data-camp="league-color"]'], next: 'Next', text: 'Pick a color. It tags this league’s players on the Players screen and in lists, so you can tell your leagues apart.' },
      { target: ['[data-camp="league-preset"]'], next: 'Next', when: changed('[data-camp="league-preset"] select'), text: 'Start from a preset: PPR, half-PPR or non-PPR. Pick one from the list.' },
      { target: ['[data-camp="league-apply"]'], press: '[data-camp="league-apply"]', next: 'Next', text: 'Press Apply preset to load its scoring into this league. Nothing is kept until you save.' },
      { target: ['.profile-form .box-body .num-field'], next: 'Next', text: 'Every rule is a number you can change. A preset is only a starting point, so override any setting you like.' },
      { target: ['.profile-form .box-body .rule-toggle'], next: 'Next', text: 'Any rule can also be switched off with its checkbox, if your league does not score it.' },
      { target: ['.save-actions .btn-primary'], press: '.save-actions .btn-primary', needs: '[data-camp="league-name"]', text: 'Press Save to keep the league. That finishes this drill; nothing counts until you save.' },
    ],
  },
  {
    on: '/',
    go: 'Second drill: follow a player. Open Players.',
    steps: [
      { target: ['[data-camp="add-player"]'], when: addDialogOpen, text: 'Second drill: follow a player. Press Add player.' },
      {
        target: [SEARCH, '[data-camp="add-dialog-league"]'],
        when: typedAsked,
        nudge: searchNudge,
        text: (f) => `Search for a player or a team defense here, and pick which league they count for below it${f.practice ? ': choose the Practice league' : ''}. Leagues matter because each one scores differently, so the same player is worth different points in each. Try searching for ${f.practice ? 'Whitmore' : 'Maye'}.`,
      },
      {
        target: ['.results button[data-result="Jalen Whitmore"], .results button[data-result="Drake Maye"], .results button.add:not([aria-disabled])'],
        needs: '[data-camp="add-dialog-results"]',
        when: (c) => !!c.q('.results button.add[aria-label$=" added"]'),
        back: (c) => !typedAsked(c), // the query was changed away from the name: back to the search step, which says what to search for
        text: (f) => f.practice ? 'There he is, Jalen Whitmore. Press Add to follow him in the Practice league.' : 'There he is, Drake Maye. Press Add to follow him in the league you picked.',
      },
      {
        target: ['dialog[open] .close'],
        backdrop: true,
        needs: '[data-camp="add-dialog-results"]',
        when: (c) => !addDialogOpen(c),
        text: 'All set. Close the dialog with the X in its corner, or click anywhere outside it.',
      },
    ],
  },
  {
    skipIf: (f) => f.leagues === 0, // there is no matchup to look at without a league
    steps: [
      { target: ['.nav a[href="/vs"]'], when: (c) => c.facts.path === '/vs', text: 'Third drill: pit two sides against each other. Open Vs Mode.' },
      { on: '/vs', go: 'Back to Vs Mode, please.', modal: true, target: [], next: 'Next', text: 'This is Vs Mode: your players on one side, an opponent’s on the other, and a live score race between them. Let me show you around.' },
      { on: '/vs', go: 'Back to Vs Mode, please.', target: ['.vs-league'], next: 'Next', text: 'Pick the league the matchup is scored in. Each league scores differently, so the same players can be worth more in one than in another. Choose one league, or All to see players from every league you have.' },
      { on: '/vs', go: 'Back to Vs Mode, please.', target: ['.score-bar'], next: 'Next', text: 'The score bar adds up each side’s live points and says who leads. How accurate it is depends on your league’s settings, because some rules cannot be copied exactly. Always check the real score at your league’s own site.' },
      { on: '/vs', go: 'Back to Vs Mode, please.', target: ['[data-camp="vs-add-mine"]'], next: 'Next', text: 'This is the same Add player you already know, putting a player on your side of the matchup.' },
      { on: '/vs', go: 'Back to Vs Mode, please.', target: ['[data-camp="vs-add-opponent"]'], next: 'Complete drill', text: 'And this one works the same way for your opponent’s side. Those players show only here, never on your Players screen.' },
    ],
  },
  {
    on: '/leagues',
    go: 'Fourth drill: importing a league. Open Leagues.',
    steps: [
      { target: ['[data-camp="import-leagues"]'], press: '[data-camp="import-leagues"]', dialog: true, text: 'Fourth drill: bring in a league you play on ESPN. Press Import leagues.' },
      {
        target: [IMPORT_LINKS, IMPORT_SEASON],
        needs: IMPORT_LINKS,
        when: (c) => {
          const box = c.q(`${IMPORT_LINKS} textarea`);
          if (document.activeElement !== box) c.memo.away = true;
          return document.activeElement === box && !!c.memo.away; // focus came back to it: it was clicked
        },
        press: IMPORT_LINKS,
        text: 'Here you tell me which league. Click the link box and paste the league’s link, or just its number: the one after leagueId= in the address bar when you have the league open on ESPN. The season is the year it started; the current one is already filled in.',
      },
      { target: ['[data-camp="import-load"]'], also: [IMPORT_LINKS, IMPORT_SEASON], needs: IMPORT_LINKS, when: (c) => !!c.q('.import-results'), text: 'With the link in, press Load leagues and I will fetch its settings from ESPN.' },
      {
        target: ['.private-help'],
        wait: true,
        needs: IMPORT_LINKS,
        skipIf: (c) => !!c.q('.import-preview'),
        text: 'This league is private, so ESPN will not hand me its settings. You copy them across from your own signed-in ESPN tab, and the box explains how. Paste them in here to go on.',
      },
      { target: ['.import-preview > p:nth-of-type(1)', '.import-preview > p:nth-of-type(2)'], wait: true, needs: IMPORT_LINKS, next: 'Next', text: 'These are the lineup slots and scoring rules I found on ESPN. They are what will be imported into your new league.' },
      { target: ['.import-issues ul', '.import-issues legend'], wait: true, needs: '.import-preview', skipIf: (c) => !c.q('.import-issues'), next: 'Next', text: 'Some of this league’s rules cannot be scored exactly here. These warnings list them, so you know where the points may differ from ESPN’s.' },
      {
        target: ['.import-issues label'],
        wait: true,
        needs: '.import-preview',
        skipIf: (c) => !c.q('.import-issues'),
        when: (c) => !!(c.q('.import-issues input[type="checkbox"]') as HTMLInputElement | null)?.checked,
        text: 'To go on you have to accept the warnings by ticking this box: for now that is the only way to import a league with approximate rules.',
      },
      { target: ['[data-camp="import-commit"]'], needs: IMPORT_LINKS, press: '[data-camp="import-commit"]', text: 'Last step: press Import selected leagues to add it. That finishes this drill.' },
    ],
  },
  {
    on: '/',
    go: 'Fifth drill: syncing your starters. Open Players.',
    skipIf: (f) => !f.imported, // starters come from an ESPN league; the practice league has none
    steps: [
      { target: ['[data-camp="sync-starters"]'], press: '[data-camp="sync-starters"]', dialog: true, text: 'Fifth drill: follow everyone in your lineup at once. Press Sync starters.' },
      { target: ['.private-help'], wait: true, needs: STARTERS_TITLE, skipIf: (c) => !!c.q(STARTERS_TEAM), text: 'This league is private, so I need your lineup copied across from your signed-in ESPN tab. The box explains how; paste it in here to go on.' },
      { target: [STARTERS_TEAM], wait: true, needs: STARTERS_TITLE, when: (c) => !!(c.q(`${STARTERS_TEAM} select`) as HTMLSelectElement | null)?.value, text: 'Now choose your own team in this league, so I know whose lineup to read. I will remember it for next time.' },
      { target: ['[data-camp="starters-remove"]'], wait: true, needs: STARTERS_TITLE, next: 'Next', text: 'Tick this to also stop following players who are not in your lineup. Leave it off and nothing is removed. You do not have to pick one now.' },
      { target: ['dialog[open] section.plan'], wait: true, needs: STARTERS_TITLE, next: 'Next', text: 'This is what would change: players to be added, players to be removed, and those you already follow, unchanged. Nothing happens until you press the button below.' },
      { target: ['[data-camp="starters-sync"]'], needs: STARTERS_TITLE, press: '[data-camp="starters-sync"]', text: 'Press Sync starters to follow them. That finishes this drill.' },
    ],
  },
  {
    on: '/',
    go: 'Last drill: watch a highlight. Open Players.',
    // The camp's league holds three practice players for this drill (`storage/campLeague.ts`): one playing now, one still to play, one with a final score and a clip.
    steps: [
      { target: CARD_LIVE, wait: true, optional: true, next: 'Next', text: 'Last drill: your cards. For the next few I have lent you some practice players. This one is playing right now: his points update live, and when his team gets inside the 20 a red zone flag shows up on the field.' },
      { target: CARD_PRE, wait: true, optional: true, next: 'Next', text: 'This one’s game has not started yet. His card shows who they play and when the kickoff is, and fills in once the game begins.' },
      { target: CARD_FINAL, wait: true, optional: true, next: 'Next', text: 'And this game is over: the card keeps the final score and his total fantasy points.' },
      { target: ['.hl-btn'], press: '.hl-btn', dialog: true, text: 'Big plays get a ▶ Highlights button on a player’s card, like this one. Press it to watch the clip.' },
      {
        target: [HL_CLOSE],
        backdrop: true,
        needs: HL_CLOSE,
        when: (c) => !c.q('dialog.hl-dlg[open]'),
        text: 'That is the highlight. Press the X to go back; clicking outside the dialog or Escape also works.',
      },
    ],
  },
];
