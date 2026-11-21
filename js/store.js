/* Persistenz: IndexedDB (Stores: kv, plans, recipes) mit Fallback auf localStorage bzw. Arbeitsspeicher.
 * Alle Daten liegen zusätzlich in einem Cache im Speicher; Schreibzugriffe gehen sofort in den Cache
 * und asynchron in die Datenbank. */
(function (g) {
  'use strict';
  const LS_KEY = 'essensplaner.v1';
  const S = { backend: 'memory', ready: false, cache: { kv: {}, plans: {}, recipes: {} }, lastError: null };
  let db = null;

  const wrap = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const open = () => new Promise((res, rej) => {
    const o = indexedDB.open('essensplaner', 1);
    o.onupgradeneeded = () => {
      const d = o.result;
      d.createObjectStore('kv');
      d.createObjectStore('plans', { keyPath: 'weekStart' });
      d.createObjectStore('recipes', { keyPath: 'id' });
    };
    o.onsuccess = () => res(o.result);
    o.onerror = () => rej(o.error);
    o.onblocked = () => rej(new Error('IndexedDB blockiert'));
  });

  S.init = async function () {
    if (typeof indexedDB !== 'undefined') {
      try {
        db = await open();
        const tx = db.transaction(['kv', 'plans', 'recipes'], 'readonly');
        const kvStore = tx.objectStore('kv');
        const [keys, vals, plans, recipes] = await Promise.all([
          wrap(kvStore.getAllKeys()), wrap(kvStore.getAll()),
          wrap(tx.objectStore('plans').getAll()), wrap(tx.objectStore('recipes').getAll())
        ]);
        keys.forEach((k, i) => { S.cache.kv[k] = vals[i]; });
        plans.forEach(p => { S.cache.plans[p.weekStart] = p; });
        recipes.forEach(r => { S.cache.recipes[r.id] = r; });
        S.backend = 'indexeddb'; S.ready = true;
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
        return S;
      } catch (e) { S.lastError = e; db = null; }
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) { const c = JSON.parse(raw); S.cache = Object.assign({ kv: {}, plans: {}, recipes: {} }, c); }
        S.backend = 'localstorage'; S.ready = true; return S;
      } catch (e) { S.lastError = e; }
    }
    S.backend = 'memory'; S.ready = true; return S;
  };

  function lsSave() { try { localStorage.setItem(LS_KEY, JSON.stringify(S.cache)); } catch (e) { S.lastError = e; } }
  function idb(store, op, ...args) {
    if (!db) return Promise.resolve();
    return new Promise((res, rej) => {
      const t = db.transaction(store, 'readwrite');
      const st = t.objectStore(store);
      st[op](...args);
      t.oncomplete = () => res(); t.onerror = () => { S.lastError = t.error; rej(t.error); }; t.onabort = () => rej(t.error);
    }).catch(e => { console.warn('Speichern fehlgeschlagen', e); });
  }
  function persist(store, op, ...args) {
    if (S.backend === 'indexeddb') return idb(store, op, ...args);
    if (S.backend === 'localstorage') lsSave();
    return Promise.resolve();
  }

  // Key-Value (Einstellungen, Bewertungen, Favoriten, Vorräte …)
  S.get = (k, def) => (k in S.cache.kv ? S.cache.kv[k] : def);
  S.set = (k, v) => { S.cache.kv[k] = v; return persist('kv', 'put', v, k); };

  // Wochenpläne
  S.plans = () => Object.values(S.cache.plans).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  S.plan = ws => S.cache.plans[ws] || null;
  S.putPlan = p => { S.cache.plans[p.weekStart] = p; return persist('plans', 'put', p); };
  S.delPlan = ws => { delete S.cache.plans[ws]; return persist('plans', 'delete', ws); };

  // Rezepte (Grunddatenbank + eigene)
  S.recipes = () => Object.values(S.cache.recipes);
  S.putRecipe = r => { S.cache.recipes[r.id] = r; return persist('recipes', 'put', r); };
  S.delRecipe = id => { delete S.cache.recipes[id]; return persist('recipes', 'delete', id); };

  // Familien-Zugang (Adresse, Schlüssel, Gerätekennung) gehört zu diesem Gerät und wird weder exportiert noch synchronisiert/überschrieben
  const LOCAL_ONLY = ['family', 'famdoc', 'famLast', 'fbConfig', 'authHint', 'pendingJoin'];
  S.exportAll = () => { const o = JSON.parse(JSON.stringify({ app: 'essensplaner', version: 1, exportedAt: new Date().toISOString(), data: S.cache })); LOCAL_ONLY.forEach(k => delete o.data.kv[k]); return o; };

  S.importAll = async function (obj) {
    if (!obj || obj.app !== 'essensplaner' || !obj.data) throw new Error('Keine gültige Essensplaner-Sicherung.');
    const keep = {}; LOCAL_ONLY.forEach(k => { if (k in S.cache.kv) keep[k] = S.cache.kv[k]; });
    await S.resetAll();
    const d = obj.data;
    for (const [k, v] of Object.entries(d.kv || {})) await S.set(k, v);
    for (const p of Object.values(d.plans || {})) await S.putPlan(p);
    for (const r of Object.values(d.recipes || {})) await S.putRecipe(r);
    for (const [k, v] of Object.entries(keep)) await S.set(k, v);
  };

  S.resetAll = async function () {
    for (const k of Object.keys(S.cache.kv)) await persist('kv', 'delete', k);
    for (const k of Object.keys(S.cache.plans)) await persist('plans', 'delete', k);
    for (const k of Object.keys(S.cache.recipes)) await persist('recipes', 'delete', k);
    S.cache = { kv: {}, plans: {}, recipes: {} };
    if (S.backend === 'localstorage') lsSave();
  };

  g.Store = S;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof globalThis !== 'undefined' ? globalThis : self);
