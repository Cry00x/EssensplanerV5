/* Optionale Cloud-Synchronisierung.
 * Es gibt bewusst KEINEN fest eingebauten Cloud-Dienst. Wer synchronisieren möchte, trägt in den Einstellungen
 * die Adresse eines eigenen JSON-Speichers ein (jeder Dienst, der GET und PUT für eine URL unterstützt,
 * z. B. WebDAV/Nextcloud-Datei, eigener Server). Optional wird ein Bearer-Token mitgeschickt.
 * Strategie: „Letzte Änderung gewinnt“ auf Basis des Zeitstempels `syncUpdatedAt`.
 * Ohne Konfiguration passiert nichts; alle Daten bleiben lokal. */
(function (g) {
  'use strict';
  const Sync = { status: 'aus', last: null, error: null, listeners: [] };
  const emit = () => Sync.listeners.forEach(f => { try { f(Sync); } catch (e) { } });

  Sync.config = () => g.Store.get('sync', { url: '', token: '' });
  Sync.enabled = () => !!(Sync.config().url || '').trim();
  Sync.touch = () => g.Store.set('syncUpdatedAt', Date.now());

  async function req(method, body) {
    const c = Sync.config();
    const headers = { 'Content-Type': 'application/json' };
    if (c.token) headers.Authorization = 'Bearer ' + c.token;
    const res = await fetch(c.url, { method, headers, body, cache: 'no-store' });
    if (res.status === 404 && method === 'GET') return null; // noch keine Daten auf dem Server
    if (!res.ok) throw new Error('Server antwortete mit ' + res.status);
    return method === 'GET' ? res.json() : null;
  }

  /** Gleicht lokale und entfernte Daten ab. Gibt 'push' | 'pull' | 'equal' | 'skipped' zurück. */
  Sync.run = async function (onPulled) {
    if (!Sync.enabled()) { Sync.status = 'aus'; emit(); return 'skipped'; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { Sync.status = 'offline'; emit(); return 'skipped'; }
    Sync.status = 'läuft'; Sync.error = null; emit();
    try {
      const remote = await req('GET');
      const local = g.Store.exportAll();
      const lt = g.Store.get('syncUpdatedAt', 0), rt = remote && remote.data && remote.data.kv ? (remote.data.kv.syncUpdatedAt || 0) : 0;
      let out = 'equal';
      if (!remote || lt > rt) { await req('PUT', JSON.stringify(local)); out = 'push'; }
      else if (rt > lt) { await g.Store.importAll(remote); out = 'pull'; if (onPulled) onPulled(); }
      Sync.status = 'ok'; Sync.last = Date.now(); emit();
      g.Store.set('syncLast', Sync.last);
      return out;
    } catch (e) {
      Sync.status = 'fehler'; Sync.error = e.message || String(e); emit();
      return 'error';
    }
  };

  /** Läuft automatisch nach Änderungen (entprellt) und sobald das Netz zurückkommt. */
  let timer = null;
  Sync.schedule = (onPulled) => { if (!Sync.enabled()) return; clearTimeout(timer); timer = setTimeout(() => Sync.run(onPulled), 2500); };
  Sync.attach = (onPulled) => {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => Sync.run(onPulled));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Sync.run(onPulled); });
  };

  g.Sync = Sync;
})(typeof globalThis !== 'undefined' ? globalThis : self);
