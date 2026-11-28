'use strict';

// Das Anlass-Design (Weihnachten) -- siehe renderer/shared/anlass.js.
//
// Gewuenscht: Schnee, Weihnachtsmann oder Nikolaus, verspielt. Pruefbar ist daran nicht, ob es
// huebsch ist (dafuer gibt es .scratch/karten-design/weihnacht-probe.html), sondern die drei
// Dinge, die AUSKUNFT sind und stimmen muessen: wann es gilt, der wievielte Advent ist, und
// wer um die Ecke schaut. Dazu die Verbindungen -- eine Schicht, die niemand einhaengt, ist
// dasselbe wie keine.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const A = require('../renderer/shared/anlass.js');

const tag = (j, m, t) => new Date(j, m - 1, t, 12);
const lies = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('Automatisch gilt Weihnachten vom 25. November bis einschliesslich 6. Januar', () => {
  assert.strictEqual(A.anlassErmitteln('auto', tag(2026, 11, 24)), '');
  assert.strictEqual(A.anlassErmitteln('auto', tag(2026, 11, 25)), 'weihnachten');
  assert.strictEqual(A.anlassErmitteln('auto', tag(2026, 12, 24)), 'weihnachten');
  assert.strictEqual(A.anlassErmitteln('auto', tag(2027, 1, 6)), 'weihnachten');
  assert.strictEqual(A.anlassErmitteln('auto', tag(2027, 1, 7)), '');
  assert.strictEqual(A.anlassErmitteln('auto', tag(2026, 7, 1)), '');
  // Ohne Einstellung gilt die Automatik -- ab Werk an, nicht erst nach dem Einschalten.
  assert.strictEqual(A.anlassErmitteln(undefined, tag(2026, 12, 1)), 'weihnachten');
});

test('Die Einstellung gewinnt in beide Richtungen', () => {
  assert.strictEqual(A.anlassErmitteln('aus', tag(2026, 12, 24)), '');
  assert.strictEqual(A.anlassErmitteln('weihnachten', tag(2026, 7, 1)), 'weihnachten');
});

test('Der Adventskranz zaehlt richtig -- auch wenn Heiligabend auf einen Sonntag faellt', () => {
  // 2026: Advent am 29.11., 6.12., 13.12., 20.12.
  assert.strictEqual(A.adventStand(tag(2026, 11, 28)), 0);
  assert.strictEqual(A.adventStand(tag(2026, 11, 29)), 1);
  assert.strictEqual(A.adventStand(tag(2026, 12, 5)), 1);
  assert.strictEqual(A.adventStand(tag(2026, 12, 6)), 2);
  assert.strictEqual(A.adventStand(tag(2026, 12, 13)), 3);
  assert.strictEqual(A.adventStand(tag(2026, 12, 20)), 4);
  assert.strictEqual(A.adventStand(tag(2026, 12, 26)), 4);
  // Im Januar gehoert der Kranz zum Advent des Vorjahres: alle vier brennen weiter.
  assert.strictEqual(A.adventStand(tag(2027, 1, 3)), 4);
  // 2023 war der 24.12. ein Sonntag und damit der vierte Advent; der erste lag am 3.12.
  assert.strictEqual(A.adventStand(tag(2023, 12, 2)), 0);
  assert.strictEqual(A.adventStand(tag(2023, 12, 3)), 1);
  assert.strictEqual(A.adventStand(tag(2023, 12, 23)), 3);
  assert.strictEqual(A.adventStand(tag(2023, 12, 24)), 4);
});

test('Am 5. und 6. Dezember schaut der Nikolaus um die Ecke, sonst der Weihnachtsmann', () => {
  assert.strictEqual(A.figurFuer(tag(2026, 12, 4)), 'weihnachtsmann');
  assert.strictEqual(A.figurFuer(tag(2026, 12, 5)), 'nikolaus');
  assert.strictEqual(A.figurFuer(tag(2026, 12, 6)), 'nikolaus');
  assert.strictEqual(A.figurFuer(tag(2026, 12, 7)), 'weihnachtsmann');
  assert.strictEqual(A.figurFuer(tag(2026, 12, 24)), 'weihnachtsmann');
});

