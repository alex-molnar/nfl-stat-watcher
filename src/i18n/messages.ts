import type { en } from './en';

type Strings<T> = { [K in keyof T]: T[K] extends string ? string : Strings<T[K]> };

/** The shape every language must have: English's keys with string values. A missing or extra key in a translation does not compile. */
export type Messages = Strings<typeof en>;
