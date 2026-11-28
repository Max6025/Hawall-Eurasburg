# Die Stimme des Weihnachtsmanns

Dreizehn Sprüche als MP3, erzeugt mit ElevenLabs vom Nutzer selbst und am 2026-11-28 geliefert
(im Download-Ordner als `1.mp3` bis `13.mp3`, in dieser Reihenfolge). Beim Übernehmen wurde die
Stille am Anfang abgeschnitten, die Lautstärke angeglichen (die Adventsgrüße waren gut 5 dB
leiser) und auf Mono mit 96 kbit/s gerechnet. Zusammen rund 570 kB.

| Datei | Text bei der Aufnahme |
|---|---|
| `hohoho-1.mp3` | [verspielt] [langsam] Ho, ho, ho! |
| `hohoho-2.mp3` | [lacht] Ho, ho, ho! [lacht leise] |
| `hohoho-weihnachten.mp3` | [verspielt] Ho, ho, ho! [Pause] Frohe Weihnachten! |
| `hohoho-brav.mp3` | [verspielt] Ho, ho, ho! [Pause] Wart ihr auch alle brav? [lacht leise] |
| `schlitten-1.mp3` | [Glockenläuten] [aufgeregt] Ho, ho, ho! Und los geht's! |
| `schlitten-2.mp3` | [aufgeregt] Hüa, Rudolf! [lacht] |
| `nikolaus.mp3` | [sanft] [langsam] Ho, ho, ho! [Pause] Der Nikolaus ist da! |
| `heiligabend.mp3` | [Glockenläuten] [verspielt] Ho, ho, ho! Frohe Weihnachten euch allen! |
| `neujahr.mp3` | [aufgeregt] Frohes neues Jahr! [lacht] |
| `advent-1.mp3` … `advent-4.mp3` | [sanft] Einen schönen ersten … vierten Advent! |

## Die Geräusche

Zwei Soundeffekte, ebenfalls mit ElevenLabs erzeugt und am selben Tag geliefert (`glocen.mp3`
und `recnntiergeräusch-mit-peitschenschlag.mp3`, je acht Sekunden). Beide waren sehr leise
aufgenommen (im Mittel −33 dB).

| Datei | Was | Bearbeitung |
|---|---|---|
| `glocken.mp3` | Schlittengeläut, gleichmäßig über acht Sekunden | +9 dB, blendet am Ende aus |
| `rentier.mp3` | Hufgetrappel mit einem Peitschenknall bei 2,1 s | +14 dB mit Begrenzer (das Getrappel lag 20 dB unter dem Knall), blendet am Ende aus |
| `gloeckchen.mp3` | Rudolfs Halsband | die ersten anderthalb Sekunden des Geläuts |

Sie ersetzen die gerechneten Schellen und Glöckchen. Wie sie zum Schlitten zusammengesetzt
werden — und wann die Stimme einsetzt, damit der Ruf zum Knall passt —, steht in `klangFuer()`.

Welcher Spruch wann fällt, steht in `spruchWaehlen()` in `anlass.js`. Wer eine Datei tauscht,
behält den Namen; wer eine hinzufügt, trägt sie dort in `SPRUECHE` oder `EFFEKTE` ein — ein Test vergleicht
Liste und Ordner in beide Richtungen.

**Nicht angehört:** Die Zuordnung der Nummern zu den Namen folgt der Reihenfolge, die der Nutzer
genannt hat (1 = „Ho, ho, ho!", 13 = vierter Advent). Geprüft sind Format, Dauer und Pegel,
nicht der Wortlaut.
