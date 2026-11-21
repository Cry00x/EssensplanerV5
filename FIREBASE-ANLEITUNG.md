# Firebase-Familienfunktion – Einrichtung, Veröffentlichung, Test

Stand dieser Lieferung: Alles unten ist umgesetzt, aber **nicht gegen ein echtes Firebase-Projekt getestet** (siehe Abschnitt 7). Plane nach dem Hochladen die Prüfung in Abschnitt 6 ein.

## 0. Was war die Ursache von „Load failed“?
Die alte Familienfunktion sprach eine selbst einzutragende Adresse an, ohne Anmeldung und ohne passende Datenbankregeln. Safari meldet jeden fehlgeschlagenen Netzwerkaufruf nur als „Load failed“. Jetzt gilt: Firebase Authentication + Realtime Database mit serverseitigen Regeln; jeder Fehler wird auf Deutsch erklärt (Netz, Konfiguration, Berechtigung, Domain nicht freigegeben, falsches Passwort usw.).

## 1. Firebase-Konsole (https://console.firebase.google.com) – Projekt „essensplaner-family“
1. **Build → Authentication → Anmeldemethode**: **E-Mail/Passwort** aktivieren (nur den ersten Schalter) und **Google** aktivieren (Support-E-Mail wählen, speichern).
2. **Authentication → Einstellungen → Autorisierte Domains**: **Domain hinzufügen** → `DEIN-GITHUB-NAME.github.io` (nur die Domain, ohne `/essensplaner`). Ohne diesen Eintrag scheitert besonders die Google-Anmeldung („Domain nicht freigegeben“).
3. **Projekteinstellungen (Zahnrad) → Allgemein → Meine Apps → Web-App (`</>`) hinzufügen** (Name z. B. „Essensplaner“, „Firebase Hosting“ NICHT anhaken). Es erscheint ein Block `const firebaseConfig = { apiKey: "AIza…", … }`.
4. **Build → Realtime Database**: Die Datenbank existiert bereits (`https://essensplaner-family-default-rtdb.europe-west1.firebasedatabase.app`). Reiter **Regeln** → den kompletten Inhalt durch die Regeln aus Abschnitt 2 ersetzen → **Veröffentlichen**. Die bisherigen „alles gesperrt“-Regeln sind damit ersetzt; es gibt keine offenen Testregeln.
5. Empfohlen: In der **Google Cloud Console → APIs & Dienste → Anmeldedaten** den „Browser key“ des Projekts öffnen → **Anwendungseinschränkungen: HTTP-Referrer** → `https://DEIN-GITHUB-NAME.github.io/*` eintragen. Der Web-API-Schlüssel ist keine Geheimnis-Zugangsdaten (er identifiziert nur das Projekt), die Einschränkung verhindert Missbrauch durch fremde Seiten.
6. Optional: Authentication → Vorlagen → E-Mail-Vorlagen auf Deutsch stellen (Passwort-Zurücksetzen).

### Konfiguration in die App bringen (zwei Wege, einer genügt)
* **Weg A (empfohlen, einmal für alle Geräte):** `js/firebase-config.js` öffnen und bei `apiKey: ''` den Schlüssel aus Schritt 3 eintragen. Prüfe außerdem `authDomain` und `projectId` gegen den Block aus Schritt 3 (ich habe sie nach dem Standardschema abgeleitet, nicht aus deiner Konsole gelesen). Der apiKey ist absichtlich leer geliefert – ich erfinde keine Werte.
* **Weg B (pro Gerät):** In der App Einstellungen → Familienplan den ganzen `firebaseConfig`-Block einfügen. Er wird nur lokal auf dem Gerät gespeichert.

**Keine privaten Schlüssel ins Repository:** Service-Account-JSON, Admin-SDK-Schlüssel oder Passwörter gehören nie hinein. Diese App braucht sie nicht.