test('Die Signatur aendert sich genau dann, wenn sich etwas Sichtbares aendert', () => {
  const s = (j, m, t) => A.anlassZustand('auto', tag(j, m, t)).signatur;
  // Seit dem Holzschild aendert sie sich TAEGLICH -- die Zahl der Tage steht mit drin.
  assert.notStrictEqual(s(2026, 11, 30), s(2026, 12, 1), 'das Schild zaehlt einen Tag weiter');
  assert.strictEqual(s(2026, 12, 1), A.anlassZustand('auto', new Date(2026, 11, 1, 23, 59)).signatur, 'innerhalb eines Tages bleibt sie gleich');
  assert.notStrictEqual(s(2026, 12, 4), s(2026, 12, 5), 'der Nikolaus kommt');
  assert.notStrictEqual(s(2026, 12, 12), s(2026, 12, 13), 'eine Kerze mehr');
  assert.strictEqual(s(2026, 7, 1), '', 'ohne Anlass leer');
});

test('Die Flocken sind in drei Tiefen verteilt, bleiben im Bild und fallen schon beim Erscheinen', () => {
  let n = 1;
  const zufall = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  const flocken = A.flockenDaten(30, zufall);
  assert.strictEqual(flocken.length, 30);
  for (const f of flocken) {
    assert.ok(f.links >= 0 && f.links <= 100, 'ausserhalb des Bildes');
    assert.ok(f.versatz <= 0 && f.versatz >= -f.dauer, 'der Versatz muss in der Vergangenheit liegen');
    assert.ok(f.dauer >= 10 && f.dauer <= 30);
  }
  const mittel = (t, k) => { const a = flocken.filter(f => f.tiefe === t); return a.reduce((s, f) => s + f[k], 0) / a.length; };
  assert.ok(mittel(0, 'groesse') < mittel(2, 'groesse'), 'ferne Flocken sind kleiner');
  assert.ok(mittel(0, 'dauer') > mittel(2, 'dauer'), 'ferne Flocken fallen langsamer');
  // Derselbe Zufall, dieselben Flocken.
  n = 1; assert.deepStrictEqual(A.flockenDaten(30, zufall), flocken);
  assert.strictEqual(A.flockenDaten(undefined).length, A.FLOCKEN_VORGABE);
});

