// Der dritte Dashboard-Typ: „Status".
//
// Er ist der einzige, den man NICHT einrichtet -- er sucht sich seine Dienste selbst. Genau
// darin steckt das Risiko: Eine Erkennung, die am Namen haengt, findet nach einem Sprach-
// oder Versionswechsel nichts mehr, und eine Seite, die nichts findet, sieht aus wie eine
// Seite, auf der alles in Ordnung ist. Dagegen sind die Tests hier.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../renderer/shared/dashboard-render.js');

const WURZEL = path.join(__dirname, '..');
const lies = (...p) => fs.readFileSync(path.join(WURZEL, ...p), 'utf8');

/**
 * Ein Monitor, so wie die Uptime-Kuma-Integration ihn in Home Assistant anlegt: eine
 * Statusentitaet und mehrere Geschwister mit demselben Stamm.
 *
 * `suffixe` ist absichtlich einstellbar -- auf einem deutschen Home Assistant heissen sie
 * `_antwortzeit` und `_verfugbarkeit_30_tage`, auf einem englischen `_response_time` und
 * `_uptime_30_days`. Beide Faelle muessen durchgehen.
 */
function monitor(zustaende, basis, name, zustand, opt = {}) {
  const s = opt.suffixe || { ms: '_antwortzeit', quote: '_verfugbarkeit_30_tage', typ: '_uberwachungstyp' };
  const setze = (id, state, attrs) => { zustaende[id] = { entity_id: id, state, attributes: attrs || {} }; };
  setze(basis + '_status', zustand, { friendly_name: name + ' Status' });
  if (opt.ms !== null) setze(basis + s.ms, String(opt.ms === undefined ? 24 : opt.ms),
    { friendly_name: name + ' Antwortzeit', unit_of_measurement: 'ms' });
  if (opt.quote !== null) setze(basis + s.quote, String(opt.quote === undefined ? 99.5 : opt.quote),
    { friendly_name: name + ' 30 Tage', unit_of_measurement: '%' });
  setze(basis + s.typ, opt.typ || 'http', { friendly_name: name + ' Typ' });
  return zustaende;
}

function welt(...bauer) {
  const z = {};
  for (const b of bauer) b(z);
  return z;
}

// --- Finden ----------------------------------------------------------------------------------

test('Monitore werden am ZUSTAND erkannt, nicht am Namen', () => {
  // Der Zustand `up` ist ein Rohwert und bleibt englisch, auch auf einem deutschen Home
  // Assistant -- uebersetzt wird erst in der Oberflaeche. Die Entitaets-Kennung dagegen wird
  // aus dem uebersetzten Namen gebildet, ist also sprachabhaengig. Dieselbe Lehre wie bei
  // `sc.exe`: die Werte lesen, nie die Beschriftungen.
  const z = welt(
    (x) => monitor(x, 'sensor.pi_hole', 'Pi-hole', 'up'),
    // Derselbe Dienst auf einem ENGLISCHEN Home Assistant -- andere Kennungen, gleicher Zustand.
    (x) => monitor(x, 'sensor.router', 'Router', 'down',
      { suffixe: { ms: '_response_time', quote: '_uptime_30_days', typ: '_monitor_type' } })
  );
  const m = R.statusMonitore(z);
  assert.deepStrictEqual(m.map(x => x.name), ['Router', 'Pi-hole']);
  assert.strictEqual(m[0].zustand, 'down');
});

test('Antwortzeit und Verfügbarkeit kommen über die EINHEIT', () => {
  // Nicht ueber den Namen: `_antwortzeit` heisst englisch `_response_time`, und eine Liste
  // mit beiden Schreibweisen waere beim naechsten Sprachwechsel wieder unvollstaendig.
  const z = welt((x) => monitor(x, 'sensor.nas', 'NAS', 'up',
    { ms: 540, quote: 97.4, suffixe: { ms: '_response_time', quote: '_uptime_30_days', typ: '_monitor_type' } }));
  const [m] = R.statusMonitore(z);
  assert.strictEqual(m.ms, 540);
  assert.strictEqual(m.quote, 97.4);
});