## 2. Sicherheitsregeln (`database.rules.json`, vollständig)
```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "userFamilies": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        "$fid": {
          ".write": "auth != null && (auth.uid === $uid || root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'admin')",
          ".validate": "newData.val() === true"
        }
      }
    },
    "invites": {
      "$code": {
        ".read": "auth != null && $code.matches(/^[A-Za-z0-9_-]{22,64}$/)",
        ".write": "auth != null && $code.matches(/^[A-Za-z0-9_-]{22,64}$/) && ((!data.exists() && newData.child('by').val() === auth.uid && root.child('families').child(newData.child('family').val()).child('members').child(auth.uid).child('role').val() === 'admin') || (data.exists() && !newData.exists() && (root.child('families').child(data.child('family').val()).child('members').child(auth.uid).child('role').val() === 'admin' || root.child('families').child(data.child('family').val()).child('members').child(auth.uid).child('inv').val() === $code)))",
        ".validate": "newData.hasChildren(['family', 'role', 'expires', 'by'])",
        "family": {
          ".validate": "newData.isString() && newData.val().matches(/^[A-Za-z0-9_-]{20,40}$/)"
        },
        "role": {
          ".validate": "newData.val() === 'member' || newData.val() === 'guest'"
        },
        "expires": {
          ".validate": "newData.isNumber() && newData.val() > now && newData.val() <= now + 604800000"
        },
        "by": {
          ".validate": "newData.val() === auth.uid"
        },
        "name": {
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 60"
        },
        "$other": {
          ".validate": false
        }
      }
    },
    "familyAdmin": {
      "$fid": {
        ".read": "auth != null && root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'admin'",
        ".write": "auth != null && root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'admin'",
        "invites": {
          "$code": {
            ".validate": "newData.hasChildren(['role', 'expires'])",
            "role": {
              ".validate": "newData.val() === 'member' || newData.val() === 'guest'"
            },
            "expires": {
              ".validate": "newData.isNumber()"
            },
            "$other": {
              ".validate": false
            }
          }
        },
        "$other": {
          ".validate": false
        }
      }
    },
    "families": {
      "$fid": {
        ".read": "auth != null && root.child('families').child($fid).child('members').child(auth.uid).exists()",
        ".write": "auth != null && $fid.matches(/^[A-Za-z0-9_-]{20,40}$/) && ((!data.exists() && newData.child('meta').child('createdBy').val() === auth.uid && newData.child('meta').child('name').isString() && newData.child('meta').child('createdAt').isNumber() && newData.child('members').numChildren() === 1 && newData.child('members').child(auth.uid).child('role').val() === 'admin' && newData.child('members').child(auth.uid).child('name').isString() && newData.child('plans').val() === null && newData.child('proposals').val() === null) || (data.exists() && !newData.exists() && data.child('members').child(auth.uid).child('role').val() === 'admin'))",
        "meta": {
          ".write": "auth != null && root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'admin'",
          "name": {
            ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 60"
          },
          "budget": {
            ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000"
          },
          "persons": {
            ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 20"
          },
          "createdBy": {
            ".validate": "newData.isString() && newData.val().length <= 128"
          },
          "createdAt": {
            ".validate": "newData.isNumber()"
          },
          "$other": {
            ".validate": false
          }
        },
        "members": {
          "$uid": {
            ".write": "auth != null && ((root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'admin' && ($uid !== auth.uid || newData.child('role').val() === 'admin')) || (auth.uid === $uid && !data.exists() && newData.hasChildren(['name', 'role', 'inv', 'joinedAt']) && root.child('invites').child(newData.child('inv').val()).child('family').val() === $fid && root.child('invites').child(newData.child('inv').val()).child('role').val() === newData.child('role').val() && root.child('invites').child(newData.child('inv').val()).child('expires').val() > now) || (auth.uid === $uid && !newData.exists() && data.child('role').val() !== 'admin'))",
            "name": {
              ".write": "auth != null && auth.uid === $uid",
              ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 40"
            },
            "role": {
              ".validate": "newData.val() === 'admin' || newData.val() === 'member' || newData.val() === 'guest'"
            },
            "inv": {
              ".validate": "newData.isString() && newData.val().matches(/^[A-Za-z0-9_-]{22,64}$/)"
            },
            "joinedAt": {
              ".validate": "newData.isNumber()"
            },
            "diet": {
              ".write": "auth != null && auth.uid === $uid",
              "intol": {
                "$k": {
                  ".validate": "($k === 'laktose' || $k === 'fisch' || $k === 'pilze' || $k === 'kohl') && newData.isBoolean()"
                }
              },
              "allowSpicy": {
                ".validate": "newData.isBoolean()"
              },
              "unwanted": {
                "$i": {
                  ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 40"
                },
                ".validate": "newData.numChildren() <= 20"
              },
              "$other": {
                ".validate": false
              }
            },
            "$other": {
              ".validate": false
            }
          }
        },
        "plans": {
          "$week": {
            ".write": "auth != null && (root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'admin' || root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'member') && $week.matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)",
            "days": {
              ".validate": "newData.numChildren() <= 7",
              "$i": {
                ".validate": "newData.isString() && newData.val().length <= 80"
              }
            },
            "locked": {
              ".validate": "newData.isString() && newData.val().length <= 7"
            },
            "persons": {
              ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 20"
            },
            "updatedAt": {
              ".validate": "newData.isNumber()"
            },
            "by": {
              ".validate": "newData.val() === auth.uid"
            },
            "$other": {
              ".validate": false
            }
          }
        },
        "checks": {
          "$week": {
            "$ing": {
              ".write": "auth != null && (root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'admin' || root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'member') && $week.matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)",
              ".validate": "newData.val() === true && $ing.length <= 100"
            }
          }
        },
        "extras": {
          "$week": {
            ".write": "auth != null && (root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'admin' || root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'member') && $week.matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)",
            ".validate": "newData.numChildren() <= 200",
            "$i": {
              ".validate": "newData.hasChildren(['name', 'done'])",
              "name": {
                ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 100"
              },
              "done": {
                ".validate": "newData.isBoolean()"
              },
              "$other": {
                ".validate": false
              }
            }
          }
        },
        "proposals": {
          "$pid": {
            ".write": "auth != null && (root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'admin' || root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'member') && ((!data.exists() && newData.child('by').val() === auth.uid) || (data.exists() && !newData.exists() && (data.child('by').val() === auth.uid || root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'admin')))",
            ".validate": "newData.hasChildren(['recipe', 'by', 'byName', 'at'])",
            "recipe": {
              ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 80"
            },
            "by": {
              ".validate": "newData.isString()"
            },
            "byName": {
              ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 40"
            },
            "note": {
              ".validate": "newData.isString() && newData.val().length <= 200"
            },
            "at": {
              ".validate": "newData.isNumber()"
            },
            "$other": {
              ".validate": false
            }
          }
        },
        "votes": {
          "$pid": {
            ".write": "auth != null && !newData.exists() && (root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'admin' || root.child('families').child($fid).child('proposals').child($pid).child('by').val() === auth.uid)",
            "$uid": {
              ".write": "auth != null && auth.uid === $uid && (root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'admin' || root.child('families').child($fid).child('members').child(auth.uid).child('role').val() === 'member') && root.child('families').child($fid).child('proposals').child($pid).exists()",
              ".validate": "newData.val() === 'up' || newData.val() === 'down'"
            }
          }
        },
        "$other": {
          ".validate": false
        }
      }
    }
  }
}
```

