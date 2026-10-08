/** English texts for the privacy area. The English here is the source: Hungarian (../hu/privacy.ts) must have the same keys. */
export const privacy = {
  title: 'Privacy',
  intro: 'Stat Watch is a personal project, run by Alex Molnar. It has no accounts and no ads, and it does not sell or share data. This page says what it does collect, and why. Last updated {{date}}.',
  lastUpdatedDate: '8 October 2026',
  browser: {
    heading: 'What stays in your browser',
    saved: "The players you follow, your leagues, your scoring settings and your preferences are saved in your browser's local storage, on your own device. They are never sent to the server. Clear my data in Settings, or clearing this site's data in your browser, deletes them.",
    private: 'For a private league, you copy its settings or rosters from your own signed-in ESPN tab. That data is read in your browser. Stat Watch never sees your ESPN password and does not send what you copied anywhere.',
  },
  counts: {
    heading: 'Anonymous usage counts',
    intro: "To see how the site is used and where it breaks, the page sends small events to this site's own server. Each one is a count in a fixed category, and nothing else:",
    page: 'that a page was loaded and which screen was opened (Players, Vs Mode, Leagues, Settings or Privacy);',
    device: 'your browser, operating system and kind of device, reduced to a few words such as "Chrome", "iOS" and "mobile";',
    league: 'whether an ESPN league was loaded or imported, whether it was public or private, and whether starters were synced. Never a league name or ID, and never a team or player;',
    help: 'which steps of the private league help were used;',
    speed: 'how fast the page loaded and responded, script errors, and whether requests to ESPN failed;',
    open: 'that this tab is open and updating live, about once a minute. It carries a random number made when the tab opened. The server keeps that number in memory for a minute and a half only to count how many tabs are open, and it is never stored or exported.',
    totals: "The counts are added up on the server and shown as totals. They are not tied to you. They use no cookies and nothing is stored on your device for them. Your browser's identification text is read once, turned into those few words and thrown away, and your IP address is not kept with the counts. Because they cannot be traced back to a person, I treat them as anonymous statistics.",
    optOut: 'If you would rather not be counted at all, turn on Do Not Track or Global Privacy Control in your browser, or block requests to <code>/api/e</code>. The site works the same either way.',
  },
  logs: {
    heading: 'Server logs',
    body: 'Like any website, the web server and the hosting platform write access logs (IP address, time, address requested and browser) to keep the site secure and to fix problems. I do not use them for analysis, and the usage counts above are left out of the web server\'s own log. The platform rotates old logs out on its normal schedule.',
  },
  others: {
    heading: 'Other companies',
    espn: '<strong>ESPN.</strong> Scores, stats and league data come straight from ESPN to your browser, as on any page that shows ESPN data. ESPN therefore sees your IP address and browser, and which players, games and leagues you ask for, and handles them under its own privacy policy. Stat Watch tells ESPN nothing else about you.',
    fonts: "<strong>Google Fonts.</strong> The page's fonts are loaded from Google's servers, so Google receives your IP address and browser when the page loads, under Google's own privacy policy.",
  },
  rights: {
    heading: 'Your rights and contact',
    body: 'Under the GDPR you can ask what is held about you, ask for it to be deleted, or object to how it is used. The usage counts are anonymous, so there is nothing in them I can look up or delete for one person, and everything else you saved is on your device, where you can delete it yourself. For anything else, or a question about this page, open an issue at <a>github.com/alex-molnar/nfl-stat-watcher</a>. You can also complain to your national data protection authority.',
  },
};