test('Eine Gruppe ist eine Überschrift, kein Dienst', () => {
  // In Uptime Kuma fasst eine Gruppe Monitore zusammen. Als eigene Kachel waere sie eine
  // Zeile, die immer gruen ist und nichts ueberwacht -- und sie verfaelscht die Zaehlung
  // „x von y erreichbar" in beide Richtungen.
  const z = welt(
    (x) => monitor(x, 'sensor.pi_hole', 'Pi-hole', 'up'),
    (x) => monitor(x, 'sensor.server', 'Server', 'up', { typ: 'group' })
  );
  assert.deepStrictEqual(R.statusMonitore(z).map(x => x.name), ['Pi-hole']);
});

test('Ein einzelner Sensor, der zufällig „up" meldet, ist kein Monitor', () => {
  // Davon gibt es in einem Haushalt genug -- ein Schalter, ein Binaersensor, ein selbst
  // gebautes Template. Ohne Geschwister mit demselben Stamm ist es keiner.
  const z = {
    'sensor.irgendwas': { entity_id: 'sensor.irgendwas', state: 'up', attributes: {} },
    'binary_sensor.tuer_status': { entity_id: 'binary_sensor.tuer_status', state: 'up', attributes: {} }
  };
  assert.deepStrictEqual(R.statusMonitore(z), []);
});

test('Das Ausgefallene steht oben', () => {
  // Eine Statusseite, auf der man die rote Kachel suchen muss, hat ihren Zweck verfehlt.
  const z = welt(
    (x) => monitor(x, 'sensor.a_up', 'Aaa', 'up'),
    (x) => monitor(x, 'sensor.b_wartung', 'Bbb', 'maintenance'),
    (x) => monitor(x, 'sensor.c_pending', 'Ccc', 'pending'),
    (x) => monitor(x, 'sensor.d_down', 'Ddd', 'down')
  );
  assert.deepStrictEqual(R.statusMonitore(z).map(x => x.zustand),
    ['down', 'pending', 'maintenance', 'up']);
});

test('Fehlende Zahlen sind null, nicht 0', () => {
  // „0 ms" behauptet eine Messung. Dieselbe Falle wie `Number(null)` in akkuStufe().
  const z = welt((x) => monitor(x, 'sensor.ohne', 'Ohne', 'up', { ms: null, quote: null }));
  const [m] = R.statusMonitore(z);
  assert.strictEqual(m.ms, null);
  assert.strictEqual(m.quote, null);
  const h = R.statusAnsicht(z, {});
  assert.ok(!/>0 ms</.test(h), 'keine erfundene Null in der Anzeige');
});

test('Ein unerreichbarer Zahlensensor wird zum Strich, nicht zu NaN', () => {
  const z = welt((x) => monitor(x, 'sensor.weg', 'Weg', 'up', { ms: 'unavailable', quote: 'unknown' }));
  const [m] = R.statusMonitore(z);
  assert.strictEqual(m.ms, null);
  assert.strictEqual(m.quote, null);
  assert.ok(!/NaN/.test(R.statusAnsicht(z, {})), 'nirgendwo darf NaN stehen');
});

// --- Störungen ---------------------------------------------------------------------------------

/** Die Sammel-Entitaet, wie sie auf dem Home-Assistant-Dashboard steht. */
const SAMMLER = {
  entity_id: 'sensor.netzwache_probleme',
  state: '3',
  attributes: {
    alle: ['HA Vater', 'Drucker', 'Wasseruhr'],
    kuma: ['HA Vater'],
    integrationen: ['Drucker'],
    hardware: ['Wasseruhr'],
    kuma_monitore: 38
  }
};

