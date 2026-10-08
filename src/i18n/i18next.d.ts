import type { en } from './en';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    enableSelector: true;
    resources: { translation: typeof en };
  }
}
