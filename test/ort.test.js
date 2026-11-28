const test = require('node:test');
const assert = require('node:assert');
const R = require('../renderer/shared/dashboard-render.js');

// Innen oder aussen -- siehe ORTE in dashboard-render.js. Anlass: Zwei Temperaturkarten und
// zwei Luftdruckkarten nebeneinander waren aus der Entfernung nicht zu unterscheiden.

test('Ohne Einstellung wird aus Name und Kennung geraten', () => {
  assert.strictEqual(R.ortErmitteln({}, 'Außentemperatur', 'sensor.temp_1'), 'aussen');
  assert.strictEqual(R.ortErmitteln({}, 'Temperatur', 'sensor.aussen_temperatur'), 'aussen');
  assert.strictEqual(R.ortErmitteln({}, 'Outdoor Temperature', 'sensor.x'), 'aussen');
  assert.strictEqual(R.ortErmitteln({}, 'Schlafzimmer', 'sensor.temp_sz'), 'innen');
  assert.strictEqual(R.ortErmitteln({}, 'Luftdruck innen', 'sensor.p'), 'innen');
});

test('Ohne Hinweis gibt es keinen Ort -- lieber keine Markierung als eine falsche', () => {
  assert.strictEqual(R.ortErmitteln({}, 'Temperatur', 'sensor.temp_1'), '');
  assert.strictEqual(R.ortErmitteln(null, null, null), '');
});

test('Aussen wird vor innen geprueft', () => {
  // "Aussenwand Wohnzimmer" misst draussen, obwohl ein Zimmer im Namen steht.
  assert.strictEqual(R.ortErmitteln({}, 'Aussenwand Wohnzimmer', 'sensor.x'), 'aussen');
});

test('Eine ausdrueckliche Einstellung gewinnt immer', () => {
  assert.strictEqual(R.ortErmitteln({ ort: 'innen' }, 'Außentemperatur', 'sensor.aussen'), 'innen');
  assert.strictEqual(R.ortErmitteln({ ort: 'aussen' }, 'Wohnzimmer', 'sensor.wz'), 'aussen');
});

test('"Keine Angabe" schaltet auch das Raten ab', () => {
  // Wer die Markierung abschaltet, soll sie nicht zurueckbekommen, weil zufaellig ein
  // Ratewort im Namen steht.
  assert.strictEqual(R.ortErmitteln({ ort: 'kein' }, 'Badewasser', 'sensor.bad'), '');
});

test('Unbekannte Einstellungswerte fallen aufs Raten zurueck, nicht auf einen festen Ort', () => {
  assert.strictEqual(R.ortErmitteln({ ort: 'garage' }, 'Außen', 'sensor.x'), 'aussen');
  assert.strictEqual(R.ortErmitteln({ ort: 'garage' }, 'Temperatur', 'sensor.x'), '');
});

test('Nur Messgroessen, die es innen UND aussen gibt, tragen einen Ort', () => {
  ['temperature', 'pressure', 'humidity', 'sensor'].forEach(t => assert.ok(R.ORT_TYPEN.includes(t), t));
  // Wind, Regen und Sonne gibt es nur draussen -- "AUSSEN" darauf waere Rauschen.
  ['wind', 'rain', 'solar', 'gauge', 'clock'].forEach(t => assert.ok(!R.ORT_TYPEN.includes(t), t));
});

// Der dritte Ort. Anlass: Wohnbereich und Treppenhaus sind beide "innen" -- zwei Haeuser
// nebeneinander sagten nicht, welche Zahl die vom Treppenhaus ist.
test('Treppenhaus ist ein eigener Ort mit eigenem Zeichen', () => {
  assert.strictEqual(R.ortErmitteln({ ort: 'treppenhaus' }, 'Temperatur', 'sensor.temp_3'), 'treppenhaus');
  assert.strictEqual(R.ortErmitteln({}, 'Temperatur Treppenhaus', 'sensor.temp_3'), 'treppenhaus');
  assert.strictEqual(R.ortErmitteln({}, 'Temperatur', 'sensor.treppe_oben'), 'treppenhaus');
  assert.strictEqual(R.ortErmitteln({}, 'Staircase', 'sensor.x'), 'treppenhaus');
  // "Treppenhaus Flur" ist im Treppenhaus, nicht irgendwo innen -- das Treppenhaus gewinnt.
  assert.strictEqual(R.ortErmitteln({}, 'Treppenhaus Flur', 'sensor.x'), 'treppenhaus');
  // Jeder Ort hat alle drei Zeichen, und keines ist von einem anderen Ort geliehen.
  const orte = Object.keys(R.ORTE);
  assert.deepStrictEqual(orte.sort(), ['aussen', 'innen', 'treppenhaus', 'wohnzimmer']);
  for (const k of ['text', 'symbol', 'silhouette']) {
    const werte = orte.map(o => R.ORTE[o][k]);
    werte.forEach(w => assert.ok(w && w.length > 0, `${k} fehlt`));
    assert.strictEqual(new Set(werte).size, werte.length, `${k} doppelt`);
  }
});