So werden die Rollen **serverseitig** erzwungen:
* Kein öffentlicher Zugriff: Wurzel `.read/.write = false`; jeder Pfad verlangt `auth != null`.
* Lesen/Schreiben einer Familie nur für Personen, die unter `families/<id>/members/<uid>` stehen.
* Admin: darf Mitglieder verwalten, Rollen ändern, einladen, Familie auflösen und alles bearbeiten.
* Mitglied: Plan, Einkaufsliste/Abhaken, Extras, Vorschläge und Abstimmung (nur die eigene Stimme). Kann weder Rollen ändern noch sich selbst zum Admin machen noch Mitglieder entfernen; verlassen darf es die Familie selbst.
* Gast: nur lesen; kein einziger Schreibpfad.
* Einladungen: 24 zufällige Zeichen, Ablauf ≤ 7 Tage (Standard 48 h), nur Admins dürfen sie anlegen/lesen/widerrufen, Beitritt nur mit gültigem, unabgelaufenem Code und genau der in der Einladung festgelegten Rolle (nie Admin), Code wird nach dem Beitritt gelöscht (einmalig).
* Der Einladungslink enthält nur den Zufallscode, keine Zugangsdaten.

**Cloud Functions sind nicht nötig** (und würden den kostenpflichtigen Blaze-Tarif brauchen). Alle Prüfungen laufen in den Datenbankregeln. Grenze: Die Einmaligkeit der Einladung beruht auf dem Löschen durch den Beitretenden; bei exakt gleichzeitigem Beitritt zweier Personen mit demselben Code ist theoretisch ein Doppelbeitritt möglich (Rolle bleibt trotzdem die der Einladung). Wer das ausschließen will, nutzt kurze Gültigkeit und widerruft Einladungen.

