import { createStore } from './store';

/** Rookie camp, the guided first practice. `idle`: never offered or answered; `running` with the drill it is on; `finished`: all drills done, the congratulation waits to be dismissed; `done`; `declined`: left or turned down (both can be started again from Settings). */
export interface CampState {
  phase: 'idle' | 'running' | 'finished' | 'done' | 'declined';
  /** The drill the camp is on. */
  step: number;
  /** The step inside that drill. */
  sub: number;
  /** The practice league (with its practice players) is wanted for the whole camp: it was chosen, or drill 1 was skipped. It lives until the camp ends. */
  practice?: boolean;
}

const PHASES: readonly unknown[] = ['idle', 'running', 'finished', 'done', 'declined'];

export const CAMP_KEY = 'nflsw:v1:camp';

export const campStore = createStore<CampState>({
  key: CAMP_KEY,
  fallback: () => ({ phase: 'idle', step: 0, sub: 0 }),
  // A state saved before drills had steps has no `sub`: it starts the drill from its first step.
  isValid: (v): v is CampState => {
    const c = v as Partial<CampState> | null;
    return typeof c === 'object' && c !== null && PHASES.includes(c.phase) && Number.isInteger(c.step) && c.step! >= 0 && (c.sub === undefined || (Number.isInteger(c.sub) && c.sub >= 0)) && (c.practice === undefined || typeof c.practice === 'boolean');
  },
  repair: (c) => ({ ...c, sub: c.sub ?? 0 }),
});

/** Moves the camp on, keeping what it carries along (the practice league). */
export const patchCamp = (patch: Partial<CampState>) => campStore.set({ ...campStore.get(), ...patch });
export const startCamp = () => campStore.set({ phase: 'running', step: 0, sub: 0 });
export const endCamp = (phase: 'done' | 'declined') => campStore.set({ phase, step: 0, sub: 0 });
