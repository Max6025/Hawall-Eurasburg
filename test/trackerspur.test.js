'use strict';

// Die Spur des Trackers -- siehe trackerSpur() in dashboard-render.js.
//
// Anlass, mit Foto vom Panel: Die Sieben-Tage-Spur war ein Stern aus Linien, die alle in der
// Ladestation zusammenlaufen. Die Zahlen hier sind aus den echten Daten vom 5. November:
// 47.85838/11.403795 ist die Station (drei Meter neben zone.eu), der Rest GPS im Freien.

const test = require('node:test');
const assert = require('node:assert');
const { trackerSpur } = require('../renderer/shared/dashboard-render.js');

const STATION = { lat: 47.85838, lon: 11.403795 };
const ZONE = [{ lat: 47.85834953, lon: 11.40379491 }];
const P = (lat, lon, t) => ({ lat, lon, t: '2026-11-05T' + t + 'Z' });
const TAG = [
  P(47.85819, 11.404398, '02:29:37'),
  P(STATION.lat, STATION.lon, '02:31:37'),
  P(47.857662, 11.40287, '02:42:41'),
  P(47.858135, 11.403439, '02:49:53'),
  P(STATION.lat, STATION.lon, '02:49:54'),   // fuenf Sekunden Station, dann weiter draussen
  P(47.85853, 11.403194, '04:22:16'),
  P(STATION.lat, STATION.lon, '04:24:08'),
  P(47.858276, 11.404368, '05:00:15'),
  P(47.858444, 11.403187, '05:04:50'),
  P(47.858322, 11.403104, '05:14:48')
];

test('Die Station ist kein Wegpunkt: kein Segment fuehrt dorthin', () => {
  const s = trackerSpur(TAG, ZONE);
  assert.strictEqual(s.anker.length, 1);
  assert.deepStrictEqual({ lat: s.anker[0].lat, lon: s.anker[0].lon }, STATION);
  for (const seg of s.segmente) for (const [lat, lon] of seg) {
    assert.ok(!(lat === STATION.lat && lon === STATION.lon), 'Station in der Spur');
  }
  assert.ok(s.punkte.every(p => p.lat !== STATION.lat), 'Station unter den Punkten');
});

test('Die Spur reisst bei einer Pause ab, statt eine Gerade darueber zu ziehen', () => {
  // 02:49:53 -> 04:22:16 sind anderthalb Stunden an der Station: zwei Ausfluege.
  // 04:22:16 -> 05:00:15 sind 38 Minuten: noch derselbe.
  const s = trackerSpur(TAG, ZONE);
  assert.strictEqual(s.segmente.length, 2);
  assert.strictEqual(s.segmente[0].length, 3);
  assert.strictEqual(s.segmente[1].length, 4);
});

test('Ein Anker wird auch ohne Zone erkannt: an exakter Wiederholung', () => {
  const s = trackerSpur(TAG, []);
  assert.strictEqual(s.anker.length, 1, 'die Station wiederholt sich dreimal');
  assert.strictEqual(s.punkte.length, 7);
});

test('Eine GPS-Position, die sich zweimal wiederholt, bleibt ein Wegpunkt', () => {
  const zwei = [P(47.8571, 11.4021, '10:00:00'), P(47.8572, 11.4022, '10:10:00'), P(47.8571, 11.4021, '10:20:00')];
  const s = trackerSpur(zwei, []);
  assert.strictEqual(s.anker.length, 0);
  assert.strictEqual(s.segmente.length, 1);
  assert.strictEqual(s.segmente[0].length, 3);
});

test('Aufeinanderfolgende Wiederholungen sind EINE Position', () => {
  const s = trackerSpur([P(47.8571, 11.4021, '10:00:00'), P(47.8571, 11.4021, '10:00:01'), P(47.8572, 11.4022, '10:10:00')], []);
  assert.strictEqual(s.punkte.length, 2);
});

test('Nur Station: keine Spur, kein Fehler', () => {
  const s = trackerSpur([P(STATION.lat, STATION.lon, '10:00:00'), P(STATION.lat, STATION.lon, '11:00:00')], ZONE);
  assert.deepStrictEqual(s.segmente, []);
  assert.strictEqual(s.punkte.length, 0);
  assert.deepStrictEqual(trackerSpur(null, null).segmente, []);
});