test('Die Sammel-Entität wird an ihrer FORM erkannt, nicht an ihrer Kennung', () => {
  // Wer sie umbenennt, soll sie nicht verlieren. Und sie ist mehr wert als die Monitore
  // allein: Eine haengende Integration und ein Gerät, das sich nicht meldet, stehen in
  // Uptime Kuma nirgends.
  const z = welt((x) => monitor(x, 'sensor.pi_hole', 'Pi-hole', 'up'));
  z['sensor.voellig_anderer_name'] = { ...SAMMLER, entity_id: 'sensor.voellig_anderer_name' };
  const p = R.statusProbleme(z, R.statusMonitore(z));
  assert.strictEqual(p.anzahl, 3);
  assert.deepStrictEqual(p.gruppen.map(g => g.titel),
    ['Nicht erreichbar', 'Integration hängt', 'Hardware']);
  assert.strictEqual(p.quelle, 'sensor.voellig_anderer_name');
});

test('Ohne Sammel-Entität zählen die Monitore selbst', () => {
  const z = welt(
    (x) => monitor(x, 'sensor.a', 'Aaa', 'down'),
    (x) => monitor(x, 'sensor.b', 'Bbb', 'up')
  );
  const p = R.statusProbleme(z, R.statusMonitore(z));
  assert.strictEqual(p.anzahl, 1);
  assert.deepStrictEqual(p.gruppen[0].eintraege, ['Aaa']);
});

test('„In Wartung" ist keine Störung', () => {
  // Sonst schlägt die Seite genau dann Alarm, wenn jemand angekündigt daran arbeitet --
  // und nach dem dritten Fehlalarm glaubt niemand mehr der Anzeige.
  const z = welt((x) => monitor(x, 'sensor.a', 'Aaa', 'maintenance'));
  assert.strictEqual(R.statusProbleme(z, R.statusMonitore(z)).anzahl, 0);
  assert.match(R.statusAnsicht(z, {}), /Alles in Ordnung/);
});

// --- Das Raster --------------------------------------------------------------------------------

test('Das Raster fasst alle Kacheln, ohne eine Zeile zu verschenken', () => {
  // „Alles auf einem Bildschirm" laesst sich nicht an `auto-fill` abgeben: Das fuellt die
  // Breite und schiebt den Rest nach unten aus dem Bild. Auf einer Wand sieht niemand, dass
  // es unterhalb der Kante weitergeht.
  for (const n of [1, 2, 3, 5, 8, 12, 19, 24, 38, 60, 97]) {
    const { spalten, zeilen } = R.statusRaster(n, 2.5);
    assert.ok(spalten >= 1 && zeilen >= 1, `n=${n}: ${spalten}x${zeilen}`);
    assert.ok(spalten * zeilen >= n, `n=${n} passt nicht: ${spalten}x${zeilen}`);
    assert.ok(spalten * (zeilen - 1) < n, `n=${n} verschenkt eine ganze Zeile: ${spalten}x${zeilen}`);
    assert.ok(spalten <= n, `mehr Spalten als Kacheln bei n=${n}`);
  }
});

test('Ein breiterer Bildschirm bekommt mehr Spalten', () => {
  assert.ok(R.statusRaster(24, 4).spalten > R.statusRaster(24, 1).spalten);
});

test('Ohne Seitenverhältnis wird nicht durch null geteilt', () => {
  // Der Kasten ist beim ersten Zeichnen noch `display: none` und damit 0 hoch.
  for (const v of [0, undefined, null, NaN, -3]) {
    const r = R.statusRaster(12, v);
    assert.ok(Number.isFinite(r.spalten) && r.spalten >= 1, 'kaputt bei ' + v);
    assert.ok(r.spalten * r.zeilen >= 12);
  }
});

// --- Die Anzeige -------------------------------------------------------------------------------