Regeln prüfen: Realtime Database → Regeln → **Regel-Simulator** (z. B. Lesen von `/families/x` ohne Anmeldung muss abgelehnt werden).

## 3. Veröffentlichung auf GitHub Pages
Im Repository (Webseite von github.com, Browser genügt):
1. **Löschen:** `js/family.js`, `tests/family.test.js`, `tests/family-ui.test.py` (Datei öffnen → Papierkorb-Symbol → Commit).
2. **Neu hinzufügen / ersetzen** (Add file → Upload files, Ordnerstruktur beibehalten; am einfachsten ZIP entpacken und alles hochladen, vorhandene Dateien überschreiben):
   `database.rules.json`, `FIREBASE-ANLEITUNG.md`, `README.md`, `index.html`, `sw.js`, `js/familyfb.js`, `js/firebase-config.js` (mit deinem apiKey), `js/features.js`, `js/app.js`, `js/store.js`, `tests/…` (neue/geänderte Testdateien).
3. Commit → warten, bis unter **Actions** der Pages-Lauf grün ist (1–2 Minuten).
4. Auf dem iPhone die App **komplett schließen und neu öffnen** (ggf. zweimal), damit der neue Service Worker (`essensplaner-v3`) aktiv wird. Notfalls: Safari → Einstellungen → Erweitert → Webseitendaten → Seite löschen. Deine Rezepte/Pläne liegen in IndexedDB und bleiben beim normalen Update erhalten; vorsichtshalber vorher in der App eine Sicherung exportieren.

## 4. Nutzung
* Einstellungen → Familienplan → Registrieren (Name, E-Mail, Passwort ≥ 6) oder „Mit Google anmelden“. Die Anmeldung bleibt erhalten; „Abmelden“ beendet sie. „Passwort vergessen?“ sendet eine Firebase-E-Mail.
* „Familie gründen“ → du bist Admin. „✉️ Mitglied einladen“ bzw. „Gast einladen“ erzeugt einen Link (Teilen per Nachricht).
* Eingeladene öffnen den Link, registrieren/melden sich an und treten mit einem Tippen bei. Jedes Mitglied braucht auf seinem Gerät die Konfiguration (Weg A erledigt das für alle automatisch).
* Offline: Zuletzt bekannter Stand bleibt sichtbar und lokal bearbeitbar; Änderungen werden bei Verbindung übertragen, solange die App geöffnet bleibt (siehe Grenzen).
* iPhone: Google-Anmeldung braucht ein Pop-up und klappt in Safari am besten; in der installierten Home-Bildschirm-App ist E-Mail/Passwort zuverlässiger.

## 5. Fehlermeldungen und was sie bedeuten
| Meldung | Ursache / Lösung |
|---|---|
| Keine Verbindung zu Firebase … | Netz, Blocker oder SDK nicht ladbar (www.gstatic.com muss erreichbar sein) |
| Diese Domain ist in Firebase nicht freigegeben | Schritt 1.2 |
| Keine Berechtigung … | Regeln nicht veröffentlicht, nicht Mitglied oder Rolle reicht nicht |
| E-Mail oder Passwort ist falsch / Konto existiert schon / Passwort zu schwach | Eingabe prüfen |
| Konfiguration unvollständig (API-Schlüssel fehlt …) | Abschnitt 1, Weg A/B |
| Einladung ungültig/abgelaufen | Neue Einladung erzeugen |

