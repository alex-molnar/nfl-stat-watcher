/** English texts for the settings area. The English here is the source: Hungarian (../hu/settings.ts) must have the same keys. */
export const settings = {
  title: 'Settings',
  categoriesLabel: 'Settings categories',
  categoriesList: 'Categories',
  categories: { general: 'General', positionOrder: 'Position order', siteSettings: 'Site settings' },
  saveBarLabel: 'Save or cancel changes',
  saveBarEndLabel: 'Save or cancel changes, end of form',
  nameDisplay: {
    legend: 'Name display mode',
    help: 'How player names are shown on cards and in lists.',
    example: 'e.g. {{example}}',
    modes: { full: 'Full', initial: 'Initial', formal: 'Formal' },
  },
  language: {
    legend: 'Language',
    auto: 'Automatic',
    autoHelp: "Uses your browser's language if the site has it, English otherwise.",
  },
  starters: {
    legend: 'Starters',
    autoSync: 'Sync public leagues automatically',
    autoSyncHelp: 'Each time you open Players or Vs, the starters of your public leagues are synced again. Every card of those leagues that is not a starter is removed, whatever each league’s own setting says. Private leagues are not touched: they need the bookmark.',
  },
  positions: {
    legend: 'Position order',
    orderHelp: 'Use this position order within every game-status group on Players and Vs. During live games, activity comes first: red zone, on the field, then inactive.',
    dragHelp: 'Drag anywhere on a row to move a position, or use the arrow buttons. Save to apply your order.',
    groupsNote: 'DL includes DE, DT and NT; LB includes ILB, OLB and MLB; DB includes CB and safeties. Fullbacks use RB; PK uses K.',
    reset: 'Reset position order',
  },
  mascot: {
    legend: 'Mascot',
    show: 'Show the mascot',
    name: 'Name',
    help: 'The football in glasses that appears beside the title and says what to do next when a page is empty. Off, every page uses plain text instead, and the Leagues menu explains its buttons in tooltips.',
  },
  camp: {
    legend: 'Rookie camp',
    help: 'A short practice with {{name}}: four drills, each done on the real pages, that show you around.',
    helpOff: 'Turn the mascot on and save to take the practice.',
    start: 'Start rookie camp',
    started: 'Rookie camp started. {{name}} will show you the first drill.',
  },
  privateSync: {
    legend: 'Private league sync',
    show: 'Show bookmark setup for private leagues',
    help: 'Show the bookmark option when syncing private league starters. Turn this on to restore it after choosing Don’t show this option again.',
  },
  data: {
    legend: 'Your data',
    help: 'Followed players, leagues, scoring and every other setting are kept in this browser only.',
    clear: 'Clear my data',
  },
  clearDialog: {
    title: 'Clear all your data?',
    warning: 'This permanently deletes your followed players, your leagues and their scoring, and your settings from this browser. It cannot be undone.',
    keep: 'Keep my data',
    clear: 'Clear my data',
    keepHint: 'Closes this and changes nothing.',
    clearHint: 'Removes every league, player and setting from this browser, for good.',
  },
  notices: {
    saved: 'Saved settings.',
    cleared: 'Your data was cleared.',
    clearFailed: 'Could not clear your data: browser storage is blocked.',
  },
};
