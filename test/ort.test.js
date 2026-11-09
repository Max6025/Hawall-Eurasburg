const test = require('node:test');
const assert = require('node:assert');
const R = require('../renderer/shared/dashboard-render.js');

// Innen oder aussen -- siehe ORTE in dashboard-render.js. Anlass: Zwei Temperaturkarten und
// zwei Luftdruckkarten nebeneinander waren aus der Entfernung nicht zu unterscheiden.

test('Ohne Einstellung wird aus Name und Kennung geraten', () => {
  assert.strictEqual(R.ortErmitteln({}, 'Außentemperatur', 'sensor.temp_1'), 'aussen');
  assert.strictEqual(R.ortErmitteln({}, 'Temperatur', 'sensor.aussen_temperatur'), 'aussen');
  assert.strictEqual(R.ortErmitteln({}, 'Outdoor Temperature', 'sensor.x'), 'aussen');
  assert.strictEqual(R.ortErmitteln({}, 'Wohnzimmer', 'sensor.temp_wz'), 'innen');
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
  assert.deepStrictEqual(orte.sort(), ['aussen', 'innen', 'treppenhaus']);
  for (const k of ['text', 'symbol', 'silhouette']) {
    const werte = orte.map(o => R.ORTE[o][k]);
    werte.forEach(w => assert.ok(w && w.length > 0, `${k} fehlt`));
    assert.strictEqual(new Set(werte).size, werte.length, `${k} doppelt`);
  }
});
