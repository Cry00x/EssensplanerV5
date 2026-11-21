/* Familienplan mit Firebase Authentication + Realtime Database (Echtzeit).
 *
 * Sicherheit: Alle Berechtigungen (Mitgliedschaft, Rollen, Einladungen) werden serverseitig durch die Datenbankregeln in
 * database.rules.json erzwungen. Die Prüfungen in diesem Code (can(...)) dienen nur der Bedienung (ausgegraute Knöpfe, klare Hinweise).
 * Es werden keine Geheimnisse im Code gespeichert: Die Firebase-Web-Konfiguration (apiKey usw.) ist kein Geheimnis, sondern eine
 * öffentliche Kennung – geschützt wird durch Anmeldung, Regeln und die Liste erlaubter Domains in Firebase.
 *
 * Die Firebase-Bibliothek wird erst bei Bedarf von gstatic.com geladen (kein Build-Schritt, keine npm-Abhängigkeit). */
(function (g) {
  'use strict';
  const SDK_BASE = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const ROLES = { admin: 'Admin', member: 'Mitglied', guest: 'Gast' };
  const CODE_RE = /^[A-Za-z0-9_-]{22,64}$/;
  const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
  const enc = k => String(k).replace(/[.$#[\]\/%]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
  const dec = k => { try { return decodeURIComponent(k); } catch (e) { return k; } };
  const isObj = v => v !== null && typeof v === 'object';
  function rnd(n) { // zufällige URL-sichere Kennung (kryptografisch)
    const a = new Uint8Array(n); (g.crypto || require('crypto').webcrypto).getRandomValues(a);
    const B = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; let s = ''; for (let i = 0; i < n; i++) s += B[a[i] % 62]; return s;
  }
  const list = v => (Array.isArray(v) ? v : isObj(v) ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : []);

  /** Fehlertexte auf Deutsch – verständlich statt „Load failed“. */
  function explain(e) {
    const code = (e && e.code) || '', msg = String((e && e.message) || e || '');
    const M = {
      'auth/invalid-email': 'Die E-Mail-Adresse ist ungültig.',
      'auth/missing-email': 'Bitte eine E-Mail-Adresse eingeben.',
      'auth/missing-password': 'Bitte ein Passwort eingeben.',
      'auth/user-not-found': 'Zu dieser E-Mail-Adresse gibt es kein Konto.',
      'auth/wrong-password': 'E-Mail-Adresse oder Passwort ist falsch.',
      'auth/invalid-credential': 'E-Mail-Adresse oder Passwort ist falsch.',
      'auth/invalid-login-credentials': 'E-Mail-Adresse oder Passwort ist falsch.',
      'auth/email-already-in-use': 'Diese E-Mail-Adresse ist schon registriert. Bitte melde dich an oder setze das Passwort zurück.',
      'auth/weak-password': 'Das Passwort ist zu schwach (mindestens 6 Zeichen).',
      'auth/too-many-requests': 'Zu viele Versuche. Bitte warte einige Minuten und versuche es dann erneut.',
      'auth/user-disabled': 'Dieses Konto wurde deaktiviert.',
      'auth/network-request-failed': 'Keine Verbindung zu Firebase. Prüfe deine Internetverbindung (und ob die Seite von deiner Domain aus geladen wird).',
      'auth/popup-closed-by-user': 'Die Google-Anmeldung wurde abgebrochen.',
      'auth/cancelled-popup-request': 'Die Google-Anmeldung wurde abgebrochen.',
      'auth/popup-blocked': 'Das Anmeldefenster wurde vom Browser blockiert. Erlaube Pop-ups für diese Seite und versuche es erneut.',
      'auth/unauthorized-domain': 'Diese Webadresse ist in Firebase nicht für die Anmeldung freigegeben: Firebase-Konsole → Authentication → Einstellungen → Autorisierte Domains → deine Domain (z. B. name.github.io) hinzufügen.',
      'auth/operation-not-allowed': 'Diese Anmeldeart ist in Firebase nicht aktiviert (Authentication → Anmeldemethode).',
      'auth/operation-not-supported-in-this-environment': 'Die Google-Anmeldung funktioniert in dieser Umgebung nicht. Nutze E-Mail und Passwort oder öffne die App im Safari-Browser.',
      'auth/invalid-api-key': 'Der Firebase-API-Schlüssel ist ungültig. Bitte die Konfiguration prüfen.',
      'auth/api-key-not-valid': 'Der Firebase-API-Schlüssel ist ungültig. Bitte die Konfiguration prüfen.',
      'auth/configuration-not-found': 'Firebase Authentication ist für dieses Projekt noch nicht eingerichtet.',
      'auth/requires-recent-login': 'Bitte melde dich erneut an.',
      'auth/internal-error': 'Interner Fehler bei Firebase. Bitte später erneut versuchen.'
    };
    if (M[code]) return M[code];
    if (code === 'PERMISSION_DENIED' || /permission_denied|permission denied/i.test(msg)) return 'Keine Berechtigung: Die Datenbankregeln lehnen diese Aktion ab. Entweder fehlt dir die Rolle dafür, oder die Regeln aus database.rules.json wurden in Firebase noch nicht veröffentlicht.';
    if (/Importing a module script failed|Failed to fetch dynamically imported|error loading dynamically imported module|Load failed|Failed to fetch|NetworkError|network error/i.test(msg) && !code) return 'Keine Verbindung: Die Firebase-Bibliothek oder der Server konnte nicht geladen werden. Prüfe die Internetverbindung (Werbeblocker/Inhaltsblocker können gstatic.com oder firebaseio.com sperren).';
    if (code === 'unavailable' || /offline|unavailable/i.test(msg)) return 'Du bist offline oder Firebase ist nicht erreichbar. Änderungen werden übernommen, sobald die Verbindung wieder besteht.';
    if (/database.*url|Can't determine Firebase Database URL/i.test(msg)) return 'Die Datenbank-URL in der Firebase-Konfiguration fehlt oder ist falsch.';
    return msg || 'Unbekannter Fehler.';
  }

  /** Firebase-Konfiguration aus eingefügtem Text lesen (JSON oder JavaScript-Objekt aus der Firebase-Konsole). */
  function parseConfig(text) {
    const o = {}; String(text || '').replace(/["']?([A-Za-z]\w*)["']?\s*:\s*["']([^"']*)["']/g, (m, k, v) => { o[k] = v.trim(); return m; });
    const need = ['apiKey', 'authDomain', 'databaseURL'], miss = need.filter(k => !o[k]);
    if (miss.length) throw new Error('In der Konfiguration fehlt: ' + miss.join(', ') + '. Kopiere den kompletten „firebaseConfig“-Block aus der Firebase-Konsole (Projekteinstellungen → Allgemein → Meine Apps).');
    o.databaseURL = o.databaseURL.replace(/\/+$/, '');
    if (!/^https:\/\/[a-z0-9-]+(-default-rtdb)?\.([a-z0-9-]+\.)?(firebasedatabase\.app|firebaseio\.com)$/i.test(o.databaseURL)) throw new Error('Die Datenbank-URL sieht nicht richtig aus (erwartet: https://…firebasedatabase.app, ohne Pfad).');
    if (!/^AIza[0-9A-Za-z_-]{30,}$/.test(o.apiKey)) throw new Error('Der API-Schlüssel sieht nicht richtig aus (beginnt normalerweise mit „AIza“).');
    const keep = {}; ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'].forEach(k => { if (o[k]) keep[k] = o[k]; });
    return keep;
  }

  async function loadSdk() {
    if (g.FIREBASE_SDK) return g.FIREBASE_SDK; // Testeinsprung / eigene Einbindung
    const [a, b, c] = await Promise.all([import(SDK_BASE + 'firebase-app.js'), import(SDK_BASE + 'firebase-auth.js'), import(SDK_BASE + 'firebase-database.js')]);
    return Object.assign({}, a, b, c);
  }

  function makeFamily(opts) {
    const store = opts.store, now = opts.now || (() => Date.now()), sdkLoader = opts.loadSdk || loadSdk;
    const F = { status: 'aus', error: null, last: null, listeners: [], removed: false, user: null, authReady: false, ROLES, explain, parseConfig, onError: null };
    let sdk = null, app = null, auth = null, db = null, unsubFam = null, unsubInfo = null, connecting = null, tree = store.get('famdoc', null), famId = null;
    const emit = () => F.listeners.forEach(f => { try { f(F); } catch (e) { } });
    const fail = e => { const m = explain(e); F.status = 'fehler'; F.error = m; emit(); if (F.onError) F.onError(m); return m; };

    // ───── Konfiguration ─────
    const cfg = () => store.get('fbConfig', null) || (g.FIREBASE_CONFIG && g.FIREBASE_CONFIG.apiKey && g.FIREBASE_CONFIG.authDomain && g.FIREBASE_CONFIG.databaseURL ? g.FIREBASE_CONFIG : null);
    F.config = cfg; F.configured = () => !!cfg();
    F.saveConfig = text => { const c = typeof text === 'string' ? parseConfig(text) : text; store.set('fbConfig', c); return c; };
    F.clearConfig = () => store.set('fbConfig', null);

    // ───── Verbindung ─────
    F.connect = function () {
      if (connecting) return connecting;
      connecting = (async () => {
        const c = cfg(); if (!c) throw Object.assign(new Error('Firebase ist noch nicht konfiguriert.'), { code: 'app/no-config' });
        sdk = await sdkLoader();
        app = sdk.getApps().length ? sdk.getApp() : sdk.initializeApp(c); // nie doppelt initialisieren
        auth = sdk.getAuth(app); db = sdk.getDatabase(app);
        await new Promise(res => { let first = true; sdk.onAuthStateChanged(auth, u => { F._onUser(u).then(() => { if (first) { first = false; res(); } }); }, () => { if (first) { first = false; res(); } }); });
        try { if (sdk.getRedirectResult) await sdk.getRedirectResult(auth); } catch (e) { fail(e); }
        F.authReady = true; emit();
      })();
      connecting.catch(() => { connecting = null; });
      return connecting;
    };
    const userOf = u => (u ? { uid: u.uid, email: u.email || '', name: u.displayName || (u.email || '').split('@')[0] || 'Nutzer' } : null);
    F._onUser = async function (u) {
      const nu = userOf(u);
      if ((nu && F.user && nu.uid === F.user.uid) || (!nu && !F.user && F.authReady)) { if (nu) F.user = nu; return; }
      F.user = nu; store.set('authHint', !!nu);
      detach();
      if (!nu) { F.status = 'abgemeldet'; F.error = null; emit(); return; }
      const fam = store.get('family', null);
      if (fam && fam.uid && fam.uid !== nu.uid) { F.leave(); } // anderes Konto: lokale Familien-Zuordnung verwerfen
      try {
        let f = store.get('family', null);
        if (!f) { // neues Gerät / neu angemeldet: Familie über die eigene Zuordnung wiederfinden
          const s = await sdk.get(sdk.ref(db, 'userFamilies/' + nu.uid)); const m = s.val();
          if (m && Object.keys(m).length) {
            const fid = Object.keys(m)[0], t = await sdk.get(sdk.ref(db, 'families/' + fid)), val = t.val();
            if (val && val.members && val.members[nu.uid]) { f = { id: fid, name: (val.meta && val.meta.name) || 'Familie', me: { id: nu.uid, name: val.members[nu.uid].name }, uid: nu.uid }; store.set('family', f); tree = val; store.set('famdoc', val); }
          }
        }
        if (f) attach(f.id);
        F.status = 'ok'; F.error = null;
      } catch (e) { fail(e); }
      emit();
    };
    function detach() { if (unsubFam) { unsubFam(); unsubFam = null; } if (unsubInfo) { unsubInfo(); unsubInfo = null; } famId = null; }
    function attach(fid) {
      detach(); famId = fid; F.removed = false;
      F.status = 'verbinde'; emit();
      unsubFam = sdk.onValue(sdk.ref(db, 'families/' + fid), snap => {
        const v = snap.val(); F.last = now(); F.error = null;
        if (!v) { if (store.get('family')) { F.removed = true; F.error = 'Die Familie existiert nicht mehr.'; } F.status = 'fehler'; emit(); return; }
        const meId = (store.get('family') || {}).me && store.get('family').me.id;
        if (meId && !(v.members && v.members[meId])) { F.removed = true; F.error = 'Du bist nicht mehr Mitglied dieser Familie.'; F.status = 'fehler'; emit(); return; }
        tree = v; store.set('famdoc', v); F.removed = false; F.status = F.status === 'offline' ? 'offline' : 'ok'; emit();
      }, err => {
        const m = explain(err);
        if (err && (err.code === 'PERMISSION_DENIED' || /permission/i.test(err.message || ''))) { F.removed = true; F.error = 'Kein Zugriff auf die Familie: Du wurdest entfernt, die Familie wurde aufgelöst oder die Datenbankregeln fehlen.'; F.status = 'fehler'; emit(); } else fail(err);
        return m;
      });
      try { unsubInfo = sdk.onValue(sdk.ref(db, '.info/connected'), s => { if (s.val() === false) { F.status = 'offline'; } else if (F.status === 'offline') { F.status = 'ok'; } emit(); }, () => { }); } catch (e) { }
    }

    // ───── Anmeldung ─────
    const wrapAuth = async fn => { try { await F.connect(); return await fn(); } catch (e) { const err = new Error(explain(e)); err.code = e && e.code; throw err; } };
    F.signUp = ({ name, email, password }) => wrapAuth(async () => {
      if (!String(name || '').trim()) throw new Error('Bitte gib deinen Namen ein.');
      const cr = await sdk.createUserWithEmailAndPassword(auth, String(email || '').trim(), password || '');
      try { await sdk.updateProfile(cr.user, { displayName: String(name).trim().slice(0, 40) }); } catch (e) { }
      await F._onUser(Object.assign({}, cr.user, { displayName: String(name).trim().slice(0, 40) })); F.user.name = String(name).trim().slice(0, 40); emit(); return F.user;
    });
    F.signIn = (email, password) => wrapAuth(async () => { const cr = await sdk.signInWithEmailAndPassword(auth, String(email || '').trim(), password || ''); await F._onUser(cr.user); return F.user; });
    F.signInGoogle = () => wrapAuth(async () => {
      const provider = new sdk.GoogleAuthProvider();
      try { const cr = await sdk.signInWithPopup(auth, provider); await F._onUser(cr.user); return F.user; }
      catch (e) {
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') && sdk.signInWithRedirect) { await sdk.signInWithRedirect(auth, provider); return null; } // Seite wird verlassen
        throw e;
      }
    });
    F.signOut = () => wrapAuth(async () => { await sdk.signOut(auth); await F._onUser(null); });
    F.resetPassword = email => wrapAuth(async () => { if (!String(email || '').trim()) throw new Error('Bitte gib zuerst deine E-Mail-Adresse ein.'); await sdk.sendPasswordResetEmail(auth, String(email).trim()); });
    F.signedIn = () => !!F.user;

    // ───── Lesen (aus dem lokalen Abbild, das in Echtzeit aktualisiert wird) ─────
    const fam = () => store.get('family', null);
    F.active = () => !!fam() && (!F.authReady || !!F.user);
    F.me = () => (fam() || {}).me || null;
    F.familyId = () => (fam() || {}).id || null;
    F.get = k => (tree && k === 'meta' ? tree.meta : undefined);
    F.members = () => Object.keys((tree && tree.members) || {}).map(id => {
      const m = tree.members[id], d = m.diet;
      return { id, name: m.name, role: m.role, joinedAt: m.joinedAt, diet: d ? { intol: d.intol || {}, allowSpicy: d.allowSpicy, unwanted: list(d.unwanted) } : null };
    }).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    F.role = () => { const me = F.me(); return me && tree && tree.members && tree.members[me.id] ? tree.members[me.id].role : null; };
    F.roleLabel = r => ROLES[r] || r;
    F.can = a => {
      const r = F.role(); if (!r) return false;
      return { admin: ['view', 'plan', 'shop', 'propose', 'vote', 'settings', 'members', 'invite'], member: ['view', 'plan', 'shop', 'propose', 'vote'], guest: ['view'] }[r].includes(a);
    };
    F.plans = () => {
      const o = {}; Object.keys((tree && tree.plans) || {}).forEach(w => {
        const p = tree.plans[w], d = list(p.days).map(x => x || null); while (d.length < 7) d.push(null);
        o[w] = { weekStart: w, days: d.slice(0, 7), locked: String(p.locked || '').padEnd(7, '0').split('').map(c => c === '1'), persons: p.persons, updatedAt: p.updatedAt || 0 };
      }); return o;
    };
    F.checked = week => { const o = {}, c = (tree && tree.checks && tree.checks[week]) || {}; Object.keys(c).forEach(k => { if (c[k]) o[dec(k)] = true; }); return o; };
    F.extras = week => list(tree && tree.extras && tree.extras[week]).map(x => ({ name: x.name, done: !!x.done }));
    F.proposals = () => {
      const me = F.me() || {}, P = (tree && tree.proposals) || {}, V = (tree && tree.votes) || {};
      return Object.keys(P).map(id => {
        const vs = V[id] || {}, up = Object.keys(vs).filter(u => vs[u] === 'up').length, down = Object.keys(vs).filter(u => vs[u] === 'down').length;
        return Object.assign({ id, up, down, score: up - down, mine: vs[me.id] || null }, P[id]);
      }).sort((a, b) => b.score - a.score || b.at - a.at);
    };
    F.effective = base => {
      if (!F.active()) return base;
      const s = JSON.parse(JSON.stringify(base)), meta = (tree && tree.meta) || {};
      if (meta.budget) s.budget = meta.budget;
      s.persons = meta.persons || Math.max(base.persons, 1);
      F.members().forEach(m => {
        const d = m.diet; if (!d) return;
        ['laktose', 'fisch', 'pilze', 'kohl'].forEach(k => { if (d.intol && d.intol[k]) s.intol[k] = true; });
        if (d.allowSpicy === false) s.allowSpicy = false;
        (d.unwanted || []).forEach(w => { if (!(s.unwanted || []).some(x => x.toLowerCase() === String(w).toLowerCase())) (s.unwanted = s.unwanted || []).push(w); });
      });
      return s;
    };

    // ───── Schreiben ─────
    function setLocal(path, value) { // sofortige lokale Anzeige; die Datenbank korrigiert bei Ablehnung automatisch
      const f = famId || F.familyId(); if (!f || !tree) return;
      const pre = 'families/' + f + '/'; if (!path.startsWith(pre)) return;
      const segs = path.slice(pre.length).split('/'); let n = tree;
      for (let i = 0; i < segs.length - 1; i++) { if (!isObj(n[segs[i]])) n[segs[i]] = {}; n = n[segs[i]]; }
      if (value === null || value === undefined) delete n[segs[segs.length - 1]]; else n[segs[segs.length - 1]] = JSON.parse(JSON.stringify(value));
    }
    const pathsOf = (upd, f) => Object.keys(upd).reduce((a, k) => { a[k] = upd[k]; return a; }, {});
    async function send(upd) { await F.connect(); if (!F.user) throw Object.assign(new Error('Bitte melde dich an.'), { code: 'app/not-signed-in' }); await sdk.update(sdk.ref(db), upd); }
    /** Schreiben im Hintergrund: sofort lokal sichtbar, Fehler werden gemeldet. */
    function bg(upd) {
      Object.keys(upd).forEach(p => setLocal(p, upd[p])); emit();
      send(upd).then(() => { F.last = now(); }).catch(e => { fail(e); F.sync().catch(() => { }); });
    }
    const guard = a => { if (!F.can(a)) throw new Error('Dafür fehlt dir die Berechtigung (' + (ROLES[F.role()] || 'nicht angemeldet') + ').'); };
    const fp = p => 'families/' + F.familyId() + '/' + p;
    const wireDiet = d => (d ? { intol: ['laktose', 'fisch', 'pilze', 'kohl'].reduce((o, k) => { if (d.intol && typeof d.intol[k] === 'boolean') o[k] = d.intol[k]; return o; }, {}), allowSpicy: d.allowSpicy !== false, unwanted: (d.unwanted || []).map(x => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 20) } : null);
    const cleanDiet = d => { const w = wireDiet(d); if (!w) return null; if (!Object.keys(w.intol).length) delete w.intol; if (!w.unwanted.length) delete w.unwanted; return w; };

    F.putPlan = p => {
      guard('plan'); if (!WEEK_RE.test(p.weekStart)) throw new Error('Ungültige Woche.');
      bg({ [fp('plans/' + p.weekStart)]: { days: (p.days || []).map(x => x || '').slice(0, 7), locked: (p.locked || []).map(x => (x ? '1' : '0')).join('').slice(0, 7), persons: p.persons, updatedAt: p.updatedAt || now(), by: F.me().id } });
    };
    F.setChecked = (week, ing, on) => { guard('shop'); bg({ [fp('checks/' + week + '/' + enc(ing))]: on ? true : null }); };
    F.setExtras = (week, items) => { guard('shop'); bg({ [fp('extras/' + week)]: items.length ? items.map(x => ({ name: String(x.name).slice(0, 100), done: !!x.done })) : null }); };
    F.setMeta = patch => { guard('settings'); const u = {}; Object.keys(patch).forEach(k => { if (['name', 'budget', 'persons'].includes(k) && patch[k] != null) u[fp('meta/' + k)] = patch[k]; }); bg(u); };
    F.setMyDiet = d => { const w = cleanDiet(d); bg({ [fp('members/' + F.me().id + '/diet')]: w }); };
    F.setRole = (id, role) => { guard('members'); if (!ROLES[role]) throw new Error('Unbekannte Rolle.'); bg({ [fp('members/' + id + '/role')]: role }); };
    F.propose = (recipeId, note) => {
      guard('propose'); const id = rnd(12), me = F.me();
      bg({ [fp('proposals/' + id)]: { recipe: String(recipeId).slice(0, 80), by: me.id, byName: me.name, note: String(note || '').slice(0, 200), at: now() } }); return id;
    };
    F.vote = (pid, v) => { guard('vote'); bg({ [fp('votes/' + pid + '/' + F.me().id)]: v === 'up' || v === 'down' ? v : null }); };
    F.removeProposal = pid => { const p = tree && tree.proposals && tree.proposals[pid]; if (!p) return; if (!(F.can('members') || p.by === F.me().id)) throw new Error('Nur der Autor oder ein Admin kann den Vorschlag entfernen.'); bg({ [fp('votes/' + pid)]: null, [fp('proposals/' + pid)]: null }); };

    // ───── Familie gründen, beitreten, verwalten ─────
    F.create = async function (o) {
      const name = String(o.name || '').trim(), my = String(o.myName || '').trim();
      if (!name || !my) throw new Error('Familienname und dein Name werden benötigt.');
      if (fam()) throw new Error('Du bist schon in einer Familie.');
      await F.connect(); if (!F.user) throw new Error('Bitte melde dich zuerst an.');
      const fid = rnd(24), uid = F.user.uid, t = now();
      const meta = { name: name.slice(0, 60), createdBy: uid, createdAt: t }; if (o.budget > 0) meta.budget = o.budget; if (o.persons >= 1) meta.persons = o.persons;
      const member = { name: my.slice(0, 40), role: 'admin', joinedAt: t }; const d = cleanDiet(o.diet); if (d) member.diet = d;
      try { await send({ ['families/' + fid]: { meta, members: { [uid]: member } }, ['userFamilies/' + uid + '/' + fid]: true }); }
      catch (e) { throw Object.assign(new Error(explain(e)), { code: e && e.code }); }
      store.set('family', { id: fid, name: meta.name, me: { id: uid, name: member.name }, uid }); tree = { meta, members: { [uid]: member } }; store.set('famdoc', tree);
      attach(fid); emit(); return fam();
    };
    F.codeFrom = s => { const t = String(s || '').trim(), m = t.match(/[?&]join=([A-Za-z0-9_-]+)/); const c = m ? m[1] : t; if (!CODE_RE.test(c)) throw new Error('Der Einladungscode ist ungültig.'); return c; };
    F.join = async function (codeOrLink, myName) {
      const code = F.codeFrom(codeOrLink), my = String(myName || '').trim();
      if (!my) throw new Error('Bitte gib deinen Namen ein.');
      if (fam()) throw new Error('Du bist schon in einer Familie. Verlasse sie zuerst.');
      await F.connect(); if (!F.user) throw new Error('Bitte melde dich zuerst an.');
      let inv;
      try { const s = await sdk.get(sdk.ref(db, 'invites/' + code)); inv = s.val(); } catch (e) { throw Object.assign(new Error(explain(e)), { code: e && e.code }); }
      if (!inv) throw new Error('Diese Einladung wurde nicht gefunden. Sie ist abgelaufen, wurde schon verwendet oder widerrufen – bitte um eine neue.');
      if (!(inv.expires > now())) throw new Error('Diese Einladung ist abgelaufen. Bitte um eine neue.');
      const uid = F.user.uid;
      try { await send({ ['families/' + inv.family + '/members/' + uid]: { name: my.slice(0, 40), role: inv.role, inv: code, joinedAt: now() }, ['userFamilies/' + uid + '/' + inv.family]: true }); }
      catch (e) { throw Object.assign(new Error(/PERMISSION/i.test((e && e.code) || '') ? 'Der Beitritt wurde von den Datenbankregeln abgelehnt (Einladung ungültig oder schon verwendet).' : explain(e)), { code: e && e.code }); }
      try { await sdk.remove(sdk.ref(db, 'invites/' + code)); } catch (e) { /* verbrauchte Einladung löschen – nicht kritisch */ }
      store.set('family', { id: inv.family, name: inv.name || 'Familie', me: { id: uid, name: my }, uid });
      attach(inv.family);
      await new Promise(res => { const t0 = setTimeout(res, 8000), f = () => { if (tree && tree.members && tree.members[uid]) { clearTimeout(t0); F.listeners = F.listeners.filter(x => x !== f); res(); } }; F.listeners.push(f); f(); });
      const meta = tree && tree.meta; if (meta && meta.name) { const c = fam(); c.name = meta.name; store.set('family', c); }
      emit(); return fam();
    };
    F.invite = async function (role, hours) {
      if (!F.can('invite')) throw new Error('Nur Admins können einladen.');
      if (!['member', 'guest'].includes(role)) throw new Error('Eingeladen werden können Mitglieder und Gäste (Admin-Rechte vergibst du danach unter „Rolle“).');
      const code = rnd(24), exp = now() + Math.min(hours || 48, 24 * 7 - 1) * 3600e3, fid = F.familyId();
      await send({ ['invites/' + code]: { family: fid, role, expires: exp, by: F.user.uid, name: (tree && tree.meta && tree.meta.name) || '' }, ['familyAdmin/' + fid + '/invites/' + code]: { role, expires: exp } })
        .catch(e => { throw Object.assign(new Error(explain(e)), { code: e && e.code }); });
      return code;
    };
    /** Offene Einladungen (nur Admin): { code, role, expires } */
    F.listInvites = async function () {
      await F.connect(); const fid = F.familyId(), s = await sdk.get(sdk.ref(db, 'familyAdmin/' + fid + '/invites')), v = s.val() || {}, out = [], stale = {};
      for (const code of Object.keys(v)) {
        let alive = v[code].expires > now(); if (alive) { try { alive = !!(await sdk.get(sdk.ref(db, 'invites/' + code))).val(); } catch (e) { alive = false; } }
        if (alive) out.push({ code, role: v[code].role, expires: v[code].expires }); else { stale['familyAdmin/' + fid + '/invites/' + code] = null; stale['invites/' + code] = null; }
      }
      if (Object.keys(stale).length) { try { await send(stale); } catch (e) { } }
      return out;
    };
    F.revokeInvite = async code => { const fid = F.familyId(); await send({ ['invites/' + code]: null, ['familyAdmin/' + fid + '/invites/' + code]: null }).catch(e => { throw new Error(explain(e)); }); };
    F.removeMember = async function (id) {
      const fid = F.familyId(), self = id === F.me().id;
      if (!self) guard('members');
      try { await send({ ['families/' + fid + '/members/' + id]: null, ['userFamilies/' + id + '/' + fid]: null }); }
      catch (e) { throw Object.assign(new Error(self && F.role() === 'admin' ? 'Als Admin kannst du die Familie nicht einfach verlassen: Ernenne zuerst ein anderes Mitglied zum Admin (und lass dich von ihm entfernen) oder löse die Familie auf.' : explain(e)), { code: e && e.code }); }
      if (self) F.leave(); else { setLocal('families/' + fid + '/members/' + id, null); emit(); }
    };
    F.dissolve = async function () {
      guard('members'); const fid = F.familyId(), uid = F.me().id;
      try { await send({ ['families/' + fid]: null, ['familyAdmin/' + fid]: null, ['userFamilies/' + uid + '/' + fid]: null }); } catch (e) { throw new Error(explain(e)); }
      F.leave();
    };
    /** Nur lokal lösen (Gerät trennen). */
    F.leave = () => { detach(); store.set('family', null); store.set('famdoc', null); tree = null; F.status = F.user ? 'ok' : 'aus'; F.removed = false; F.error = null; emit(); };
    F.sync = async () => {
      if (!fam()) return { pulled: false }; await F.connect(); if (!F.user) throw new Error('Bitte melde dich an.');
      try { const s = await sdk.get(sdk.ref(db, 'families/' + F.familyId())), v = s.val(); if (v) { tree = v; store.set('famdoc', v); } F.last = now(); F.status = 'ok'; F.error = null; emit(); return { pulled: true }; }
      catch (e) { fail(e); throw new Error(explain(e)); }
    };
    F.schedule = () => { }; // Echtzeit: kein zeitversetzter Abgleich nötig
    /** Beim Start: Verbindung herstellen, wenn schon einmal genutzt */
    F.boot = () => { if (F.configured() && (fam() || store.get('authHint', false) || store.get('pendingJoin', null))) return F.connect().catch(e => { fail(e); }); return Promise.resolve(); };
    return F;
  }
  const api = { makeFamily, explain, parseConfig, ROLES, enc, dec };
  g.FamilyFB = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
