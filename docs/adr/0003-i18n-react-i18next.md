# ADR 0003: Translate with i18next, English bundled, other languages on demand

**Status:** Accepted  
**Date:** 2026-10-08

## Context

The site was English only, with every text written into its components. The owner can vouch for Hungarian and wants more languages possible later. The texts include plurals ("1 starter", "3 starters"), sentences with links and bold words (the private league guides), error messages built in plain TypeScript, and scripted copy (Rookie camp, the Privacy notice). The one video is narrated in English.

## Decision

- **i18next with react-i18next.** Plurals, `{{values}}` and elements inside sentences (`Trans`) are solved problems, and the same instance serves plain TypeScript (`i18n.t`). The cost is two dependencies and some size.
- **Texts are an object, English is the source** (`src/i18n/en/<area>.ts`). With i18next's typed selectors a key is written `t(($) => $.shell.nav.players)`: a wrong key is a compile error, and renaming one is an ordinary refactor. A translation is typed against English's shape, so a missing or extra key does not compile; a test also checks that each translation keeps the English `{{values}}` and `<tags>`. There are no separate JSON files to drift.
- **English is bundled, other languages are chunks** fetched when first used (`import('./hu')`). English visitors download nothing extra, and a Hungarian visitor waits for one small file before the first render, so no English flashes by.
- **The choice is a preference** (`languageStore`: automatic, English, Hungarian), saved in the browser like the others, changed in Settings with Save. Automatic follows `navigator.languages`. No URL prefix and no server logic: the site is static and the choice is per browser.
- **Stored data never holds translated text.** Messages that are saved (import issues) are saved as codes and translated when shown.
- **The video keeps its English voice; captions are WebVTT tracks** per language (`public/captions/`), the one for the site's language marked default.
- **Not translated:** ESPN's data (names, play text, headlines), position codes and the site name.

## Alternatives considered

- **Lingui or FormatJS.** Better extraction tooling, but a build step (macros or a compiler) and catalogue files to keep in sync; the typed object gives the same safety with nothing to build.
- **A hand-written `t()`.** No dependency, but plurals and rich text would be reinvented, and Hungarian's and later languages' rules differ.
- **Separate JSON per language.** Conventional, but missing keys are found at runtime, not by the compiler.
- **A URL per language (`/hu/...`).** Helps search engines, but needs routing and hosting changes for a personal tool that is used signed-in-style, not found by search.
- **Dubbing the video.** Out of scope; captions cover it.

## Consequences

- Every new text now has two entries (English and each language). The compiler reports a missing translation; `docs/i18n.md` describes the steps for a text and for a language.
- A sentence is never assembled from pieces, so a screen reader and a translator see whole sentences.
- Tests read English by default (the setup puts English back after each test); Hungarian tests call `inHungarian()`.
- Bundle size grows by the libraries (a few tens of kB gzipped) and, for Hungarian visitors, one lazy chunk.
- Hungarian wording is the owner's to review; the glossary in `docs/i18n.md` keeps terms consistent.