test('Die Zahl in der Überschrift passt zur Liste darunter', () => {
  const z = welt((x) => monitor(x, 'sensor.pi_hole', 'Pi-hole', 'up'));
  z[SAMMLER.entity_id] = SAMMLER;
  const h = R.statusAnsicht(z, { seitenverhaeltnis: 2.5 });
  assert.match(h, /3 Störungen/);
  assert.strictEqual((h.match(/class="st-pille"/g) || []).length, 3);
  assert.ok(!/Alles in Ordnung/.test(h));
});

test('Eine einzelne Störung heißt nicht „1 Störungen"', () => {
  const z = welt((x) => monitor(x, 'sensor.a', 'Aaa', 'down'));
  assert.match(R.statusAnsicht(z, {}), /1 Störung</);
});

test('Nichts gefunden ist NICHT „alles in Ordnung"', () => {
  // Die gefaehrlichste Anzeige von allen: Ein gruener Haken ueber einer leeren Flaeche sagt
  // „geprüft", und geprüft wurde nichts. Genau so sähe ein kaputter Erkennungsweg aus.
  const h = R.statusAnsicht({}, {});
  assert.ok(!/Alles in Ordnung/.test(h));
  assert.match(h, /Keine Überwachung gefunden/);
  assert.ok(!/st-kopf-ok/.test(h), 'und kein grüner Kopf');
});

test('Die Zählung nennt beide Zahlen', () => {
  const z = welt(
    (x) => monitor(x, 'sensor.a', 'Aaa', 'up'),
    (x) => monitor(x, 'sensor.b', 'Bbb', 'up'),
    (x) => monitor(x, 'sensor.c', 'Ccc', 'down')
  );
  assert.match(R.statusAnsicht(z, {}), /2 von 3 Diensten erreichbar/);
});

test('Namen und Werte werden maskiert', () => {
  // Ein Monitorname kommt aus Uptime Kuma und darf alles enthalten.
  const z = welt((x) => monitor(x, 'sensor.b', '<img src=x onerror=alert(1)>', 'up'));
  const h = R.statusAnsicht(z, {});
  assert.ok(!/<img/.test(h), 'roher Name im HTML: ' + h.slice(0, 200));
  assert.match(h, /&lt;img/);
});

