/**
 * The drills of Rookie camp, as data. A drill is a list of steps on the real pages; the engine (`RookieCamp.tsx`) walks them, rings what a step
 * points at, and moves on when the user has done what it asks. To add a drill, or a step to one, add it here: a step is one thing said, one
 * place highlighted and one way of being done. Controls the camp points at carry a `data-camp` attribute where a class would be brittle.
 */

export interface Facts { leagues: number; followed: number; path: string }

/** What a step can look at: the state, the page (`q`), and a note that lasts for as long as the step does (`memo`). */
export interface Ctx { facts: Facts; q: (selector: string) => Element | null; memo: Record<string, unknown> }

export interface Step {
  text: string;
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
}

export interface Drill {
  /** Where the drill's controls live; elsewhere the camp points at that page's tab and says `go`. No page: the control is the tab itself. */
  on?: '/' | '/leagues';
  go?: string;
  /** Offers a ready-made league on the first step, for a user who would rather not import one just to practise. */
  practice?: boolean;
  steps: Step[];
}

/** True once the control's value is not what it was when the step began. */
export const changed = (selector: string) => (c: Ctx) => {
  const el = c.q(selector) as HTMLInputElement | null;
  if (!el) return false;
  if (!('seed' in c.memo)) c.memo.seed = el.value;
  return el.value !== c.memo.seed;
};

const SEARCH = '[data-camp="add-dialog-search"]';
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
        when: (c) => /maye/i.test((c.q(`${SEARCH} input`) as HTMLInputElement | null)?.value ?? ''),
        text: 'Search for a player or a team defense here, and pick which league they count for below it. Leagues matter because each one scores differently, so the same player is worth different points in each. Try searching for Maye.',
      },
      {
        target: ['.results button[data-result="Drake Maye"], .results button.add:not([aria-disabled])'],
        needs: '[data-camp="add-dialog-results"]',
        when: (c) => !!c.q('.results button.add[aria-label$=" added"]'),
        text: 'There he is, Drake Maye. Press Add to follow him in the league you picked.',
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
    steps: [{ target: ['.nav a[href="/vs"]'], when: (c) => c.facts.path === '/vs', text: 'Third drill: pit two sides against each other. Open Vs Mode.' }],
  },
  {
    on: '/',
    go: 'Last drill: watch a highlight. Open Players.',
    steps: [{ target: ['.hl-btn'], press: '.hl-btn', dialog: true, text: 'Last drill: big plays get a ▶ Highlights button on a player’s card. Open one when you see it, or skip this drill.' }],
  },
];
