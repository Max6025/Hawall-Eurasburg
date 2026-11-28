'use strict';
// Die Anzeige zeichnet immer -- und ruht trotzdem, wenn das Panel aus ist.
//
// Anlass (2026-11-28): Angetippt, die Helligkeit ging hoch, aber auf der Wand blieb das Bild des
// Bildschirmschoners stehen; nichts reagierte sichtbar, und dazu kamen die Geraeusche des
// Dashboards. Die App war wach -- Chromium hielt das Fenster fuer verdeckt und zeichnete nicht
// mehr. Die Fernpruefung meldete dabei "alles in Ordnung", weil sie nur die Logik fragte.
//
// Jeder Test hier haelt eine der Stellen fest, die zusammen dagegen stehen. Fehlt eine, gibt es
// keinen Fehler, sondern irgendwann wieder ein stehendes Bild.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const lies = (...teile) => fs.readFileSync(path.join(__dirname, '..', ...teile), 'utf8');
const main = lies('main.js');
const seite = lies('renderer', 'dashboard.html');
const css = lies('renderer', 'shared', 'dashboard.css');
const server = lies('server', 'setup-server.js');

test('Chromium darf das Fenster nicht fuer verdeckt halten', () => {
  assert.match(main, /appendSwitch\('disable-features',\s*'[^']*CalculateNativeWinOcclusion[^']*'\)/);
  assert.match(main, /backgroundThrottling:\s*false/);
});

test('der Schalter steht VOR app.whenReady -- danach liest Chromium ihn nicht mehr', () => {
  const schalter = main.indexOf('CalculateNativeWinOcclusion\')');
  const bereit = main.indexOf('app.whenReady()');
  assert.ok(schalter > 0 && bereit > 0 && schalter < bereit);
});

test('ist das Panel aus, ruht die Seite: Klasse wird gesetzt, sofort wieder genommen, und es gibt eine Regel dazu', () => {
  assert.match(seite, /classList\.add\('panel-dunkel'\)/);
  assert.match(seite, /classList\.remove\('panel-dunkel'\)/);
  for (const flaeche of ['.app', '.lebendig', '.bildschirmschoner', '.anlass-schicht']) {
    assert.ok(css.includes(`body.panel-dunkel ${flaeche}`), `keine Ruheregel fuer ${flaeche}`);
  }
  // Die Blende selbst darf NICHT verschwinden -- aus ihr blendet das Aufwachen auf.
  assert.ok(!/body\.panel-dunkel \.panel-blende/.test(css));
});

test('die Ruhe schlaegt die Sichtbarkeit des liegenden Schoners', () => {
  // .bildschirmschoner.bs-sichtbar setzt visibility: visible mit hoeherer Spezifitaet.
  const regel = css.slice(css.indexOf('body.panel-dunkel .app'));
  assert.match(regel.slice(0, regel.indexOf('}')), /visibility:\s*hidden\s*!important/);
});

test('die Fernpruefung fragt, ob etwas zu SEHEN ist -- und der Server laesst die Antwort durch', () => {
  assert.match(seite, /sichtbarkeit:\s*document\.visibilityState/);
  assert.match(server, /'sichtbarkeit'/);
  assert.match(server, /'panelDunkel'/);
});

test('ein verdecktes Fenster landet im Protokoll', () => {
  assert.match(seite, /addEventListener\('visibilitychange',\s*sichtbarkeitMelden\)/);
  assert.match(server, /app\.post\('\/api\/geraet\/sichtbarkeit'/);
  assert.match(server, /controller\.log\(/);
});
