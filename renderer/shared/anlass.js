// Das Anlass-Design: Weihnachten.
//
// Gewünscht: "über Weihnachten, bzw. ab jetzt, ein Weihnachtsdesign. Mit Schnee, mit einem
// Weihnachtsmann oder Nikolaus. Verspielt."
//
// DIE ERSTE FASSUNG WAR ZU ZAGHAFT, und die Rückmeldung dazu ist die Messlatte für alles hier:
// "Das ist mir alles zu einfach und zu minimal gehalten. Du hast da einfach das bestehende
// Design genommen und ein paar Wolken dran gemacht. Ich möchte wirklich was mit viel Farben
// und wirklich Weihnachten." Sie hatte recht: Eine Schicht aus Schnee über denselben
// Glaskarten ist Dekoration, kein Design. Deshalb ist Weihnachten jetzt ein EIGENES Aussehen:
//
//   - Die KARTEN sind bunt: sechs Festfarben mit je einem Muster, weißem Zuckergussrand,
//     gestickter Naht und Schneehaube (dashboard.css). Hier darf Farbe Fläche sein -- die
//     zweite ausdrückliche Ausnahme von ADR 0004 neben der Statusseite, und aus demselben
//     Grund: Die Farbe IST die Aussage.
//   - Oben hängt eine TANNENGIRLANDE mit Lichtern, roten Schleifen und pendelnden Kugeln,
//     Sternen, Glocken und Zuckerstangen.
//   - Unten steht auf dem Bildschirmschoner eine WINTERSZENE: geschmückter Baum, Geschenke,
//     ein Holzschild, der Adventskranz, ein Häuschen mit rauchendem Kamin, ein Schneemann.
//   - Es schneit, der Schlitten fliegt vorbei, und hinter dem Schneehügel schaut jemand hervor.
//
// Vier Dinge darin sind nicht Dekoration, sondern AUSKUNFT (und haben Tests):
//   - Das Holzschild zählt die Tage bis Heiligabend.
//   - Der Adventskranz zeigt, der wievielte Advent ist: so viele Kerzen brennen.
//   - Am 5. und 6. Dezember schaut der NIKOLAUS um die Ecke (Mitra, Stab), sonst der
//     Weihnachtsmann. Das ist bei uns nicht dasselbe.
//   - Rudolfs Nase leuchtet. Das ist keine Auskunft, aber es musste sein.
//
// AB WERK AN, vom 25. November bis zum 6. Januar -- eine Verbesserung, die man erst einschalten
// muss, ist für die meisten keine (siehe CLAUDE.md). Abschalten und "immer an" stehen in den
// Design-Einstellungen.
//
// Dieselbe Regel wie bei der Bühne: Der Zufall läuft NUR BEIM AUFBAU. Jede Flocke und jeder
// Anhänger bekommt einmal Ort, Größe und Takt; danach bewegt der Browser auf der
// Grafikeinheit (transform und opacity), JavaScript rechnet kein einziges Bild. Auf einem
// Surface Go ist das kein theoretischer Einwand.