## 6. Test mit mehreren Familienmitgliedern (echt, ca. 15 Minuten)
Benötigt: 3 Geräte oder Browser-Profile (Admin, Mitglied, Gast) mit verschiedenen E-Mail-Adressen.
1. **Admin:** registrieren → Familie gründen. In der Firebase-Konsole unter Realtime Database sollte `families/…` mit dir als `admin` erscheinen.
2. **Admin:** Mitglieds-Einladung erzeugen, Link an Gerät 2 schicken; Gast-Einladung an Gerät 3.
3. **Gerät 2:** Link öffnen → registrieren → Beitreten. Rolle „Mitglied“, Plan des Admins sichtbar.
4. **Gerät 3:** dito → Rolle „Gast“; „Plan erzeugen“ und Abhaken müssen abgelehnt werden.
5. **Echtzeit:** Admin erzeugt Plan → erscheint in Sekunden bei 2 und 3. Gerät 2 hakt Artikel ab → erscheint beim Admin. Admin ändert Budget → bei allen neu.
6. **Rechte:** Gerät 2 versucht Budget zu ändern → abgelehnt; Admin-Knöpfe fehlen. Admin ändert Rolle von Gerät 3 auf „Mitglied“ → Gerät 3 kann nun bearbeiten.
7. **Vorschlag/Abstimmung:** Gerät 2 schlägt ein Gericht vor, alle stimmen, Admin übernimmt.
8. **Einladung:** Denselben Link nochmals benutzen → muss „ungültig“ melden. Abgelaufene/widerrufene Einladung ebenso.
9. **Zugriffsschutz (Regel-Simulator oder Abmelden):** Abgemeldet darf nichts aus `/families` lesbar sein; ein fremdes Konto, das nicht Mitglied ist, bekommt „Keine Berechtigung“.
10. **Abmelden/Anmelden:** App schließen, neu öffnen → bleibt angemeldet. Abmelden → Familiendaten nicht mehr sichtbar, lokale Rezepte/Pläne unverändert.

## 7. Was getestet wurde – und was NICHT
**Durchgeführt (alles in einer Simulation, `tests/lib/fakefb.js`, die Firebase-Auth, Datenbank und die Regeln nachbildet – kein echtes Firebase, kein Internet):**
* `node tests/rules.test.js` – 80 Prüfungen der Regeln gegen den Regel-Interpreter (Anlegen, Lesen, Einladungen, Beitritt, Rollen, Plan/Liste/Budget, Vorschläge, Entfernen, Standard-Verbot, Angriffsversuche).
* `node tests/familyfb.test.js` – 77 Prüfungen der App-Logik gegen die Simulation (Registrierung, Login, Google (simuliert), Passwort-Reset, Familie, Einladungen, Echtzeit, Rollen, Offline, Neustart, Abmelden).
* `python3 tests/firebase-ui.test.py` – 26 Prüfungen im Browser (Chromium, iPhone-Format) mit drei simulierten Geräten.
* Regression: `engine` 1057, `images` 118, `importer` 41, `ui` 72, `migration` 7 – alle bestanden.

**NICHT durchgeführt (brauchen echte Zugangsdaten bzw. Internet):**
* echte Registrierung, echter Login, echte Google-Anmeldung, echte Passwort-E-Mail
* Laden des Firebase-SDK von gstatic.com
* Veröffentlichen und Wirkung der Regeln auf dem echten Server (die Regeln wurden von mir nur im Simulator geprüft; Mehrpfad-Updates und Regelauswertung beruhen auf der Dokumentation)
* echte Echtzeit-Synchronisierung zwischen Geräten, echte gemeinsame Liste/Budget, echter Zugriffsschutz
* iPhone-Gerätetest (Safari, Home-Bildschirm-App)

## 8. Bekannte Grenzen
* Änderungen, die offline gemacht und danach die App geschlossen wird, werden nicht nachgesendet.
* Google-Popup in der installierten iPhone-App kann scheitern; Redirect-Fallback ist eingebaut, aber ungetestet.
* Bei Bedarf Gäste per Rolle auf „Mitglied“ anheben (Admin).
