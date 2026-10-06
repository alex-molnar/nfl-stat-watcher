import { createStore } from './store';

/** Rookie camp, the guided first practice. `idle`: never offered or answered; `running` with the drill it is on; `finished`: all drills done, the congratulation waits to be dismissed; `done`; `declined`: left or turned down (both can be started again from Settings). */
export interface CampState {
  phase: 'idle' | 'running' | 'finished' | 'done' | 'declined';
  step: number;
}

const PHASES: readonly unknown[] = ['idle', 'running', 'finished', 'done', 'declined'];

export const CAMP_KEY = 'nflsw:v1:camp';

export const campStore = createStore<CampState>({
  key: CAMP_KEY,
  fallback: () => ({ phase: 'idle', step: 0 }),
  isValid: (v): v is CampState => {
    const c = v as Partial<CampState> | null;
    return typeof c === 'object' && c !== null && PHASES.includes(c.phase) && Number.isInteger(c.step) && c.step! >= 0;
  },
});

export const startCamp = () => campStore.set({ phase: 'running', step: 0 });
export const endCamp = (phase: 'done' | 'declined') => campStore.set({ phase, step: 0 });
