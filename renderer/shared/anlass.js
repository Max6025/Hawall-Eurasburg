// Das Anlass-Design: Weihnachten.
//
// Gewünscht: "über Weihnachten, bzw. ab jetzt, ein Weihnachtsdesign. Mit Schnee, mit einem
// Weihnachtsmann oder Nikolaus. Verspielt."
//
// Was es ist: eine SCHICHT über Dashboard und Bildschirmschoner, kein drittes Farbschema. Das
// helle und das dunkle Design bleiben, wie sie sind -- darüber liegen Schnee, eine
// Lichterkette, eine Schneewehe am unteren Rand, und ab und zu kommt jemand vorbei. Die Karten
// selbst bekommen nur eine Schneehaube (dashboard.css), ihr Aufbau bleibt unangetastet.
//
// Drei Dinge darin sind nicht Dekoration, sondern AUSKUNFT:
//   - Der Adventskranz zeigt, der wievielte Advent ist: so viele Kerzen brennen.
//   - Am 5. und 6. Dezember schaut der NIKOLAUS um die Ecke (Mitra, Stab), sonst der
//     Weihnachtsmann. Das ist bei uns nicht dasselbe.
//   - Rudolfs Nase leuchtet. Das ist keine Auskunft, aber es musste sein.
//
// AB WERK AN, in der Zeit vom 25. November bis zum 6. Januar -- eine Verbesserung, die man erst
// einschalten muss, ist für die meisten keine (siehe CLAUDE.md). Abschalten und "immer an"
// stehen in den Design-Einstellungen.
//
// Dieselbe Regel wie bei der Bühne: Der Zufall läuft NUR BEIM AUFBAU. Jede Flocke bekommt
// einmal Ort, Größe, Dauer und Drift als CSS-Variable; danach bewegt der Browser auf der
// Grafikeinheit (transform und opacity), JavaScript rechnet kein einziges Bild. Auf einem
// Surface Go ist das kein theoretischer Einwand.

