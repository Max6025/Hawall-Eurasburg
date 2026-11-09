'use strict';

// Der Verlauf direkt von Tractive -- siehe server/tractive.js.
//
// Tractive hat keine veroeffentlichte Schnittstelle; was hier steht, ist aus den
// inoffiziellen Clients abgeschrieben. Pruefbar ohne Konto: dass die Anfragen so aussehen,
// wie diese Clients sie schicken, dass der Login nur bei Erfolg eine Sitzung ergibt, und
// dass die Antwort in beiden bekannten Formen zu Punkten wird.

const test = require('node:test');
const assert = require('node:assert');
const { erzeugeTractive, tractivePunkte, TRACTIVE_CLIENT } = require('../server/tractive.js');

const antwort = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });

function attrappe(handler) {
  const aufrufe = [];
  const holen = async (url, init) => { aufrufe.push({ url, init: init || {} }); return handler(url, init || {}); };
  return { holen, aufrufe };
}

test('Die Anmeldung schickt, was Tractive erwartet, und merkt sich Token und Benutzer', async () => {
  const { holen, aufrufe } = attrappe((url) => {
    if (url.endsWith('auth/token')) return antwort(200, { access_token: 'tok', user_id: 'u1', expires_at: 9999999999 });
    if (url.endsWith('user/u1/trackers')) return antwort(200, [{ _id: 'ABC123', _type: 'tracker' }]);
    if (url.endsWith('user/u1/trackable_objects')) return antwort(200, [{ _id: 'pet1' }]);
    if (url.endsWith('trackable_object/pet1')) return antwort(200, { name: 'Nesti', device_id: 'ABC123' });
    return antwort(404, {});
  });
  const t = erzeugeTractive({ fetch: holen });
  await t.anmelden('max@example.org', 'geheim');
  const login = aufrufe[0];
  assert.strictEqual(login.url, 'https://graph.tractive.com/4/auth/token');
  assert.strictEqual(login.init.method, 'POST');
  assert.deepStrictEqual(JSON.parse(login.init.body), { platform_email: 'max@example.org', platform_token: 'geheim', grant_type: 'tractive' });
  assert.strictEqual(login.init.headers['x-tractive-client'], TRACTIVE_CLIENT);

  const liste = await t.tracker();
  assert.deepStrictEqual(liste, [{ id: 'ABC123', name: 'Nesti' }]);
  const danach = aufrufe[1];
  assert.strictEqual(danach.init.headers.authorization, 'Bearer tok');
  assert.strictEqual(danach.init.headers['x-tractive-user'], 'u1');
});

test('Falsches Passwort: Fehler, keine Sitzung', async () => {
  const { holen } = attrappe(() => antwort(401, { message: 'nope' }));
  const t = erzeugeTractive({ fetch: holen });
  await assert.rejects(() => t.anmelden('a', 'b'), /E-Mail oder Passwort/);
  assert.strictEqual(t.angemeldet(), false);
});

test('Der Verlauf fragt in Unix-Sekunden als json_segments und liefert Punkte', async () => {
  const { holen, aufrufe } = attrappe((url) => {
    if (url.endsWith('auth/token')) return antwort(200, { access_token: 'tok', user_id: 'u1', expires_at: 9999999999 });
    if (url.includes('/positions')) return antwort(200, [[
      { time: 1762300000, latlong: [47.858, 11.403], sensor_used: 'GPS' },
      { time: 1762300600, latlong: [47.859, 11.404], sensor_used: 'GPS' }
    ]]);
    return antwort(404, {});
  });
  const t = erzeugeTractive({ fetch: holen });
  await t.sicherstellen('a', 'b');
  const punkte = await t.verlauf('ABC123', '2026-11-05T00:00:00Z', '2026-11-06T00:00:00Z');
  const u = new URL(aufrufe[1].url);
  assert.strictEqual(u.pathname, '/4/tracker/ABC123/positions');
  assert.strictEqual(u.searchParams.get('time_from'), String(Math.floor(Date.parse('2026-11-05T00:00:00Z') / 1000)));
  assert.strictEqual(u.searchParams.get('format'), 'json_segments');
  assert.strictEqual(punkte.length, 2);
  assert.deepStrictEqual(punkte[0], { lat: 47.858, lon: 11.403, t: '2025-11-04T23:46:40.000Z', sensor: 'GPS' });
});

test('Die Sitzung wird erst erneuert, wenn sie bald ablaeuft', async () => {
  let logins = 0;
  const { holen } = attrappe((url) => {
    if (url.endsWith('auth/token')) { logins++; return antwort(200, { access_token: 'tok', user_id: 'u1', expires_at: 2000000 }); }
    return antwort(200, []);
  });
  let jetzt = 1000000 * 1000;
  const t = erzeugeTractive({ fetch: holen, jetzt: () => jetzt });
  await t.sicherstellen('a', 'b'); await t.sicherstellen('a', 'b');
  assert.strictEqual(logins, 1);
  jetzt = (2000000 - 1800) * 1000; // in einer halben Stunde abgelaufen
  await t.sicherstellen('a', 'b');
  assert.strictEqual(logins, 2);
});

test('tractivePunkte versteht Segmente, flache Listen, Millisekunden und Breiten-/Laengengrad', () => {
  const seg = tractivePunkte([[{ time: 100, latlong: [1, 2] }], [{ time: 50, latlong: [3, 4] }]]);
  assert.deepStrictEqual(seg.map(p => p.lat), [3, 1], 'nach Zeit sortiert');
  const flach = tractivePunkte([{ time: 1762300000000, latitude: 5, longitude: 6 }]);
  assert.strictEqual(flach[0].t, '2025-11-04T23:46:40.000Z');
  assert.deepStrictEqual(tractivePunkte([{ time: 1, latlong: ['x', 2] }, null, 'unsinn']), []);
  assert.deepStrictEqual(tractivePunkte(null), []);
});