(function (global) {
  'use strict';

  const FLOCKEN_VORGABE = 60;
  // Die Girlande hängt in so vielen Bögen. Die Zahl steht auch im CSS nirgends ein zweites Mal:
  // Alle Lagen (Schleifen, Lichter, Anhänger) werden hier in Prozent ausgerechnet.
  const BOEGEN = 8;

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

  /**
   * Was auf dem Holzschild steht: zwei Zeilen, { gross, klein }.
   *
   * Bis Heiligabend zählt es die Tage. Gezählt wird in KALENDERTAGEN, nicht in 24-Stunden-
   * Schritten: Am 23. um 23 Uhr ist es "noch 1 Tag", nicht "noch 0".
   */
  function schildText(datum) {
    const d = ALS_DATUM(datum);
    const m = d.getMonth() + 1, t = d.getDate();
    if (m === 1) return { gross: 'Frohes neues Jahr', klein: String(d.getFullYear()) };
    if (m === 12 && t === 31) return { gross: 'Guten Rutsch!', klein: 'Silvester' };
    if (m === 12 && t >= 27) return { gross: 'Frohe Festtage', klein: 'zwischen den Jahren' };
    if (m === 12 && t >= 25) return { gross: 'Frohe Weihnachten', klein: t === 25 ? '1. Weihnachtstag' : '2. Weihnachtstag' };
    if (m === 12 && t === 24) return { gross: 'Heiligabend!', klein: 'Frohe Weihnachten' };
    const heute = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const ziel = new Date(d.getFullYear(), 11, 24);
    const tage = Math.round((ziel - heute) / 86400000);
    return { gross: tage === 1 ? 'Noch 1 Tag' : `Noch ${tage} Tage`, klein: 'bis Heiligabend' };
  }

  /** Alles, was sich über Nacht ändern kann, in einer Zeichenkette -- zum Vergleichen. */
  function anlassZustand(einstellung, datum) {
    const anlass = anlassErmitteln(einstellung, datum);
    if (!anlass) return { anlass: '', advent: 0, figur: '', schild: null, signatur: '' };
    const advent = adventStand(datum), figur = figurFuer(datum), schild = schildText(datum);
    return { anlass, advent, figur, schild, signatur: [anlass, advent, figur, schild.gross, schild.klein].join('|') };
  }

  // --- Der Schnee ---------------------------------------------------------------------------------
  //
  // DREI LAGEN STATT ACHTUNDVIERZIG FLOCKEN. In 1.0.42 war jede Flocke ein eigenes Element mit
  // eigener Animation -- sauber auf der Grafikeinheit, der Hauptstrang lag bei 2,5 %. Aber auf
  // dem Surface Go gemessen kostete allein der COMPOSITOR-Faden 45 % eines Kerns und der
  // Grafikprozess 64 %: Rund zweihundert Ebenen wollen in jedem Bild einzeln fortgeschrieben,
  // sortiert und gezeichnet werden. Was flüssig sein soll, darf nicht viele Ebenen bewegen,
  // sondern wenige.
  //
  // Eine Lage ist ein bildschirmgroßes Bild voller Flocken, zweimal untereinander gekachelt,
  // das einmal um seine Höhe nach unten läuft und nahtlos von vorn beginnt. Drei Lagen in drei
  // Tiefen (fern klein und langsam, nah groß und schnell), jede schwankt dazu langsam seitlich
  // -- das Schwanken liegt auf einem eigenen Element darum, sonst spränge die Lage am Ende der
  // Runde zur Seite. Macht sechs bewegte Ebenen für beliebig viel Schnee.
  //
  // Der Zufall läuft weiter nur beim Aufbau: Wo die Flocken in ihrer Lage sitzen, wird einmal
  // gewürfelt und als Bild (SVG in einer Data-URL) abgelegt.

  const SCHNEE_LAGEN = [
    { tiefe: 0, anteil: 0.5,  rMin: 2,   rMax: 3,   dkMin: 0.5,  dkMax: 0.65, dauer: 30, schwank: 2.2, takt: 17 },
    { tiefe: 1, anteil: 0.32, rMin: 3.5, rMax: 5,   dkMin: 0.7,  dkMax: 0.85, dauer: 19, schwank: 3.4, takt: 13 },
    { tiefe: 2, anteil: 0.18, rMin: 5.5, rMax: 8.5, dkMin: 0.88, dkMax: 1,    dauer: 12, schwank: 5,   takt: 9 }
  ];
  // Das Bild einer Lage misst 1680 x 1000 Einheiten: 1000 sind die Bildschirmhöhe, 1680 die
  // Breite samt dem Rand, um den die Lage seitlich schwankt (112vw).
  const SCHNEE_B = 1680, SCHNEE_H = 1000;

  /**
   * Die Flocken als Daten, je Lage. `zufall` ist austauschbar, damit der Test dieselben Flocken
   * zweimal bekommt. `anzahl` ist die Gesamtzahl über alle drei Lagen.
   */
  function flockenDaten(anzahl, zufall) {
    const r = zufall || Math.random;
    const z = (a, b) => a + r() * (b - a);
    const n = Number(anzahl) > 0 ? Math.round(Number(anzahl)) : FLOCKEN_VORGABE;
    return SCHNEE_LAGEN.map(lage => {
      const stueck = Math.max(1, Math.round(n * lage.anteil));
      const flocken = [];
      for (let i = 0; i < stueck; i++) {
        flocken.push({ x: +z(0, SCHNEE_B).toFixed(0), y: +z(0, SCHNEE_H).toFixed(0),
          r: +z(lage.rMin, lage.rMax).toFixed(1), deckkraft: +z(lage.dkMin, lage.dkMax).toFixed(2) });
      }
      return { tiefe: lage.tiefe, dauer: lage.dauer, schwank: lage.schwank, takt: lage.takt, flocken };
    });
  }

  /** Die drei Schneelagen als HTML. */
  function schneeHtml(anzahl, zufall) {
    return flockenDaten(anzahl, zufall).map(lage => {
      // Eine Flocke am oberen oder unteren Rand wird auf der Gegenseite wiederholt, sonst ist sie
      // an der Naht der Kachel abgeschnitten.
      const kreis = (f, y) => `<circle cx="${f.x}" cy="${y}" r="${f.r}" fill="url(#f)" opacity="${f.deckkraft}"/>`;
      const kreise = lage.flocken.map(f =>
        kreis(f, f.y) + (f.y < f.r ? kreis(f, f.y + SCHNEE_H) : '') + (f.y > SCHNEE_H - f.r ? kreis(f, f.y - SCHNEE_H) : '')).join('');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCHNEE_B} ${SCHNEE_H}" preserveAspectRatio="none">` +
        `<defs><radialGradient id="f"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/>` +
        `<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>${kreise}</svg>`;
      return `<div class="anlass-schwank anlass-bewegt" style="--schwank:${lage.schwank}vw;--takt:${lage.takt}s">` +
        `<div class="anlass-schneelage anlass-bewegt t${lage.tiefe}" data-flocken="${lage.flocken.length}" ` +
        `style="--dauer:${lage.dauer}s;background-image:url('data:image/svg+xml,${encodeURIComponent(svg)}')"></div></div>`;
    }).join('');
  }

  // --- Die Zeichnungen ----------------------------------------------------------------------------
  //
  // Flache, runde Formen ohne Konturen: Sie müssen aus fünf Metern als "Weihnachtsmann" zu
  // lesen sein und dürfen aus der Nähe nicht nach Clipart aussehen.
  //
  // WAS SICH BEWEGT, IST HTML UND LIEGT ÜBER DER ZEICHNUNG -- NIE IN IHR. Das ist die Lehre aus
  // 1.0.41 und der wichtigste Satz dieser Datei. Dort winkte der Handschuh als Gruppe IM SVG,
  // die Baumlichter funkelten als Kreise IM SVG, und jedes dieser SVGs trug einen Schlagschatten
  // (filter). Eine Bewegung in einem SVG rechnet der Browser auf dem Hauptstrang: Er zeichnet
  // für jedes Bild die ganze Zeichnung neu, samt Filter. Auf dem Surface Go gemessen: 198 %
  // eines Kerns und 46 % der Grafikeinheit -- und gemeldet wurde es als Ruckeln. Die Vorgabe
  // dazu ist eindeutig: "Animationen müssen flüssig laufen, ohne Ruckeln, ohne Hängen, ohne
  // langsam zu werden. Auch wenn man den Bildschirm antippt."
  //
  // Deshalb ist jede Zeichnung ein Kasten (.anlass-bild): das STEHENDE SVG und daneben die
  // bewegten Teile (.anlass-teil) als eigene HTML-Elemente, in Prozent des Kastens daraufgelegt.
  // Ein HTML-Element, das nur transform und opacity ändert, bewegt die Grafikeinheit allein --
  // auch während der Hauptstrang gerade Karten neu baut. Ein Test hält fest, dass im ganzen
  // Markup kein `anlass-bewegt` innerhalb eines <svg> steht.

  const ROT = '#d42b3c', ROT_TIEF = '#a81d2c', GOLD = '#f2c14e', HAUT = '#f6c9a8', WEISS = '#ffffff';
  const GRUEN = '#1f8a52', GRUEN_TIEF = '#14633a';
  const pz = (v, von) => (v / von * 100).toFixed(2) + '%';

  /** Ein Kasten: das stehende SVG, dahinter und davor die bewegten Teile. */
  function bild(b, h, zeichnung, davor, dahinter, attr) {
    return `<span class="anlass-bild"${attr || ''}>${dahinter || ''}` +
      `<svg viewBox="0 0 ${b} ${h}" xmlns="http://www.w3.org/2000/svg">${zeichnung}</svg>${davor || ''}</span>`;
  }
  /**
   * Ein bewegtes Teil mit eigener kleiner Zeichnung. b/h: Maße des ganzen Kastens;
   * x/y/w/t: der Ausschnitt, den das Teil einnimmt (zugleich der viewBox seiner Zeichnung);
   * ursprung: Drehpunkt in den Koordinaten des Kastens.
   */
  function teil(klasse, b, h, x, y, w, t, zeichnung, ursprung) {
    const dreh = ursprung ? `;transform-origin:${pz(ursprung[0] - x, w)} ${pz(ursprung[1] - y, t)}` : '';
    return `<i class="anlass-teil anlass-bewegt ${klasse}" style="left:${pz(x, b)};top:${pz(y, h)};width:${pz(w, b)};height:${pz(t, h)}${dreh}">` +
      `<svg viewBox="${x} ${y} ${w} ${t}" xmlns="http://www.w3.org/2000/svg">${zeichnung}</svg></i>`;
  }
  /**
   * Mehrere Dinge als EIN bewegtes Teil: ein kastengroßes Element, das als Ganzes blinkt, mit
   * stehenden Punkten darin. Zehn Baumlichter in vier Gruppen sind vier Ebenen statt zehn.
   */
  function gruppe(klasse, inhalt) {
    return `<i class="anlass-teil anlass-gruppe anlass-bewegt ${klasse}" style="left:0;top:0;width:100%;height:100%">${inhalt}</i>`;
  }
  /** Ein stehender runder Punkt in einer Gruppe. */
  function punkt(b, h, cx, cy, r, farbe) {
    return `<b class="anlass-punkt" style="left:${pz(cx - r, b)};top:${pz(cy - r, h)};width:${pz(2 * r, b)};height:${pz(2 * r, h)};background:${farbe}"></b>`;
  }
  /** Ein bewegter runder Fleck ohne eigene Zeichnung: Licht, Nase, Rauch, Funke. */
  function fleck(klasse, b, h, cx, cy, r, farbe) {
    return `<i class="anlass-teil anlass-fleck anlass-bewegt ${klasse}" style="left:${pz(cx - r, b)};top:${pz(cy - r, h)};` +
      `width:${pz(2 * r, b)};height:${pz(2 * r, h)};background:${farbe}"></i>`;
  }

  const GESICHT =
    `<path d="M30 76 C27 112 46 128 60 128 C74 128 93 112 90 76 C80 90 40 90 30 76Z" fill="${WEISS}"/>` +
    `<ellipse cx="60" cy="72" rx="26" ry="21" fill="${HAUT}"/>` +
    `<circle cx="43" cy="80" r="5.5" fill="#f08f86" opacity=".65"/><circle cx="77" cy="80" r="5.5" fill="#f08f86" opacity=".65"/>` +
    `<circle cx="50" cy="70" r="3.2" fill="#2b2b33"/><circle cx="70" cy="70" r="3.2" fill="#2b2b33"/>` +
    `<circle cx="51.2" cy="68.8" r="1" fill="#fff"/><circle cx="71.2" cy="68.8" r="1" fill="#fff"/>` +
    `<path d="M38 92 C44 80 56 82 60 88 C64 82 76 80 82 92 C74 100 66 98 60 92 C54 98 46 100 38 92Z" fill="${WEISS}"/>` +
    `<circle cx="60" cy="80" r="5.4" fill="#ea8f7d"/>`;

  // Der Weihnachtsmann: Zipfelmütze, deren Bommel zur Seite fällt, und ein Handschuh, der winkt.
  // Der Handschuh ist das bewegte Teil und liegt HINTER dem Kopf.
  const WEIHNACHTSMANN = bild(124, 130,
    `<path d="M30 58 Q38 10 78 13 Q106 17 110 56 L99 55 Q95 33 83 33 Q91 44 91 58Z" fill="${ROT}"/>` +
    `<path d="M83 33 Q91 44 91 58 L80 58 Q84 44 83 33Z" fill="${ROT_TIEF}"/>` +
    `<circle cx="106" cy="60" r="9" fill="${WEISS}"/>` +
    GESICHT +
    `<rect x="24" y="50" width="72" height="16" rx="8" fill="${WEISS}"/>`,
    '',
    teil('anlass-winken', 124, 130, 0, 66, 36, 44,
      `<path d="M4 100 C0 82 8 70 16 72 C24 74 27 86 25 100Z" fill="${ROT}"/>` +
      `<circle cx="27" cy="86" r="6" fill="${ROT}"/><rect x="2" y="97" width="26" height="11" rx="5.5" fill="${WEISS}"/>`,
      [15, 104]));

  // Der Nikolaus: Mitra mit Kreuz und goldenem Band, dazu der Bischofsstab. Kein Bommel.
  const NIKOLAUS = bild(124, 130,
    `<path d="M34 60 L39 28 L60 4 L81 28 L86 60Z" fill="${ROT}"/>` +
    `<path d="M60 4 L81 28 L86 60 L60 60Z" fill="${ROT_TIEF}" opacity=".55"/>` +
    `<path d="M60 16 V46 M49 28 H71" stroke="${GOLD}" stroke-width="4.5" stroke-linecap="round"/>` +
    GESICHT +
    `<rect x="28" y="52" width="64" height="12" rx="6" fill="${GOLD}"/>`,
    '',
    teil('anlass-winken', 124, 130, 6, 24, 34, 106,
      `<path d="M14 128 L14 44 C14 28 34 28 34 42 C34 50 26 52 24 46" fill="none" stroke="${GOLD}" stroke-width="5" stroke-linecap="round"/>`,
      [14, 128]));

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
      `<circle cx="68.5" cy="28" r="2.4" fill="${rudolf ? '#c8102e' : '#3a2a22'}"/>` +
      `</g>`;
  }
  // Rudolfs Nase und der Sternenstaub hinter dem Schlitten sind die bewegten Teile.
  const SCHLITTEN = bild(330, 96,
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
    `<path d="M168 38 Q210 52 244 40 Q270 34 300 36" stroke="${GOLD}" stroke-width="1.4" fill="none" opacity=".85"/>` +
    rentier(180, false) + rentier(250, true),
    fleck('anlass-nase', 330, 96, 318.5, 28, 3.6, '#ff3b30') +
    gruppe('anlass-funke', punkt(330, 96, 14, 46, 2.8, GOLD) + punkt(330, 96, 34, 60, 2.2, GOLD) +
      punkt(330, 96, 52, 40, 3.2, GOLD) + punkt(330, 96, 70, 66, 2, GOLD)));

  // Der Adventskranz: vier Kerzen, so viele brennen, wie Advent ist. Die Flammen sind die
  // bewegten Teile, jede ein eigenes kleines Bild mit dem Drehpunkt am Docht.
  function adventskranzSvg(kerzen) {
    const n = Math.max(0, Math.min(4, Number(kerzen) || 0));
    const plaetze = [[24, 46], [52, 38], [80, 38], [108, 46]];
    let kerzenSvg = '', flammen = '';
    plaetze.forEach(([x, y], i) => {
      kerzenSvg +=
        `<rect x="${x - 6}" y="${y}" width="12" height="${80 - y}" rx="3" fill="${ROT}"/>` +
        `<rect x="${x - 6}" y="${y}" width="5" height="${80 - y}" rx="2.5" fill="#fff" opacity=".18"/>` +
        `<path d="M${x} ${y} v-5" stroke="#3a2a22" stroke-width="1.6" stroke-linecap="round"/>` +
        (i < n ? `<circle cx="${x}" cy="${y - 12}" r="11" fill="${GOLD}" opacity=".22"/>` : '');
      if (i < n) {
        flammen += teil(`anlass-flamme fl${i % 3}`, 132, 108, x - 7, y - 23, 14, 20,
          `<path d="M${x} ${y - 22} C${x + 6} ${y - 14} ${x + 5} ${y - 5} ${x} ${y - 4} C${x - 5} ${y - 5} ${x - 6} ${y - 14} ${x} ${y - 22}Z" fill="${GOLD}"/>` +
          `<path d="M${x} ${y - 14} C${x + 2.6} ${y - 10} ${x + 2} ${y - 6} ${x} ${y - 5.4} C${x - 2} ${y - 6} ${x - 2.6} ${y - 10} ${x} ${y - 14}Z" fill="#fff6d8"/>`,
          [x, y - 4]);
      }
    });
    const beeren = [[18, 86], [40, 96], [66, 90], [92, 97], [116, 87], [54, 82], [80, 83]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="${ROT}"/>`).join('');
    return bild(132, 108,
      `<ellipse cx="66" cy="88" rx="62" ry="18" fill="#1f6b43"/>` +
      kerzenSvg +
      `<path d="M4 88 C10 104 122 104 128 88 C124 100 100 106 66 106 C32 106 8 100 4 88Z" fill="#2f8f5b"/>` +
      `<path d="M8 84 q8 -8 16 0 q8 -8 16 0 q8 -8 16 0 q8 -8 16 0 q8 -8 16 0 q8 -8 16 0 q8 -8 12 0" stroke="#2f8f5b" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>` +
      beeren, flammen, '', ` data-kerzen="${n}"`);
  }

  // Der Tannenbaum: drei Stufen mit Schnee auf den Ästen, bunte Kugeln, ein Stern -- und Lichter,
  // die funkeln. Lichter und Stern sind die bewegten Teile.
  const BAUM_LICHTER = [[50, 34, '#ffd166'], [38, 54, '#ff5a5f'], [63, 58, '#6fb8ff'], [30, 84, '#ffd166'],
    [52, 80, '#ff7bd5'], [72, 88, '#5fd38d'], [22, 114, '#6fb8ff'], [44, 110, '#ff5a5f'], [64, 116, '#ffd166'], [82, 112, '#ff7bd5']];
  const TANNENBAUM = bild(100, 150,
    `<rect x="43" y="124" width="14" height="22" rx="2" fill="#7a4b2a"/>` +
    `<path d="M50 14 L78 62 L66 60 L88 98 L72 95 L96 132 L4 132 L28 95 L12 98 L34 60 L22 62Z" fill="${GRUEN}"/>` +
    `<path d="M50 14 L78 62 L66 60 L88 98 L72 95 L96 132 L50 132Z" fill="${GRUEN_TIEF}" opacity=".55"/>` +
    `<path d="M22 62 Q30 54 34 60 Q42 52 50 58 Q58 52 66 60 Q70 54 78 62 Q66 68 58 62 Q50 70 42 62 Q32 68 22 62Z" fill="#fff" opacity=".92"/>` +
    `<path d="M12 98 Q22 90 28 95 Q38 86 50 94 Q62 86 72 95 Q78 90 88 98 Q74 104 64 98 Q50 106 36 98 Q24 104 12 98Z" fill="#fff" opacity=".92"/>` +
    `<path d="M40 32 Q46 26 50 30 Q54 26 60 32 Q54 36 50 33 Q46 36 40 32Z" fill="#fff" opacity=".92"/>` +
    [[42, 46, ROT], [58, 44, '#3d7df0'], [30, 76, '#b04bd6'], [70, 74, ROT], [50, 68, GOLD], [20, 122, ROT], [38, 124, '#3d7df0'], [58, 126, '#b04bd6'], [78, 124, GOLD]]
      .map(([x, y, f]) => `<circle cx="${x}" cy="${y}" r="4.2" fill="${f}"/><circle cx="${x - 1.3}" cy="${y - 1.4}" r="1.2" fill="#fff" opacity=".7"/>`).join(''),
    [0, 1, 2, 3].map(k => gruppe(`anlass-baumlicht b${k}`,
      BAUM_LICHTER.filter((_, i) => i % 4 === k).map(([x, y, f]) => punkt(100, 150, x, y, 2.8, f)).join(''))).join('') +
    teil('anlass-stern', 100, 150, 35, -1, 30, 28,
      `<path d="M50 0 L53.6 9.4 L63.6 10 L55.8 16.4 L58.4 26 L50 20.6 L41.6 26 L44.2 16.4 L36.4 10 L46.4 9.4Z" fill="${GOLD}"/>`, [50, 13]));

  // Die Geschenke: drei Pakete in drei Farben, jedes mit Band und Schleife. Steht still.
  function paket(x, y, b, h, farbe, band) {
    const mx = x + b / 2;
    return `<rect x="${x}" y="${y}" width="${b}" height="${h}" rx="2.5" fill="${farbe}"/>` +
      `<rect x="${x}" y="${y}" width="${b}" height="${h * 0.22}" rx="2.5" fill="#000" opacity=".12"/>` +
      `<rect x="${mx - 3}" y="${y}" width="6" height="${h}" fill="${band}"/>` +
      `<path d="M${mx} ${y} C${mx - 12} ${y - 14} ${mx - 16} ${y - 2} ${mx} ${y} C${mx + 12} ${y - 14} ${mx + 16} ${y - 2} ${mx} ${y}Z" fill="${band}"/>` +
      `<circle cx="${mx}" cy="${y}" r="2.6" fill="${band}"/>`;
  }
  const GESCHENKE = bild(130, 76,
    paket(46, 24, 44, 50, '#2d6fe0', '#ffd166') + paket(4, 40, 46, 34, ROT, '#ffffff') + paket(84, 44, 42, 30, '#22a565', '#ff7bd5'));

  // Das Häuschen: Schnee auf dem Dach, zwei warme Fenster, ein Kranz an der Tür -- und aus dem
  // Kamin steigt Rauch. Bewegt: der Rauch (hinter dem Haus) und der Schein in den Fenstern.
  // Beide Fenster sind EIN Teil: Sie leuchten im selben Takt, also reicht eine Ebene.
  const fensterBild = (x, y) => `<rect x="${x}" y="${y}" width="18" height="18" rx="1.5" fill="#fff6c4"/><path d="M${x + 9} ${y} v18 M${x} ${y + 9} h18" stroke="#fff" stroke-width="2"/>`;
  const HAUS = bild(140, 112,
    `<rect x="94" y="20" width="18" height="30" fill="#9c4a3a"/><rect x="91" y="16" width="24" height="7" rx="3.5" fill="#fff"/>` +
    `<rect x="20" y="56" width="100" height="54" rx="3" fill="#c96f4e"/>` +
    `<rect x="20" y="56" width="100" height="10" fill="#000" opacity=".12"/>` +
    `<path d="M6 62 L70 14 L134 62 Q124 70 112 60 Q100 70 88 60 Q76 70 64 60 Q52 70 40 60 Q28 70 16 62Z" fill="#fff"/>` +
    `<path d="M70 14 L134 62 Q124 70 112 60 Q100 70 88 60 Q79 68 70 61Z" fill="#cfe0f5" opacity=".7"/>` +
    `<rect x="60" y="74" width="20" height="36" rx="2" fill="#7a3f2c"/><circle cx="76" cy="93" r="1.6" fill="${GOLD}"/>` +
    `<circle cx="70" cy="84" r="5.4" fill="none" stroke="${GRUEN}" stroke-width="3"/><circle cx="70" cy="89.4" r="1.6" fill="${ROT}"/>` +
    [[30, 74], [92, 74]].map(([x, y]) =>
      `<rect x="${x - 3}" y="${y - 3}" width="24" height="24" rx="3" fill="#fff"/>` +
      `<rect x="${x}" y="${y}" width="18" height="18" rx="1.5" fill="#f0b83c"/>` +
      `<path d="M${x + 9} ${y} v18 M${x} ${y + 9} h18" stroke="#fff" stroke-width="2"/>`).join(''),
    teil('anlass-fenster', 140, 112, 30, 74, 80, 18, fensterBild(30, 74) + fensterBild(92, 74)),
    ['r1', 'r2', 'r3'].map(k => fleck('anlass-rauch ' + k, 140, 112, 103, 14, 5.4, '#fff')).join(''));

  // Der Schneemann: Zylinder, Karottennase, roter Schal -- und ein Arm, der winkt (hinter dem
  // Bauch angesetzt).
  const SCHNEEMANN = bild(92, 118,
    `<path d="M26 72 L8 60 M13 63 L6 68" stroke="#6e452d" stroke-width="3" stroke-linecap="round" fill="none"/>` +
    `<circle cx="46" cy="88" r="28" fill="#fff"/><circle cx="46" cy="50" r="19" fill="#fff"/>` +
    `<path d="M46 116 A28 28 0 0 0 74 88 A30 30 0 0 1 30 111 A28 28 0 0 0 46 116Z" fill="#cfe0f5"/>` +
    `<path d="M26 60 Q46 72 66 60 L66 67 Q46 78 26 67Z" fill="${ROT}"/><path d="M58 66 L64 86 L56 86 L54 68Z" fill="${ROT}"/>` +
    `<circle cx="39" cy="45" r="2.6" fill="#2b2b33"/><circle cx="53" cy="45" r="2.6" fill="#2b2b33"/>` +
    `<path d="M46 50 L64 54 L46 56Z" fill="#f08a2e"/>` +
    `<circle cx="38" cy="58" r="1.4" fill="#2b2b33"/><circle cx="43" cy="60.4" r="1.4" fill="#2b2b33"/><circle cx="49" cy="60.4" r="1.4" fill="#2b2b33"/><circle cx="54" cy="58" r="1.4" fill="#2b2b33"/>` +
    `<circle cx="46" cy="80" r="2.6" fill="#2b2b33"/><circle cx="46" cy="92" r="2.6" fill="#2b2b33"/><circle cx="46" cy="104" r="2.6" fill="#2b2b33"/>` +
    `<rect x="26" y="29" width="40" height="6" rx="3" fill="#2b2b33"/><rect x="33" y="8" width="26" height="24" rx="2" fill="#2b2b33"/>` +
    `<rect x="33" y="24" width="26" height="5" fill="${ROT}"/>`,
    '',
    teil('anlass-arm', 92, 118, 62, 44, 30, 30,
      `<path d="M66 70 L86 52 M80 57 L88 60 M80 57 L80 48" stroke="#6e452d" stroke-width="3" stroke-linecap="round" fill="none"/>`, [66, 70]));

  // Rudolf schaut vom Rand herein: Kopf, Geweih -- und die Nase, die leuchtet (bewegtes Teil).
  const RUDOLF = bild(120, 124,
    `<path d="M120 124 L120 60 Q100 50 78 58 L86 124Z" fill="#8a5a3c"/>` +
    `<path d="M70 40 L64 10 M65 24 L52 14 M66 18 L78 6 M86 42 L96 14 M93 24 L106 16" stroke="#c9a27a" stroke-width="5.5" stroke-linecap="round" fill="none"/>` +
    `<path d="M84 44 Q98 30 104 44 Q96 56 84 54Z" fill="#6e452d"/>` +
    `<ellipse cx="58" cy="60" rx="32" ry="23" fill="#8a5a3c"/>` +
    `<ellipse cx="38" cy="68" rx="18" ry="14" fill="#a8744f"/>` +
    `<circle cx="64" cy="52" r="4.6" fill="#2b2b33"/><circle cx="65.6" cy="50.4" r="1.5" fill="#fff"/>` +
    `<path d="M32 78 Q40 84 48 78" stroke="#6e452d" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
    `<circle cx="24" cy="62" r="7.4" fill="#c8102e"/>`,
    fleck('anlass-nase', 120, 124, 24, 62, 8.4, '#ff3b30'));

  // Ein Geschenk am Fallschirm, das vom Himmel schwebt. Steht als Bild still; geschwebt und
  // gependelt wird am Kasten.
  const FALLSCHIRM = bild(90, 120,
    `<path d="M6 44 Q8 6 45 4 Q82 6 84 44 Q72 34 62 44 Q52 34 45 44 Q38 34 28 44 Q18 34 6 44Z" fill="${ROT}"/>` +
    `<path d="M28 44 Q34 14 45 4 Q56 14 62 44 Q52 34 45 44 Q38 34 28 44Z" fill="#fff" opacity=".92"/>` +
    `<path d="M6 44 L36 88 M28 44 L41 88 M45 44 L45 88 M62 44 L49 88 M84 44 L54 88" stroke="#fff" stroke-opacity=".8" stroke-width="1.2" fill="none"/>` +
    paket(27, 90, 36, 28, '#22a565', '#ffd166'));

  const SVG = (vb, inhalt, attr) => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg"${attr || ''}>${inhalt}</svg>`;

  // --- Die Girlande -------------------------------------------------------------------------------
  //
  // Eine Tannengirlande in acht Bögen quer über den oberen Rand. Das Grün ist ein gestrecktes
  // SVG (steht still). Alles, was daran hängt, ist HTML und wird in Prozent darübergelegt:
  // rote Schleifen an den Aufhängepunkten, Lichter auf den Bögen, Anhänger am tiefsten Punkt.
  // HTML und nicht SVG, weil sich Lichter und Anhänger bewegen -- ihre Deckkraft und ihr Pendeln
  // rechnet dann die Grafikeinheit, statt dass der Browser die ganze Girlande neu zeichnet.

  const LICHTER_FARBEN = ['#ff5a5f', '#ffd166', '#5fd38d', '#6fb8ff', '#ff7bd5'];
  // Wie tief der Bogen an der Stelle t (0..1) hängt, als Anteil der Girlandenhöhe.
  const bogenTiefe = (t) => (8 + 88 * t * (1 - t)) / 60;

  const SCHLEIFE = SVG('0 0 60 44',
    `<path d="M30 16 C10 -2 0 8 2 20 C4 30 18 26 30 16Z" fill="${ROT}"/><path d="M30 16 C50 -2 60 8 58 20 C56 30 42 26 30 16Z" fill="${ROT}"/>` +
    `<path d="M30 16 L18 42 L26 38 L30 44 L34 38 L42 42Z" fill="${ROT_TIEF}"/>` +
    `<path d="M30 16 C16 6 8 10 8 18" stroke="#fff" stroke-opacity=".28" stroke-width="2" fill="none"/>` +
    `<circle cx="30" cy="16" r="6" fill="${GOLD}"/>`);

  function kugelSvg(farbe, muster) {
    return SVG('0 0 40 48',
      `<rect x="15" y="2" width="10" height="7" rx="2" fill="${GOLD}"/>` +
      `<circle cx="20" cy="28" r="17" fill="${farbe}"/>` +
      (muster === 'band'
        ? `<path d="M3.6 24 Q20 32 36.4 24 L36.8 30 Q20 38 3.2 30Z" fill="#fff" opacity=".85"/><path d="M6 27.5 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3" stroke="${farbe}" stroke-width="1.4" fill="none"/>`
        : muster === 'sterne'
          ? `<path d="M12 26 l1.6 3.6 l3.6 1.6 l-3.6 1.6 l-1.6 3.6 l-1.6 -3.6 l-3.6 -1.6 l3.6 -1.6Z M27 18 l1.2 2.8 l2.8 1.2 l-2.8 1.2 l-1.2 2.8 l-1.2 -2.8 l-2.8 -1.2 l2.8 -1.2Z" fill="#fff" opacity=".9"/>`
          : `<path d="M4 22 Q20 14 36 22 M3.4 31 Q20 23 36.6 31" stroke="#fff" stroke-opacity=".8" stroke-width="2.4" fill="none"/>`) +
      `<ellipse cx="13.5" cy="20" rx="4.6" ry="6.4" fill="#fff" opacity=".42" transform="rotate(-28 13.5 20)"/>`);
  }
  const STERN = SVG('0 0 44 44',
    `<path d="M22 2 L27.4 15.6 L42 16.6 L30.8 26 L34.4 40.2 L22 32.4 L9.6 40.2 L13.2 26 L2 16.6 L16.6 15.6Z" fill="${GOLD}"/>` +
    `<path d="M22 2 L27.4 15.6 L42 16.6 L30.8 26 L22 22Z" fill="#fff" opacity=".35"/>`);
  const ZUCKERSTANGE = SVG('0 0 34 54',
    `<path d="M12 50 V17 a9 9 0 0 1 18 0 v5" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>` +
    `<path d="M12 50 V17 a9 9 0 0 1 18 0 v5" fill="none" stroke="${ROT}" stroke-width="8" stroke-dasharray="5 6.5"/>`);
  const GLOCKE = SVG('0 0 44 48',
    `<circle cx="22" cy="41" r="4.4" fill="#b9882a"/>` +
    `<path d="M22 6 C10 6 9 20 8 30 C7 34 3 36 3 39 L41 39 C41 36 37 34 36 30 C35 20 34 6 22 6Z" fill="${GOLD}"/>` +
    `<path d="M22 6 C16 6 13 12 12 20 C16 14 20 12 24 12Z" fill="#fff" opacity=".4"/>` +
    `<path d="M22 8 C14 2 9 5 10 9 C11 12 17 11 22 8Z M22 8 C30 2 35 5 34 9 C33 12 27 11 22 8Z" fill="${ROT}"/><circle cx="22" cy="8" r="2.6" fill="${ROT_TIEF}"/>`);

  // Was am tiefsten Punkt jedes Bogens hängt, der Reihe nach. Acht Bögen, acht Anhänger, und
  // keine zwei Nachbarn gleich.
  const ANHAENGER = [
    kugelSvg('#e0263b', 'band'), STERN, kugelSvg('#2d6fe0', 'sterne'), ZUCKERSTANGE,
    kugelSvg('#22a565', 'streifen'), GLOCKE, kugelSvg('#b04bd6', 'band'), kugelSvg('#f08a2e', 'sterne')
  ];

  function girlandeHtml(zufall) {
    const r = zufall || Math.random;
    const z = (a, b) => a + r() * (b - a);
    const b = 100 / BOEGEN;
    let pfad = '';
    for (let i = 0; i < BOEGEN; i++) pfad += `M${i * 100} 8 Q${i * 100 + 50} 52 ${i * 100 + 100} 8 `;
    let html = `<svg class="anlass-gruen" viewBox="0 0 ${BOEGEN * 100} 60" preserveAspectRatio="none" aria-hidden="true">` +
      `<path class="g1" d="${pfad}"/><path class="g2" d="${pfad}"/><path class="g3" d="${pfad}"/><path class="g4" d="${pfad}"/></svg>`;
    // Die Lichter: 32 Birnen, aber nur VIER bewegte Ebenen -- je Takt eine Gruppe, die als
    // Ganzes atmet. Einzeln waeren es 32 Ebenen fuer dasselbe Bild.
    const lichter = ['', '', '', ''];
    for (let i = 0; i < BOEGEN; i++) {
      [0.16, 0.38, 0.62, 0.84].forEach((t, k) => {
        const farbe = LICHTER_FARBEN[(i * 4 + k) % LICHTER_FARBEN.length];
        lichter[(i + k) % 4] += `<span class="anlass-birne" style="left:${((i + t) * b).toFixed(2)}%;` +
          `top:${(bogenTiefe(t) * 100).toFixed(1)}%;--birne:${farbe}"></span>`;
      });
    }
    lichter.forEach((birnen, k) => { html += `<div class="anlass-lichter anlass-bewegt b${k}">${birnen}</div>`; });
    for (let i = 0; i < BOEGEN; i++) {
      // Der Anhänger am tiefsten Punkt: eigene Fadenlänge, eigene Größe, eigener Takt.
      html += `<span class="anlass-haenger anlass-bewegt" style="left:${((i + 0.5) * b).toFixed(2)}%;top:${(bogenTiefe(0.5) * 100).toFixed(1)}%;` +
        `--faden:${z(0.2, 1.2).toFixed(2)}vh;--gr:${z(2.8, 3.5).toFixed(2)}vh;--pd:${z(2.6, 4.4).toFixed(1)}s;--pv:${(-z(0, 4)).toFixed(1)}s">` +
        `<i class="anlass-faden"></i>${ANHAENGER[i % ANHAENGER.length]}</span>`;
    }
    for (let i = 0; i <= BOEGEN; i++) html += `<span class="anlass-schleife" style="left:${(i * b).toFixed(2)}%">${SCHLEIFE}</span>`;
    return html;
  }

  // Die Schneehügel am unteren Rand: zwei Ketten hintereinander.
  const HUEGEL =
    `<svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">` +
    `<path class="wehe-hinten" d="M0 10 V6 Q6 2 13 5 T27 4 T42 6 T58 3 T73 5 T88 3 T100 5 V10Z"/>` +
    `<path class="wehe-vorn" d="M0 10 V7.5 Q8 4 16 6.5 T33 6 T49 7.5 T66 5.5 T82 7 T100 6 V10Z"/></svg>`;

  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // --- Die Auftritte ------------------------------------------------------------------------------
  //
  // Gewünscht: "dass ab und zu, in unregelmäßigen Zeitabschnitten, der Weihnachtsmann da so
  // rumfliegt -- das ist schon witzig", und "vielleicht noch ein paar mehr Animationen". Ein
  // Auftritt ist etwas, das KOMMT UND WIEDER GEHT: der Schlitten, der Weihnachtsmann hinter
  // dem Schnee, Rudolf vom Rand, eine Sternschnuppe, ein Geschenk am Fallschirm.
  //
  // In 1.0.41 lief der Schlitten als Endlosschleife im festen Takt von 150 Sekunden. Jetzt
  // würfelt ein Zeitgeber, WANN der nächste Auftritt ist und WELCHER -- und dazu Höhe, Richtung
  // und Tempo. JavaScript löst nur AUS (eine Klasse setzen); die Bewegung selbst bleibt eine
  // CSS-Animation auf der Grafikeinheit. Zwischen zwei Auftritten rechnet niemand.
  //
  // `gewicht`: wie oft er im Verhältnis drankommt. `ton`: was dazu klingt (siehe tonSpielen).
  //
  // `tonNach`: nach welchem Anteil der Dauer der Ton kommt. DER TON GEHÖRT ZUM AUGENBLICK, NICHT
  // DAVOR. In 1.0.42 klang das Glockenspiel in dem Moment, in dem der Weihnachtsmann unten
  // LOSFUHR -- anderthalb Sekunden, bevor von ihm etwas zu sehen war. Gemeldet wurde das als
  // "Vorwarnung", und genau das war es: ein Signalton, der etwas ankündigt. Gewünscht ist das
  // Gegenteil: "wenn der Weihnachtsmann von unten kommt und winkt, dann kommt ho ho ho". Also
  // erst, wenn er OBEN ist. Und er SAGT es (ton 'hohoho', siehe hohoho()), statt zu klingeln.
  const AUFTRITTE = {
    schlitten:  { gewicht: 4, ton: 'schellen',   tonNach: 0.03 },  // er ist sofort im Bild
    figur:      { gewicht: 3, ton: 'hohoho',     tonNach: 0.2 },   // oben angekommen, winkt
    rudolf:     { gewicht: 2, ton: 'gloeckchen', tonNach: 0.17 },  // der Kopf ist herein
    schnuppe:   { gewicht: 2, ton: '',           tonNach: 0 },     // eine Sternschnuppe ist still
    fallschirm: { gewicht: 2, ton: '',           tonNach: 0 },
    kranz:      { gewicht: 2, ton: '',           tonNach: 0 }
  };

  /**
   * Welcher Auftritt als nächster? Gewichtet gewürfelt, aber nie derselbe zweimal
   * hintereinander -- zweimal der Schlitten wirkt wie ein Hänger, nicht wie Zufall.
   */
  function auftrittWaehlen(namen, zuletzt, zufall) {
    const r = zufall || Math.random;
    let kandidaten = (namen || []).filter(n => AUFTRITTE[n]);
    if (kandidaten.length > 1) kandidaten = kandidaten.filter(n => n !== zuletzt);
    if (!kandidaten.length) return '';
    const summe = kandidaten.reduce((s, n) => s + AUFTRITTE[n].gewicht, 0);
    let wurf = r() * summe;
    for (const n of kandidaten) { wurf -= AUFTRITTE[n].gewicht; if (wurf < 0) return n; }
    return kandidaten[kandidaten.length - 1];
  }

  /**
   * Wie ein Auftritt diesmal aussieht: CSS-Variablen und Klassen, einmal gewürfelt.
   * Reine Funktion (mit austauschbarem Zufall), damit prüfbar ist, dass nichts aus dem Bild
   * fliegt und jede Dauer in ihrem Rahmen bleibt.
   */
  function auftrittWuerfeln(name, szene, zufall) {
    const r = zufall || Math.random;
    const z = (a, b) => a + r() * (b - a);
    const seite = r() < 0.5 ? 'von-links' : 'von-rechts';
    switch (name) {
      case 'schlitten': return { dauer: +z(13, 19).toFixed(1), klassen: [seite], vars: { '--hoehe': z(9, 34).toFixed(1) + 'vh' } };
      case 'figur': return { dauer: +z(9, 13).toFixed(1), klassen: [],
        vars: szene === 'gross' ? {} : { '--x': z(52, 84).toFixed(1) + 'vw' } };
      case 'kranz': return { dauer: +z(11, 15).toFixed(1), klassen: [], vars: { '--x': z(3, 30).toFixed(1) + 'vw' } };
      case 'rudolf': return { dauer: +z(6, 8.5).toFixed(1), klassen: [seite], vars: { '--hoehe': z(24, 62).toFixed(1) + 'vh' } };
      case 'schnuppe': return { dauer: +z(1.1, 1.7).toFixed(2), klassen: [], vars: { '--x': z(38, 92).toFixed(1) + 'vw', '--hoehe': z(8, 34).toFixed(1) + 'vh' } };
      case 'fallschirm': return { dauer: +z(12, 16).toFixed(1), klassen: [], vars: { '--x': z(8, 88).toFixed(1) + 'vw' } };
      default: return { dauer: 10, klassen: [], vars: {} };
    }
  }

  /**
   * Der Zeitgeber einer Schicht. Läuft nur, solange die Schicht zu sehen ist -- starten() und
   * stoppen() ruft, wer das weiß (dashboard.html). Gestoppt hält er KEINEN Zeitgeber.
   *
   * optionen: { szene, ersterMin, ersterMax, warteMin, warteMax (Sekunden), beiAuftritt(name, info) }
   */
  function Auftritte(schicht, optionen) {
    this.schicht = schicht;
    this.opt = Object.assign({ szene: 'klein', ersterMin: 8, ersterMax: 22, warteMin: 45, warteMax: 140 }, optionen || {});
    this.zeitgeber = 0;
    this.tonZeitgeber = 0;
    this.aktiv = false;
    this.zuletzt = '';
  }
  Auftritte.prototype._planen = function (min, max) {
    clearTimeout(this.zeitgeber);
    this.zeitgeber = setTimeout(() => this.auftreten(), (min + Math.random() * (max - min)) * 1000);
  };
  /**
   * Einen Auftritt JETZT auslösen (auch von außen: Probe, Ton-Test). Liefert den Namen.
   * `stumm`: ohne den Ton-Rückruf -- wer von außen auslöst, spielt seinen Ton selbst.
   */
  Auftritte.prototype.auftreten = function (erzwungen, stumm) {
    if (!this.aktiv && !erzwungen) return '';
    const elemente = Array.from(this.schicht.querySelectorAll('[data-auftritt]'));
    const frei = elemente.filter(e => !e.classList.contains('laeuft')).map(e => e.dataset.auftritt);
    const name = erzwungen && typeof erzwungen === 'string' ? erzwungen : auftrittWaehlen(frei, this.zuletzt);
    const el = elemente.find(e => e.dataset.auftritt === name);
    if (el) {
      const w = auftrittWuerfeln(name, this.opt.szene);
      el.classList.remove('laeuft', 'von-links', 'von-rechts');
      Object.keys(w.vars).forEach(k => el.style.setProperty(k, w.vars[k]));
      el.style.setProperty('--dauer', w.dauer + 's');
      w.klassen.forEach(k => el.classList.add(k));
      void el.offsetWidth; // Startzustand übernehmen, sonst beginnt die Animation nicht neu
      el.classList.add('laeuft');
      const fertig = (ev) => {
        if (ev.target !== el) return; // Die Teile darin haben eigene Animationen
        el.removeEventListener('animationend', fertig);
        el.classList.remove('laeuft');
      };
      el.addEventListener('animationend', fertig);
      this.zuletzt = name;
      if (this.opt.beiAuftritt && !stumm && AUFTRITTE[name].ton) {
        // Der Ton kommt, wenn zu sehen ist, was ihn macht -- nicht beim Losfahren.
        const info = { dauer: w.dauer, richtung: w.klassen.includes('von-rechts') ? -1 : 1, ton: AUFTRITTE[name].ton };
        clearTimeout(this.tonZeitgeber);
        this.tonZeitgeber = setTimeout(() => {
          try { this.opt.beiAuftritt(name, info); } catch (e) { /* Ton ist Zugabe */ }
        }, w.dauer * AUFTRITTE[name].tonNach * 1000);
      }
    }
    if (this.aktiv) this._planen(this.opt.warteMin, this.opt.warteMax);
    return name;
  };
  Auftritte.prototype.starten = function () {
    if (this.aktiv) return;
    this.aktiv = true;
    this._planen(this.opt.ersterMin, this.opt.ersterMax);
  };
  Auftritte.prototype.stoppen = function () {
    this.aktiv = false;
    clearTimeout(this.zeitgeber);
    // Auch ein Ton, der noch aussteht: Legt sich der Schoner hin, bevor der Weihnachtsmann oben
    // ist, soll er nicht aus dem Nichts rufen.
    clearTimeout(this.tonZeitgeber);
    this.zeitgeber = 0;
    this.tonZeitgeber = 0;
    this.schicht.querySelectorAll('[data-auftritt].laeuft').forEach(e => e.classList.remove('laeuft'));
  };
  Auftritte.prototype.laeuft = function () { return !!this.aktiv; };

  // --- Die Geräusche ------------------------------------------------------------------------------
  //
  // Gewünscht: "dass ab und zu, wenn der mit seinen Rentieren vorbeifliegt, ein Geräusch
  // macht ... oder wenn er von unten hochkommt" -- abschaltbar, und NUR auf dem eigentlichen
  // Bildschirm: Im Bildschirmschoner bleibt die Wand still und zeigt nur die Bewegung. Die
  // Entscheidung, OB gespielt wird, trifft dashboard.html; hier steht nur, WIE es klingt.
  //
  // Gerechnet, nicht abgespielt -- wie der Akku-Warnton: Eine Tondatei müsste mitgebaut und
  // mitgeliefert werden. Schlittenschellen sind viele kurze, helle, leicht verstimmte
  // Schläge; ein Glockenspiel ist ein Sinus mit einem unharmonischen Oberton, der schnell
  // ausklingt.
  //
  // Jede Funktion plant ihre Stimmen in einen gegebenen Tonkontext und gibt zurück, wie viele
  // es waren -- so lässt sich ohne Lautsprecher prüfen, dass überhaupt etwas geplant wurde und
  // nichts über die Dauer hinausklingt.

  /** Ein Glockenschlag: Grundton plus Obertöne, weich ein, schnell aus. */
  function schlag(ctx, ziel, t, hz, teiltoene, laut, ausklang) {
    let stimmen = 0;
    teiltoene.forEach(([faktor, anteil]) => {
      const ton = ctx.createOscillator();
      const huelle = ctx.createGain();
      ton.type = 'sine';
      ton.frequency.value = hz * faktor;
      huelle.gain.setValueAtTime(0.0001, t);
      huelle.gain.exponentialRampToValueAtTime(Math.max(0.0002, laut * anteil), t + 0.004);
      huelle.gain.exponentialRampToValueAtTime(0.0001, t + ausklang);
      ton.connect(huelle); huelle.connect(ziel);
      ton.start(t); ton.stop(t + ausklang + 0.03);
      stimmen++;
    });
    return stimmen;
  }
  const SCHELLE = [[1, 1], [1.34, 0.7], [1.72, 0.55], [2.31, 0.4]];
  const GLOCKENTON = [[1, 1], [2.76, 0.28], [5.4, 0.12]];

  /**
   * Die Töne. name: 'schellen' | 'glockenspiel' | 'gloeckchen' | 'sternklang'.
   * optionen: { laut (0..1, Vorgabe 0.22), dauer (s, nur Schellen), richtung (1 = nach rechts),
   *             zufall }
   * Liefert { stimmen, ende } -- ende in Sekunden nach "jetzt".
   */
  function tonSpielen(ctx, name, optionen) {
    const o = Object.assign({ laut: 0.22, dauer: 5, richtung: 1 }, optionen || {});
    const r = o.zufall || Math.random;
    const t0 = ctx.currentTime + 0.03;
    const ausgang = ctx.createGain();
    ausgang.gain.value = 1;
    let ziel = ausgang, stimmen = 0, ende = 0;
    ausgang.connect(ctx.destination);

    if (name === 'schellen') {
      // Der Schlitten zieht vorbei: von einer Seite zur anderen, erst leiser, in der Mitte am
      // lautesten, dann wieder weg.
      const dauer = Math.max(2, Math.min(9, o.dauer));
      if (ctx.createStereoPanner) {
        const lage = ctx.createStereoPanner();
        lage.pan.setValueAtTime(-0.85 * o.richtung, t0);
        lage.pan.linearRampToValueAtTime(0.85 * o.richtung, t0 + dauer);
        lage.connect(ctx.destination);
        ausgang.disconnect(); ausgang.connect(lage);
      }
      ausgang.gain.setValueAtTime(0.12, t0);
      ausgang.gain.linearRampToValueAtTime(1, t0 + dauer * 0.5);
      ausgang.gain.linearRampToValueAtTime(0.1, t0 + dauer);
      // Galopp: zwei schnelle Schläge, eine kleine Pause.
      for (let t = 0, i = 0; t < dauer - 0.15; i++) {
        const hz = 2500 + r() * 700;
        stimmen += schlag(ctx, ziel, t0 + t, hz, SCHELLE, o.laut * (i % 2 ? 0.7 : 1), 0.11 + r() * 0.05);
        t += (i % 2 ? 0.2 : 0.13) + r() * 0.02;
      }
      ende = dauer + 0.2;
    } else if (name === 'glockenspiel') {
      // Er taucht auf: vier Töne aufwärts, C-Dur, wie eine Spieluhr.
      [1046.5, 1318.5, 1568, 2093].forEach((hz, i) => { stimmen += schlag(ctx, ziel, t0 + i * 0.13, hz, GLOCKENTON, o.laut * 0.9, 0.75); });
      ende = 3 * 0.13 + 0.8;
    } else if (name === 'gloeckchen') {
      // Rudolf: zwei helle Schläge am Halsband.
      [0, 0.24].forEach((t, i) => { stimmen += schlag(ctx, ziel, t0 + t, 1760, GLOCKENTON, o.laut * (i ? 0.7 : 0.9), 0.5); });
      ende = 0.24 + 0.55;
    } else if (name === 'sternklang') {
      // Die Sternschnuppe: ein kurzes Glitzern abwärts, sehr leise.
      [2637, 2349, 2093, 1760, 1568].forEach((hz, i) => { stimmen += schlag(ctx, ziel, t0 + i * 0.055, hz, GLOCKENTON, o.laut * 0.5, 0.28); });
      ende = 4 * 0.055 + 0.32;
    }
    return { stimmen, ende };
  }

  // --- Ho, ho, ho --------------------------------------------------------------------------------
  //
  // Der Weihnachtsmann SAGT etwas. Ein Ruf lässt sich nicht aus Sinustönen rechnen wie eine
  // Schelle, und eine Tondatei müsste mitgeliefert werden. Windows bringt aber Stimmen mit, und
  // Chromium reicht sie durch (speechSynthesis): Auf dem Panel in Eurasburg ist "Microsoft
  // Stefan" installiert, eine deutsche Männerstimme. Tief und langsam gesprochen ist das ein
  // brauchbares "Ho, ho, ho!" -- kein Schauspieler, aber ein Ruf und kein Klingelton.
  //
  // Gibt es keine Stimme (ein anderes Gerät, ein Browser ohne Sprachausgabe), sagt hohoho()
  // false, und der Aufrufer nimmt das Glockenspiel.

  // Was er ruft. Meist nur das eine -- eine Wand, die jedes Mal einen ganzen Satz sagt, wird
  // am zweiten Tag abgeschaltet.
  const RUFE = ['Ho, ho, ho!', 'Ho, ho, ho!', 'Ho, ho, ho!', 'Ho, ho, ho! Frohe Weihnachten!'];

  /**
   * Die Stimme für den Ruf: eine deutsche Männerstimme, sonst irgendeine deutsche, sonst die
   * erste. Reine Funktion über die Liste, die speechSynthesis.getVoices() liefert.
   */
  function stimmeWaehlen(stimmen) {
    const liste = Array.isArray(stimmen) ? stimmen.filter(Boolean) : [];
    if (!liste.length) return null;
    const deutsch = liste.filter(s => /^de([-_]|$)/i.test(String(s.lang || '')) || /german|deutsch/i.test(String(s.name || '')));
    const mann = /stefan|conrad|killian|bernd|christoph|klaus|ralf|male|m[aä]nn/i;
    return deutsch.find(s => mann.test(String(s.name || ''))) || deutsch[0] || liste.find(s => mann.test(String(s.name || ''))) || liste[0];
  }

  /**
   * "Ho, ho, ho!" sprechen. `synth` ist speechSynthesis, `Aeusserung` der Konstruktor
   * SpeechSynthesisUtterance -- beide hereingereicht, damit es ohne Browser prüfbar bleibt.
   * optionen: { text, laut (0..1), beiEnde(ergebnis) }
   * Liefert true, wenn gesprochen wird; false, wenn es keine Sprachausgabe oder keine Stimme gibt.
   */
  function hohoho(synth, Aeusserung, optionen) {
    const o = optionen || {};
    if (!synth || typeof Aeusserung !== 'function' || typeof synth.speak !== 'function') return false;
    const stimme = stimmeWaehlen(typeof synth.getVoices === 'function' ? synth.getVoices() : []);
    if (!stimme) return false;
    const r = o.zufall || Math.random;
    const a = new Aeusserung(o.text || RUFE[Math.floor(r() * RUFE.length)]);
    a.voice = stimme;
    a.lang = stimme.lang || 'de-DE';
    // Tief und gemächlich: 1 ist die normale Tonhöhe und das normale Tempo.
    a.pitch = 0.2;
    a.rate = 0.8;
    a.volume = o.laut === undefined ? 1 : Math.max(0, Math.min(1, o.laut));
    if (o.beiEnde) {
      a.onend = () => o.beiEnde('gesprochen');
      a.onerror = (ev) => o.beiEnde('fehler: ' + String((ev && ev.error) || 'unbekannt'));
    }
    // Ein Ruf, der noch läuft oder ansteht, wird nicht gestapelt -- sonst ruft er nach einer
    // Pause dreimal hintereinander.
    if (typeof synth.cancel === 'function' && (synth.speaking || synth.pending)) synth.cancel();
    synth.speak(a);
    return true;
  }

  /**
   * Der ganze Inhalt der Schicht als HTML.
   *
   * zustand:  aus anlassZustand()
   * optionen: { flocken, zufall, szene }
   *   szene 'gross' -- der Bildschirmschoner: unten die ganze Winterszene, alles steht da.
   *   szene 'klein' -- das Dashboard (Vorgabe): unten nur der Schnee; der Kranz ist dort ein
   *                    Auftritt. Für eine Szene ist kein Platz -- unten steht der Streifen mit
   *                    der Uhr.
   */
  function schichtHtml(zustand, optionen) {
    if (!zustand || zustand.anlass !== 'weihnachten') return '';
    const opt = optionen || {};
    const gross = opt.szene === 'gross';
    const flocken = schneeHtml(opt.flocken, opt.zufall);
    const figur = zustand.figur === 'nikolaus' ? NIKOLAUS : WEIHNACHTSMANN;
    const schild = zustand.schild || schildText(new Date());
    const kranz = adventskranzSvg(zustand.advent);
    const auftritt = (name, klasse, inhalt, attr) =>
      `<div class="anlass-auftritt anlass-bewegt ${klasse}" data-auftritt="${name}"${attr || ''}>${inhalt}</div>`;
    // Die Auftritte, die überall vorkommen. Jeder steht unsichtbar bereit, bis der Zeitgeber
    // ihm die Klasse `laeuft` gibt.
    const gaeste =
      auftritt('schlitten', 'anlass-schlitten', `<div class="anlass-spiegel"><div class="anlass-wippe anlass-bewegt">${SCHLITTEN}</div></div>`) +
      auftritt('schnuppe', 'anlass-schnuppe', `<i class="anlass-schweif anlass-bewegt"></i>`) +
      auftritt('fallschirm', 'anlass-fallschirm', `<div class="anlass-pendel anlass-bewegt">${FALLSCHIRM}</div>`) +
      auftritt('rudolf', 'anlass-rudolf', `<div class="anlass-spiegel">${RUDOLF}</div>`);
    const figurAuftritt = auftritt('figur', 'anlass-ecke anlass-figur', figur, ` data-figur="${zustand.figur}"`);
    const szene = gross
      ? `<div class="anlass-szene">` +
          `<div class="anlass-ding anlass-baum">${TANNENBAUM}</div>` +
          `<div class="anlass-ding anlass-geschenke">${GESCHENKE}</div>` +
          `<div class="anlass-ding anlass-schild"><b>${esc(schild.gross)}</b><small>${esc(schild.klein)}</small></div>` +
          `<div class="anlass-ding anlass-kranzplatz">${kranz}</div>` +
          `<div class="anlass-ding anlass-haus">${HAUS}</div>` +
          `<div class="anlass-ding anlass-schneemann">${SCHNEEMANN}</div>` +
          figurAuftritt +
          `<div class="anlass-wehe">${HUEGEL}</div>` +
        `</div>`
      : figurAuftritt +
        auftritt('kranz', 'anlass-ecke anlass-kranz', kranz) +
        `<div class="anlass-wehe">${HUEGEL}</div>`;
    return '' +
      `<div class="anlass-girlande">${girlandeHtml(opt.zufall)}</div>` +
      gaeste +
      `<div class="anlass-schnee">${flocken}</div>` +
      szene;
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
    el.classList.toggle('anlass-gross', !!html && !!optionen && optionen.szene === 'gross');
  }

  // Die Farben der Bühne zu Weihnachten: Rot, Gold, Tannengrün, Eisblau und Beerenrosa -- als
  // Ausschnitte des Farbkreises. Die Bühne würfelt bei der Geburt jeder Form einen davon.
  const BUEHNE_TOENE_WEIHNACHTEN = [[348, 366], [38, 50], [128, 152], [205, 225], [305, 328]];

  const api = {
    anlassErmitteln, adventStand, figurFuer, schildText, anlassZustand, flockenDaten, schneeHtml,
    adventskranzSvg, girlandeHtml, schichtHtml, schichtSetzen,
    AUFTRITTE, auftrittWaehlen, auftrittWuerfeln, Auftritte, tonSpielen, hohoho, stimmeWaehlen, RUFE,
    FLOCKEN_VORGABE, BOEGEN, BUEHNE_TOENE_WEIHNACHTEN
  };
  global.AnlassModul = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
