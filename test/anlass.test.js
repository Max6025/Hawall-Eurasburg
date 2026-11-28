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

// Seit 1.0.43 ist der Schnee DREI LAGEN statt vieler einzelner Flocken: Jede Flocke als eigene
// Ebene kostete den Compositor-Faden auf dem Surface Go 45 % eines Kerns.
test('Der Schnee ist drei Lagen: fern klein und langsam, nah gross und schnell', () => {
  let n = 1;
  const zufall = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  const lagen = A.flockenDaten(60, zufall);
  assert.strictEqual(lagen.length, 3);
  const stueck = lagen.reduce((s, l) => s + l.flocken.length, 0);
  assert.ok(stueck >= 58 && stueck <= 62, `${stueck} Flocken statt rund 60`);
  for (const l of lagen) for (const f of l.flocken) {
    assert.ok(f.x >= 0 && f.x <= 1680 && f.y >= 0 && f.y <= 1000, 'ausserhalb der Kachel');
    assert.ok(f.deckkraft > 0.4 && f.deckkraft <= 1);
  }
  const mittel = (l, k) => l.flocken.reduce((s, f) => s + f[k], 0) / l.flocken.length;
  assert.ok(mittel(lagen[0], 'r') < mittel(lagen[2], 'r'), 'ferne Flocken sind kleiner');
  assert.ok(lagen[0].dauer > lagen[2].dauer, 'ferne Flocken fallen langsamer');
  assert.ok(lagen[0].flocken.length > lagen[2].flocken.length, 'in der Ferne sind es mehr');
  // Derselbe Zufall, dieselben Flocken.
  n = 1; assert.deepStrictEqual(A.flockenDaten(60, zufall), lagen);
  // Und im Markup: genau SECHS bewegte Ebenen fuer allen Schnee, egal wie viele Flocken.
  for (const anzahl of [20, 60, 200]) {
    const html = A.schneeHtml(anzahl, zufall);
    assert.strictEqual((html.match(/anlass-bewegt/g) || []).length, 6, `${anzahl} Flocken`);
    assert.strictEqual((html.match(/class="anlass-schneelage/g) || []).length, 3);
    assert.ok(html.includes("url('data:image/svg+xml,"), 'die Flocken stehen als Bild in der Lage');
  }
});

test('Der Adventskranz hat vier Kerzen, und so viele brennen, wie Advent ist', () => {
  for (let k = 0; k <= 4; k++) {
    const svg = A.adventskranzSvg(k);
    assert.strictEqual((svg.match(/anlass-flamme fl/g) || []).length, k, `${k} Flammen`);
    assert.strictEqual((svg.match(/stroke="#3a2a22"/g) || []).length, 4, 'vier Dochte');
  }
  assert.strictEqual((A.adventskranzSvg(9).match(/anlass-flamme fl/g) || []).length, 4);
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
  assert.strictEqual((html.match(/class="anlass-schneelage/g) || []).length, 3);
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
  // Kommentare zuerst weg: Dort stehen Klassennamen im Fliesstext, und die sind keine Regeln.
  const regeln = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of regeln.matchAll(/\.(anlass-[a-z-]+)[^{}]*\{[^}]*animation(?:-name)?:\s*anlass-/g)) {
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
  assert.strictEqual((html.match(/class="anlass-birne"/g) || []).length, A.BOEGEN * 4);
  // 32 Birnen, aber nur vier bewegte Ebenen: Sie atmen in Gruppen.
  assert.strictEqual((html.match(/class="anlass-lichter anlass-bewegt/g) || []).length, 4);
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

// --- Fluessig: nur die Grafikeinheit bewegt -------------------------------------------------------
//
// Auf dem Surface Go gemessen (1.0.41): 198 % eines Kerns und 46 % der Grafikeinheit, gemeldet
// als Ruckeln. Die Ursache waren Bewegungen INNERHALB von SVG-Zeichnungen (Baumlichter, Winken,
// Flammen) samt Schlagschatten darauf -- die rechnet der Hauptstrang, Bild fuer Bild. Die
// Vorgabe: "Animationen muessen fluessig laufen, ohne Ruckeln, ohne Haengen, ohne langsam zu
// werden. Auch wenn man den Bildschirm antippt." Diese Tests halten die Bauweise fest, die das
// leistet: Bewegt wird nur HTML, und nur ueber transform und opacity.

const ohneKommentare = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const svgBloecke = (html) => html.match(/<svg[\s\S]*?<\/svg>/g) || [];

test('Kein bewegtes Teil steckt in einem SVG -- in keiner Szene, an keinem Tag', () => {
  for (const szene of ['klein', 'gross']) {
    for (const d of [tag(2026, 11, 28), tag(2026, 12, 6), tag(2026, 12, 20)]) {
      const html = A.schichtHtml(A.anlassZustand('auto', d), { flocken: 4, szene });
      assert.ok(svgBloecke(html).length > 10, 'die Zeichnungen sind da');
      for (const block of svgBloecke(html)) {
        assert.ok(!/anlass-bewegt|anlass-teil|data-auftritt/.test(block), `bewegtes Teil im SVG (${szene}): ${block.slice(0, 90)}`);
      }
    }
  }
});

test('Jede Bewegung aendert nur transform und opacity', () => {
  const css = ohneKommentare(lies('renderer/shared/anlass.css'));
  const bloecke = [...css.matchAll(/@keyframes (anlass-[a-z-]+) \{((?:[^{}]*\{[^{}]*\})+)\s*\}/g)];
  assert.ok(bloecke.length >= 15, `zu wenige Bewegungen gefunden (${bloecke.length})`);
  for (const [, name, inhalt] of bloecke) {
    for (const m of inhalt.matchAll(/([a-z-]+)\s*:/g)) {
      assert.ok(['transform', 'opacity'].includes(m[1]), `${name} aendert ${m[1]} -- das rechnet der Hauptstrang`);
    }
  }
});

test('Im Weihnachtsblatt gibt es keinen Filter und keine Maske', () => {
  // Ein Filter ist eine eigene Zeichenrunde der Grafikeinheit. Der Schnee laesst das ganze Bild
  // in jedem Bild neu zeichnen -- also liefe jede dieser Runden sechzigmal in der Sekunde.
  const css = ohneKommentare(lies('renderer/shared/anlass.css'));
  for (const m of css.matchAll(/filter\s*:\s*([^;}]+)/g)) {
    assert.strictEqual(m[1].trim(), 'none', `ein Filter im Weihnachtsblatt: ${m[0]}`);
  }
  assert.ok(!/mask(-image)?\s*:/.test(css), 'eine Maske im Weihnachtsblatt');
  assert.ok(!/mix-blend-mode/.test(css), 'ein Mischmodus im Weihnachtsblatt');
  // Und die grossen weichgezeichneten Flaechen des Alltags sind zu Weihnachten aus.
  assert.match(css, /body\.anlass-weihnachten \.lebendig \{ display: none; \}/);
  assert.match(css, /body\.anlass-weihnachten \.bs-buehne \{ display: none; \}/);
  assert.match(lies('renderer/dashboard.html'), /schoner\.buehneSperren\(z\.anlass === 'weihnachten'\)/);
  // Die verdeckte Schicht wird gar nicht gezeichnet.
  assert.match(css, /\.bildschirmschoner\.bs-sichtbar ~ \.anlass-schicht \{ visibility: hidden;/);
});

test('Die Buehne laesst sich sperren und startet gesperrt nicht', () => {
  const B = require('../renderer/shared/bildschirmschoner.js');
  const s = Object.create(B.Bildschirmschoner.prototype);
  const rufe = [];
  s.buehne = { starten: () => rufe.push('start'), stoppen: () => rufe.push('stopp') };
  s.wurzel = { classList: { add() {}, remove() {} } };
  s.sichtbar = false; s.art = 'wolken';
  s.buehneSperren(true);
  s.zeigen();
  assert.deepStrictEqual(rufe, ['stopp'], 'gesperrt darf zeigen() die Buehne nicht starten');
  s.buehneSperren(false);
  assert.deepStrictEqual(rufe, ['stopp', 'start'], 'entsperrt laeuft sie wieder, wenn der Schoner liegt');
});

// --- Die Auftritte --------------------------------------------------------------------------------

test('Auftritte kommen gewuerfelt, aber nie derselbe zweimal hintereinander', () => {
  const namen = ['schlitten', 'figur', 'rudolf', 'schnuppe', 'fallschirm'];
  let n = 5, zuletzt = '';
  const zufall = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  const gezaehlt = {};
  for (let i = 0; i < 600; i++) {
    const name = A.auftrittWaehlen(namen, zuletzt, zufall);
    assert.ok(namen.includes(name));
    assert.notStrictEqual(name, zuletzt, 'derselbe Auftritt zweimal wirkt wie ein Haenger');
    gezaehlt[name] = (gezaehlt[name] || 0) + 1; zuletzt = name;
  }
  for (const name of namen) assert.ok(gezaehlt[name] > 30, `${name} kommt nie dran`);
  assert.ok(gezaehlt.schlitten > gezaehlt.schnuppe, 'der Schlitten ist der haeufigste Gast');
  // Ein einziger Auftritt darf sich wiederholen -- sonst kaeme gar keiner.
  assert.strictEqual(A.auftrittWaehlen(['schlitten'], 'schlitten'), 'schlitten');
  assert.strictEqual(A.auftrittWaehlen([], ''), '');
  assert.strictEqual(A.auftrittWaehlen(['gibtsnicht'], ''), '');
});

test('Was gewuerfelt wird, bleibt im Bild und in seinem Zeitrahmen', () => {
  let n = 11;
  const zufall = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  for (let i = 0; i < 200; i++) {
    for (const name of Object.keys(A.AUFTRITTE)) {
      const w = A.auftrittWuerfeln(name, i % 2 ? 'gross' : 'klein', zufall);
      assert.ok(w.dauer >= 1 && w.dauer <= 20, `${name}: Dauer ${w.dauer}`);
      for (const [k, v] of Object.entries(w.vars)) {
        const zahl = parseFloat(v);
        assert.ok(zahl >= 0 && zahl <= 95, `${name}: ${k} = ${v} liegt ausserhalb des Bildes`);
      }
      for (const k of w.klassen) assert.ok(['von-links', 'von-rechts'].includes(k));
    }
  }
  // Mal von links, mal von rechts.
  const seiten = new Set();
  for (let i = 0; i < 40; i++) seiten.add(A.auftrittWuerfeln('schlitten', 'gross', zufall).klassen[0]);
  assert.strictEqual(seiten.size, 2);
});

test('Jeder Auftritt steht in beiden Szenen bereit -- der Kranz taucht nur auf dem Dashboard auf', () => {
  const z = A.anlassZustand('auto', tag(2026, 12, 13));
  const namen = (szene) => [...A.schichtHtml(z, { flocken: 2, szene }).matchAll(/data-auftritt="([a-z]+)"/g)].map(m => m[1]).sort();
  assert.deepStrictEqual(namen('klein'), ['fallschirm', 'figur', 'kranz', 'rudolf', 'schlitten', 'schnuppe']);
  assert.deepStrictEqual(namen('gross'), ['fallschirm', 'figur', 'rudolf', 'schlitten', 'schnuppe']);
  for (const name of namen('klein')) assert.ok(A.AUFTRITTE[name], `${name} hat keinen Eintrag`);
  // Eine Endlosschleife im festen Takt gibt es fuer keinen Auftritt mehr.
  const css = ohneKommentare(lies('renderer/shared/anlass.css'));
  for (const m of css.matchAll(/\.anlass-(schlitten|figur|kranz|rudolf|schnuppe|fallschirm)[a-z.-]*\.laeuft \{ animation: [^}]*\}/g)) {
    assert.ok(!/infinite/.test(m[0]), `${m[1]} laeuft endlos statt einmal`);
    assert.match(m[0], / 1 both;/);
  }
});

// --- Die Geraeusche -------------------------------------------------------------------------------

// Ein Tonkontext, der nichts abspielt und alles aufschreibt.
function tonAttrappe() {
  const stimmen = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const knoten = () => ({ connect() {}, disconnect() {}, gain: param(), pan: param() });
  return {
    currentTime: 10, destination: {}, stimmen,
    createGain: knoten, createStereoPanner: knoten,
    createOscillator() {
      const o = { type: '', frequency: { value: 0 }, connect() {}, start(t) { o.von = t; }, stop(t) { o.bis = t; } };
      stimmen.push(o); return o;
    }
  };
}

test('Jeder Ton plant Stimmen, und keine klingt ueber sein Ende hinaus', () => {
  for (const name of ['schellen', 'glockenspiel', 'gloeckchen', 'sternklang']) {
    const ctx = tonAttrappe();
    const r = A.tonSpielen(ctx, name, { dauer: 5, zufall: () => 0.5 });
    assert.ok(r.stimmen > 0 && r.stimmen === ctx.stimmen.length, `${name}: keine Stimmen`);
    for (const s of ctx.stimmen) {
      assert.ok(s.von >= ctx.currentTime, `${name}: beginnt in der Vergangenheit`);
      assert.ok(s.bis <= ctx.currentTime + r.ende + 0.1, `${name}: klingt bis ${s.bis - ctx.currentTime}, gemeldet ${r.ende}`);
      assert.ok(s.frequency.value > 500 && s.frequency.value < 16000, `${name}: ${s.frequency.value} Hz`);
    }
  }
  // Ein unbekannter Name bleibt still statt zu werfen.
  assert.strictEqual(A.tonSpielen(tonAttrappe(), 'gibtsnicht').stimmen, 0);
  // Die Schellen dauern so lange wie der Flug -- aber nie endlos.
  assert.ok(A.tonSpielen(tonAttrappe(), 'schellen', { dauer: 99 }).ende <= 9.3);
});

test('Geklingelt wird nur auf dem Dashboard: nicht im Schoner, nicht in der Live-Ansicht, nicht wenn abgeschaltet', () => {
  const seite = lies('renderer/dashboard.html');
  const block = seite.slice(seite.indexOf('function anlassTonSpielen'), seite.indexOf('function applyTheme'));
  assert.match(block, /if \(!IM_PANEL \|\| !ton\) return false;/);
  assert.match(block, /config\.anlassTon === false/);
  assert.match(block, /schoner\.istSichtbar\(\)\) return false;/);
  // Nur die Schicht VORN bekommt den Ton -- die im Schoner hat gar keinen Rueckruf.
  assert.match(seite, /szene: 'klein',[^}]*beiAuftritt: anlassTonSpielen/);
  const schonerZeile = /anlassGaeste\.schoner = new AnlassModul\.Auftritte\(innen,\s*\{[^}]*\}/.exec(seite)[0];
  assert.ok(!/beiAuftritt/.test(schonerZeile), 'der Schoner bleibt still');
  // Und die Zeitgeber wechseln mit dem Schoner die Schicht.
  assert.ok((seite.match(/anlassGaesteAnpassen\(\);/g) || []).length >= 4, 'nach jedem Hinlegen und Aufstehen');
});

test('Die Ton-Einstellung reist durch Server und Einstellungsseite, samt Probeknopf', () => {
  const server = lies('server/setup-server.js');
  assert.match(server, /anlassTon: store\.get\('anlassTon'\) !== false/);
  assert.match(server, /store\.set\('anlassTon', !!anlassTon\)/);
  assert.match(server, /app\.post\('\/api\/anzeige\/anlass-ton'/);
  const js = lies('renderer/setup/theme.js'), html = lies('renderer/setup/theme.html');
  assert.match(js, /anlassTon: \$\('anlassTon'\)\.checked/);
  assert.match(js, /\$\('anlassTon'\)\.checked = configRes\.anlassTon !== false/);
  assert.ok(html.includes('src="/shared/anlass.js"'), 'der Knopf "Hier anhoeren" braucht das Modul');
  assert.match(lies('renderer/dashboard.html'), /befehl\.befehl === 'anlass-ton'/);
});

// --- Wenige Ebenen ------------------------------------------------------------------------------
//
// 1.0.42 bewegte nur noch HTML ueber transform und opacity -- der Hauptstrang lag bei 2,5 %.
// Trotzdem kostete der Compositor-Faden 45 % eines Kerns und der Grafikprozess 64 %: Rund
// zweihundert einzelne Ebenen wollen in jedem Bild fortgeschrieben und gezeichnet werden.
// Fluessig heisst deshalb auch: WENIGE Ebenen. Diese Zahl ist eine Obergrenze, kein Ziel.
test('Die ganze Schicht bewegt hoechstens fuenfzig Ebenen', () => {
  for (const szene of ['klein', 'gross']) {
    const html = A.schichtHtml(A.anlassZustand('auto', tag(2026, 12, 20)), { flocken: 60, szene });
    const bewegt = (html.match(/anlass-bewegt/g) || []).length;
    assert.ok(bewegt <= 50, `${szene}: ${bewegt} bewegte Ebenen`);
  }
});

test('Liegt der Schoner, ruht das Dashboard darunter -- und wacht vor ihm auf', () => {
  const css = lies('renderer/shared/dashboard.css');
  assert.match(css, /body\.schoner-deckt \.app \{ content-visibility: hidden; \}/);
  const seite = lies('renderer/dashboard.html');
  // Aufwecken: ERST das Dashboard, DANN der Schoner -- an beiden Stellen, an denen er aufsteht.
  const stellen = [...seite.matchAll(/dashboardRuhen\(false\);\s*schoner\.verbergen\(\);/g)];
  assert.strictEqual(stellen.length, (seite.match(/schoner\.verbergen\(\);/g) || []).length,
    'jedes schoner.verbergen() braucht davor dashboardRuhen(false)');
  assert.match(seite, /schoner\.zeigen\(\);\s*dashboardRuhen\(true\);/);
  // Und ein laufender Zeitgeber wird beim Aufwecken abgeraeumt, sonst schliefe es wieder ein.
  const fn = seite.slice(seite.indexOf('function dashboardRuhen'), seite.indexOf('function dashboardRuhen') + 500);
  assert.match(fn, /clearTimeout\(dashboardRuheTakt\)/);
});

// --- Ho, ho, ho -----------------------------------------------------------------------------------
//
// Die Rueckmeldung zu den ersten Geraeuschen: "Ich moechte nicht, dass die Vorwarnung kommt ...
// sondern wenn der Weihnachtsmann von unten kommt und winkt, dann kommt ho ho ho." Das
// Glockenspiel klang beim LOSFAHREN, anderthalb Sekunden bevor er zu sehen war -- ein Signalton,
// der etwas ankuendigt. Jetzt ruft er, und zwar erst, wenn er oben ist.

test('Der Weihnachtsmann ruft, statt zu klingeln -- und erst, wenn er oben ist', () => {
  assert.strictEqual(A.AUFTRITTE.figur.ton, 'hohoho');
  // Bei 13 % der Dauer ist er oben, bis 82 % bleibt er: Der Ruf faellt in diese Spanne.
  assert.ok(A.AUFTRITTE.figur.tonNach >= 0.15 && A.AUFTRITTE.figur.tonNach <= 0.4, 'der Ruf kommt, waehrend er winkt');
  // Kein Auftritt toent VOR seinem Erscheinen, und was still ist, hat keinen Ton.
  for (const [name, a] of Object.entries(A.AUFTRITTE)) {
    assert.ok(a.tonNach >= 0 && a.tonNach < 0.5, `${name}: tonNach ${a.tonNach}`);
  }
  assert.strictEqual(A.AUFTRITTE.schnuppe.ton, '', 'eine Sternschnuppe ist still');
  // Im Zeitgeber: Der Rueckruf laeuft ueber einen eigenen Zeitgeber, und stoppen() raeumt ihn ab.
  const quelle = lies('renderer/shared/anlass.js');
  assert.match(quelle, /this\.tonZeitgeber = setTimeout\(\(\) => \{[\s\S]{0,160}w\.dauer \* AUFTRITTE\[name\]\.tonNach \* 1000\)/);
  const stopp = quelle.slice(quelle.indexOf('Auftritte.prototype.stoppen'), quelle.indexOf('Auftritte.prototype.laeuft'));
  assert.match(stopp, /clearTimeout\(this\.tonZeitgeber\)/, 'ein ausstehender Ruf muss beim Hinlegen weg');
});

test('Die Stimme: eine deutsche Maennerstimme, sonst eine deutsche, sonst irgendeine', () => {
  const S = (name, lang) => ({ name, lang });
  // So sieht die Liste auf dem Panel in Eurasburg aus.
  const panel = [S('Microsoft Hedda Desktop - German', 'de-DE'), S('Microsoft Zira Desktop - English (United States)', 'en-US'),
    S('Microsoft Hedda - German (Germany)', 'de-DE'), S('Microsoft Katja - German (Germany)', 'de-DE'), S('Microsoft Stefan - German (Germany)', 'de-DE')];
  assert.strictEqual(A.stimmeWaehlen(panel).name, 'Microsoft Stefan - German (Germany)');
  assert.strictEqual(A.stimmeWaehlen([S('Zira', 'en-US'), S('Hedda', 'de-DE')]).name, 'Hedda', 'lieber deutsch als englisch');
  assert.strictEqual(A.stimmeWaehlen([S('Zira', 'en-US')]).name, 'Zira', 'lieber irgendeine als keine');
  assert.strictEqual(A.stimmeWaehlen([]), null);
  assert.strictEqual(A.stimmeWaehlen(null), null);
});

test('Ho, ho, ho: tief, gemaechlich, und ohne Stimme lieber gar nicht', () => {
  const gesprochen = [];
  function Aeusserung(text) { this.text = text; }
  const synth = { getVoices: () => [{ name: 'Microsoft Stefan - German (Germany)', lang: 'de-DE' }],
    speak: (a) => gesprochen.push(a), cancel() { this.abgebrochen = true; }, speaking: false, pending: false };
  assert.strictEqual(A.hohoho(synth, Aeusserung, { zufall: () => 0 }), true);
  assert.strictEqual(gesprochen.length, 1);
  assert.match(gesprochen[0].text, /^Ho, ho, ho!/);
  assert.ok(gesprochen[0].pitch < 0.6, 'tiefer als die normale Stimme');
  assert.ok(gesprochen[0].rate < 1, 'langsamer als normal');
  assert.strictEqual(gesprochen[0].voice.name, 'Microsoft Stefan - German (Germany)');
  // Jeder Ruf beginnt mit Ho, ho, ho -- und die meisten sind nur das.
  assert.ok(A.RUFE.every(r => r.startsWith('Ho, ho, ho!')));
  assert.ok(A.RUFE.filter(r => r === 'Ho, ho, ho!').length > A.RUFE.length / 2, 'eine Wand, die jedes Mal einen Satz sagt, wird abgeschaltet');
  // Laeuft noch einer, wird nicht gestapelt.
  synth.speaking = true; A.hohoho(synth, Aeusserung); assert.strictEqual(synth.abgebrochen, true);
  // Keine Stimme, keine Sprachausgabe: false -- dann nimmt der Aufrufer das Glockenspiel.
  assert.strictEqual(A.hohoho({ getVoices: () => [], speak() {} }, Aeusserung), false);
  assert.strictEqual(A.hohoho(null, Aeusserung), false);
  assert.strictEqual(A.hohoho(synth, undefined), false);
  const seite = lies('renderer/dashboard.html');
  assert.match(seite, /AnlassModul\.hohoho\(window\.speechSynthesis, window\.SpeechSynthesisUtterance/);
  assert.match(seite, /ton === 'hohoho' \? 'glockenspiel' : ton/, 'ohne Stimme bleibt das Glockenspiel');
  // Die Stimmen werden beim Aufbau vorgeladen -- der erste Aufruf von getVoices() ist leer.
  const aufbau = seite.slice(seite.indexOf('function anlassAnwenden'), seite.indexOf('function anlassGaesteAnpassen'));
  assert.match(aufbau, /window\.speechSynthesis\.getVoices\(\)/, 'ohne Vorladen klingelt der erste Auftritt');
});

// --- Die aufgenommenen Sprueche -------------------------------------------------------------------
//
// Dreizehn MP3 mit der Stimme des Weihnachtsmanns (ElevenLabs, vom Nutzer erzeugt). Welcher
// faellt, haengt am Auftritt und am Tag.

test('Jeder Spruch hat seine Datei, und keine Datei liegt herum, die niemand spielt', () => {
  const ordner = path.join(__dirname, '..', 'renderer', 'shared', 'toene');
  const dateien = fs.readdirSync(ordner).filter(d => d.endsWith('.mp3')).map(d => d.replace(/\.mp3$/, '')).sort();
  assert.deepStrictEqual(dateien, A.SPRUECHE.slice().sort());
  for (const name of A.SPRUECHE) {
    const groesse = fs.statSync(path.join(ordner, name + '.mp3')).size;
    assert.ok(groesse > 8000 && groesse < 200000, `${name}.mp3 ist ${groesse} Bytes gross`);
  }
  for (const name of A.SPRUECHE_MIT_GLOCKEN) assert.ok(A.SPRUECHE.includes(name));
});

test('Der Spruch passt zum Tag: Nikolaus, Advent, Heiligabend, Neujahr -- sonst Ho, ho, ho', () => {
  let n = 3;
  const zufall = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  const ziehen = (auftritt, d, mal) => { const s = new Set(); let z = ''; for (let i = 0; i < (mal || 300); i++) { z = A.spruchWaehlen(auftritt, d, z, zufall); s.add(z); } return s; };
  const hat = (menge, ...namen) => namen.every(x => menge.has(x));
  const nur = (menge, ...erlaubt) => [...menge].every(x => erlaubt.includes(x));

  // Ein gewoehnlicher Tag Ende November: nur Ho, ho, ho -- kein "Frohe Weihnachten".
  const alltag = ziehen('figur', tag(2026, 11, 30));
  assert.ok(nur(alltag, 'hohoho-1', 'hohoho-2', 'hohoho-brav'), [...alltag].join());
  assert.ok(hat(alltag, 'hohoho-1', 'hohoho-2'));
  // Nikolaustag (2026 zugleich der zweite Advent): beides kommt vor.
  const nikolaus = ziehen('figur', tag(2026, 12, 6));
  assert.ok(hat(nikolaus, 'nikolaus', 'advent-2'), [...nikolaus].join());
  assert.ok(!nikolaus.has('advent-1') && !nikolaus.has('advent-3'));
  // Die vier Adventssonntage 2026 -- und kein Adventsgruss an einem Werktag.
  for (const [t, m, nr] of [[29, 11, 1], [6, 12, 2], [13, 12, 3], [20, 12, 4]]) {
    assert.strictEqual(A.adventssonntag(tag(2026, m, t)), nr);
    assert.ok(ziehen('figur', tag(2026, m, t)).has('advent-' + nr), `advent-${nr} fehlt`);
  }
  assert.strictEqual(A.adventssonntag(tag(2026, 12, 7)), 0);
  assert.ok(![...ziehen('figur', tag(2026, 12, 9))].some(x => x.startsWith('advent')));
  // 2023 war der 24. ein Sonntag: vierter Advent UND Heiligabend.
  assert.strictEqual(A.adventssonntag(tag(2023, 12, 24)), 4);
  assert.ok(hat(ziehen('figur', tag(2023, 12, 24)), 'heiligabend', 'advent-4'));
  // Heiligabend, Weihnachtstage, Neujahr.
  assert.ok(ziehen('figur', tag(2026, 12, 24)).has('heiligabend'));
  assert.ok(!ziehen('figur', tag(2026, 12, 23)).has('heiligabend'));
  assert.ok(ziehen('figur', tag(2026, 12, 25)).has('hohoho-weihnachten'));
  assert.ok(ziehen('figur', tag(2027, 1, 2)).has('neujahr'));
  assert.ok(!ziehen('figur', tag(2026, 12, 10)).has('neujahr'));
  // Der Schlitten hat seine eigenen zwei; was still ist, bleibt still.
  assert.deepStrictEqual([...ziehen('schlitten', tag(2026, 12, 1))].sort(), ['schlitten-1', 'schlitten-2']);
  assert.strictEqual(A.spruchWaehlen('rudolf', tag(2026, 12, 1), ''), '');
  assert.strictEqual(A.spruchWaehlen('schnuppe', tag(2026, 12, 1), ''), '');
  // Nie derselbe zweimal hintereinander.
  let z = '';
  for (let i = 0; i < 200; i++) { const neu = A.spruchWaehlen('figur', tag(2026, 12, 1), z, zufall); assert.notStrictEqual(neu, z); z = neu; }
  // Alles, was gezogen werden kann, gibt es als Datei.
  for (const d of [tag(2026, 11, 30), tag(2026, 12, 6), tag(2026, 12, 24), tag(2026, 12, 31), tag(2027, 1, 3)]) {
    for (const a of ['figur', 'schlitten']) for (const s of ziehen(a, d, 120)) assert.ok(A.SPRUECHE.includes(s), `${s} hat keine Datei`);
  }
});

test('Die Aufnahme zuerst, dann die Sprachausgabe, dann das Glockenspiel -- und zu Glocken keine Schellen', () => {
  const seite = lies('renderer/dashboard.html');
  const block = seite.slice(seite.indexOf('function anlassTonSpielen'), seite.indexOf('function applyTheme'));
  assert.match(block, /AnlassModul\.spruchWaehlen\(name, new Date\(\), anlassSpruchZuletzt\)/);
  assert.ok(block.indexOf('anlassSpruchSpielen(spruch') < block.indexOf('AnlassModul.hohoho('), 'die Aufnahme kommt vor dem Notbehelf');
  assert.match(block, /SPRUECHE_MIT_GLOCKEN\.includes\(spruch\)\) anlassRechenton\('schellen'/);
  assert.match(seite, /new Audio\('shared\/toene\/' \+ name \+ '\.mp3'\)/);
  // Die Einstellungsseite spielt dieselben Dateien.
  assert.match(lies('renderer/setup/theme.js'), /new Audio\('\/shared\/toene\/' \+ name \+ '\.mp3'\)/);
});
