// Der Verlauf, über den ECHTEN Weg: Anzeige -> eigener Server -> Home Assistant -> zurück ->
// in die Zeichenfunktion.
//
// Anlass: Der Balken auf der Statusseite war auf dem Gerät durchgehend grau, darunter stand
// „Für diesen Zeitraum liegt kein Verlauf vor". Nichts war kaputt — der Server schickte das
// Feld als `z`, die Anzeige las `zustand`. Jeder Punkt fiel durch den Filter.
//
// Die Modultests sahen es nicht: Beide Hälften waren für sich in Ordnung. Und die Probe sah es
// auch nicht, denn sie ERFAND ihre Daten und schrieb dabei `zustand` — sie prüfte damit nicht
// den Weg, sondern sich selbst. Deshalb geht dieser Test ihn ganz: Was der Server liefert,
// wird hier direkt an `statusBalken()` gereicht. Stimmen die Namen nicht, wird der Balken grau,
// und der Test merkt es.

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { startServer } = require('../server/setup-server');
const R = require('../renderer/shared/dashboard-render.js');

const STUNDE = 3600000;
const JETZT = Date.now();

function fakeStore(values = {}) {
  const data = { ...values };
  return { get: (k) => data[k], set: (k, v) => { data[k] = v; }, delete: (k) => { delete data[k]; } };
}

// Ein Home Assistant, das genau das antwortet, was das echte auf diesen Pfad antwortet:
// eine Liste von Listen, je Entität eine, mit `state` und `last_changed`.
let haServer, haPort, letzteAnfrage = '';
const HA_ANTWORT = [[
  { state: 'up', last_changed: new Date(JETZT - 24 * STUNDE).toISOString() },
  { state: 'down', last_changed: new Date(JETZT - 3 * STUNDE).toISOString() },
  { state: 'up', last_changed: new Date(JETZT - 3 * STUNDE + 180000).toISOString() }
]];
const HA_ZAHLEN = [[
  { state: '41.2', last_changed: new Date(JETZT - 2 * STUNDE).toISOString() },
  { state: 'unavailable', last_changed: new Date(JETZT - STUNDE).toISOString() },
  { state: '47.9', last_changed: new Date(JETZT - 1800000).toISOString() }
]];

let server, live, PORT = 0;
const U = (pfad) => `http://127.0.0.1:${PORT}${pfad}`;

test.before(async () => {
  haServer = http.createServer((req, res) => {
    letzteAnfrage = req.url;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(/status/.test(req.url) ? HA_ANTWORT : HA_ZAHLEN));
  });
  await new Promise((f) => haServer.listen(0, '127.0.0.1', f));
  haPort = haServer.address().port;

  const app = startServer({
    port: 0,
    store: fakeStore({ haUrl: `http://127.0.0.1:${haPort}`, token: 'geheim' }),
    onConfigSaved: () => {}, getLocalIps: () => [],
    updater: { currentVersion: '1.0.0', getState: () => ({}), check: () => {}, install: () => {} },
    controller: null
  });
  server = app.server;
  live = app.haLive;
  await new Promise((f) => { if (server.listening) return f(); server.once('listening', f); });
  PORT = server.address().port;
});

test.after(() => {
  if (server) server.close();
  if (haServer) haServer.close();
  if (live) live.stop();
});

test('Ein Textzustand überlebt den Weg -- und färbt den Balken', () => {
  // DER Test dieser Datei. Er prüft nicht, wie die Felder heißen, sondern dass am Ende Farbe
  // herauskommt: Ein umbenanntes Feld auf einer der beiden Seiten macht den Balken grau.
  return fetch(U('/api/ha/history?entity_id=sensor.x_status&hours=24&text=1'))
    .then(r => r.json())
    .then(d => {
      assert.strictEqual(d.ok, true);
      assert.strictEqual(d.series.length, 3);
      const felder = R.statusBalken(d.series, JETZT - 24 * STUNDE, JETZT, 48);
      assert.strictEqual(felder.filter(f => f.zustand === 'down').length, 1, 'der Ausfall fehlt');
      assert.strictEqual(felder.filter(f => f.zustand === 'up').length, 47);
      assert.strictEqual(felder.filter(f => f.zustand === '').length, 0, 'nichts darf unbekannt bleiben');
    });
});

test('Und das ganze Fenster steht damit, ohne „keine Daten"', () => {
  return fetch(U('/api/ha/history?entity_id=sensor.x_status&hours=24&text=1'))
    .then(r => r.json())
    .then(d => {
      const h = R.statusDetail({
        monitor: { name: 'Pi-hole', zustand: 'up', ms: 42, quote: 99.1, seit: JETZT - 3 * STUNDE },
        zustandsVerlauf: d.series, msVerlauf: [], jetzt: JETZT
      });
      assert.ok(!/liegt kein Verlauf vor/.test(h), 'das Fenster behauptet, nichts zu wissen');
      assert.match(h, /std-feld st-down/);
    });
});

test('Ohne `text=1` bleibt alles wie vorher -- Zahlen, kein NaN', () => {
  // Die Zahlenseite darf der Textzweig nicht anfassen: Jede Wertkarte hängt daran.
  return fetch(U('/api/ha/history?entity_id=sensor.antwortzeit&hours=24'))
    .then(r => r.json())
    .then(d => {
      assert.strictEqual(d.ok, true);
      assert.deepStrictEqual(d.series.map(p => p.v), [41.2, 47.9], '„unavailable" muss rausfallen');
      assert.ok(d.series.every(p => typeof p.t === 'string'));
      // Und die Kurve nimmt das unverändert an.
      const h = R.detailInhalt('sensor.antwortzeit', 'sensor',
        { state: '47.9', attributes: { unit_of_measurement: 'ms' } }, { history: d.series });
      assert.match(h, /dt-verlauf-box/);
      assert.ok(!/NaN/.test(h));
    });
});

test('Der Zeitraum geht als Stunden an Home Assistant', () => {
  return fetch(U('/api/ha/history?entity_id=sensor.x_status&hours=6&text=1'))
    .then(() => {
      assert.match(letzteAnfrage, /^\/api\/history\/period\//);
      assert.match(letzteAnfrage, /filter_entity_id=sensor\.x_status/);
      assert.match(letzteAnfrage, /minimal_response/);
    });
});