(function (global) {
  'use strict';

  const FLOCKEN_VORGABE = 34;
  // Wer wann vorbeikommt, in Sekunden. Die Zahlen stehen als CSS-Variablen an der Schicht, damit
  // die Probe sie kürzen kann -- zwei Minuten auf einen Schlitten warten will beim Hinsehen
  // niemand.
  const TAKT_SCHLITTEN = 150;
  const TAKT_ECKE = 120;

  const ALS_DATUM = (d) => (d instanceof Date ? d : new Date(d || Date.now()));

  /**
   * Welcher Anlass gilt? '' oder 'weihnachten'.
   *
   * einstellung: 'auto' (Vorgabe) | 'aus' | 'weihnachten' (immer).
   * Automatisch gilt Weihnachten vom 25. November bis einschließlich 6. Januar: Vor dem
   * ersten Advent hängt man die Lichterkette auf, an Dreikönig räumt man ab.
   */
  function anlassErmitteln(einstellung, datum) {
    if (einstellung === 'aus') return '';
    if (einstellung === 'weihnachten') return 'weihnachten';
    const d = ALS_DATUM(datum);
    const m = d.getMonth() + 1, t = d.getDate();
    if ((m === 11 && t >= 25) || m === 12 || (m === 1 && t <= 6)) return 'weihnachten';
    return '';
  }

  /**
   * Wie viele Kerzen brennen: 0 bis 4.
   *
   * Der vierte Advent ist der letzte Sonntag VOR dem ersten Weihnachtstag (fällt der 24. auf
   * einen Sonntag, ist er der vierte Advent). Die anderen liegen je eine Woche davor. Nach
   * Weihnachten brennen alle vier weiter, bis abgeräumt wird.
   */
  function adventStand(datum) {
    const d = ALS_DATUM(datum);
    const heute = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    // Im Januar gehört der Kranz noch zum Advent des Vorjahres.
    const jahr = heute.getMonth() === 0 ? heute.getFullYear() - 1 : heute.getFullYear();
    const heiligabend = new Date(jahr, 11, 24);
    const vierter = new Date(jahr, 11, 24 - heiligabend.getDay()); // getDay(): Sonntag = 0
    let kerzen = 0;
    for (let i = 0; i < 4; i++) {
      const sonntag = new Date(vierter.getFullYear(), vierter.getMonth(), vierter.getDate() - 7 * (3 - i));
      if (heute >= sonntag) kerzen = i + 1;
    }
    return kerzen;
  }

  /** Wer um die Ecke schaut: am 5. und 6. Dezember der Nikolaus, sonst der Weihnachtsmann. */
  function figurFuer(datum) {
    const d = ALS_DATUM(datum);
    return (d.getMonth() === 11 && (d.getDate() === 5 || d.getDate() === 6)) ? 'nikolaus' : 'weihnachtsmann';
  }

  /** Alles, was sich über Nacht ändern kann, in einer Zeichenkette -- zum Vergleichen. */
  function anlassZustand(einstellung, datum) {
    const anlass = anlassErmitteln(einstellung, datum);
    if (!anlass) return { anlass: '', advent: 0, figur: '', signatur: '' };
    const advent = adventStand(datum), figur = figurFuer(datum);
    return { anlass, advent, figur, signatur: [anlass, advent, figur].join('|') };
  }

  /**
   * Die Flocken als Daten. `zufall` ist austauschbar, damit der Test dieselben Flocken zweimal
   * bekommt.
   *
   * Drei Tiefen: Ferne Flocken sind klein, blass und langsam, nahe groß und schnell. Ohne das
   * fällt der Schnee wie ein Vorhang; mit ihm hat das Bild Raum.
   */
  function flockenDaten(anzahl, zufall) {
    const r = zufall || Math.random;
    const z = (a, b) => a + r() * (b - a);
    const n = Number(anzahl) > 0 ? Math.round(Number(anzahl)) : FLOCKEN_VORGABE;
    const flocken = [];
    for (let i = 0; i < n; i++) {
      const tiefe = i % 3; // 0 fern, 1 mittel, 2 nah
      const dauer = [z(22, 30), z(15, 21), z(10, 14)][tiefe];
      flocken.push({
        tiefe,
        links: +z(0, 100).toFixed(1),                       // vw
        groesse: +([z(0.35, 0.55), z(0.6, 0.9), z(1.0, 1.5)][tiefe]).toFixed(2), // vh
        deckkraft: +([z(0.35, 0.5), z(0.55, 0.75), z(0.8, 0.95)][tiefe]).toFixed(2),
        dauer: +dauer.toFixed(1),                            // s
        // Negativ: Der Schnee fällt schon, wenn die Schicht erscheint, statt oben zu starten.
        versatz: +(-z(0, dauer)).toFixed(1),
        drift: +z(-6, 6).toFixed(1)                          // vw, seitliches Treiben
      });
    }
    return flocken;
  }

  // --- Die Zeichnungen ----------------------------------------------------------------------------
  //
  // Flache, runde Formen ohne Konturen: Sie müssen aus fünf Metern als "Weihnachtsmann" zu
  // lesen sein und dürfen aus der Nähe nicht nach Clipart aussehen.

  const ROT = '#d42b3c', ROT_TIEF = '#a81d2c', GOLD = '#f2c14e', HAUT = '#f6c9a8', WEISS = '#ffffff';

  const GESICHT =
    `<path d="M30 76 C27 112 46 128 60 128 C74 128 93 112 90 76 C80 90 40 90 30 76Z" fill="${WEISS}"/>` +
    `<ellipse cx="60" cy="72" rx="26" ry="21" fill="${HAUT}"/>` +
    `<circle cx="43" cy="80" r="5.5" fill="#f08f86" opacity=".65"/><circle cx="77" cy="80" r="5.5" fill="#f08f86" opacity=".65"/>` +
    `<circle cx="50" cy="70" r="3.2" fill="#2b2b33"/><circle cx="70" cy="70" r="3.2" fill="#2b2b33"/>` +
    `<circle cx="51.2" cy="68.8" r="1" fill="#fff"/><circle cx="71.2" cy="68.8" r="1" fill="#fff"/>` +
    `<path d="M38 92 C44 80 56 82 60 88 C64 82 76 80 82 92 C74 100 66 98 60 92 C54 98 46 100 38 92Z" fill="${WEISS}"/>` +
    `<circle cx="60" cy="80" r="5.4" fill="#ea8f7d"/>`;

  // Der Weihnachtsmann: Zipfelmütze, deren Bommel zur Seite fällt, und ein Handschuh, der winkt.
  const WEIHNACHTSMANN =
    `<svg viewBox="0 0 124 130" xmlns="http://www.w3.org/2000/svg">` +
    `<g class="anlass-winken anlass-bewegt"><path d="M4 100 C0 82 8 70 16 72 C24 74 27 86 25 100Z" fill="${ROT}"/>` +
    `<circle cx="27" cy="86" r="6" fill="${ROT}"/><rect x="2" y="97" width="26" height="11" rx="5.5" fill="${WEISS}"/></g>` +
    `<path d="M30 58 Q38 10 78 13 Q106 17 110 56 L99 55 Q95 33 83 33 Q91 44 91 58Z" fill="${ROT}"/>` +
    `<path d="M83 33 Q91 44 91 58 L80 58 Q84 44 83 33Z" fill="${ROT_TIEF}"/>` +
    `<circle cx="106" cy="60" r="9" fill="${WEISS}"/>` +
    GESICHT +
    `<rect x="24" y="50" width="72" height="16" rx="8" fill="${WEISS}"/>` +
    `</svg>`;

  // Der Nikolaus: Mitra mit Kreuz und goldenem Band, dazu der Bischofsstab. Kein Bommel.
  const NIKOLAUS =
    `<svg viewBox="0 0 124 130" xmlns="http://www.w3.org/2000/svg">` +
    `<g class="anlass-winken anlass-bewegt"><path d="M14 128 L14 44 C14 28 34 28 34 42 C34 50 26 52 24 46" fill="none" stroke="${GOLD}" stroke-width="5" stroke-linecap="round"/></g>` +
    `<path d="M34 60 L39 28 L60 4 L81 28 L86 60Z" fill="${ROT}"/>` +
    `<path d="M60 4 L81 28 L86 60 L60 60Z" fill="${ROT_TIEF}" opacity=".55"/>` +
    `<path d="M60 16 V46 M49 28 H71" stroke="${GOLD}" stroke-width="4.5" stroke-linecap="round"/>` +
    GESICHT +
    `<rect x="28" y="52" width="64" height="12" rx="6" fill="${GOLD}"/>` +
    `</svg>`;

  // Der Schlitten: zwei Rentiere im Galopp, vorn Rudolf, dahinter der Schlitten mit Sack.
  function rentier(x, rudolf) {
    const b = '#8a5a3c', d = '#6e452d', g = '#c9a27a';
    return `<g transform="translate(${x} 0)">` +
      `<path d="M14 52 L6 66 M22 54 L20 68 M40 54 L46 67 M48 50 L58 62" stroke="${d}" stroke-width="3.4" stroke-linecap="round"/>` +
      `<ellipse cx="31" cy="44" rx="20" ry="10" fill="${b}"/>` +
      `<path d="M44 40 L54 26 L60 30 L52 46Z" fill="${b}"/>` +
      `<ellipse cx="60" cy="27" rx="8.5" ry="6" fill="${b}"/>` +
      `<path d="M56 21 L53 9 M53 14 L48 10 M53 13 L58 9 M61 21 L64 10 M64 14 L69 11" stroke="${g}" stroke-width="2.2" stroke-linecap="round" fill="none"/>` +
      `<circle cx="62" cy="25.5" r="1.3" fill="#2b2b33"/>` +
      `<circle cx="10" cy="40" r="3.4" fill="${WEISS}"/>` +
      (rudolf
        ? `<circle class="anlass-nase anlass-bewegt" cx="68.5" cy="28" r="3.3" fill="#ff3b30"/>`
        : `<circle cx="68.5" cy="28" r="2.4" fill="#3a2a22"/>`) +
      `</g>`;
  }
  const SCHLITTEN =
    `<svg viewBox="0 0 330 96" xmlns="http://www.w3.org/2000/svg">` +
    // Sternenstaub hinter dem Schlitten
    `<g fill="${GOLD}"><circle class="anlass-funke anlass-bewegt f1" cx="14" cy="46" r="2.6"/>` +
    `<circle class="anlass-funke anlass-bewegt f2" cx="34" cy="60" r="2"/>` +
    `<circle class="anlass-funke anlass-bewegt f3" cx="52" cy="40" r="3"/>` +
    `<circle class="anlass-funke anlass-bewegt f2" cx="70" cy="66" r="1.8"/></g>` +
    // Schlitten
    `<ellipse cx="108" cy="34" rx="15" ry="18" fill="#7a4b2a"/>` +
    `<path d="M98 22 Q108 12 118 22" stroke="${GOLD}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<circle cx="136" cy="30" r="14" fill="${ROT}"/>` +
    `<circle cx="138" cy="13" r="7.5" fill="${HAUT}"/>` +
    `<path d="M131 11 Q134 -3 148 3 L145 12Z" fill="${ROT}"/><circle cx="149" cy="4" r="3" fill="${WEISS}"/>` +
    `<path d="M132 15 Q138 26 146 15 Q140 18 132 15Z" fill="${WEISS}"/>` +
    `<path d="M84 34 Q84 62 106 62 L150 62 Q170 62 170 42 L170 30 Q160 36 150 32 L150 48 L104 48 Q98 48 98 34Z" fill="${ROT}"/>` +
    `<path d="M104 48 L150 48 L150 54 L104 54Z" fill="${ROT_TIEF}"/>` +
    `<path d="M100 62 L98 74 M150 62 L152 74" stroke="${GOLD}" stroke-width="3"/>` +
    `<path d="M78 70 Q74 78 88 78 L166 78 Q180 78 182 66" stroke="${GOLD}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
    // Zügel
    `<path d="M168 38 Q210 52 244 40 Q270 34 300 36" stroke="${GOLD}" stroke-width="1.4" fill="none" opacity=".85"/>` +
    rentier(180, false) + rentier(250, true) +
    `</svg>`;

  // Der Adventskranz: vier Kerzen, so viele brennen, wie Advent ist.
  function adventskranzSvg(kerzen) {
    const n = Math.max(0, Math.min(4, Number(kerzen) || 0));
    const plaetze = [[24, 46], [52, 38], [80, 38], [108, 46]];
    let kerzenSvg = '';
    plaetze.forEach(([x, y], i) => {
      const brennt = i < n;
      kerzenSvg +=
        `<rect x="${x - 6}" y="${y}" width="12" height="${80 - y}" rx="3" fill="${ROT}"/>` +
        `<rect x="${x - 6}" y="${y}" width="5" height="${80 - y}" rx="2.5" fill="#fff" opacity=".18"/>` +
        `<path d="M${x} ${y} v-5" stroke="#3a2a22" stroke-width="1.6" stroke-linecap="round"/>` +
        (brennt
          ? `<circle cx="${x}" cy="${y - 12}" r="11" fill="${GOLD}" opacity=".22"/>` +
            `<path class="anlass-flamme anlass-bewegt fl${i % 3}" d="M${x} ${y - 22} C${x + 6} ${y - 14} ${x + 5} ${y - 5} ${x} ${y - 4} C${x - 5} ${y - 5} ${x - 6} ${y - 14} ${x} ${y - 22}Z" fill="${GOLD}"/>` +
            `<path d="M${x} ${y - 14} C${x + 2.6} ${y - 10} ${x + 2} ${y - 6} ${x} ${y - 5.4} C${x - 2} ${y - 6} ${x - 2.6} ${y - 10} ${x} ${y - 14}Z" fill="#fff6d8"/>`
          : '');
    });
    const beeren = [[18, 86], [40, 96], [66, 90], [92, 97], [116, 87], [54, 82], [80, 83]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="${ROT}"/>`).join('');
    return `<svg viewBox="0 0 132 108" xmlns="http://www.w3.org/2000/svg" data-kerzen="${n}">` +
      `<ellipse cx="66" cy="88" rx="62" ry="18" fill="#1f6b43"/>` +
      kerzenSvg +
      `<path d="M4 88 C10 104 122 104 128 88 C124 100 100 106 66 106 C32 106 8 100 4 88Z" fill="#2f8f5b"/>` +
      `<path d="M8 84 q8 -8 16 0 q8 -8 16 0 q8 -8 16 0 q8 -8 16 0 q8 -8 16 0 q8 -8 16 0 q8 -8 12 0" stroke="#2f8f5b" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>` +
      beeren + `</svg>`;
  }

  // Die Lichterkette: ein durchhängendes Kabel und daran Birnen in vier Farben. Die Birnen sind
  // HTML und kein SVG -- ihre Deckkraft bewegt dann die Grafikeinheit; in einem SVG müsste der
  // Browser für jedes Funkeln die ganze Kette neu zeichnen.
  const LICHTER_FARBEN = ['#ff5a5f', '#ffd166', '#5fd38d', '#6fb8ff'];
  function lichterketteHtml(birnen) {
    const n = Math.max(6, Math.round(Number(birnen) || 22));
    const breite = 100 / n;
    let kabel = 'M0 1';
    for (let i = 0; i < n; i++) kabel += ` q${(breite / 2).toFixed(3)} 9 ${breite.toFixed(3)} 0`;
    let html = `<svg class="anlass-kabel" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">` +
      `<path d="${kabel}" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
    for (let i = 0; i < n; i++) {
      const farbe = LICHTER_FARBEN[i % LICHTER_FARBEN.length];
      html += `<span class="anlass-birne anlass-bewegt b${i % 4}" style="left:${((i + 0.5) * breite).toFixed(2)}%;--birne:${farbe}"></span>`;
    }
    return html;
  }

  // Die Schneewehe am unteren Rand: zwei Hügelketten hintereinander.
  const SCHNEEWEHE =
    `<svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">` +
    `<path class="wehe-hinten" d="M0 10 V6 Q6 2 13 5 T27 4 T42 6 T58 3 T73 5 T88 3 T100 5 V10Z"/>` +
    `<path class="wehe-vorn" d="M0 10 V7.5 Q8 4 16 6.5 T33 6 T49 7.5 T66 5.5 T82 7 T100 6 V10Z"/></svg>`;

  /**
   * Der ganze Inhalt der Schicht als HTML.
   *
   * zustand:  aus anlassZustand()
   * optionen: { flocken, birnen, zufall, mitEcke } -- mitEcke=false lässt Kranz und Figur weg.
   */
  function schichtHtml(zustand, optionen) {
    if (!zustand || zustand.anlass !== 'weihnachten') return '';
    const opt = optionen || {};
    const flocken = flockenDaten(opt.flocken, opt.zufall).map(f =>
      `<span class="anlass-flocke anlass-bewegt t${f.tiefe}" style="left:${f.links}vw;--gr:${f.groesse}vh;--dk:${f.deckkraft};` +
      `--dauer:${f.dauer}s;--versatz:${f.versatz}s;--drift:${f.drift}vw"></span>`).join('');
    const figur = zustand.figur === 'nikolaus' ? NIKOLAUS : WEIHNACHTSMANN;
    return '' +
      `<div class="anlass-lichterkette">${lichterketteHtml(opt.birnen)}</div>` +
      `<div class="anlass-schlitten anlass-bewegt"><div class="anlass-schlitten-wippe anlass-bewegt">${SCHLITTEN}</div></div>` +
      `<div class="anlass-schnee">${flocken}</div>` +
      (opt.mitEcke === false ? '' :
        `<div class="anlass-ecke anlass-figur anlass-bewegt" data-figur="${zustand.figur}">${figur}</div>` +
        `<div class="anlass-ecke anlass-kranz anlass-bewegt">${adventskranzSvg(zustand.advent)}</div>`) +
      `<div class="anlass-wehe">${SCHNEEWEHE}</div>`;
  }

  /**
   * Die Schicht in ein Element legen (oder leeren). Das Element bekommt die Klasse
   * `anlass-schicht`; ohne Anlass bleibt es leer und unsichtbar.
   */
  function schichtSetzen(el, zustand, optionen) {
    if (!el) return;
    el.classList.add('anlass-schicht');
    el.setAttribute('aria-hidden', 'true');
    const html = schichtHtml(zustand, optionen);
    el.innerHTML = html;
    el.classList.toggle('anlass-leer', !html);
    if (html) {
      el.style.setProperty('--anlass-takt-schlitten', TAKT_SCHLITTEN + 's');
      el.style.setProperty('--anlass-takt-ecke', TAKT_ECKE + 's');
    }
  }

  // Die Farben der Bühne zu Weihnachten: Rot, Gold, Tannengrün -- als Ausschnitte des
  // Farbkreises. Die Bühne würfelt bei der Geburt jeder Form einen davon.
  const BUEHNE_TOENE_WEIHNACHTEN = [[348, 366], [38, 50], [128, 152], [352, 364]];

  const api = {
    anlassErmitteln, adventStand, figurFuer, anlassZustand, flockenDaten,
    adventskranzSvg, lichterketteHtml, schichtHtml, schichtSetzen,
    FLOCKEN_VORGABE, TAKT_SCHLITTEN, TAKT_ECKE, BUEHNE_TOENE_WEIHNACHTEN
  };
  global.AnlassModul = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
