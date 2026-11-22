const $ = id => document.getElementById(id);

async function loadTrackerEntities() {
  try {
    const r = await fetch('/api/entities');
    const data = await r.json();
    const entities = data.ok ? data.entities : [];
    const trackers = entities.filter(e => e.domain === 'device_tracker' || e.domain === 'person');
    $('trackerEntityList').innerHTML = trackers.map(e => `<option value="${e.entity_id}">${e.name}</option>`).join('');
  } catch (e) { /* Entitaeten-Liste ist nur eine Eingabehilfe, kein hartes Erfordernis */ }
}

async function load() {
  const r = await fetch('/api/dashboards');
  const data = await r.json();
  const list = $('dashList');
  list.innerHTML = '';
  const dashboards = data.ok ? data.dashboards : [];

  // Das Hauptdashboard steht nicht in dieser Liste -- es liegt als 'layout' in der
  // Konfiguration. Waere es hier nicht aufgefuehrt, waere ausgerechnet das wichtigste
  // Dashboard das einzige, das man nicht mitnehmen kann.
  const haupt = document.createElement('div');
  haupt.className = 'dash-item';
  haupt.innerHTML = `
    <input type="text" value="Hauptdashboard" disabled>
    <span class="dash-type-badge">🏠 Start</span>
    <a class="edit-link" href="editor.html">Karten bearbeiten</a>
    <button class="export-link">Exportieren</button>
  `;
  haupt.querySelector('.export-link').addEventListener('click', () => exportieren('/api/dashboard-haupt/export', 'Hauptdashboard'));
  list.appendChild(haupt);

  if (!dashboards.length) {
    list.insertAdjacentHTML('beforeend', '<p class="note">Noch keine Unterdashboards angelegt.</p>');
    return;
  }
  dashboards.forEach(d => {
    const row = document.createElement('div');
    row.className = 'dash-item';
    // Die Statusseite hat KEINE Einrichtung -- sie sucht ihre Dienste selbst. Statt eines
    // Links, der auf eine leere Seite fuehrt, steht dort, warum es nichts einzustellen gibt:
    // Ein Knopf, der nichts tut, laesst einen suchen, was man falsch gemacht hat.
    const art = { tracker: '📍 Tracker', status: '🩺 Status' }[d.type] || '🃏 Karten';
    const einrichten = d.type === 'tracker'
      ? `<a class="edit-link" href="tracker-editor.html?dashboard=${encodeURIComponent(d.id)}">Einrichten</a>`
      : d.type === 'status'
        ? '<span class="note" style="margin:0;">findet die Dienste selbst</span>'
        : `<a class="edit-link" href="editor.html?dashboard=${encodeURIComponent(d.id)}">Karten bearbeiten</a>`;
    row.innerHTML = `
      <input type="text" value="${d.name}" data-id="${d.id}">
      <span class="dash-type-badge">${art}</span>
      ${einrichten}
      <button class="save-link" data-id="${d.id}">Name speichern</button>
      <button class="export-link" data-id="${d.id}">Exportieren</button>
      <button class="delete-link" data-id="${d.id}">Löschen</button>
    `;
    row.querySelector('.export-link').addEventListener('click', () => exportieren(`/api/dashboards/${d.id}/export`, d.name));
    row.querySelector('.save-link').addEventListener('click', async () => {
      const name = row.querySelector('input').value.trim();
      if (!name) return;
      await fetch(`/api/dashboards/${d.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      $('result').textContent = 'Name gespeichert.';
      $('result').className = 'result ok';
    });
    row.querySelector('.delete-link').addEventListener('click', async () => {
      if (!confirm(`"${d.name}" wirklich löschen? Alle Inhalte darin gehen verloren.`)) return;
      await fetch(`/api/dashboards/${d.id}/delete`, { method: 'POST' });
      load();
    });
    list.appendChild(row);
  });
}

// --- Aus- und Eingeben -------------------------------------------------------------------------

function dateinameFuer(name) {
  const rein = String(name || 'dashboard').toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (rein || 'dashboard') + '.json';
}

async function exportieren(pfad, name) {
  const el = $('result');
  el.className = 'result';
  el.textContent = 'Exportiere...';
  try {
    const r = await fetch(pfad);
    const data = await r.json();
    if (!data.ok) {
      el.className = 'result err';
      el.textContent = 'Fehler: ' + (data.error || 'unbekannt');
      return;
    }
    // Zwei Leerzeichen Einrueckung: Die Datei soll man lesen und in ein Chatfenster werfen
    // koennen. Kompakt gespeichert waere sie kleiner und unbrauchbar.
    const text = JSON.stringify(data.datei, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = dateinameFuer(name);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);

    el.className = 'result ok';
    // Die Hinweise NICHT verschlucken: Wer eine Foto-Karte exportiert, muss wissen, dass das
    // Bild nicht mitkommt -- sonst entdeckt er es erst auf dem anderen Geraet.
    el.innerHTML = 'Exportiert als <code>' + dateinameFuer(name) + '</code>.'
      + ((data.hinweise && data.hinweise.length)
        ? '<br><br>Nicht mit übertragen:<br>• ' + data.hinweise.join('<br>• ') : '');
  } catch (e) {
    el.className = 'result err';
    el.textContent = 'Fehler: ' + (e.message || e);
  }
}

async function einspielen(text) {
  const el = $('importResult');
  el.className = 'result';
  el.textContent = 'Prüfe...';
  let datei;
  try {
    datei = JSON.parse(text);
  } catch (e) {
    el.className = 'result err';
    el.textContent = 'Das ist kein gültiges JSON: ' + (e.message || e);
    return;
  }
  try {
    const r = await fetch('/api/dashboard-import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datei })
    });
    const data = await r.json();
    if (!data.ok) {
      el.className = 'result err';
      el.innerHTML = 'Nicht eingespielt:<br>• ' + (data.fehler || ['unbekannter Fehler']).join('<br>• ');
      return;
    }
    el.className = 'result ok';
    el.innerHTML = `„${data.name}“ eingespielt, ${data.anzahl} Karte${data.anzahl === 1 ? '' : 'n'}.`
      + ((data.warnungen && data.warnungen.length)
        ? '<br><br>Angepasst:<br>• ' + data.warnungen.join('<br>• ') : '');
    $('importText').value = '';
    load();
  } catch (e) {
    el.className = 'result err';
    el.textContent = 'Fehler: ' + (e.message || e);
  }
}

$('importFileBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', () => {
  const datei = $('importFile').files[0];
  if (!datei) return;
  const leser = new FileReader();
  leser.onload = () => { $('importText').value = leser.result; einspielen(leser.result); };
  leser.readAsText(datei);
  $('importFile').value = '';
});
$('importBtn').addEventListener('click', () => {
  const text = $('importText').value.trim();
  if (!text) {
    $('importResult').className = 'result err';
    $('importResult').textContent = 'Nichts einzuspielen – Datei wählen oder Text einfügen.';
    return;
  }
  einspielen(text);
});

/**
 * Text in die Zwischenablage, so weit der Browser das hergibt.
 *
 * `navigator.clipboard` gibt es NUR im sicheren Kontext -- HTTPS oder localhost. Diese
 * Oberflaeche wird ueber einfaches HTTP im Netzwerk aufgerufen; dort ist die Eigenschaft
 * schlicht undefined, und der Zugriff darauf wirft "Cannot read properties of undefined".
 * Genau das ist passiert. Auf dem Geraet selbst (localhost) haette es funktioniert -- ein
 * Fehler, der sich beim Entwickeln versteckt und erst beim Benutzen zeigt. Nachgemessen ueber
 * die LAN-Adresse: isSecureContext = false, navigator.clipboard = undefined.
 *
 * Der aeltere Weg (`execCommand`) braucht eine frische Benutzergeste. Deshalb wird der Text
 * VORHER geholt und hier nur noch verwendet -- ein `await` zwischen Klick und Kopieren kann
 * die Geste verfallen lassen. Er ist trotzdem nur ein Versuch, kein Verlass.
 */
function inZwischenablage(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true, () => versuchAelterenWeg(text));
  }
  return Promise.resolve(versuchAelterenWeg(text));
}

function versuchAelterenWeg(text) {
  // Das Feld muss WIRKLICH im Dokument stehen und auswaehlbar sein -- display:none laesst
  // sich nicht selektieren.
  const feld = document.createElement('textarea');
  feld.value = text;
  feld.setAttribute('readonly', '');
  feld.style.cssText = 'position:fixed; top:0; left:0; width:1px; height:1px; opacity:0;';
  document.body.appendChild(feld);
  feld.select();
  feld.setSelectionRange(0, text.length);   // iOS ignoriert select() allein
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(feld);
  return ok;
}

// Die Anleitung wird beim Laden geholt, nicht erst beim Klick. Zwei Gruende: Der Kopierversuch
// braucht den Text sofort (siehe oben), und der Knopf antwortet ohne Wartezeit.
let formatText = '';
fetch('/api/dashboard-format')
  .then(r => r.json())
  .then(d => { if (d && d.ok) formatText = JSON.stringify(d.anleitung, null, 2); })
  .catch(() => { /* der Knopf holt sie dann eben doch selbst */ });

// Wer ein Dashboard von Grund auf schreiben lassen will, hat noch keines zum Exportieren --
// und damit auch die Anleitung nicht. Deshalb gibt es sie einzeln.
$('formatBtn').addEventListener('click', async () => {
  const el = $('importResult');
  try {
    if (!formatText) {
      const d = await (await fetch('/api/dashboard-format')).json();
      formatText = JSON.stringify(d.anleitung, null, 2);
    }

    if (await inZwischenablage(formatText)) {
      el.className = 'result ok';
      el.textContent = 'Anleitung kopiert. In einen Chat einfügen und beschreiben, was auf das Dashboard soll.';
      return;
    }

    // Kein Verlass auf die Zwischenablage. Statt einer Fehlermeldung, mit der niemand etwas
    // anfangen kann, zwei Wege, die IMMER funktionieren: der Text zum Selbstkopieren --
    // schon markiert, Strg+C genügt -- und dieselbe Anleitung als Datei zum Anhängen.
    el.className = 'result';
    el.innerHTML = 'Der Browser gibt die Zwischenablage hier nicht frei (die geht nur über '
      + 'HTTPS oder direkt auf dem Gerät). Zwei Wege, die trotzdem gehen:'
      + '<p style="margin:.6rem 0 .3rem;"><strong>1.</strong> Markiert – <kbd>Strg</kbd>+<kbd>C</kbd> drücken:</p>'
      + '<textarea id="formatText" readonly rows="7" style="width:100%; box-sizing:border-box; '
      + 'font-family:ui-monospace,Menlo,Consolas,monospace; font-size:0.75rem;"></textarea>'
      + '<p style="margin:.6rem 0 .3rem;"><strong>2.</strong> Oder als Datei, die sich an einen Chat anhängen lässt:</p>'
      + '<button type="button" id="formatDownload" style="width:auto;">dashboard-format.json herunterladen</button>';

    const feld = document.getElementById('formatText');
    feld.value = formatText;
    feld.focus();
    feld.select();

    document.getElementById('formatDownload').addEventListener('click', () => {
      const blob = new Blob([formatText], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'dashboard-format.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
  } catch (e) {
    el.className = 'result err';
    el.textContent = 'Fehler: ' + (e.message || e);
  }
});

document.querySelectorAll('input[name="newType"]').forEach(r => {
  r.addEventListener('change', () => {
    $('trackerFieldWrap').style.display = document.querySelector('input[name="newType"]:checked').value === 'tracker' ? 'block' : 'none';
  });
});

$('createBtn').addEventListener('click', async () => {
  const name = $('newName').value.trim();
  if (!name) return;
  const type = document.querySelector('input[name="newType"]:checked').value;
  const trackerEntity = $('newTrackerEntity').value.trim();
  if (type === 'tracker' && !trackerEntity) {
    $('result').textContent = 'Bitte eine Tracker-Entität angeben.';
    $('result').className = 'result err';
    return;
  }
  const r = await fetch('/api/dashboards', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type, trackerEntity })
  });
  const data = await r.json();
  if (data.ok) {
    $('newName').value = '';
    $('newTrackerEntity').value = '';
    $('result').textContent = {
      tracker: 'Angelegt – Zeitraum & Details findest du unter "Einrichten".',
      status: 'Angelegt – es gibt nichts einzustellen: Die Seite sucht die überwachten Dienste selbst.'
    }[type] || 'Angelegt – jetzt "Karten bearbeiten" nutzen, um Inhalte hinzuzufügen.';
    $('result').className = 'result ok';
    load();
  } else {
    $('result').textContent = 'Fehler: ' + data.error;
    $('result').className = 'result err';
  }
});

loadTrackerEntities();
load();
