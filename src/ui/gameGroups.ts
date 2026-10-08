/** The order the Players and Vs screens use to group cards by game state; the titles are `shell.groups.<key>`. */
export const GROUPS = [
  { key: 'in' },
  { key: 'pre' },
  { key: 'post' },
  { key: 'none' },
] as const;