// Der vierte Ort. "Wohnzimmer" war bis 1.0.29 ein Ratewort fuer innen -- jetzt ist es ein
// eigener Raum mit Sofa.
test('Wohnzimmer ist ein eigener Ort und gewinnt gegen innen', () => {
  assert.strictEqual(R.ortErmitteln({ ort: 'wohnzimmer' }, 'Temperatur', 'sensor.temp_4'), 'wohnzimmer');
  assert.strictEqual(R.ortErmitteln({}, 'Wohnzimmer', 'sensor.temp_wz'), 'wohnzimmer');
  assert.strictEqual(R.ortErmitteln({}, 'Temperatur', 'sensor.living_room_temp'), 'wohnzimmer');
  assert.strictEqual(R.ortErmitteln({}, 'Temperatur innen Wohnzimmer', 'sensor.x'), 'wohnzimmer');
  // Aussen gewinnt weiterhin gegen alles.
  assert.strictEqual(R.ortErmitteln({}, 'Aussenwand Wohnzimmer', 'sensor.x'), 'aussen');
});

// Jeder Ort bewegt sich, und zwar anders -- gewuenscht war ausdruecklich nicht "alles dreht
// sich". Pruefbar ist daran: Jeder Ort hat mindestens eine Bewegung, keine zwei Orte teilen
// sich eine, die bewegten Teile stehen in Symbol UND Silhouette, und die Dauer in ORTE ist
// dieselbe wie in dashboard.css -- das ist die bekannte Schwachstelle der Uhrphase (siehe
// HVAC_ANIMATIONEN): Stimmen die Zahlen nicht ueberein, springt die Bewegung beim Neuaufbau.
test('Jeder Ort hat seine eigene Bewegung, in Symbol und Silhouette, mit der Dauer aus dem CSS', () => {
  const css = require('fs').readFileSync(require('path').join(__dirname, '../renderer/shared/dashboard.css'), 'utf8');
  const gesehen = new Set();
  for (const [ort, eintrag] of Object.entries(R.ORTE)) {
    assert.ok(Array.isArray(eintrag.animationen) && eintrag.animationen.length > 0, `${ort} bewegt sich nicht`);
    for (const [name, dauer, wechselnd] of eintrag.animationen) {
      assert.ok(!gesehen.has(name), `${name} doppelt`); gesehen.add(name);
      assert.ok(eintrag.symbol.includes('class="ort-' + name) || eintrag.symbol.includes(`ort-${name}`), `${ort}: ort-${name} fehlt im Symbol`);
      assert.ok(eintrag.silhouette.includes(`ort-${name}`), `${ort}: ort-${name} fehlt in der Silhouette`);
      const regel = new RegExp(`animation:\\s*ort-${name}\\s+([0-9.]+)s[^;]*?(alternate)?;`);
      const m = regel.exec(css);
      assert.ok(m, `${ort}: keine CSS-Animation ort-${name}`);
      assert.strictEqual(Number(m[1]), dauer, `${ort}: Dauer von ort-${name} weicht vom CSS ab`);
      assert.strictEqual(!!m[2], !!wechselnd, `${ort}: 'alternate' von ort-${name} weicht vom CSS ab`);
      assert.ok(css.includes(`var(--ph-${name}`), `${ort}: das CSS liest --ph-${name} nicht`);
    }
  }
  // Der Startversatz: je Bewegung eine Variable, aus der Uhrzeit, negativ.
  const stil = R.ortPhasenStil('innen', 1000);
  assert.match(stil, /^--ph-rauch:-[0-9.]+s$/);
  assert.strictEqual(R.ortPhasenStil('innen', 5000), R.ortPhasenStil('innen', 5000 + 4200));
  assert.strictEqual(R.ortPhasenStil('nirgends', 0), '');
});

