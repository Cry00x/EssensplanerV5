# Essensplaner (PWA)

Wochenplaner für Mittagessen: 72 Rezepte, automatischer Wochenplan, Einkaufsliste nach Kategorien,
Budgetkontrolle, Favoriten/Bewertungen, eigene Rezepte. Läuft komplett offline, ohne Server-Code,
ohne KI- oder Preis-Schnittstellen.

## Lokal starten (zum Ausprobieren)
    python3 -m http.server 8765        # im Ordner dieser Datei
    # dann http://localhost:8765/ im Browser öffnen

Die Dateien müssen über http(s) ausgeliefert werden (nicht per Doppelklick), sonst sind
Service Worker und Installation nicht möglich.

## Auf dem iPhone installieren
Eine PWA braucht eine öffentliche HTTPS-Adresse. Den ganzen Ordner auf einen statischen Hoster legen
(z. B. GitHub Pages, Netlify oder Cloudflare Pages), dann auf dem iPhone:
1. Die Adresse in **Safari** öffnen.
2. Unten auf **Teilen** (Quadrat mit Pfeil) tippen.
3. **„Zum Home-Bildschirm“** wählen, Namen bestätigen, **Hinzufügen**.
4. Die App über das neue Symbol starten – sie öffnet ohne Browserleisten.
5. Einmal online öffnen, danach funktioniert alles auch offline.

## Tests
    node tests/engine.test.js                       # Budget, Einkaufsliste, Ausschlüsse, Planregeln
    python3 tests/ui.test.py http://localhost:8765/ # Browser-Test inkl. Offline (Playwright)

## Aufbau
    index.html, manifest.webmanifest, sw.js   PWA-Grundlage
    js/data.js      Zutatenkatalog (Preis-Schätzwerte) und Rezepte
    js/engine.js    Planer, Kosten, Einkaufsliste, Tausch, Optimierung
    js/store.js     Speicherung (IndexedDB)
    js/sync.js      optionale Synchronisierung mit eigenem Speicher
    js/familyfb.js  Familienplan (Firebase Auth + Realtime Database);  js/firebase-config.js  Projektkonfiguration
    database.rules.json  Sicherheitsregeln der Datenbank
    js/app.js       Oberfläche;  css/style.css  Design

## Neu in Version 2

- **Echte Rezeptfotos**: Beim ersten Start sucht die App im Browser für jedes Rezept ein frei lizenziertes Foto (Wikimedia Commons, ohne Schlüssel; optional Pexels mit eigenem kostenlosen Schlüssel unter „Mehr → Fotos & Import“). Jeder Treffer wird streng geprüft (JPEG, Mindestgröße, Seitenverhältnis, Lizenz CC0/CC BY/CC BY-SA/gemeinfrei, Titel muss zum Gericht passen). Das Foto wird dauerhaft dem Rezept zugeordnet, vom Service Worker offline vorgehalten und mit Urheber/Lizenz/Link angezeigt. Ähnliche Gerichte sind als „Beispielfoto“ gekennzeichnet. Ohne sicheren Treffer erscheint ein neutraler Platzhalter – nie ein falsches Gericht. Eigene Fotos lassen sich je Rezept hochladen.
- **Planung**: keine doppelten Gerichte pro Woche (auch nicht beim manuellen Tauschen), kürzlich gekochte Gerichte werden gemieden, nur aktive Rezepte werden geplant, einzelne Gerichte tauschen oder die ganze Woche neu würfeln.
- **Rezeptverwaltung**: alle Rezepte (auch mitgelieferte) bearbeiten, löschen, aktivieren/deaktivieren, Küchenrichtung zuordnen, Original wiederherstellen.
- **Import per Link** (schema.org-Daten, z. B. Chefkoch, Lecker, EAT SMARTER, Rezeptwelt): Zutaten → Katalog (laktosefrei ersetzt, unbekannte Zutaten mit Preis 0 €), Umrechnung auf 4 Portionen, Quelle gespeichert, Duplikaterkennung, Originalbild nur mit Opt-in. Fallbacks: Seitenquelltext einfügen oder manuell eingeben. Der Abruf läuft über einen öffentlichen CORS-Proxy (einstellbar).
- **13 Küchen** inkl. Filter in Rezepten und Planung sowie „Überrasch mich international“.
- **Familienplan** (Firebase Authentication + Realtime Database, Rollen Admin/Mitglied/Gast, Einladungslinks, Echtzeit, Vorschläge mit Abstimmung): Einrichtung und Tests siehe **FIREBASE-ANLEITUNG.md**; Regeln in `database.rules.json` (serverseitig erzwungen).

Neue Tests (Server vorher: `python3 -m http.server 8765`): `node tests/importer.test.js`, `node tests/rules.test.js`, `node tests/familyfb.test.js`, `python3 tests/firebase-ui.test.py`, `python3 tests/migration.test.py`. Die Firebase-Tests laufen gegen eine Simulation (`tests/lib/fakefb.js`), nicht gegen echtes Firebase.