test('Nur die ausgefallene Kachel blinkt', () => {
  // Blinkte alles, waere die Seite eine Lichterkette und das Blinken keine Aussage mehr.
  const css = lies('renderer', 'shared', 'dashboard.css');
  assert.match(css, /\.st-down \.st-punkt \{[^}]*animation:/);
  assert.ok(!/\.st-up \.st-punkt \{[^}]*animation:/.test(css));
  // Und wer Bewegung abgeschaltet hat, bekommt keinen still blinkenden Punkt.
  assert.ok(/prefers-reduced-motion[\s\S]{0,200}\.st-down \.st-punkt \{ animation: none/.test(css),
    'prefers-reduced-motion fehlt für den Punkt');
});

// --- Die Live-Verbindung -----------------------------------------------------------------------

test('Die Statusseite meldet ihre Entitäten für den Live-Filter', () => {
  // Dieselbe Rolle wie `kartenEntitaeten()` bei den Karten. Ohne sie trägt der Filter noch
  // das vorher gezeigte Dashboard -- und ausgerechnet die Meldung „ein Dienst ist
  // ausgefallen" fällt durch.
  const z = welt((x) => monitor(x, 'sensor.pi_hole', 'Pi-hole', 'up'));
  z[SAMMLER.entity_id] = SAMMLER;
  const e = R.statusEntitaeten(z);
  assert.ok(e.has('sensor.pi_hole_status'));
  assert.ok(e.has('sensor.netzwache_probleme'));
  // Die Antwortzeit NICHT: Sie ändert sich bei jedem Ping, und die Seite würde sich dauernd
  // neu bauen, um eine Zahl zu drehen, die niemand von der Wand abliest.
  assert.ok(!e.has('sensor.pi_hole_antwortzeit'));
});

// --- Die Verdrahtung ---------------------------------------------------------------------------

test('Drei Ansichten werden an EINER Stelle umgeschaltet', () => {
  // Mit zwei Typen reichte ein if/else. Mit dreien muss sonst jeder Zweig an die beiden
  // ANDEREN denken -- und der, der es vergisst, legt zwei Ansichten übereinander.
  const dash = lies('renderer', 'dashboard.html');
  const i = dash.indexOf('function ansichtUmschalten');
  assert.ok(i > 0, 'ansichtUmschalten fehlt');
  const block = dash.slice(i, dash.indexOf('\n}\n', i));
  for (const id of ['grid', 'trackerView', 'statusView']) {
    assert.ok(block.includes(`$('${id}')`), `ansichtUmschalten fasst ${id} nicht an`);
  }
  assert.ok(dash.includes('id="statusView"'), 'der Container fehlt in der Seite');
  // Und der Abruf-Takt zeichnet sie mit: Eine Statusseite, die nur beim Aufrufen stimmt,
  // zeigt den Ausfall von vor zwei Stunden.
  const r = dash.indexOf('async function refresh');
  assert.ok(dash.slice(r, r + 900).includes('renderStatusView'),
    'refresh() zeichnet die Statusseite nicht nach');
});

test('Die Statusseite ist ein Dashboard-Typ wie die anderen', () => {
  const server = lies('server', 'setup-server.js');
  assert.match(server, /const DASHBOARD_ARTEN = \['cards', 'tracker', 'status'\]/);
  assert.match(server, /DASHBOARD_ARTEN\.includes\(type\) \? type : 'cards'/,
    'die Art muss gegen die Liste geprüft werden, nicht gegen einzelne Vergleiche');
  const seite = lies('renderer', 'setup', 'dashboards.html');
  assert.match(seite, /name="newType" value="status"/, 'sie lässt sich nicht anlegen');
});

test('Eine Statusseite lässt sich aus- und wieder einspielen', () => {
  const A = require('../server/dashboard-austausch.js');
  const { datei } = A.exportieren({ id: 'db_1', name: 'Hausstatus', type: 'status', layout: [] }, {});
  assert.strictEqual(datei.art, 'status');
  assert.deepStrictEqual(datei.karten, []);
  const rein = A.importieren(datei);
  assert.strictEqual(rein.ok, true, JSON.stringify(rein.fehler));
  assert.strictEqual(rein.dashboard.type, 'status');
  assert.strictEqual(rein.dashboard.name, 'Hausstatus');
});

test('Jede Klasse der Statusseite hat eine Regel im CSS', () => {
  // Beide Richtungen, wie beim Energiediagramm: Eine Klasse ohne Regel ist ein Element ohne
  // Gestaltung, eine Regel ohne Klasse ist toter Code -- und beides ohne Fehlermeldung.
  // Genau so fehlte `.st-kopf-ok`.
  const js = lies('renderer', 'shared', 'dashboard-render.js');
  const css = lies('renderer', 'shared', 'dashboard.css');
  const teil = js.slice(js.indexOf('Der Dashboard-Typ "Status"'), js.indexOf('global.DashboardRender = {'));
  assert.ok(teil.length > 2000, 'der Status-Abschnitt wurde nicht gefunden');

  const imJs = new Set();
  for (const m of teil.matchAll(/class="([^"]*)"/g)) {
    for (const k of m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
      if (/^st(-|$)/.test(k)) imJs.add(k);
    }
  }
  // Die Klassen aus der Zustandstabelle stehen als Zeichenketten da, nicht in einem class=;
  // und in `class="${ok ? 'st-kopf-ok' : 'st-kopf-alarm'}"` stecken sie IM Ausdruck, den das
  // Muster oben gerade herausgeschnitten hat. Genau so hat dieser Test beim ersten Anlauf
  // zwei Klassen übersehen und dafür zwei Regeln als verwaist gemeldet.
  for (const m of teil.matchAll(/'(st-[\w-]+)'/g)) imJs.add(m[1]);

  const imCss = new Set();
  for (const m of css.matchAll(/\.(st(?:-[\w-]+)?)(?![\w-])/g)) imCss.add(m[1]);

  const ohneRegel = [...imJs].filter(k => !imCss.has(k));
  assert.deepStrictEqual(ohneRegel, [], 'Klassen im JS ohne CSS-Regel: ' + ohneRegel.join(', '));
  const verwaist = [...imCss].filter(k => !imJs.has(k));
  assert.deepStrictEqual(verwaist, [], 'CSS-Regeln ohne Verwendung: ' + verwaist.join(', '));
});