// --- Fluessig: die Bewegung der Ortszeichen rechnet die Grafikeinheit ----------------------------
//
// Bis 1.0.41 sassen Rauch, Strahlen und Laeufer als Formen IM SVG. Eine Bewegung dort zeichnet
// der Browser auf dem Hauptstrang, Bild fuer Bild, die ganze Zeichnung neu -- bei der Silhouette
// eine Flaeche von Kartengroesse. Gemessen auf dem Surface Go: 198 % eines Kerns.

test('Was sich an einem Ortszeichen bewegt, ist HTML ueber der Zeichnung, nie eine Form darin', () => {
  for (const [ort, eintrag] of Object.entries(R.ORTE)) {
    for (const [welches, html] of [['Symbol', eintrag.symbol], ['Silhouette', eintrag.silhouette]]) {
      assert.ok(html.includes('class="ort-bild'), `${ort}/${welches}: kein Kasten`);
      for (const block of html.match(/<svg[\s\S]*?<\/svg>/g) || []) {
        assert.ok(!/class="ort-/.test(block), `${ort}/${welches}: bewegtes Teil im SVG`);
      }
      for (const [name] of eintrag.animationen) {
        assert.match(html, new RegExp(`<i class="ort-teil ort-${name}`), `${ort}/${welches}: ort-${name} ist kein eigenes Teil`);
      }
    }
  }
});

test('Die Bewegungen der Ortszeichen aendern nur transform und opacity', () => {
  const css = require('fs').readFileSync(require('path').join(__dirname, '../renderer/shared/dashboard.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const bloecke = [...css.matchAll(/@keyframes (ort-[a-z-]+) \{((?:[^{}]*\{[^{}]*\})+)\s*\}/g)];
  assert.ok(bloecke.length >= 5, `zu wenige gefunden (${bloecke.length})`);
  for (const [, name, inhalt] of bloecke) {
    for (const m of inhalt.matchAll(/([a-z-]+)\s*:/g)) {
      assert.ok(['transform', 'opacity'].includes(m[1]), `${name} aendert ${m[1]}`);
    }
  }
});

// Gewuenscht: "dass das Haus im Hintergrund bei innen Schnee am Dach hat" und "dass da, wo jetzt
// die Sonne im Hintergrund ist und sich dreht, was anderes ist".
test('Innen und Aussen haben eine Festfassung, die das Weihnachtsblatt einschaltet', () => {
  const fs = require('fs'), path = require('path');
  for (const ort of ['innen', 'aussen']) {
    for (const html of [R.ORTE[ort].symbol, R.ORTE[ort].silhouette]) {
      assert.match(html, /class="ort-bild ort-alltag hat-fest"/, `${ort}: Alltag nicht als ersetzbar markiert`);
      assert.match(html, /class="ort-bild ort-fest"/, `${ort}: keine Festfassung`);
    }
  }
  // Der Schneemann im Schneefall, nicht die drehende Sonne.
  const fest = R.ORTE.aussen.silhouette.split('class="ort-bild ort-fest"')[1];
  assert.ok(fest.includes('ort-flocken') && !fest.includes('ort-strahlen'));
  // Treppe und Sofa haben keine -- sie bleiben stehen, statt zu verschwinden.
  for (const ort of ['treppenhaus', 'wohnzimmer']) assert.ok(!R.ORTE[ort].silhouette.includes('hat-fest'));
  // Ab Werk aus (auch im Editor, der das Weihnachtsblatt nicht laedt), eingeschaltet nur dort.
  const alltag = fs.readFileSync(path.join(__dirname, '../renderer/shared/dashboard.css'), 'utf8');
  const festblatt = fs.readFileSync(path.join(__dirname, '../renderer/shared/anlass.css'), 'utf8');
  assert.match(alltag, /\.ort-bild\.ort-fest \{ display: none; \}/);
  assert.match(festblatt, /body\.anlass-weihnachten \.ort-bild\.ort-fest \{ display: block; \}/);
  assert.match(festblatt, /body\.anlass-weihnachten \.ort-bild\.ort-alltag\.hat-fest \{ display: none; \}/);
});
