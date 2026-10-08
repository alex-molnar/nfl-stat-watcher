import type { Messages } from '../messages';

export const privacy: Messages['privacy'] = {
  title: 'Adatvédelem',
  intro: 'A Stat Watch egy személyes projekt, amelyet Alex Molnar működtet. Nincsenek fiókok és hirdetések, és nem ad el vagy oszt meg adatokat. Ez az oldal azt írja le, hogy mit gyűjt, és miért. Utolsó frissítés: {{date}}',
  lastUpdatedDate: '2026. október 8.',
  browser: {
    heading: 'Ami a böngésződben marad',
    saved: 'A követett játékosaid, a ligáid, a pontozási beállításaid és a személyes beállításaid a böngésződ helyi tárolójában (local storage) vannak elmentve, a saját eszközödön. Ezek soha nem kerülnek el a szerverre. A Beállításokban az „Adataim törlése” gombbal, vagy ha a böngészőben törlöd az oldal adatait, mindez törlődik.',
    private: 'Privát liga esetén a beállításait vagy a kereteit a saját, bejelentkezett ESPN-lapodról másolod át. Ezeket az adatokat a böngésződ olvassa be. A Stat Watch soha nem látja az ESPN-jelszavadat, és a kimásolt adatokat sehová nem küldi el.',
  },
  counts: {
    heading: 'Névtelen használati számlálók',
    intro: 'Hogy lássam, hogyan használják az oldalt, és hol hibásodik meg, az oldal apró eseményeket küld az oldal saját szerverének. Mindegyik egy számláló egy előre meghatározott kategóriában, és semmi más:',
    page: 'hogy egy oldal betöltődött, és melyik képernyőt nyitották meg (Játékosok, Párharc, Ligák, Beállítások vagy Adatvédelem);',
    device: 'a böngésződ, az operációs rendszered és az eszközöd fajtája, néhány szóra leegyszerűsítve, például „Chrome”, „iOS” és „mobil”;',
    league: 'hogy betöltöttek vagy importáltak-e egy ESPN-ligát, hogy nyilvános volt-e vagy privát, és hogy szinkronizáltak-e kezdőket. Soha nem a liga neve vagy azonosítója, és soha nem egy csapat vagy játékos;',
    help: 'hogy a privát liga súgójának melyik lépéseit használták;',
    speed: 'milyen gyorsan töltődött be és reagált az oldal, a szkripthibák, és hogy az ESPN-nek küldött kérések sikertelenek voltak-e;',
    open: 'hogy ez a lap nyitva van és élőben frissül, nagyjából percenként egyszer. Ez egy véletlen számot hordoz, amely a lap megnyitásakor készült. A szerver ezt a számot csak másfél percig tartja a memóriájában, kizárólag azért, hogy megszámolja, hány lap van nyitva, és sosem tárolja vagy exportálja.',
    totals: 'A számlálókat a szerver összeadja, és összesítésként jeleníti meg. Nem kapcsolódnak hozzád. Nem használnak sütiket (cookie), és semmi nem kerül miattuk az eszközödre. A böngésződ azonosító szövegét egyszer kiolvassa a rendszer, átalakítja ezekké a néhány szavakká, és eldobja, az IP-címedet pedig nem őrzi meg a számlálók mellett. Mivel nem vezethetők vissza egy személyre, névtelen statisztikának tekintem őket.',
    optOut: 'Ha inkább egyáltalán nem szeretnél bekerülni a számlálókba, kapcsold be a böngésződben a Do Not Track vagy a Global Privacy Control beállítást, vagy tiltsd le a <code>/api/e</code> címre küldött kéréseket. Az oldal mindkét esetben ugyanúgy működik.',
  },
  logs: {
    heading: 'Szervernaplók',
    body: 'Mint minden weboldal esetében, a webszerver és a tárhelyszolgáltató platform hozzáférési naplókat ír (IP-cím, időpont, kért cím és böngésző), hogy az oldal biztonságos maradjon, és hogy a hibákat ki lehessen javítani. Nem használom őket elemzésre, a fenti használati számlálókat pedig kihagyom a webszerver saját naplójából. A platform a régi naplókat a szokásos ütemezése szerint törli.',
  },
  others: {
    heading: 'Más cégek',
    espn: '<strong>ESPN.</strong> Az eredmények, a statisztikák és a ligaadatok közvetlenül az ESPN-től érkeznek a böngésződbe, ahogy minden olyan oldalon, amely ESPN-adatokat mutat. Az ESPN ezért látja az IP-címedet és a böngésződet, valamint azt, hogy mely játékosokat, meccseket és ligákat kéred le, és ezeket a saját adatvédelmi szabályzata szerint kezeli. A Stat Watch semmi mást nem közöl rólad az ESPN-nel.',
    fonts: '<strong>Google Fonts.</strong> Az oldal betűtípusait a Google szerverei töltik be, ezért a Google az oldal betöltésekor megkapja az IP-címedet és a böngésződet, a Google saját adatvédelmi szabályzata szerint.',
  },
  rights: {
    heading: 'Jogaid és kapcsolat',
    body: 'A GDPR alapján kérheted, hogy tájékoztassalak arról, milyen adat van rólad, kérheted a törlését, vagy tiltakozhatsz a felhasználása ellen. A használati számlálók névtelenek, ezért semmi olyat nem tartalmaznak, amit egy adott személyhez kikereshetnék vagy törölhetnék, minden más, amit elmentettél, pedig az eszközödön van, ahol magad is törölheted. Bármi másért, vagy ha kérdésed van erről az oldalról, nyiss egy hibajegyet (issue) itt: <a>github.com/alex-molnar/nfl-stat-watcher</a>. Panaszt az országos adatvédelmi hatóságnál is tehetsz.',
  },
};