// --- Was hinter einer Kachel steckt ----------------------------------------------------------
//
// Angetippt zeigt eine Kachel den Balken der letzten 24 Stunden, die Antwortzeit als Kurve und
// die letzten Wechsel. Vorbild war die Statusseite von Uptime Kuma -- mit EINEM Unterschied,
// der hier die meisten Tests trägt: Dort ist jedes Feld eine Prüfung, hier ein Zeitabschnitt.

const STUNDE = 3600000;
const JETZT = Date.parse('2026-11-22T16:00:00Z');
const w = (stundenVorher, zustand) => ({ t: new Date(JETZT - stundenVorher * STUNDE).toISOString(), zustand });

test('Ein Ausfall von drei Minuten färbt sein Feld', () => {
  // Der Grund für die Zeitabschnitte. Hätte jedes Feld eine Prüfung zu zeigen, verschwände
  // ein kurzer Ausfall zwischen zwei Prüfungen -- und genau der ist der interessante.
  const verlauf = [w(24, 'up'), w(3, 'down'), { t: new Date(JETZT - 3 * STUNDE + 180000).toISOString(), zustand: 'up' }];
  const felder = R.statusBalken(verlauf, JETZT - 24 * STUNDE, JETZT, 48);
  assert.strictEqual(felder.length, 48);
  assert.strictEqual(felder.filter(f => f.zustand === 'down').length, 1);
  assert.strictEqual(felder.filter(f => f.zustand === 'up').length, 47);
});

test('Der schlechteste Zustand gewinnt im Feld', () => {
  // Ein Abschnitt, in dem es kurz aus war, ist nicht halb in Ordnung.
  const verlauf = [w(24, 'up'), w(2, 'pending'), w(1.9, 'down'), w(1.8, 'up')];
  const felder = R.statusBalken(verlauf, JETZT - 24 * STUNDE, JETZT, 24);  // eine Stunde je Feld
  const betroffen = felder.filter(f => f.von < JETZT - 1.5 * STUNDE && f.bis > JETZT - 2 * STUNDE);
  assert.ok(betroffen.length);
  assert.ok(betroffen.some(f => f.zustand === 'down'), 'der Ausfall muss durchschlagen');
});

test('Nichts bekannt ist NICHT "erreichbar"', () => {
  // Ein grünes Feld für einen Zeitraum, aus dem kein Verlauf vorliegt, wäre eine Behauptung
  // über etwas, das niemand gemessen hat.
  const felder = R.statusBalken([w(6, 'up')], JETZT - 24 * STUNDE, JETZT, 24);
  assert.strictEqual(felder.filter(f => f.zustand === '').length, 18, 'die ersten 18 Stunden sind unbekannt');
  assert.strictEqual(felder.filter(f => f.zustand === 'up').length, 6);
  const h = R.statusDetail({ monitor: { name: 'X', zustand: 'up', ms: 10, quote: 99 },
    zustandsVerlauf: [], msVerlauf: [], jetzt: JETZT });
  assert.match(h, /liegt kein Verlauf vor/, 'ein durchgehend grauer Balken braucht ein Wort dazu');
});

