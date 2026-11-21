/* Firebase-Web-Konfiguration für den Familienplan.
 *
 * Diese Werte sind KEINE Geheimnisse (sie stehen in jeder Firebase-Web-App im Klartext). Geschützt wird der Zugriff durch
 * Firebase Authentication, die Datenbankregeln (database.rules.json) und die Liste „Autorisierte Domains“.
 * NICHT hier eintragen: Dienstkonto-Schlüssel, Admin-SDK-Schlüssel, Datenbank-Secrets – die gehören nie in ein öffentliches Repository.
 *
 * databaseURL stammt aus deiner Angabe. authDomain und projectId folgen Firebases Standard-Benennung für dieses Projekt
 * (essensplaner-family) – bitte in der Firebase-Konsole prüfen (Projekteinstellungen → Allgemein → Meine Apps).
 * apiKey fehlt absichtlich: Ich kenne ihn nicht und erfinde ihn nicht. Trage ihn hier ein ODER füge den kompletten
 * firebaseConfig-Block in der App ein (Mehr → Familienplan), dann wird er nur auf deinem Gerät gespeichert. */
window.FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: 'essensplaner-family.firebaseapp.com',
  databaseURL: 'https://essensplaner-family-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'essensplaner-family'
};
