/* Tests des Firebase-Familienmoduls gegen die SIMULATION (tests/lib/fakefb.js) – NICHT gegen echtes Firebase.
 * Ausführen: node tests/familyfb.test.js */
'use strict';
const fs = require('fs'); const FF = require('./lib/fakefb.js'); const { makeFamily, parseConfig, explain } = require('../js/familyfb.js');
const rules = JSON.parse(fs.readFileSync(__dirname + '/../database.rules.json', 'utf8'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗', m); } };
const rejects = async (p, re) => { try { await p; return false; } catch (e) { return re ? re.test(e.message) : true; } };
const tick = (ms = 5) => new Promise(r => setTimeout(r, ms));
let clock = 1700000000000; const server = FF.makeServer(rules, { now: () => clock });
const CFG = { apiKey: 'AIzaSyTESTTESTTESTTESTTESTTESTTESTTEST0', authDomain: 'essensplaner-family.firebaseapp.com', databaseURL: 'https://essensplaner-family-default-rtdb.europe-west1.firebasedatabase.app', projectId: 'essensplaner-family' };
const mkStore = () => { const m = {}; return { m, get: (k, d) => (k in m && m[k] !== null ? JSON.parse(JSON.stringify(m[k])) : d), set: (k, v) => { m[k] = v === undefined ? null : JSON.parse(JSON.stringify(v)); } }; };
function device(srv, store, session) {
  const sdk = srv.sdk(session); store = store || mkStore(); store.set('fbConfig', CFG);
  const F = makeFamily({ store, loadSdk: async () => sdk, now: () => clock }); F.errors = []; F.onError = m => F.errors.push(m); return { F, sdk, store };
}
const week = '2026-11-16';

(async () => {
  console.log('\nKonfiguration');
  const p = parseConfig(`const firebaseConfig = {\n  apiKey: "${CFG.apiKey}",\n  authDomain: "essensplaner-family.firebaseapp.com",\n  databaseURL: "https://essensplaner-family-default-rtdb.europe-west1.firebasedatabase.app/",\n  projectId: "essensplaner-family", appId: "1:123:web:abc"\n};`);
  ok(p.databaseURL === CFG.databaseURL && p.apiKey === CFG.apiKey && p.appId === '1:123:web:abc', 'Konfig aus Konsolen-Block gelesen, Schrägstrich am Ende entfernt');
  ok((() => { try { parseConfig('{"apiKey":"AIzaSyTESTTESTTESTTESTTESTTESTTESTTEST0","authDomain":"a.firebaseapp.com","databaseURL":"https://x-default-rtdb.firebaseio.com"}'); return true; } catch (e) { return false; } })(), 'JSON-Form und firebaseio.com werden akzeptiert');
  ok((() => { try { parseConfig('apiKey: "AIzaSyTESTTESTTESTTESTTESTTESTTESTTEST0"'); } catch (e) { return /authDomain, databaseURL/.test(e.message); } })(), 'fehlende Felder werden benannt');
  ok((() => { try { parseConfig(`apiKey:"${CFG.apiKey}",authDomain:"x",databaseURL:"https://evil.example.com"`); } catch (e) { return /Datenbank-URL/.test(e.message); } })(), 'falsche Datenbank-URL abgelehnt');
  ok((() => { try { parseConfig(`apiKey:"xyz",authDomain:"x",databaseURL:"${CFG.databaseURL}"`); } catch (e) { return /API-Schlüssel/.test(e.message); } })(), 'falscher API-Schlüssel abgelehnt');
  const nocfg = makeFamily({ store: mkStore(), loadSdk: async () => server.sdk() }); ok(!nocfg.configured() && await rejects(nocfg.signIn('a@b.de', 'x'), /nicht konfiguriert/), 'ohne Konfiguration: klare Meldung');
  ok(/Datenbankregeln/.test(explain({ code: 'PERMISSION_DENIED' })) && /Keine Verbindung/.test(explain(new TypeError('Load failed'))) && /Autorisierte Domains/.test(explain({ code: 'auth/unauthorized-domain' })), 'Fehlertexte: „Load failed“, Regeln, Domain');

  console.log('\nRegistrierung, Anmeldung, Google, Abmeldung');
  const a = device(server), A = a.F;
  ok(await rejects(A.signUp({ name: '', email: 'anna@example.de', password: 'geheim123' }), /Namen/), 'Name erforderlich');
  ok(await rejects(A.signUp({ name: 'Anna', email: 'kaputt', password: 'geheim123' }), /ungültig/), 'ungültige E-Mail → deutsche Meldung');
  ok(await rejects(A.signUp({ name: 'Anna', email: 'anna@example.de', password: '123' }), /zu schwach/), 'schwaches Passwort → deutsche Meldung');
  await A.signUp({ name: 'Anna', email: 'anna@example.de', password: 'geheim123' });
  ok(A.user && A.user.uid && A.user.name === 'Anna' && A.signedIn(), 'registriert und angemeldet, Name angezeigt');
  ok(await rejects(device(server).F.signUp({ name: 'Zweite', email: 'ANNA@example.de', password: 'geheim123' }), /schon registriert/), 'E-Mail doppelt');
  await A.signOut(); ok(!A.user && !A.signedIn() && a.store.get('authHint') === false, 'Abmelden');
  ok(await rejects(A.signIn('anna@example.de', 'falsch!'), /Passwort ist falsch/), 'falsches Passwort → deutsche Meldung');
  await A.signIn('anna@example.de', 'geheim123'); ok(A.user.email === 'anna@example.de', 'Anmelden mit E-Mail/Passwort');
  await A.resetPassword('anna@example.de'); ok(server.resets.includes('anna@example.de'), 'Passwort-Zurücksetzen-Mail ausgelöst');
  ok(await rejects(A.resetPassword(''), /E-Mail/) && await rejects(A.resetPassword('quatsch'), /ungültig/), 'Zurücksetzen: Eingabefehler');
  const g1 = device(server).F; server.googleMode = 'closed'; ok(await rejects(g1.signInGoogle(), /abgebrochen/), 'Google: abgebrochen → Meldung');
  server.googleMode = 'domain'; ok(await rejects(g1.signInGoogle(), /Autorisierte Domains/), 'Google: Domain nicht freigegeben → Anleitung');
  server.googleMode = 'ok'; await g1.signInGoogle(); ok(g1.user && g1.user.email === 'google.nutzer@gmail.com', 'Google-Anmeldung (simuliert)'); await g1.signOut();
  server.failNetwork = true; ok(await rejects(device(server).F.signIn('anna@example.de', 'geheim123'), /Keine Verbindung/), 'offline: verständliche Meldung'); server.failNetwork = false;
  ok(a.sdk._inited === 1, 'Firebase nur einmal initialisiert');
  await A.connect(); await A.connect(); ok(a.sdk._inited === 1, 'wiederholtes Verbinden initialisiert nicht erneut');

  console.log('\nFamilie gründen');
  ok(await rejects(device(server).F.create({ name: 'X', myName: 'Y' }), /melde dich/), 'ohne Anmeldung nicht möglich');
  ok(await rejects(A.create({ name: '', myName: 'Anna' }), /benötigt/), 'Name erforderlich');
  await A.create({ name: 'Familie Müller', myName: 'Anna', budget: 120, persons: 4, diet: { intol: { laktose: true, fisch: true, pilze: true, kohl: true }, allowSpicy: false, unwanted: ['Oliven'] } });
  ok(A.active() && A.role() === 'admin' && A.members().length === 1 && A.get('meta').name === 'Familie Müller', 'Familie gegründet, Anna ist Admin');
  ok(A.members()[0].diet.unwanted[0] === 'Oliven' && A.members()[0].diet.allowSpicy === false, 'Ernährungsprofil gespeichert');
  const fid = A.familyId(); ok(server.db.userFamilies[A.user.uid][fid] === true && server.db.families[fid].members[A.user.uid].role === 'admin', 'Daten liegen in der Datenbank (Simulation)');
  ok(await rejects(A.create({ name: 'Zweite', myName: 'Anna' }), /schon in einer Familie/), 'nur eine Familie');

  console.log('\nEinladen und Beitreten');
  ok(await rejects(A.invite('admin'), /Mitglieder und Gäste/), 'Admin-Einladung nicht vorgesehen');
  const codeM = await A.invite('member'), codeG = await A.invite('guest', 24);
  ok(/^[A-Za-z0-9_-]{24}$/.test(codeM) && codeM !== codeG, 'zufällige Einladungscodes');
  ok((await A.listInvites()).length === 2, 'offene Einladungen sichtbar (Admin)');
  const b = device(server), B = b.F, c = device(server), C = c.F, x = device(server), X = x.F;
  await B.signUp({ name: 'Ben', email: 'ben@example.de', password: 'geheim123' }); await C.signUp({ name: 'Cleo', email: 'cleo@example.de', password: 'geheim123' }); await X.signUp({ name: 'Fremd', email: 'fremd@example.de', password: 'geheim123' });
  ok(await rejects(B.join('kaputt', 'Ben'), /ungültig/), 'ungültiger Code');
  ok(await rejects(B.join('A'.repeat(24), 'Ben'), /nicht gefunden/), 'unbekannter Code');
  await B.join('https://x.github.io/essensplaner/?join=' + codeM, 'Ben');
  ok(B.role() === 'member' && B.get('meta').name === 'Familie Müller' && B.members().length === 2, 'Ben tritt per Link bei (Mitglied)');
  ok(!server.db.invites || !server.db.invites[codeM], 'verbrauchte Einladung wurde gelöscht (einmalig)');
  ok(await rejects(X.join(codeM, 'Fremd'), /nicht gefunden/), 'Einladung ist nur einmal nutzbar');
  await C.join(codeG, 'Cleo'); ok(C.role() === 'guest', 'Cleo tritt als Gast bei');
  await tick(); ok(A.members().length === 3, 'Anna sieht neue Mitglieder in Echtzeit (ohne Neuladen)');
  const exp = await A.invite('member', 1); clock += 2 * 3600e3; ok(await rejects(X.join(exp, 'Fremd'), /abgelaufen/), 'abgelaufene Einladung');
  const rv = await A.invite('member'); await A.revokeInvite(rv); ok(await rejects(X.join(rv, 'Fremd'), /nicht gefunden/), 'widerrufene Einladung');
  ok((await A.listInvites()).length === 0, 'Aufräumen: keine offenen Einladungen mehr (abgelaufen/verbraucht/widerrufen)');
  ok(!X.active() && X.familyId() === null, 'Fremder ist nirgends Mitglied');

  console.log('\nEchtzeit: Plan, Einkaufsliste, Budget');
  B.putPlan({ weekStart: week, days: ['a', 'b', 'c', null, 'e', 'f', 'g'], locked: [false, true, false, false, false, false, false], persons: 4, updatedAt: clock });
  ok(B.plans()[week].days[2] === 'c', 'lokal sofort sichtbar'); await tick();
  const pa = A.plans()[week]; ok(pa && pa.days[0] === 'a' && pa.days[3] === null && pa.locked[1] === true && pa.persons === 4, 'Plan kommt bei Anna in Echtzeit an (inkl. leerer/fixierter Tage)');
  A.setChecked(week, 'hack', true); A.setChecked(week, 'reis.2%x', true); await tick();
  ok(B.checked(week).hack === true && B.checked(week)['reis.2%x'] === true, 'Haken in Echtzeit (auch Zutaten-IDs mit Sonderzeichen)');
  B.setChecked(week, 'hack', false); await tick(); ok(!A.checked(week).hack, 'Haken entfernt');
  B.setExtras(week, [{ name: 'Brot', done: false }, { name: 'Äpfel', done: true }]); await tick(); ok(A.extras(week).length === 2 && A.extras(week)[1].done === true, 'Zusatzartikel in Echtzeit');
  A.setMeta({ budget: 150, persons: 5 }); await tick(); ok(B.get('meta').budget === 150 && B.effective({ budget: 120, persons: 4, intol: {}, unwanted: [] }).persons === 5, 'gemeinsames Budget/Personenzahl gilt für alle');
  ok((() => { try { B.setMeta({ budget: 1 }); } catch (e) { return /Berechtigung/.test(e.message); } })(), 'Mitglied: Budget ändern – Oberfläche lehnt ab');
  ok((() => { try { C.putPlan({ weekStart: week, days: [], persons: 4 }); } catch (e) { return /Berechtigung/.test(e.message); } })() && (() => { try { C.setChecked(week, 'x', true); } catch (e) { return true; } })(), 'Gast: Plan/Liste – Oberfläche lehnt ab');
  ok(C.plans()[week] && C.plans()[week].days[0] === 'a', 'Gast sieht den Plan (Leserecht)');
  const e0 = C.errors.length; await b.sdk.update(b.sdk.ref(null), { ['families/' + fid + '/meta/budget']: 1 }).then(() => ok(false, 'Mitglied schrieb Budget direkt'), e => ok(e.code === 'PERMISSION_DENIED', 'Server (Regeln) lehnt Budget-Änderung durch Mitglied ab, auch an der Oberfläche vorbei'));
  await c.sdk.update(c.sdk.ref(null), { ['families/' + fid + '/plans/' + week + '/persons']: 1 }).then(() => ok(false, 'Gast schrieb Plan direkt'), e => ok(e.code === 'PERMISSION_DENIED', 'Server lehnt Plan-Änderung durch Gast ab'));
  await x.sdk.get(x.sdk.ref(null, 'families/' + fid)).then(() => ok(false, 'Fremder las Familie'), e => ok(e.code === 'PERMISSION_DENIED', 'Server verweigert Fremden das Lesen'));
  // Oberfläche umgehen: Fehler bei abgelehntem Hintergrund-Schreiben wird gemeldet und lokal zurückgesetzt
  const forced = device(server, mkStore()); await forced.F.signIn('cleo@example.de', 'geheim123'); await tick();
  ok(forced.F.role() === 'guest' && forced.F.active(), 'Anmeldung auf neuem Gerät findet die Familie wieder (ohne erneuten Beitritt)');
  forced.store.set('family', Object.assign(forced.store.get('family'), {})); forced.F.can = () => true; // Oberflächenprüfung absichtlich aushebeln
  forced.F.setChecked(week, 'brot', true); await tick(20);
  ok(forced.F.errors.some(m => /Keine Berechtigung/.test(m)) && !forced.F.checked(week).brot && !A.checked(week).brot, 'abgelehnte Änderung: Fehlermeldung, kein Eintrag in der Datenbank');

  console.log('\nVorschläge und Abstimmung');
  const pid = B.propose('hack-lasagne', 'Mal wieder?'); await tick();
  ok(A.proposals().length === 1 && A.proposals()[0].byName === 'Ben' && C.proposals().length === 1, 'Vorschlag bei allen sichtbar');
  A.vote(pid, 'up'); B.vote(pid, 'down'); await tick(); let pr = A.proposals()[0]; ok(pr.up === 1 && pr.down === 1 && pr.mine === 'up' && B.proposals()[0].mine === 'down', 'Stimmen gezählt');
  B.vote(pid, 'up'); await tick(); ok(A.proposals()[0].up === 2, 'Stimme geändert');
  ok((() => { try { C.vote(pid, 'up'); } catch (e) { return /Berechtigung/.test(e.message); } })() && (() => { try { C.propose('x', ''); } catch (e) { return true; } })(), 'Gast: abstimmen/vorschlagen nicht möglich');
  A.removeProposal(pid); await tick(); ok(B.proposals().length === 0 && !(server.db.families[fid].votes), 'Admin entfernt Vorschlag samt Stimmen');

  console.log('\nRollen und Mitglieder');
  ok((() => { try { B.setRole(B.me().id, 'admin'); } catch (e) { return /Berechtigung/.test(e.message); } })(), 'Mitglied kann sich nicht zum Admin machen (Oberfläche)');
  await b.sdk.update(b.sdk.ref(null), { ['families/' + fid + '/members/' + B.me().id + '/role']: 'admin' }).then(() => ok(false, 'Ben wurde Admin'), e => ok(e.code === 'PERMISSION_DENIED', 'Server verhindert Selbsternennung zum Admin'));
  A.setRole(C.me().id, 'member'); await tick(); ok(C.role() === 'member' && C.can('plan'), 'Admin befördert Gast – wirkt sofort bei Cleo');
  C.putPlan({ weekStart: '2026-11-23', days: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], persons: 4 }); await tick(); ok(A.plans()['2026-11-23'], 'Cleo darf jetzt den Plan ändern');
  A.setRole(C.me().id, 'guest'); await tick();
  B.setMyDiet({ intol: { fisch: true }, allowSpicy: true, unwanted: ['Spinat'] }); await tick();
  const eff = A.effective({ persons: 4, budget: 120, intol: { laktose: true, fisch: false, pilze: true, kohl: true }, allowSpicy: true, unwanted: [] });
  ok(eff.allowSpicy === false && eff.unwanted.includes('Oliven') && eff.unwanted.includes('Spinat') && eff.intol.fisch && eff.budget === 150, 'Ernährungsprofile werden vereinigt');
  ok(await rejects(A.removeMember(A.me().id), /Admin/), 'letzter Admin kann nicht austreten');
  await A.removeMember(C.me().id); await tick(); ok(A.members().length === 2 && C.removed === true && !!C.error, 'Admin entfernt Mitglied → Cleo erfährt es sofort');
  C.leave(); ok(!C.active() && c.store.get('family') == null && c.store.get('famdoc') == null, 'entferntes Mitglied: lokale Zuordnung gelöscht');
  await B.removeMember(B.me().id); ok(!B.active() && !server.db.families[fid].members[B.user.uid], 'Mitglied kann selbst austreten');

  console.log('\nOffline, Neustart, Abmeldung, Auflösen');
  const a2 = device(server, a.store, Object.assign({}, a.sdk._session, { authCbs: [], app: null })); // „App-Neustart“ mit gespeichertem Zustand
  server.failNetwork = true; ok(a2.F.active() && a2.F.members().length >= 1 && a2.F.role() === 'admin', 'Offline-Start: zuletzt bekannter Stand ist sofort verfügbar'); server.failNetwork = false;
  await a2.F.connect(); await tick(); ok(a2.F.user && a2.F.user.email === 'anna@example.de' && a2.F.active(), 'Anmeldung bleibt bestehen (Sitzung wiederhergestellt – in der Simulation durch geteilten Zustand)');
  server.failNetwork = true; a2.F.setChecked(week, 'milch', true); await tick(20); ok(a2.F.errors.length >= 1 && /offline|Verbindung/i.test(a2.F.errors[a2.F.errors.length - 1]), 'Offline-Schreiben meldet verständlich'); server.failNetwork = false;
  await A.signOut(); ok(!A.active() && a.store.get('family') !== null, 'nach Abmeldung ist der Familienplan inaktiv (lokaler Plan bleibt), Zuordnung bleibt für die nächste Anmeldung');
  await A.signIn('anna@example.de', 'geheim123'); await tick(); ok(A.active() && A.role() === 'admin', 'erneute Anmeldung: Familie wieder da');
  await A.dissolve(); ok(!A.active() && !server.db.families, 'Admin löst Familie auf');
  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