test('Der Adventskranz hat vier Kerzen, und so viele brennen, wie Advent ist', () => {
  for (let k = 0; k <= 4; k++) {
    const svg = A.adventskranzSvg(k);
    assert.strictEqual((svg.match(/class="anlass-flamme/g) || []).length, k, `${k} Flammen`);
    assert.strictEqual((svg.match(/stroke="#3a2a22"/g) || []).length, 4, 'vier Dochte');
  }
  assert.strictEqual((A.adventskranzSvg(9).match(/class="anlass-flamme/g) || []).length, 4);
});

test('Die Schicht enthaelt alles -- und ohne Anlass nichts', () => {
  const html = A.schichtHtml(A.anlassZustand('auto', tag(2026, 12, 6)), { flocken: 12 });
  for (const klasse of ['anlass-girlande', 'anlass-schlitten', 'anlass-schnee', 'anlass-figur', 'anlass-kranz', 'anlass-wehe', 'anlass-nase']) {
    assert.ok(html.includes(klasse), `${klasse} fehlt`);
  }
  // Die kleine Szene (Dashboard) hat keine Winterszene -- dort steht unten der Streifen mit der
  // Uhr. Die grosse (Schoner) hat sie, und der Kranz steht dort fest statt aufzutauchen.
  assert.ok(!html.includes('anlass-szene'));
  const gross = A.schichtHtml(A.anlassZustand('auto', tag(2026, 12, 6)), { flocken: 12, szene: 'gross' });
  for (const klasse of ['anlass-szene', 'anlass-baum', 'anlass-geschenke', 'anlass-schild', 'anlass-kranzplatz', 'anlass-haus', 'anlass-schneemann', 'anlass-figur']) {
    assert.ok(gross.includes(klasse), `${klasse} fehlt in der grossen Szene`);
  }
  assert.ok(gross.includes('Noch 18 Tage'), 'das Schild zaehlt');
  assert.ok(gross.includes('data-kerzen="2"'));
  assert.strictEqual((html.match(/class="anlass-flocke/g) || []).length, 12);
  assert.ok(html.includes('data-figur="nikolaus"'), 'am 6.12. der Nikolaus');
  assert.ok(html.includes('data-kerzen="2"'), 'am 6.12. zwei Kerzen');
  assert.strictEqual(A.schichtHtml(A.anlassZustand('aus', tag(2026, 12, 6))), '');
  assert.strictEqual(A.schichtHtml(null), '');
});

// Eine Klasse ohne Regel ist genauso tot wie eine Regel ohne Klasse (siehe CLAUDE.md,
// Energiediagramm). Jede anlass-Klasse aus dem Modul braucht eine Regel im CSS, und jede
// Bewegung im CSS ein Element, das sie traegt.
test('Jede anlass-Klasse im Modul hat eine Regel im CSS, und alles Bewegte traegt anlass-bewegt', () => {
  const css = lies('renderer/shared/anlass.css');
  const html = A.schichtHtml(A.anlassZustand('auto', tag(2026, 12, 20)), { flocken: 3 })
    + A.schichtHtml(A.anlassZustand('auto', tag(2026, 12, 6)), { flocken: 3, szene: 'gross' });
  const klassen = new Set();
  for (const m of html.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).filter(k => k.startsWith('anlass-')).forEach(k => klassen.add(k));
  for (const k of klassen) assert.ok(css.includes('.' + k), `keine CSS-Regel fuer .${k}`);
  // Was im CSS eine Animation bekommt, muss im HTML anlass-bewegt tragen -- sonst haelt es
  // hinter dem Schoner nicht an.
  for (const m of css.matchAll(/\.(anlass-[a-z-]+)[^{}]*\{[^}]*animation(?:-name)?:\s*anlass-/g)) {
    const k = m[1];
    if (k === 'anlass-bewegt') continue;
    const re = new RegExp(`class="[^"]*\\b${k}\\b[^"]*"`, 'g');
    const treffer = html.match(re) || [];
    assert.ok(treffer.length > 0, `.${k} ist animiert, kommt aber im HTML nicht vor`);
    for (const t of treffer) assert.ok(t.includes('anlass-bewegt'), `.${k} ist animiert, traegt aber kein anlass-bewegt`);
  }
});

test('Ohne Bewegung und hinter dem Schoner steht alles still', () => {
  const css = lies('renderer/shared/anlass.css');
  assert.match(css, /body\.ohne-bewegung \.anlass-bewegt \{ animation: none !important; \}/);
  assert.match(css, /\.bildschirmschoner\.bs-sichtbar ~ \.anlass-schicht \.anlass-bewegt/);
  assert.match(css, /\.bildschirmschoner:not\(\.bs-sichtbar\) > \.anlass-schicht \.anlass-bewegt/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.anlass-schnee/);
});

// Die Verbindung: Eine Funktion, die niemand aufruft, ist dasselbe wie eine, die es nicht gibt.
test('Das Dashboard laedt das Modul, haengt die Schicht NACH dem Schoner ein und ruft sie auf', () => {
  const seite = lies('renderer/dashboard.html');
  assert.ok(seite.includes('<script src="shared/anlass.js"></script>'));
  assert.ok(seite.includes('<link rel="stylesheet" href="shared/anlass.css">'), 'ohne das Blatt ist alles unsichtbar');
  assert.match(seite, /szene: 'klein'/); assert.match(seite, /szene: 'gross'/);
  assert.ok(seite.indexOf('id="bildschirmschoner"') < seite.indexOf('id="anlassSchicht"'),
    'die Geschwister-Regel im CSS braucht die Schicht hinter dem Schoner');
  assert.match(seite, /anlassAnwenden\(\);/, 'beim Config-Abruf');
  assert.match(seite, /anlassAnwenden\(true\);/, 'nach dem Erzeugen des Schoners -- der baut sein Inneres neu');
  assert.match(seite, /schoner\.farbenSetzen\(/);
});

test('Die Einstellung reist durch Server und Einstellungsseite', () => {
  const server = lies('server/setup-server.js');
  assert.match(server, /anlassDesign: store\.get\('anlassDesign'\) \|\| 'auto'/);
  assert.match(server, /\['auto', 'aus', 'weihnachten'\]\.includes\(anlassDesign\)/);
  const js = lies('renderer/setup/theme.js'), html = lies('renderer/setup/theme.html');
  assert.match(js, /anlassDesign: \$\('anlassDesign'\)\.value/);
  assert.match(js, /\$\('anlassDesign'\)\.value = configRes\.anlassDesign/);
  for (const wert of ['auto', 'weihnachten', 'aus']) assert.ok(html.includes(`<option value="${wert}"`), wert);
});

test('Die Buehne wuerfelt aus mehreren Farbausschnitten und bleibt im Farbkreis', () => {
  const { Buehne } = require('../renderer/shared/buehne.js');
  const b = Object.create(Buehne.prototype);
  b.tonVon = 0; b.tonBis = 360; b.toene = A.BUEHNE_TOENE_WEIHNACHTEN;
  for (let i = 0; i < 200; i++) {
    const t = b._ton();
    assert.ok(t >= 0 && t < 360, `Ton ${t} ausserhalb`);
    const rot = t >= 348 || t <= 6, gold = t >= 38 && t <= 50, gruen = t >= 128 && t <= 152;
    const blau = t >= 205 && t <= 225, rosa = t >= 305 && t <= 328;
    assert.ok(rot || gold || gruen || blau || rosa, `Ton ${t} gehoert zu keiner Festfarbe`);
  }
  b.toene = null; b.tonVon = 100; b.tonBis = 110;
  const t = b._ton(); assert.ok(t >= 100 && t <= 110);
});

// --- Die zweite Fassung: ein eigenes Aussehen statt einer Schicht ---------------------------------
//
// Die Rueckmeldung zur ersten Fassung: "zu einfach und zu minimal ... ich moechte wirklich was mit
// viel Farben und wirklich Weihnachten", und danach: "Schriftart, Schriftfarbe, gesamtes Layout
// kannst du auch ein anderes hernehmen."

test('Das Holzschild zaehlt die Kalendertage bis Heiligabend und wechselt danach den Text', () => {
  assert.deepStrictEqual(A.schildText(tag(2026, 11, 28)), { gross: 'Noch 26 Tage', klein: 'bis Heiligabend' });
  assert.strictEqual(A.schildText(tag(2026, 12, 23)).gross, 'Noch 1 Tag');
  // Am 23. um 23 Uhr ist es immer noch ein Tag, nicht null.
  assert.strictEqual(A.schildText(new Date(2026, 11, 23, 23, 30)).gross, 'Noch 1 Tag');
  assert.strictEqual(A.schildText(tag(2026, 12, 24)).gross, 'Heiligabend!');
  assert.strictEqual(A.schildText(tag(2026, 12, 25)).gross, 'Frohe Weihnachten');
  assert.strictEqual(A.schildText(tag(2026, 12, 26)).klein, '2. Weihnachtstag');
  assert.strictEqual(A.schildText(tag(2026, 12, 31)).gross, 'Guten Rutsch!');
  assert.deepStrictEqual(A.schildText(tag(2027, 1, 2)), { gross: 'Frohes neues Jahr', klein: '2027' });
  // Die Zahl aendert sich taeglich, also auch die Signatur -- sonst stuende morgen die von heute da.
  assert.notStrictEqual(A.anlassZustand('auto', tag(2026, 12, 1)).signatur, A.anlassZustand('auto', tag(2026, 12, 2)).signatur);
});

test('Die Girlande haengt in acht Boegen: Schleifen an den Enden, Lichter darauf, ein Anhaenger je Bogen', () => {
  let n = 3;
  const zufall = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  const html = A.girlandeHtml(zufall);
  assert.strictEqual((html.match(/class="anlass-schleife"/g) || []).length, A.BOEGEN + 1);
  assert.strictEqual((html.match(/class="anlass-haenger /g) || []).length, A.BOEGEN);
  assert.strictEqual((html.match(/class="anlass-birne /g) || []).length, A.BOEGEN * 4);
  // Nichts haengt ausserhalb des Bildes.
  for (const m of html.matchAll(/left:([0-9.]+)%/g)) assert.ok(Number(m[1]) >= 0 && Number(m[1]) <= 100, `left ${m[1]}%`);
  // Keine zwei benachbarten Anhaenger sind dieselbe Zeichnung.
  const teile = html.split('class="anlass-haenger ').slice(1).map(t => t.slice(t.indexOf('<svg'), t.indexOf('</svg>')));
  for (let i = 1; i < teile.length; i++) assert.notStrictEqual(teile[i], teile[i - 1], `Anhaenger ${i} gleicht seinem Nachbarn`);
});

test('Die Karten sind bunt: sechs Festfarben reihum, die Energiekarte bleibt nachtblau', () => {
  const css = lies('renderer/shared/anlass.css');
  const farben = new Set();
  for (let i = 1; i <= 6; i++) {
    const m = new RegExp(`\\.card:nth-child\\(6n\\+${i}\\) \\{ --wf1: (#[0-9a-f]{6}); --wf2: (#[0-9a-f]{6});`).exec(css);
    assert.ok(m, `keine Farbe fuer die ${i}. Karte`);
    farben.add(m[1]);
  }
  assert.strictEqual(farben.size, 6, 'sechs VERSCHIEDENE Farben');
  // Fotos, Radar und Media Player bringen ihr eigenes Bild mit.
  assert.match(css, /\.card:not\(\.type-photo\):not\(\.type-radar\):not\(\.type-media_player\):not\(\.card-on-photo\) \{\s*background: var\(--wm/);
  // Die Knotenfarben der Energiekarte sind Auskunft -- auf Rot oder Gold waeren sie nicht zu lesen.
  assert.match(css, /\.card\.type-energy \{\s*--wf1: #1b2a66/);
  // Und ein Tor, das klemmt, wird rot: Das braucht eine dunkle Karte.
  assert.match(css, /\.card\.tor-ueberfaellig \{ --wf1: #3a0d16/);
});

test('Zu Weihnachten gibt es kein helles Design: weisse Schrift auf Farbe, der Sonnenstand schaltet nur den Himmel', () => {
  const seite = lies('renderer/dashboard.html');
  assert.match(seite, /classList\.toggle\('light-theme', isDay && !weihnachten\)/);
  assert.match(seite, /classList\.toggle\('anlass-tag', isDay && weihnachten\)/);
  // anlassAnwenden ruft applyTheme -- sonst bliebe light-theme stehen, bis sich die Sonne ruehrt.
  const block = seite.slice(seite.indexOf('function anlassAnwenden'), seite.indexOf('function applyTheme'));
  assert.match(block, /applyTheme\(\);/);
  const css = lies('renderer/shared/anlass.css');
  assert.ok(!/\.light-theme/.test(css), 'im Weihnachtsblatt hat eine light-theme-Regel nichts verloren');
});

test('Die Weihnachtsschrift ist mitgeliefert, samt Lizenz, und das Blatt zeigt auf die Datei', () => {
  const css = lies('renderer/shared/anlass.css');
  const m = /font-family: 'Panel Weihnachten';\s*src: url\('([^']+)'\)/.exec(css);
  assert.ok(m, 'kein @font-face fuer die Weihnachtsschrift');
  // Ein falscher Pfad faellt still auf die naechste Schrift zurueck -- siehe test/uhrschrift.test.js.
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'renderer', 'shared', m[1])), `die Schriftdatei ${m[1]} fehlt`);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'renderer', 'shared', 'schriften', 'LICENSE-MountainsofChristmas.txt')));
  assert.match(lies('renderer/shared/schriften/HERKUNFT.md'), /Mountains of Christmas/);
  assert.match(css, /font-display: block/);
});
