/** The order and titles the Players and Vs screens use to group cards by game state. */
export const GROUPS = [
  { key: 'in', title: 'Live now' },
  { key: 'pre', title: 'Later' },
  { key: 'post', title: 'Final' },
  { key: 'none', title: 'Bye week' },
] as const;
