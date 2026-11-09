'use strict';

// Der Verlauf direkt von Tractive.
//
// Home Assistant bekommt vom Halsband nur, was Tractive gerade pusht, und fuellt nichts nach:
// Was waehrend eines HA-Neustarts oder im Live-Modus anfiel, fehlt dort. Die Tractive-App
// holt ihren Verlauf dagegen vom Tractive-Server, und dort liegt alles. Dieses Modul tut
// dasselbe -- mit dem Tractive-Login des Nutzers, der nur auf dem Geraet liegt (wie das
// HA-Token, siehe CLAUDE.md zum fehlenden Zugangsschutz).
//
// Tractive hat keine veroeffentlichte Schnittstelle. Pfade und Kopfzeilen stammen aus den
// inoffiziellen Clients aiotractive (Python, von Home Assistant benutzt) und FAXES/tractive
// (Node): Basis https://graph.tractive.com/4/, Anmeldung POST auth/token mit platform_email,
// platform_token, grant_type "tractive"; danach Bearer-Token und x-tractive-user. Der
// Verlauf: GET tracker/{id}/positions?time_from=&time_to=&format=json_segments, Zeiten in
// Unix-Sekunden. Aendert Tractive etwas, bricht das hier -- und die Karte faellt auf den
// Verlauf aus Home Assistant zurueck (siehe dashboard.html).

const BASIS = 'https://graph.tractive.com/4/';
// Die Kennung, mit der sich aiotractive ausweist; ohne sie antwortet Tractive mit 400.
const CLIENT = '625e533dc3c3b41c28a669f0';

function erzeugeTractive(optionen) {
  const o = optionen || {};
  const holen = o.fetch || globalThis.fetch;
  const jetzt = o.jetzt || (() => Date.now());
  let sitzung = null; // { accessToken, userId, expiresAt (Sekunden), email }

  const kopf = (mitSitzung) => {
    const h = {
      'x-tractive-client': CLIENT,
      'content-type': 'application/json;charset=UTF-8',
      accept: 'application/json, text/plain, */*'
    };
    if (mitSitzung && sitzung) {
      h.authorization = 'Bearer ' + sitzung.accessToken;
      h['x-tractive-user'] = sitzung.userId;
    }
    return h;
  };

  async function anfrage(pfad, init) {
    const r = await holen(BASIS + pfad, Object.assign({ headers: kopf(true) }, init || {}));
    if (r.status === 401) { sitzung = null; throw new Error('Tractive: Anmeldung abgelaufen oder ungueltig'); }
    if (!r.ok) throw new Error(`Tractive antwortete mit Status ${r.status}`);
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }

  /** Anmelden. Wirft bei falschen Zugangsdaten. */
  async function anmelden(email, passwort) {
    const r = await holen(BASIS + 'auth/token', {
      method: 'POST',
      headers: kopf(false),
      body: JSON.stringify({ platform_email: email, platform_token: passwort, grant_type: 'tractive' })
    });
    if (r.status === 401 || r.status === 403) throw new Error('Tractive: E-Mail oder Passwort falsch');
    if (!r.ok) throw new Error(`Tractive antwortete bei der Anmeldung mit Status ${r.status}`);
    const d = await r.json();
    if (!d || !d.access_token || !d.user_id) throw new Error('Tractive: unerwartete Antwort bei der Anmeldung');
    sitzung = { accessToken: d.access_token, userId: String(d.user_id), expiresAt: Number(d.expires_at) || 0, email };
    return { userId: sitzung.userId };
  }

  /** Sitzung sicherstellen: neu anmelden, wenn keine da ist oder sie in einer Stunde ablaeuft. */
  async function sicherstellen(email, passwort) {
    const bald = jetzt() / 1000 + 3600;
    if (sitzung && sitzung.email === email && (!sitzung.expiresAt || sitzung.expiresAt > bald)) return;
    await anmelden(email, passwort);
  }

  /** Die Tracker des Kontos, mit dem Namen des Tiers, soweit Tractive ihn hergibt. */
  async function tracker() {
    const liste = (await anfrage(`user/${sitzung.userId}/trackers`)) || [];
    const ergebnis = liste.map(t => ({ id: String(t._id || t.id || ''), name: '' })).filter(t => t.id);
    try {
      const tiere = (await anfrage(`user/${sitzung.userId}/trackable_objects`)) || [];
      for (const tier of tiere) {
        const id = tier && (tier._id || tier.id);
        if (!id) continue;
        const d = await anfrage(`trackable_object/${id}`);
        const geraet = d && (d.device_id || (d.details && d.details.device_id));
        const name = d && (d.name || (d.details && d.details.name));
        const treffer = ergebnis.find(t => t.id === String(geraet || ''));
        if (treffer && name) treffer.name = String(name);
      }
    } catch (e) { /* Der Name ist Beigabe; ohne ihn steht die Kennung da. */ }
    return ergebnis;
  }

  /** Der Verlauf eines Trackers zwischen zwei Zeitpunkten (ISO oder ms), als Punkte. */
  async function verlauf(trackerId, von, bis) {
    const s = (v) => Math.floor(new Date(v).getTime() / 1000);
    const antwort = await anfrage(`tracker/${encodeURIComponent(trackerId)}/positions?time_from=${s(von)}&time_to=${s(bis)}&format=json_segments`);
    return tractivePunkte(antwort);
  }

  return { anmelden, sicherstellen, tracker, verlauf, abmelden: () => { sitzung = null; }, angemeldet: () => !!sitzung };
}

/**
 * Die Antwort von positions?format=json_segments in Punkte { lat, lon, t, sensor } umbauen.
 *
 * Reine Funktion, deshalb pruefbar. Tolerant gegen zwei Formen, weil die Schnittstelle nicht
 * dokumentiert ist: eine Liste von Segmenten (je eine Liste von Punkten) oder eine flache
 * Liste. Ein Punkt traegt `latlong: [lat, lon]` und `time` in Sekunden (Millisekunden werden
 * erkannt); `sensor_used` sagt, ob GPS oder die Ladestation gemeldet hat.
 */
function tractivePunkte(antwort) {
  const flach = [];
  const sammeln = (x) => {
    if (Array.isArray(x)) { x.forEach(sammeln); return; }
    if (x && typeof x === 'object') {
      if (Array.isArray(x.latlong) || (x.latitude !== undefined && x.longitude !== undefined)) flach.push(x);
      else if (Array.isArray(x.points)) x.points.forEach(sammeln);
      else if (Array.isArray(x.positions)) x.positions.forEach(sammeln);
    }
  };
  sammeln(antwort);
  const punkte = [];
  for (const p of flach) {
    const lat = Array.isArray(p.latlong) ? Number(p.latlong[0]) : Number(p.latitude);
    const lon = Array.isArray(p.latlong) ? Number(p.latlong[1]) : Number(p.longitude);
    let zeit = Number(p.time);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(zeit)) continue;
    if (zeit < 1e11) zeit *= 1000; // Sekunden -> Millisekunden
    punkte.push({ lat, lon, t: new Date(zeit).toISOString(), sensor: p.sensor_used ? String(p.sensor_used) : '' });
  }
  punkte.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  return punkte;
}

module.exports = { erzeugeTractive, tractivePunkte, TRACTIVE_CLIENT: CLIENT };
