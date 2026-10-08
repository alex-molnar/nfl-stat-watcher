import { camp } from './camp';
import { leagues } from './leagues';
import { privacy } from './privacy';
import { settings } from './settings';
import { shell } from './shell';
import { sync } from './sync';

/** The source language: every text the site shows, by area. Other languages are checked against it by the compiler. */
export const en = { shell, leagues, sync, camp, settings, privacy };
