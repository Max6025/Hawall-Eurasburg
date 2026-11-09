'use strict';

// Der Akku des Trackers -- siehe trackerAkku() in dashboard-render.js.
//
// Anlass: Nestis GPS-Halsband. Die Standort-Entitaet device_tracker.nesti_tracker hat KEIN
// battery_level, der Akku steht in sensor.nesti_tracker_batterie daneben. Auf dem Panel war
// die Anzeige deshalb leer, und die Meldung lautete "die Batterie soll dort, wo man sie sehen
// kann".

const test = require('node:test');
const assert = require('node:assert');
const { trackerAkku, trackerAkkuHtml } = require('../renderer/shared/dashboard-render.js');

const Z = (state, attributes) => ({ state, attributes: attributes || {} });
const NESTI = {
  'device_tracker.nesti_tracker': Z('not_home', { source_type: 'gps', latitude: 47.8, longitude: 11.4 }),
  'sensor.nesti_tracker_batterie': Z('100', { device_class: 'battery', unit_of_measurement: '%' }),
  'binary_sensor.nesti_tracker_batterie_wird_geladen': Z('off', { device_class: 'battery_charging' }),
  'sensor.nesti_gewicht': Z('4.0', { device_class: 'weight' }),
  'sensor.iphone_batterie': Z('60', { device_class: 'battery' })
};

test('Ein Halsband-Tracker: der Akku kommt aus der Nachbar-Entitaet mit demselben Stamm', () => {
  const a = trackerAkku('device_tracker.nesti_tracker', NESTI);
  assert.deepStrictEqual(a, { prozent: 100, laedt: false, quelle: 'sensor.nesti_tracker_batterie' });
});

test('Ein Handy: das Attribut der Entitaet selbst', () => {
  const st = { 'device_tracker.handy': Z('home', { battery_level: 60, battery_charging: true }) };
  assert.deepStrictEqual(trackerAkku('device_tracker.handy', st), { prozent: 60, laedt: true, quelle: 'device_tracker.handy' });
});

test('Eine eingestellte Akku-Entitaet gewinnt gegen alles Geratene', () => {
  const a = trackerAkku('device_tracker.nesti_tracker', NESTI, 'sensor.iphone_batterie');
  assert.strictEqual(a.prozent, 60);
  assert.strictEqual(a.quelle, 'sensor.iphone_batterie');
});

test('Der falsche Nachbar zaehlt nicht: gleicher Stamm, aber keine Batterie -- oder anderer Stamm', () => {
  // "nesti_gewicht" hat den Stamm "nesti", nicht "nesti_tracker"; "iphone_batterie" ist eine
  // Batterie, aber von einem anderen Geraet.
  const st = { 'device_tracker.nesti_tracker': Z('home'), 'sensor.nesti_gewicht': NESTI['sensor.nesti_gewicht'], 'sensor.iphone_batterie': NESTI['sensor.iphone_batterie'] };
  assert.strictEqual(trackerAkku('device_tracker.nesti_tracker', st), null);
});

test('Laden kommt vom Nachbarn mit device_class battery_charging', () => {
  const st = Object.assign({}, NESTI, { 'binary_sensor.nesti_tracker_batterie_wird_geladen': Z('on', { device_class: 'battery_charging' }) });
  assert.strictEqual(trackerAkku('device_tracker.nesti_tracker', st).laedt, true);
});

test('Unbrauchbare Werte ergeben keinen Akku, und Zahlen bleiben zwischen 0 und 100', () => {
  assert.strictEqual(trackerAkku('device_tracker.x', { 'device_tracker.x': Z('home', { battery_level: 'unknown' }) }), null);
  assert.strictEqual(trackerAkku('device_tracker.x', {}), null);
  assert.strictEqual(trackerAkku(null, null), null);
  assert.strictEqual(trackerAkku('device_tracker.x', { 'device_tracker.x': Z('home', { battery_level: '137' }) }).prozent, 100);
});

test('Die Pille zeigt die Zahl und eine Fuellung, die dem Stand entspricht', () => {
  const voll = trackerAkkuHtml({ prozent: 100, laedt: false, quelle: 'x' });
  const halb = trackerAkkuHtml({ prozent: 50, laedt: true, quelle: 'x' });
  assert.match(voll, /100 %/);
  assert.match(voll, /width="13.0"/, 'volle Fuellung');
  assert.match(halb, /width="6.5"/, 'halbe Fuellung');
  assert.ok(halb.includes('<path d="M12.5'), 'beim Laden ein Blitz');
  assert.ok(!voll.includes('<path d="M12.5'), 'ohne Laden kein Blitz');
  assert.strictEqual(trackerAkkuHtml(null), '');
});
