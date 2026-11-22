// Das Symbol, das Home Assistant für eine Entität meint.
//
// Anlass: Der Wasserzähler zeigt in Home Assistant einen Tropfen, auf der Karte stand das
// allgemeine Sensorzeichen. Nichts war kaputt — `attributes.icon` gab es schlicht nicht.
// Home Assistant leitet das Zeichen bei sich im Browser aus der GERÄTEKLASSE ab, und das
// kommt über die Zustands-Schnittstelle nie mit. Wir haben nur dort nachgesehen, wo nichts war.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../renderer/shared/dashboard-render.js');

const WURZEL = path.join(__dirname, '..');

test('Ein ausdrücklich gesetztes Symbol gewinnt gegen die Geräteklasse', () => {
  // Wer in Home Assistant ein Symbol vergibt, hat sich etwas dabei gedacht.
  assert.strictEqual(R.haSymbolName({ icon: 'mdi:water-plus', device_class: 'water' }), 'mdi:water-plus');
  assert.strictEqual(R.haSymbolName({ device_class: 'water' }), 'water');
});

test('Ohne beides bleibt es leer -- und die Karte nimmt ihr eigenes Zeichen', () => {
  assert.strictEqual(R.haSymbolName({}), '');
  assert.strictEqual(R.haSymbolName(null), '');
  assert.strictEqual(R.haSymbolName({ device_class: 'gibtsnicht' }), '');
});

test('JEDER Name in der Tabelle existiert wirklich', () => {
  // DER Test dieser Datei. Ein Tippfehler in einem MDI-Namen gibt keinen Fehler: `mdiSymbol()`
  // findet den Pfad nicht, liefert eine leere Zeichenkette, und die Karte fällt auf ihr
  // allgemeines Zeichen zurück — also genau auf den Zustand, den diese Tabelle beheben soll.
  // Aufgefallen wäre das erst auf der Wand, und auch dort nur dem, der diese Geräteklasse hat.
  global.window = global.window || {};
  require(path.join(WURZEL, 'renderer', 'shared', 'mdi-pfade.js'));
  const pfade = global.window.MDI_PFADE;
  assert.ok(pfade && Object.keys(pfade).length > 1000, 'die Symbolpfade fehlen');

  const fehlen = Object.entries(R.GERAETEKLASSE_SYMBOL)
    .filter(([, name]) => !pfade[name])
    .map(([klasse, name]) => `${klasse} -> ${name}`);
  assert.deepStrictEqual(fehlen, [], 'Namen ohne Pfad: ' + fehlen.join(', '));
});

test('Die Geräteklasse allein löst das Nachladen der Pfade aus', () => {
  // Ohne das bleibt die Datei ungeladen, `mdiSymbol()` findet nichts, und die Tabelle oben
  // wäre wirkungslos — eine Verbesserung, die es nur im Quelltext gibt.
  assert.strictEqual(R.brauchtMdi('sensor', { attributes: { device_class: 'water' } }, {}), true);
  assert.strictEqual(R.brauchtMdi('sensor', { attributes: { icon: 'mdi:water' } }, {}), true);
  assert.strictEqual(R.brauchtMdi('sensor', { attributes: {} }, {}), false);
  // Eine eigene Wahl schlägt alles -- dann braucht es Home Assistant gar nicht.
  assert.strictEqual(R.brauchtMdi('sensor', { attributes: { device_class: 'water' } }, { icon: 'drop' }), false);
  // Und nur die Sensorkarte greift überhaupt darauf zurück: Jede andere hat ihr eigenes
  // Zeichen, und bei der Klima-Karte sagt dessen Bewegung etwas, das ein fremdes nicht kann.
  assert.strictEqual(R.brauchtMdi('temperature', { attributes: { device_class: 'temperature' } }, {}), false);
});

test('Der Editor lädt die Symbolpfade -- sonst zeigt er etwas anderes als die Wand', () => {
  // Er hat es NIE getan. Eine Sensorkarte zeigte dort immer das allgemeine Zeichen, auf der
  // Wand das aus Home Assistant. Eine Vorschau, die etwas anderes zeigt als das Ergebnis, ist
  // schlimmer als keine -- genau dafür gibt es sie.
  const editor = fs.readFileSync(path.join(WURZEL, 'renderer', 'setup', 'editor.js'), 'utf8');
  assert.match(editor, /function mdiPfadeLaden\(\)/, 'der Editor kann die Pfade nicht laden');
  assert.match(editor, /DashboardRender\.brauchtMdi\(/, 'er fragt nicht, ob er sie braucht');
  // Vor dem ersten buildCard, nicht danach: Nachgeladen nützt dem schon gezeichneten Bild nichts.
  const i = editor.indexOf('async function render()');
  const vorKarten = editor.slice(i, editor.indexOf('buildCard(', i));
  assert.ok(vorKarten.includes('await mdiPfadeLaden()'),
    'die Pfade müssen VOR der ersten Karte da sein');
});

test('Die Wasseruhr steht in der Editor-Probe', () => {
  // Der Fall, an dem beides aufgefallen ist. Was in der Probe fehlt, wird nicht angesehen --
  // dieselbe Lehre wie bei der Energiekarte in vorschau.html.
  const probe = fs.readFileSync(path.join(WURZEL, '.scratch', 'karten-design', 'editor-probe.js'), 'utf8');
  assert.match(probe, /device_class: 'water'/, 'keine Entität mit Geräteklasse, aber ohne icon');
  assert.ok(!/wasserzaehler_litres_current[^\n]*icon:/.test(probe),
    'die Probe darf dort KEIN icon setzen -- sonst prüft sie den alten Weg');
});
