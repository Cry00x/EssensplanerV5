/* SIMULATION von Firebase (Authentication + Realtime Database) für Tests ohne Internet.
 * Enthält einen Interpreter für Realtime-Database-Regeln (database.rules.json). Das ist KEIN echtes Firebase:
 * Die Auswertung folgt der dokumentierten Semantik (.read/.write kaskadieren nach unten, .validate gilt für neu geschriebene Daten,
 * Variablen $x, auth, now, root, data, newData), kann aber im Detail von der echten Auswertung abweichen.
 * Läuft in Node und im Browser (window.FakeFirebase). */
(function (g) {
  'use strict';
  // ───────── Datenbaum ─────────
  const isObj = v => v !== null && typeof v === 'object';
  function norm(v) { // Arrays → Objekte, null/undefined/leere Objekte entfernen (wie die echte Datenbank)
    if (v === undefined || v === null) return null;
    if (Array.isArray(v)) { const o = {}; v.forEach((x, i) => { const n = norm(x); if (n !== null) o[i] = n; }); return Object.keys(o).length ? o : null; }
    if (isObj(v)) { const o = {}; Object.keys(v).forEach(k => { const n = norm(v[k]); if (n !== null) o[k] = n; }); return Object.keys(o).length ? o : null; }
    return v;
  }
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const segs = p => String(p).split('/').filter(Boolean);
  function getAt(tree, path) { let n = tree; for (const s of path) { if (!isObj(n) || !(s in n)) return null; n = n[s]; } return n === undefined ? null : n; }
  function setAt(tree, path, value) {
    value = norm(value);
    if (!path.length) return value || {};
    const root = isObj(tree) ? tree : {}; let n = root;
    for (let i = 0; i < path.length - 1; i++) { if (!isObj(n[path[i]])) n[path[i]] = {}; n = n[path[i]]; }
    if (value === null) delete n[path[path.length - 1]]; else n[path[path.length - 1]] = value;
    // leere Zwischenknoten entfernen
    (function prune(node, p) { if (!p.length) return; const k = p[0]; if (isObj(node[k])) { prune(node[k], p.slice(1)); if (!Object.keys(node[k]).length) delete node[k]; } })(root, path);
    return root;
  }

  // ───────── Regel-Interpreter ─────────
  class Snap {
    constructor(tree, path) { this.t = tree; this.p = path; }
    val() { return clone(getAt(this.t, this.p)); }
    child(c) { if (typeof c !== 'string' || !c.length) throw new Error('child() braucht einen String'); return new Snap(this.t, this.p.concat(segs(c))); }
    parent() { if (!this.p.length) return null; return new Snap(this.t, this.p.slice(0, -1)); }
    exists() { return getAt(this.t, this.p) !== null; }
    hasChild(c) { return getAt(this.t, this.p.concat(segs(c))) !== null; }
    hasChildren(arr) { const v = getAt(this.t, this.p); if (!isObj(v)) return false; return arr ? arr.every(k => k in v) : Object.keys(v).length > 0; }
    numChildren() { const v = getAt(this.t, this.p); return isObj(v) ? Object.keys(v).length : 0; }
    isString() { return typeof getAt(this.t, this.p) === 'string'; }
    isNumber() { return typeof getAt(this.t, this.p) === 'number'; }
    isBoolean() { return typeof getAt(this.t, this.p) === 'boolean'; }
    getPriority() { return null; }
  }
  const SP = String.prototype;
  [['matches', function (re) { return re.test(this); }], ['contains', function (s) { return this.indexOf(s) >= 0; }], ['beginsWith', function (s) { return this.startsWith(s); }], ['endsWith', function (s) { return this.endsWith(s); }]]
    .forEach(([n, f]) => { if (!SP[n]) Object.defineProperty(SP, n, { value: f, enumerable: false, configurable: true }); });
  const fnCache = {};
  function evalExpr(expr, env, vars) {
    if (typeof expr === 'boolean') return expr;
    const names = Object.keys(vars);
    const key = expr + '|' + names.join(',');
    const fn = fnCache[key] || (fnCache[key] = new Function('auth', 'now', 'root', 'data', 'newData', ...names, '"use strict"; return (' + expr + ');'));
    try { return !!fn(env.auth, env.now, env.root, env.data, env.newData, ...names.map(n => vars[n])); } catch (e) { return false; }
  }
  function childRule(node, seg, vars) {
    if (!isObj(node)) return null;
    if (Object.prototype.hasOwnProperty.call(node, seg) && !seg.startsWith('.')) return { node: node[seg], vars };
    const w = Object.keys(node).find(k => k.startsWith('$')); if (w) return { node: node[w], vars: Object.assign({}, vars, { [w]: seg }) };
    return null;
  }

  function makeEngine(rulesJson, clock) {
    const R = rulesJson.rules || rulesJson;
    const authObj = a => (a ? { uid: a.uid, token: { email: a.email } } : null);
    function canRead(db, path, auth) {
      const P = segs(path), root = new Snap(db, []); let node = R, vars = {};
      for (let i = 0; i <= P.length; i++) {
        if (node && node['.read'] !== undefined && evalExpr(node['.read'], { auth: authObj(auth), now: clock(), root, data: new Snap(db, P.slice(0, i)), newData: null }, vars)) return true;
        if (i === P.length) break;
        const c = childRule(node, P[i], vars); if (!c) return false; node = c.node; vars = c.vars;
      }
      return false;
    }
    /** { ok, reason } für das Schreiben von value an path (value null = löschen) */
    function checkWrite(db, path, value, auth) {
      const P = segs(path), newRoot = setAt(clone(db), P, clone(value)), root = new Snap(db, []), a = authObj(auth), now = clock();
      let node = R, vars = {}, granted = false;
      const chain = [];
      for (let i = 0; i <= P.length; i++) {
        chain.push({ node, vars, i });
        if (node && node['.write'] !== undefined && evalExpr(node['.write'], { auth: a, now, root, data: new Snap(db, P.slice(0, i)), newData: new Snap(newRoot, P.slice(0, i)) }, vars)) granted = true;
        if (i === P.length) break;
        const c = childRule(node, P[i], vars); if (!c) { node = null; break; } node = c.node; vars = c.vars;
      }
      if (!granted) return { ok: false, reason: 'PERMISSION_DENIED (.write) bei /' + P.join('/') };
      // .validate: am Schreibort und in allen neu geschriebenen Unterknoten
      const nv = getAt(newRoot, P);
      if (nv !== null) {
        const end = chain[chain.length - 1]; let atNode = end.node && end.i === P.length ? end : null;
        if (atNode) { const r = validate(atNode.node, atNode.vars, P, newRoot, db, a, now); if (r) return { ok: false, reason: 'Validierung fehlgeschlagen: ' + r }; }
      }
      return { ok: true };
    }
    function validate(node, vars, path, newRoot, db, a, now) {
      if (!node) return null;
      const val = getAt(newRoot, path); if (val === null) return null;
      if (node['.validate'] !== undefined && !evalExpr(node['.validate'], { auth: a, now, root: new Snap(db, []), data: new Snap(db, path), newData: new Snap(newRoot, path) }, vars)) return '/' + path.join('/');
      if (isObj(val)) for (const k of Object.keys(val)) {
        const c = childRule(node, k, vars); if (!c) continue;
        const r = validate(c.node, c.vars, path.concat(k), newRoot, db, a, now); if (r) return r;
      }
      return null;
    }
    return { canRead, checkWrite };
  }

  const snapshot = v => ({ val: () => clone(v === undefined ? null : v), exists: () => v !== null && v !== undefined });
  // ───────── Fake-Server (Datenbank + Konten) ─────────
  function makeServer(rulesJson, opts) {
    opts = opts || {};
    const S = { db: {}, users: [], clock: opts.now || (() => Date.now()), listeners: [], resets: [], googleMode: 'ok', failNetwork: false, writes: [], uidN: 0 };
    const eng = makeEngine(rulesJson, () => S.clock());
    S.engine = eng;
    S.notify = () => {
      S.listeners.slice().forEach(l => {
        if (l.dead) return;
        const auth = l.session.currentUser;
        if (!eng.canRead(S.db, l.path, auth)) { if (!l.denied) { l.denied = true; l.errCb && l.errCb(Object.assign(new Error('permission_denied at /' + l.path + ': Client doesn\'t have permission to access the desired data.'), { code: 'PERMISSION_DENIED' })); } return; }
        l.denied = false;
        const v = getAt(S.db, segs(l.path)), j = JSON.stringify(v);
        if (l.last !== j) { l.last = j; l.cb(snapshot(v)); }
      });
    };
    S.write = (session, updates) => { // updates: {pfad: wert}; atomar, jeder Pfad einzeln gegen den Vorher-Zustand geprüft
      if (S.failNetwork) throw Object.assign(new Error('Network request failed'), { code: 'unavailable' });
      const auth = session.currentUser;
      for (const p of Object.keys(updates)) {
        const r = eng.checkWrite(S.db, p, updates[p], auth);
        if (!r.ok) throw Object.assign(new Error('PERMISSION_DENIED: Permission denied (' + r.reason + ')'), { code: 'PERMISSION_DENIED', detail: r.reason });
      }
      Object.keys(updates).forEach(p => { S.db = setAt(S.db, segs(p), clone(updates[p])) || {}; S.writes.push(p); });
      S.notify();
    };
    S.sdk = function (session) { return makeSdk(S, session); };
    return S;
  }

  function makeSdk(S, existing) {
    const session = existing || { currentUser: null, authCbs: [], app: null }; // existing: simuliert die dauerhaft gespeicherte Anmeldung eines Geräts
    const fireAuth = () => { session.authCbs.slice().forEach(cb => Promise.resolve().then(() => cb(session.currentUser))); S.notify(); };
    const authErr = (code, msg) => Object.assign(new Error('Firebase: ' + (msg || code) + ' (' + code + ').'), { code });
    const wrapUser = u => (u ? { uid: u.uid, email: u.email, displayName: u.displayName || null, emailVerified: false } : null);
    const mkUser = (email, displayName) => { const u = { uid: 'uid' + (++S.uidN) + Math.random().toString(36).slice(2, 8), email, displayName }; return u; };
    const net = () => { if (S.failNetwork) throw authErr('auth/network-request-failed'); };
    const sdk = {
      _session: session, _server: S,
      initializeApp(cfg) { if (!cfg || !cfg.apiKey) throw authErr('auth/invalid-api-key'); session.app = { options: cfg }; sdk._inited = (sdk._inited || 0) + 1; return session.app; },
      getApps() { return session.app ? [session.app] : []; },
      getApp() { return session.app; },
      getAuth() { return { get currentUser() { return wrapUser(session.currentUser); }, _s: session }; },
      onAuthStateChanged(auth, cb) { session.authCbs.push(cb); Promise.resolve().then(() => cb(wrapUser(session.currentUser))); return () => { session.authCbs = session.authCbs.filter(x => x !== cb); }; },
      async createUserWithEmailAndPassword(auth, email, pw) {
        net(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) throw authErr('auth/invalid-email');
        if ((pw || '').length < 6) throw authErr('auth/weak-password');
        if (S.users.some(u => u.email === email.toLowerCase())) throw authErr('auth/email-already-in-use');
        const u = mkUser(email.toLowerCase(), null); u.password = pw; S.users.push(u); session.currentUser = u; fireAuth(); return { user: wrapUser(u) };
      },
      async signInWithEmailAndPassword(auth, email, pw) {
        net(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) throw authErr('auth/invalid-email');
        const u = S.users.find(x => x.email === (email || '').toLowerCase() && x.password === pw);
        if (!u) throw authErr('auth/invalid-credential'); if (u.disabled) throw authErr('auth/user-disabled');
        session.currentUser = u; fireAuth(); return { user: wrapUser(u) };
      },
      GoogleAuthProvider: function () { this.setCustomParameters = () => { }; },
      async signInWithPopup(auth, provider) {
        net(); if (S.googleMode === 'closed') throw authErr('auth/popup-closed-by-user'); if (S.googleMode === 'blocked') throw authErr('auth/popup-blocked'); if (S.googleMode === 'domain') throw authErr('auth/unauthorized-domain');
        const email = (S.googleEmail || 'google.nutzer@gmail.com').toLowerCase(); let u = S.users.find(x => x.email === email);
        if (!u) { u = mkUser(email, S.googleName || 'Google Nutzer'); u.google = true; S.users.push(u); }
        session.currentUser = u; fireAuth(); return { user: wrapUser(u) };
      },
      async signInWithRedirect() { throw authErr('auth/operation-not-supported-in-this-environment'); },
      async getRedirectResult() { return null; },
      async sendPasswordResetEmail(auth, email) { net(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) throw authErr('auth/invalid-email'); S.resets.push(email.toLowerCase()); },
      async signOut() { session.currentUser = null; fireAuth(); },
      async updateProfile(user, p) { const u = session.currentUser; if (u && p.displayName !== undefined) u.displayName = p.displayName; fireAuth(); },
      getDatabase() { return { _s: session }; },
      ref(db, path) { return { path: segs(path || '').join('/') }; },
      onValue(r, cb, errCb) { const l = { path: r.path, cb, errCb, session, last: undefined, dead: false }; S.listeners.push(l); Promise.resolve().then(() => { if (!l.dead) { l.last = undefined; S.notify(); } }); return () => { l.dead = true; S.listeners = S.listeners.filter(x => x !== l); }; },
      async get(r) {
        if (S.failNetwork) throw Object.assign(new Error('Client is offline.'), { code: 'unavailable' });
        if (!S.engine.canRead(S.db, r.path, session.currentUser)) throw Object.assign(new Error('Permission denied'), { code: 'PERMISSION_DENIED' });
        return snapshot(getAt(S.db, segs(r.path)));
      },
      async set(r, v) { S.write(session, { [r.path]: v }); },
      async remove(r) { S.write(session, { [r.path]: null }); },
      async update(r, upd) { const m = {}; Object.keys(upd).forEach(k => { m[[r.path, k].filter(Boolean).join('/')] = upd[k]; }); S.write(session, m); }
    };
    return sdk;
  }

  const api = { makeServer, makeEngine, Snap, norm, getAt, setAt };
  g.FakeFirebase = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
