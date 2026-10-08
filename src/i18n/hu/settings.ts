import type { Messages } from '../messages';

export const settings: Messages['settings'] = {
  title: 'Beállítások',
  categoriesLabel: 'Beállítási kategóriák',
  categoriesList: 'Kategóriák',
  categories: { general: 'Általános', positionOrder: 'Pozíciósorrend', siteSettings: 'Oldalbeállítások' },
  saveBarLabel: 'Változtatások mentése vagy elvetése',
  saveBarEndLabel: 'Változtatások mentése vagy elvetése, az űrlap vége',
  nameDisplay: {
    legend: 'Névmegjelenítés',
    help: 'Így jelennek meg a játékosok nevei a kártyákon és a listákban.',
    example: 'pl. {{example}}',
    modes: { full: 'Teljes', initial: 'Rövidített', formal: 'Formális' },
  },
  language: {
    legend: 'Nyelv',
    auto: 'Automatikus',
    autoHelp: 'A böngésződ nyelvét használja, ha az oldal elérhető azon a nyelven, különben angolt.',
  },
  starters: {
    legend: 'Kezdők',
    autoSync: 'Nyilvános ligák automatikus szinkronizálása',
    autoSyncHelp: 'Minden alkalommal, amikor megnyitod a Játékosok vagy a Párharc oldalt, a nyilvános ligáid kezdői újra szinkronizálódnak. Ezeknek a ligáknak minden olyan kártyája törlődik, amely nem kezdő, függetlenül az adott liga saját beállításától. A privát ligákhoz nem nyúl: azokhoz a könyvjelző kell.',
  },
  positions: {
    legend: 'Pozíciósorrend',
    orderHelp: 'Ez a pozíciósorrend érvényes a Játékosok és a Párharc oldalon minden meccsállapot-csoporton belül. Élő meccsek alatt az aktivitás van elöl: először a red zone, utána a pályán lévők, végül az inaktívak.',
    dragHelp: 'Húzz meg egy sort bárhol egy pozíció áthelyezéséhez, vagy használd a nyílgombokat. A sorrend alkalmazásához mentsd el.',
    groupsNote: 'A DL a DE-t, a DT-t és az NT-t is magában foglalja; az LB az ILB-t, az OLB-t és az MLB-t; a DB a CB-t és a safetyket. A fullbackek az RB-t használják; a PK a K-t.',
    reset: 'Pozíciósorrend visszaállítása',
  },
  mascot: {
    legend: 'Kabala',
    show: 'Kabala megjelenítése',
    name: 'Név',
    help: 'A szemüveges focilabda, amely a cím mellett jelenik meg, és megmondja, mit tegyél, ha egy oldal üres. Kikapcsolva minden oldal egyszerű szöveget használ helyette, a Ligák menü pedig buborékokban magyarázza a gombjait.',
  },
  camp: {
    legend: 'Újonctábor',
    help: 'Rövid gyakorlás a kabalával ({{name}}): négy gyakorlat, mindegyik a valódi oldalakon, hogy körbevezessen.',
    helpOff: 'Kapcsold be a kabalát, és mentsd el, hogy elvégezhesd a gyakorlást.',
    start: 'Újonctábor indítása',
    started: 'Az Újonctábor elindult. {{name}} megmutatja az első gyakorlatot.',
  },
  privateSync: {
    legend: 'Privát liga szinkronizálása',
    show: 'Könyvjelzős beállítás mutatása privát ligákhoz',
    help: 'A könyvjelző opció mutatása a privát ligák kezdőinek szinkronizálásakor. Kapcsold be, hogy visszakerüljön, ha korábban a „Ne mutasd többé ezt az opciót” lehetőséget választottad.',
  },
  data: {
    legend: 'Az adataid',
    help: 'A követett játékosok, a ligák, a pontozás és minden más beállítás csak ebben a böngészőben tárolódik.',
    clear: 'Adataim törlése',
  },
  clearDialog: {
    title: 'Törlöd az összes adatodat?',
    warning: 'Ez véglegesen törli a követett játékosaidat, a ligáidat és azok pontozását, valamint a beállításaidat ebből a böngészőből. Nem vonható vissza.',
    keep: 'Megtartom az adataimat',
    clear: 'Adataim törlése',
    keepHint: 'Bezárja ezt az ablakot, és nem változtat semmin.',
    clearHint: 'Véglegesen eltávolít minden ligát, játékost és beállítást ebből a böngészőből.',
  },
  notices: {
    saved: 'A beállítások mentve.',
    cleared: 'Az adataid törölve lettek.',
    clearFailed: 'Nem sikerült törölni az adataidat: a böngésző tárolója le van tiltva.',
  },
};
