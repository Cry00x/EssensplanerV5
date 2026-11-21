/* Prüft database.rules.json gegen den REGEL-SIMULATOR (tests/lib/fakefb.js) – nicht gegen echtes Firebase.
 * Ausführen: node tests/rules.test.js */
'use strict';
const fs = require('fs'); const FF = require('./lib/fakefb.js');
const rules = JSON.parse(fs.readFileSync(__dirname + '/../database.rules.json', 'utf8'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗', m); } };
let T = 1700000000000; const S = FF.makeServer(rules, { now: () => T });
const mk = uid => ({ currentUser: { uid, email: uid + '@x.de' } });
const A = mk('anna'), B = mk('ben'), C = mk('cleo'), X = mk('fremd'), NOBODY = { currentUser: null };
const FID = 'fam_ABCDEFGHIJKLMNOPQRST', FID2 = 'fam_ZZZZZZZZZZZZZZZZZZZZ';
const can = (s, upd) => { try { S.write(s, upd); return true; } catch (e) { if (e.code !== 'PERMISSION_DENIED') throw e; return false; } };
const canRead = (s, p) => S.engine.canRead(S.db, p, s.currentUser);
const INV1 = 'inv1_aaaaaaaaaaaaaaaaaaaaaa', INV2 = 'inv2_bbbbbbbbbbbbbbbbbbbbbb', INV3 = 'inv3_cccccccccccccccccccccc';
const week = '2026-11-16';

console.log('\nFamilie anlegen');
ok(!can(NOBODY, { ['families/' + FID]: { meta: { name: 'F', createdBy: 'anna', createdAt: T }, members: { anna: { name: 'Anna', role: 'admin' } } } }), 'ohne Anmeldung nicht möglich');
ok(!can(A, { ['families/' + FID]: { meta: { name: 'F', createdBy: 'ben', createdAt: T }, members: { anna: { name: 'Anna', role: 'admin' } } } }), 'createdBy muss die eigene Kennung sein');
ok(!can(A, { ['families/' + FID]: { meta: { name: 'F', createdBy: 'anna', createdAt: T }, members: { anna: { name: 'Anna', role: 'member' } } } }), 'Ersteller muss Admin sein');
ok(!can(A, { ['families/' + FID]: { meta: { name: 'F', createdBy: 'anna', createdAt: T }, members: { anna: { name: 'Anna', role: 'admin' }, ben: { name: 'Ben', role: 'admin' } } } }), 'nicht gleich mehrere Admins anlegen');
ok(!can(A, { ['families/kurz']: { meta: { name: 'F', createdBy: 'anna', createdAt: T }, members: { anna: { name: 'Anna', role: 'admin' } } } }), 'ungültige Familien-ID');
ok(!can(A, { ['families/' + FID]: { meta: { name: 'F', createdBy: 'anna', createdAt: T, evil: 1 }, members: { anna: { name: 'Anna', role: 'admin' } } } }), 'unbekannte Felder abgelehnt');
ok(!can(A, { ['families/' + FID]: { meta: { name: 'F', createdBy: 'anna', createdAt: T, budget: 99999 }, members: { anna: { name: 'Anna', role: 'admin' } } } }), 'Budget außerhalb des Bereichs');
ok(can(A, { ['families/' + FID]: { meta: { name: 'Familie Müller', createdBy: 'anna', createdAt: T, budget: 120, persons: 4 }, members: { anna: { name: 'Anna', role: 'admin', joinedAt: T } } }, ['userFamilies/anna/' + FID]: true }), 'Familie anlegen (gültig)');
ok(!can(X, { ['families/' + FID]: { meta: { name: 'Übernahme', createdBy: 'fremd', createdAt: T }, members: { fremd: { name: 'X', role: 'admin' } } } }), 'bestehende Familie nicht überschreibbar');

console.log('\nLesen');
ok(canRead(A, 'families/' + FID) && canRead(A, 'families/' + FID + '/meta'), 'Mitglied liest');
ok(!canRead(X, 'families/' + FID) && !canRead(X, 'families/' + FID + '/members') && !canRead(NOBODY, 'families/' + FID), 'Fremde und Abgemeldete lesen nicht');
ok(!canRead(A, 'families') && !canRead(A, '') && !canRead(A, 'invites') && !canRead(A, 'userFamilies'), 'keine Listen/Wurzel lesbar');
ok(canRead(A, 'userFamilies/anna') && !canRead(B, 'userFamilies/anna'), 'Zuordnung nur für sich selbst lesbar');
ok(!can(X, { ['userFamilies/anna/' + FID]: true }) && can(X, { ['userFamilies/fremd/' + FID]: true }) && can(X, { ['userFamilies/fremd/' + FID]: null }), 'Zuordnung nur für sich selbst schreibbar (und harmlos)');

console.log('\nEinladungen');
const inv = (code, o) => ({ ['invites/' + code]: Object.assign({ family: FID, role: 'member', expires: T + 48 * 3600e3, by: 'anna', name: 'Familie Müller' }, o || {}) });
ok(!can(X, inv(INV1, { by: 'fremd' })), 'Fremde können keine Einladung für fremde Familie erzeugen');
ok(!can(A, inv('kurz')), 'Code zu kurz');
ok(!can(A, inv(INV1, { role: 'admin' })), 'Admin-Einladung nicht möglich');
ok(!can(A, inv(INV1, { expires: T - 1 })), 'abgelaufenes Ablaufdatum abgelehnt');
ok(!can(A, inv(INV1, { expires: T + 8 * 24 * 3600e3 })), 'Ablauf > 7 Tage abgelehnt');
ok(!can(A, inv(INV1, { by: 'ben' })), 'Absender muss man selbst sein');
ok(can(A, inv(INV1)) && can(A, inv(INV2, { role: 'guest' })) && can(A, inv(INV3, { expires: T + 1000 })), 'Admin erzeugt Einladungen');
ok(can(A, { ['familyAdmin/' + FID + '/invites/' + INV1]: { role: 'member', expires: T + 1 } }), 'Admin-Index schreibbar');
ok(!canRead(X, 'familyAdmin/' + FID) && canRead(A, 'familyAdmin/' + FID), 'Admin-Index nur für Admin lesbar');
ok(canRead(X, 'invites/' + INV1) && !canRead(X, 'invites'), 'Einladung nur mit Code lesbar, nicht auflistbar');
ok(!canRead(NOBODY, 'invites/' + INV1), 'Einladung nur angemeldet lesbar');

console.log('\nBeitritt');
const join = (s, uid, code, role, extra) => ({ ['families/' + FID + '/members/' + uid]: Object.assign({ name: uid, role, inv: code, joinedAt: T }, extra || {}), ['userFamilies/' + uid + '/' + FID]: true });
ok(!can(B, join('ben', 'ben', 'gibtsnicht_aaaaaaaaaaaaaaaa', 'member')), 'Beitritt ohne gültige Einladung');
ok(!can(B, join('ben', 'ben', INV1, 'admin')), 'Beitritt mit Wunschrolle Admin abgelehnt');
ok(!can(B, join('ben', 'ben', INV2, 'member')), 'Rolle muss zur Einladung passen (Gast-Einladung ≠ Mitglied)');
ok(!can(B, join('cleo', 'cleo', INV1, 'member')), 'nicht für andere beitreten');
ok(!can(B, { ['families/' + FID + '/members/ben']: { name: 'Ben', role: 'member', joinedAt: T } }), 'ohne Einladungscode nicht möglich');
T += 2000; ok(!can(B, join('ben', 'ben', INV3, 'member')), 'abgelaufene Einladung abgelehnt'); T -= 2000;
ok(can(B, join('ben', 'ben', INV1, 'member')), 'Ben tritt als Mitglied bei');
ok(can(B, { ['invites/' + INV1]: null }), 'Ben löscht die verbrauchte Einladung (einmalig)');
ok(!can(X, { ['invites/' + INV2]: null }), 'Fremde können Einladungen nicht löschen');
ok(can(C, join('cleo', 'cleo', INV2, 'guest')) && can(C, { ['invites/' + INV2]: null }), 'Cleo tritt als Gast bei');
ok(!can(X, join('fremd', 'fremd', INV1, 'member')), 'verbrauchte Einladung funktioniert nicht mehr');
ok(S.db.families[FID].members.ben.role === 'member' && S.db.families[FID].members.cleo.role === 'guest', 'Rollen wie eingeladen');

console.log('\nRollen verwalten');
ok(!can(B, { ['families/' + FID + '/members/ben/role']: 'admin' }), 'Mitglied kann sich nicht zum Admin machen');
ok(!can(B, { ['families/' + FID + '/members/cleo/role']: 'member' }), 'Mitglied kann Rollen anderer nicht ändern');
ok(!can(B, { ['families/' + FID + '/members/ben']: { name: 'Ben', role: 'admin', inv: INV1, joinedAt: T } }), 'Mitglied kann seinen Eintrag nicht neu schreiben');
ok(!can(C, { ['families/' + FID + '/members/cleo/role']: 'admin' }), 'Gast kann sich nicht zum Admin machen');
ok(can(B, { ['families/' + FID + '/members/ben/name']: 'Benjamin' }) && S.db.families[FID].members.ben.name === 'Benjamin', 'eigenen Namen ändern');
ok(!can(B, { ['families/' + FID + '/members/cleo/name']: 'Hacker' }), 'fremden Namen nicht ändern');
ok(can(B, { ['families/' + FID + '/members/ben/diet']: { intol: { fisch: true }, allowSpicy: false, unwanted: ['Oliven'] } }), 'eigenes Ernährungsprofil');
ok(!can(B, { ['families/' + FID + '/members/ben/diet']: { intol: { evil: true } } }) && !can(B, { ['families/' + FID + '/members/cleo/diet']: { allowSpicy: false } }), 'ungültiges/fremdes Profil abgelehnt');
ok(!can(A, { ['families/' + FID + '/members/anna/role']: 'member' }) && !can(A, { ['families/' + FID + '/members/anna']: null }), 'letzter Admin kann sich nicht degradieren oder entfernen');
ok(can(A, { ['families/' + FID + '/members/cleo/role']: 'member' }) && can(A, { ['families/' + FID + '/members/cleo/role']: 'guest' }), 'Admin ändert Rollen');
ok(!can(A, { ['families/' + FID + '/members/cleo/role']: 'chef' }), 'ungültige Rolle');

console.log('\nPlan, Einkaufsliste, Budget');
const plan = { days: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], locked: '0000000', persons: 4, updatedAt: T, by: 'ben' };
ok(can(B, { ['families/' + FID + '/plans/' + week]: plan }) && can(A, { ['families/' + FID + '/plans/' + week]: Object.assign({}, plan, { by: 'anna' }) }), 'Mitglied und Admin bearbeiten den Plan');
ok(!can(C, { ['families/' + FID + '/plans/' + week]: plan }), 'Gast kann den Plan nicht ändern');
ok(!can(X, { ['families/' + FID + '/plans/' + week]: plan }) && !can(NOBODY, { ['families/' + FID + '/plans/' + week]: plan }), 'Fremde/Abgemeldete können den Plan nicht ändern');
ok(!can(B, { ['families/' + FID + '/plans/' + week]: Object.assign({}, plan, { by: 'anna' }) }), '„by“ lässt sich nicht fälschen');
ok(!can(B, { ['families/' + FID + '/plans/morgen']: plan }), 'ungültiger Wochenschlüssel');
ok(!can(B, { ['families/' + FID + '/plans/' + week]: Object.assign({}, plan, { days: [1, 2, 3, 4, 5, 6, 7, 8] }) }), 'mehr als 7 Tage abgelehnt');
ok(can(B, { ['families/' + FID + '/checks/' + week + '/hack']: true }) && can(B, { ['families/' + FID + '/checks/' + week + '/hack']: null }), 'Mitglied hakt ab / entfernt Haken');
ok(!can(C, { ['families/' + FID + '/checks/' + week + '/hack']: true }) && !can(B, { ['families/' + FID + '/checks/' + week + '/hack']: 'ja' }), 'Gast kann nicht abhaken; nur true erlaubt');
ok(can(B, { ['families/' + FID + '/extras/' + week]: [{ name: 'Brot', done: false }] }) && !can(C, { ['families/' + FID + '/extras/' + week]: [{ name: 'Brot', done: true }] }), 'Zusatzartikel: Mitglied ja, Gast nein');
ok(!can(B, { ['families/' + FID + '/extras/' + week]: [{ done: false }] }), 'Artikel ohne Namen abgelehnt');
ok(can(A, { ['families/' + FID + '/meta/budget']: 150, ['families/' + FID + '/meta/persons']: 5 }), 'Admin ändert Familienbudget');
ok(!can(B, { ['families/' + FID + '/meta/budget']: 1 }) && !can(C, { ['families/' + FID + '/meta/name']: 'x' }), 'Mitglied/Gast ändern Budget/Name nicht');
ok(!can(A, { ['families/' + FID + '/meta/createdBy']: 'x'.repeat(200) }), 'Feldlängen begrenzt');

console.log('\nVorschläge und Abstimmung');
const prop = { recipe: 'hack-lasagne', by: 'ben', byName: 'Ben', note: 'lecker', at: T };
ok(can(B, { ['families/' + FID + '/proposals/p1']: prop }), 'Mitglied schlägt vor');
ok(!can(C, { ['families/' + FID + '/proposals/p2']: Object.assign({}, prop, { by: 'cleo' }) }), 'Gast kann nichts vorschlagen');
ok(!can(B, { ['families/' + FID + '/proposals/p3']: Object.assign({}, prop, { by: 'anna' }) }), 'Vorschlag nicht im Namen anderer');
ok(can(A, { ['families/' + FID + '/votes/p1/anna']: 'up' }) && can(B, { ['families/' + FID + '/votes/p1/ben']: 'down' }), 'Mitglieder stimmen ab');
ok(!can(C, { ['families/' + FID + '/votes/p1/cleo']: 'up' }), 'Gast stimmt nicht ab (nur lesen)');
ok(!can(B, { ['families/' + FID + '/votes/p1/anna']: 'down' }), 'fremde Stimme nicht änderbar');
ok(!can(B, { ['families/' + FID + '/votes/p1/ben']: 'vielleicht' }) && !can(B, { ['families/' + FID + '/votes/nichtda/ben']: 'up' }), 'ungültige Stimme / Vorschlag existiert nicht');
ok(!can(A, { ['families/' + FID + '/votes/p1']: null }) === false, 'Admin löscht Stimmen eines Vorschlags');
ok(can(B, { ['families/' + FID + '/votes/p1/ben']: 'up' }), 'neu abstimmen');
ok(!can(C, { ['families/' + FID + '/proposals/p1']: null }) && can(B, { ['families/' + FID + '/proposals/p1']: null }), 'Vorschlag löschen: Autor ja, Gast nein');
ok(can(B, { ['families/' + FID + '/proposals/p5']: Object.assign({}, prop, { recipe: 'x' }) }) && can(A, { ['families/' + FID + '/proposals/p5']: null }), 'Admin löscht fremde Vorschläge');

console.log('\nAustreten, Entfernen, Auflösen');
ok(!can(B, { ['families/' + FID + '/members/cleo']: null }), 'Mitglied kann andere nicht entfernen');
ok(can(A, { ['families/' + FID + '/members/cleo']: null, ['userFamilies/cleo/' + FID]: null }), 'Admin entfernt Gast');
ok(!canRead(C, 'families/' + FID) && !can(C, { ['families/' + FID + '/plans/' + week]: plan }), 'Entfernte haben keinen Zugriff mehr');
ok(can(B, { ['families/' + FID + '/members/ben']: null }) && !canRead(B, 'families/' + FID), 'Mitglied kann austreten');
ok(!can(X, { ['families/' + FID]: null }) && !can(A, { ['families/' + FID + '/meta']: null }) === false, 'Auflösen nur durch Admin (Fremder nicht)');
ok(can(A, { ['families/' + FID]: null, ['familyAdmin/' + FID]: null }) && !S.db.families, 'Admin löst Familie auf');
ok(!canRead(A, 'families/' + FID), 'nach Auflösung nichts mehr lesbar');

console.log('\nStandard: alles andere verboten');
ok(!can(A, { 'irgendwas': 1 }) && !can(A, { 'users/anna': { x: 1 } }) && !can(A, { '': { families: {} } }), 'unbekannte Pfade/Wurzel nicht schreibbar');
console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`); process.exit(fail ? 1 : 0);
