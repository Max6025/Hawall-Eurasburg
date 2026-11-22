// Das Kartensymbol groß und blass im Hintergrund.
//
// Dieselbe Kette wie bei der Uhr-Schrift, und aus demselben Grund: Editor schreibt die
// Einstellung -> buildCard liest sie -> das CSS hat eine Regel. Reißt die Kette an einer
// Stelle, gibt es keinen Fehler, sondern eine Einstellung, die man setzt und die nichts tut.
// Genau so war `gauge.baseColor` in der Vorlage über Monate tot.
//
// `buildCard()` selbst braucht ein `document` und läuft hier nicht. Geprüft wird deshalb der
// Quelltext -- das ist weniger als ein echter Aufbau, aber mehr als nichts, und es fängt die
// Fehler, die hier wirklich passieren: eine Liste, die auseinanderläuft, und eine Klasse ohne
// Regel.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../renderer/shared/dashboard-render.js');

const WURZEL = path.join(__dirname, '..');
const lies = (...p) => fs.readFileSync(path.join(WURZEL, ...p), 'utf8');
const RENDER = lies('renderer', 'shared', 'dashboard-render.js');
const EDITOR = lies('renderer', 'setup', 'editor.js');
const CSS = lies('renderer', 'shared', 'dashboard.css');

test('Editor und Karte fragen DIESELBE Liste', () => {
  // Zwei Listen wären eine Einstellung, die bei einer Kartenart angeboten wird und bei der
  // anderen wirkt -- ohne dass irgendwo etwas nach einem Fehler aussieht.
  assert.ok(Array.isArray(R.SYMBOL_HG_TYPEN) && R.SYMBOL_HG_TYPEN.length > 0);
  assert.match(EDITOR, /symbolHintergrund: DashboardRender\.SYMBOL_HG_TYPEN\.includes\(type\)/,
    'der Editor baut sich seine eigene Liste');
  assert.match(RENDER, /SYMBOL_HG_TYPEN\.includes\(type\)/,
    'die Karte prüft die Liste nicht');
});

test('Angeboten wird es nur dort, wo unter dem Wert Fläche frei ist', () => {
  // Auf einer Lampen- oder Tor-Karte liegen dort Bedienelemente, und die Zeichnung läge
  // darunter durch.
  for (const t of ['temperature', 'humidity', 'pressure', 'sensor', 'wind', 'rain']) {
    assert.ok(R.SYMBOL_HG_TYPEN.includes(t), t + ' fehlt');
  }
  for (const t of ['light', 'switch', 'cover', 'gate', 'clock', 'photo', 'energy', 'navigate']) {
    assert.ok(!R.SYMBOL_HG_TYPEN.includes(t), t + ' darf es nicht geben');
  }
});

test('Die Kette Editor -> Karte -> CSS ist geschlossen', () => {
  // Der Editor schreibt die Einstellung...
  assert.match(EDITOR, /settings\.symbolHintergrund = true/, 'der Editor speichert nichts');
  assert.match(EDITOR, /\$\('setSymbolHg'\)/, 'das Feld fehlt');
  // ...die Karte liest sie und setzt die Klasse...
  assert.match(RENDER, /settings\.symbolHintergrund/, 'die Karte liest die Einstellung nicht');
  assert.match(RENDER, /className = 'symbol-silhouette'/, 'die Karte setzt die Klasse nicht');
  // ...und das CSS kennt sie.
  assert.ok(CSS.includes('.symbol-silhouette'), 'keine CSS-Regel für .symbol-silhouette');
});

test('Nur das EINSCHALTEN wird gespeichert', () => {
  // Ein `false` in jeder Karte wäre Ballast in der Konfiguration und sähe aus wie eine
  // Entscheidung, die jemand getroffen hat -- dieselbe Regel wie beim Ort, wo „automatisch"
  // ausdrücklich nicht gespeichert wird.
  const i = EDITOR.indexOf("if (settingsFields.symbolHintergrund)");
  assert.ok(i > 0);
  const block = EDITOR.slice(i, i + 400);
  assert.ok(block.includes('delete settings.symbolHintergrund'),
    'ausgeschaltet muss die Einstellung verschwinden, nicht auf false stehen');
});

test('Der ORT gewinnt gegen das Symbol', () => {
  // Er sagt WO gemessen wird, das Symbol nur WAS. Beides übereinander wären zwei blasse
  // Zeichnungen an derselben Stelle -- aus fünf Metern ein Fleck.
  assert.match(RENDER, /if \(!ort && settings\.symbolHintergrund/,
    'die Silhouette des Symbols muss beim gesetzten Ort ausfallen');
});

test('Gezeichnet wird DASSELBE Symbol wie oben links', () => {
  // Nicht ein ähnliches: Die Reihenfolge „eigene Wahl > HA-Symbol > Typ > Domäne" steckt in
  // jedem Kartenzweig einzeln. Sie am Ende noch einmal nachzubauen hieße, sie ein zweites Mal
  // zu schreiben -- und beim nächsten neuen Kartentyp liefe sie auseinander.
  assert.match(RENDER, /let benutztesSymbol = '';/);
  assert.match(RENDER, /benutztesSymbol = s;/, 'das verwendete Symbol wird nicht gemerkt');
  assert.match(RENDER, /umriss\.innerHTML = benutztesSymbol;/,
    'die Silhouette baut sich ihr Symbol selbst zusammen');
});

test('Ort- und Symbol-Silhouette teilen sich EINE Regel', () => {
  // Zwei Kopien liefen beim nächsten Verschieben auseinander, und der Unterschied fiele erst
  // auf der Wand auf.
  assert.match(CSS, /\.card \.ort-silhouette, \.card \.symbol-silhouette \{/,
    'Lage und Deckkraft stehen doppelt im CSS');
  assert.match(CSS, /body\.light-theme \.card \.ort-silhouette, body\.light-theme \.card \.symbol-silhouette/,
    'das helle Design ist nur für eine der beiden geregelt');
});

test('Das eingebaute Strichsymbol wird als Silhouette dünner', () => {
  // Ein Strich von zwei Einheiten im 24er-Raster wird auf Kartenhöhe gezogen zum Balken. Die
  // Symbole aus Home Assistant sind Flächen und bleiben davon unberührt.
  assert.match(CSS, /\.card \.symbol-silhouette svg \{ stroke-width:/);
});