test('Ein kaputter Zeitraum ergibt keinen Balken statt eines falschen', () => {
  for (const [a, b] of [[JETZT, JETZT], [JETZT, JETZT - STUNDE], [NaN, JETZT], [JETZT - STUNDE, undefined]]) {
    assert.deepStrictEqual(R.statusBalken([w(1, 'up')], a, b, 24), []);
  }
});

test('Die Ereignisliste zeigt nur WECHSEL, neueste zuerst', () => {
  // Home Assistant meldet denselben Zustand auch dann noch einmal, wenn sich nur ein Attribut
  // gerührt hat -- bei einem Monitor die Antwortzeit, also ständig. Zweihundert Zeilen
  // "Erreichbar" beantworten keine Frage.
  const verlauf = [w(10, 'up'), w(9, 'up'), w(8, 'up'), w(5, 'down'), w(4, 'down'), w(3, 'up')];
  const e = R.statusEreignisse(verlauf, 6);
  assert.deepStrictEqual(e.map(x => x.zustand), ['up', 'down', 'up']);
  assert.ok(e[0].ms > e[1].ms, 'neueste zuerst');
});

test('Das Fenster zeigt höchstens VIER Ereignisse', () => {
  // Es hat eine feste Höhe, und mit sechs Zeilen ragte die letzte darunter heraus. Auf einem
  // Wandpanel scrollt niemand. In der Probe nachgemessen, nicht geschätzt.
  const verlauf = [];
  for (let i = 20; i > 0; i--) verlauf.push(w(i, i % 2 ? 'up' : 'down'));
  const h = R.statusDetail({ monitor: { name: 'X', zustand: 'up', ms: 10, quote: 99 },
    zustandsVerlauf: verlauf, msVerlauf: [], jetzt: JETZT });
  assert.strictEqual((h.match(/class="std-ereignis /g) || []).length, 4);
});

test('Das Fenster nennt den Zeitraum, den der Balken wirklich zeigt', () => {
  // "Letzte 24 Stunden", nicht "letzte 20 Prüfungen": Ein Balken, der etwas anderes zählt,
  // als seine Beschriftung sagt, ist schlimmer als keiner.
  const h = R.statusDetail({ monitor: { name: 'Pi-hole', zustand: 'down', ms: 480, quote: 97.45 },
    zustandsVerlauf: [w(24, 'up'), w(1, 'down')], msVerlauf: [], stunden: 24, jetzt: JETZT });
  assert.match(h, /Letzte 24 Stunden/);
  assert.match(h, /vor 24 Std\./);
  assert.ok(!/Prüfung/.test(h));
  assert.match(h, /Ausgefallen/, 'der Zustand steht als Chip im Kopf');
  assert.match(h, /97,45 %/);
  assert.match(h, /480 ms/);
});

test('Auch hier wird fremder Text maskiert', () => {
  const h = R.statusDetail({ monitor: { name: '<img src=x>', zustand: 'up', ms: null, quote: null },
    zustandsVerlauf: [], msVerlauf: [], jetzt: JETZT });
  assert.ok(!/<img/.test(h));
  assert.ok(!/NaN/.test(h), 'fehlende Zahlen werden zum Strich');
});

test('Die Antwortzeit-Kurve ist dieselbe wie im Detailfenster einer Karte', () => {
  // Sie hier nachzubauen wäre eine zweite Wahrheit -- samt Zeitachse und Tippstrich.
  const ms = Array.from({ length: 20 }, (_, i) =>
    ({ t: new Date(JETZT - (19 - i) * STUNDE).toISOString(), v: 40 + i }));
  const h = R.statusDetail({ monitor: { name: 'X', zustand: 'up', ms: 59, quote: 99 },
    zustandsVerlauf: [w(24, 'up')], msVerlauf: ms, jetzt: JETZT });
  assert.match(h, /dt-verlauf-box/, 'keine Kurve');
  assert.match(h, /dt-achse/, 'keine Zeitachse');
  assert.match(h, /data-einheit="ms"/, 'der Tippstrich kennt die Einheit nicht');
});

test('Die Kachel trägt ihre Kennung, damit das Antippen weiß, wen es meint', () => {
  const z = welt((x) => monitor(x, 'sensor.pi_hole', 'Pi-hole', 'up'));
  assert.match(R.statusAnsicht(z, {}), /data-entity="sensor\.pi_hole_status"/);
  // Und die Kennung der Antwortzeit reist mit -- das Fenster holt davon den Verlauf.
  assert.strictEqual(R.statusMonitore(z)[0].msId, 'sensor.pi_hole_antwortzeit');
});

test('Der Zustandsverlauf kommt über DENSELBEN Pfad wie der Zahlenverlauf', () => {
  // `parseFloat('up')` ist NaN -- ohne den Textzweig kam die Reihe leer zurück, und von außen
  // war das nicht davon zu unterscheiden, dass Home Assistant keinen Verlauf hat.
  const server = lies('server', 'setup-server.js');
  assert.match(server, /req\.query\.text/, 'die Route kennt den Textfall nicht');
  // Das Feld heißt `zustand`, nicht `z`. Beim ersten Anlauf hieß es `z`, und die Anzeige las
  // `zustand` -- jeder Punkt fiel durch den Filter, der Balken war grau, und darunter stand
  // „kein Verlauf". Dass beide Seiten denselben Namen meinen, prüft test/server-verlauf.js
  // am echten Weg; hier steht nur, dass es diesen einen Namen überhaupt gibt.
  assert.match(server, /alsText \? \{ t: p\.last_changed, zustand: String\(p\.state\) \}/);
  const dash = lies('renderer', 'dashboard.html');
  assert.match(dash, /async function ensureZustandsverlauf/);
  assert.match(dash, /&text=1/);
});

test('Das Fenster hinter der Kachel ist DASSELBE wie bei den Karten', () => {
  // Samt 30-Sekunden-Uhr, Escape und Tippen daneben. Ein zweites Fenster wäre ein zweiter
  // Satz Fluchtwege, und einer davon würde vergessen.
  const dash = lies('renderer', 'dashboard.html');
  assert.match(dash, /async function statusDetailOeffnen/);
  assert.match(dash, /detailLaeuft = \{ art: 'status'/);
  assert.match(dash, /statusDetailOeffnen\(kachel\.dataset\.entity\)/, 'die Kachel ist nicht verdrahtet');
  const i = dash.indexOf('async function detailAktualisieren');
  const block = dash.slice(i, i + 1200);
  assert.ok(block.includes("detailLaeuft.art === 'status'"), 'der Neuaufbau kennt den Statusfall nicht');
  assert.ok(block.includes('STATUS_DETAIL_STUNDEN'), 'beide Abrufe müssen denselben Zeitraum nehmen');
});

test('Jede Klasse des Kachel-Fensters hat eine Regel im CSS', () => {
  const js = lies('renderer', 'shared', 'dashboard-render.js');
  const css = lies('renderer', 'shared', 'dashboard.css');
  const teil = js.slice(js.indexOf('Was hinter einer Kachel steckt'), js.indexOf('global.DashboardRender = {'));
  assert.ok(teil.length > 2000, 'der Abschnitt wurde nicht gefunden');
  const imJs = new Set();
  for (const m of teil.matchAll(/class="([^"]*)"/g)) {
    for (const k of m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) if (/^std(-|$)/.test(k)) imJs.add(k);
  }
  for (const m of teil.matchAll(/'(std-[\w-]+)'/g)) imJs.add(m[1]);
  const imCss = new Set();
  for (const m of css.matchAll(/\.(std(?:-[\w-]+)?)(?![\w-])/g)) imCss.add(m[1]);
  assert.deepStrictEqual([...imJs].filter(k => !imCss.has(k)), [], 'Klassen ohne CSS-Regel');
  assert.deepStrictEqual([...imCss].filter(k => !imJs.has(k)), [], 'CSS-Regeln ohne Verwendung');
});
