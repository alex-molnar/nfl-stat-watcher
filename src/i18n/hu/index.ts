import type { Messages } from '../messages';
import { camp } from './camp';
import { leagues } from './leagues';
import { privacy } from './privacy';
import { settings } from './settings';
import { shell } from './shell';
import { sync } from './sync';

/** Magyar. Loaded only when needed, so English visitors never download it. */
const hu: Messages = { shell, leagues, sync, camp, settings, privacy };
export default hu;
