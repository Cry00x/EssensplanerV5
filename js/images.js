/* Rezeptfotos.
 * Es werden ausschließlich echte Fotos verwendet – keine Illustrationen. Reihenfolge je Rezept:
 *   1. eigenes Foto des Nutzers (hochgeladen/aufgenommen)
 *   2. Originalbild eines importierten Rezepts (nur wenn beim Import ausdrücklich übernommen)
 *   3. automatisch gefundenes Foto: Wikimedia Commons (ohne Schlüssel, nur frei lizenzierte Fotos mit Namensnennung)
 *      und optional Pexels (mit eigenem kostenlosen API-Schlüssel)
 * Jeder Treffer wird gegen Suchhinweise des Rezepts geprüft (Titel/Beschreibung müssen zum Gericht passen).
 * Gefundene Fotos werden dauerhaft dem Rezept zugeordnet (IndexedDB) und vom Service Worker offline vorgehalten.
 * Gibt es keinen sicheren Treffer, erscheint ein neutraler Platzhalter – niemals ein Foto eines anderen Gerichts. */
(function (g) {
  'use strict';
  const I = { cache: {}, status: {}, cfg: { pexelsKey: '' }, getRecipe: null, onChange: null, fetchImpl: null };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RETRY_MS = 7 * 24 * 3600 * 1000;

  // ───────────── Prüfung von Treffern (rein, testbar) ─────────────
  const BLACKLIST = /logo|karte\b|\bmap\b|diagram|schema|plakat|poster|speisekarte|menu\b|menü|label|packung|verpackung|briefmarke|banknote|münze|coin|flagge|flag\b|wappen|restaurant|pizzeria|imbiss|stand\b|markt\b|market|laden\b|shop|store|building|gebäude|straße|street|portrait|porträt|person|people|kind\b|child|tier\b|animal|plant\b|pflanze|field|feld\b|baum|tree\b|rezeptbuch|cookbook|buch\b|book\b|zeichnung|drawing|illustration|painting|gemälde|kochbuch|werbung|advert/i;
  const stripHtml = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  const norm = s => String(s || '').toLowerCase().replace(/_/g, ' ');
  function partMatches(text, part) {
    part = part.trim(); if (!part) return true;
    const re = new RegExp('(^|[^a-zäöüß0-9])' + part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return re.test(text);
  }
  /** keys: ["a+b", "c"] → mindestens ein Eintrag muss vollständig (alle "+"-Teile) im Text vorkommen. */
  I.matchesKeys = (text, keys) => (keys || []).some(k => String(k).split('+').every(p => partMatches(text, p)));

  const LICENSE_OK = /^(cc0|cc[- ]by(?![- ]n[cd])|cc[- ]by[- ]sa|public domain|pd\b|pdm|gemeinfrei|pexels)/i;
  I.licenseOk = l => !!l && LICENSE_OK.test(String(l).trim()) && !/\b(nc|nd)\b/i.test(l);

  /** cand: {title, desc, w, h, mime, license, url}. Gibt true zurück, wenn das Foto zum Gericht passt. */
  I.verify = function (cand, keys) {
    if (!cand || !cand.url) return false;
    if (cand.mime && !/^image\/jpe?g$/i.test(cand.mime)) return false;
    if (cand.w && cand.w < 600) return false;
    if (cand.w && cand.h) { const ar = cand.w / cand.h; if (ar < 0.75 || ar > 2.3) return false; }
    if (!I.licenseOk(cand.license)) return false;
    const title = norm(String(cand.title || '').replace(/^file:/i, '').replace(/\.[a-z]{3,4}$/i, ''));
    const text = title + ' ' + norm(cand.desc);
    if (BLACKLIST.test(title)) return false;
    return I.matchesKeys(text, keys);
  };

  // ───────────── Hinweise ─────────────
  const STOP = new Set(['mit', 'und', 'aus', 'dem', 'der', 'die', 'das', 'auf', 'vom', 'von', 'zum', 'zur', 'mild', 'mildes', 'milde', 'milder', 'cremig', 'cremige', 'cremiger', 'bunte', 'bunter', 'knusprige', 'knuspriger', 'schnelle', 'schneller', 'einfache', 'einfacher', 'selbstgemachte', 'hausgemachte', 'herzhafte', 'leckere', 'leckerer', 'frische', 'gesunde', 'rezept', 'nach', 'art', 'wie', 'für', 'alla', 'the', 'and', 'with']);
  I.hints = function (r) {
    const D = g.DATA && g.DATA.IMG_HINTS && g.DATA.IMG_HINTS[r.id];
    if (D) return D;
    const toks = String(r.name || '').toLowerCase().split(/[^a-zäöüß]+/).filter(t => t.length >= 4 && !STOP.has(t));
    const keys = toks.length >= 2 ? [toks[0] + '+' + toks[1], toks[0] + toks[1]] : toks;
    return { q: [r.name, toks.slice(0, 2).join(' ')].filter(Boolean), k: keys, g: [], gk: [] };
  };

  // ───────────── Anbieter ─────────────
  I.wikiUrl = q => 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=' +
    encodeURIComponent(q + ' filetype:bitmap') + '&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=640&iiextmetadatafilter=LicenseShortName|Artist|ImageDescription|ObjectName';
  I.wikiCandidates = function (json) {
    const pages = json && json.query && json.query.pages ? Object.values(json.query.pages) : [];
    pages.sort((a, b) => (a.index || 0) - (b.index || 0));
    return pages.map(p => {
      const ii = p.imageinfo && p.imageinfo[0]; if (!ii) return null;
      const m = ii.extmetadata || {}, v = k => (m[k] && m[k].value) || '';
      return {
        source: 'wikimedia', title: p.title, desc: stripHtml(v('ImageDescription')) + ' ' + stripHtml(v('ObjectName')), mime: ii.mime,
        w: ii.width, h: ii.height, url: ii.thumburl || ii.url, page: ii.descriptionurl, author: stripHtml(v('Artist')).slice(0, 80), license: stripHtml(v('LicenseShortName'))
      };
    }).filter(Boolean);
  };
  I.pexelsUrl = q => 'https://api.pexels.com/v1/search?per_page=15&orientation=landscape&query=' + encodeURIComponent(q);
  I.pexelsCandidates = function (json) {
    return ((json && json.photos) || []).map(p => ({
      source: 'pexels', title: p.alt || '', desc: '', mime: 'image/jpeg', w: p.width, h: p.height, url: p.src && (p.src.large || p.src.medium),
      page: p.url, author: p.photographer || '', license: 'Pexels-Lizenz'
    })).filter(c => c.title && c.url);
  };
  const doFetch = (url, opt) => (I.fetchImpl || g.fetch.bind(g))(url, opt);
  async function getJson(url, opt) {
    const res = await doFetch(url, opt);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }
  const providers = () => {
    const p = [{ name: 'wikimedia', search: async q => I.wikiCandidates(await getJson(I.wikiUrl(q))) }];
    if (I.cfg.pexelsKey) p.push({ name: 'pexels', search: async q => I.pexelsCandidates(await getJson(I.pexelsUrl(q + ' food'), { headers: { Authorization: I.cfg.pexelsKey } })) });
    return p;
  };

  /** Sucht ein Foto: erst gezielt, dann (als „Beispielfoto“ gekennzeichnet) allgemeiner. Gibt Datensatz oder null zurück. */
  I.resolve = async function (r) {
    const h = I.hints(r);
    const tiers = [{ q: (h.q || []).slice(0, 3), k: h.k, similar: false }, { q: (h.g || []).slice(0, 2), k: h.gk, similar: true }];
    for (const t of tiers) {
      if (!t.q.length || !t.k || !t.k.length) continue;
      for (const prov of providers()) {
        for (const q of t.q) {
          const cands = await prov.search(q);
          const hit = cands.find(c => I.verify(c, t.k));
          if (hit) return { url: hit.url, page: hit.page, author: hit.author, license: hit.license, source: hit.source, title: String(hit.title || '').replace(/^File:/, ''), similar: t.similar, q, ts: Date.now() };
        }
      }
    }
    return null;
  };

  // ───────────── Zuordnung, Cache, Warteschlange ─────────────
  const own = r => (r.photo ? { url: r.photo, own: true } : null);
  const original = r => (r.image ? { url: r.image, original: true } : null);
  I.record = r => own(r) || original(r) || (I.cache[r.id] && I.cache[r.id].url ? I.cache[r.id] : null);
  I.state = r => (I.record(r) ? 'ok' : (I.cache[r.id] && I.cache[r.id].fail ? 'none' : (I.status[r.id] || 'idle')));

  const ph = (r, cls) => {
    const st = I.state(r);
    return `<div class="${esc(cls)} ph ${st === 'none' ? 'none' : (st === 'offline' ? 'none' : 'loading')}" data-rid="${esc(r.id)}" data-cls="${esc(cls)}" role="img" aria-label="Foto ${st === 'none' ? 'nicht verfügbar' : 'wird gesucht'}">` +
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1.5-3 4-3 7 0 2 1 3 3 3v8"/></svg>` +
      `<small>${st === 'none' ? 'Kein Foto gefunden' : (st === 'offline' ? 'Foto offline nicht verfügbar' : 'Foto wird gesucht …')}</small></div>`;
  };
  /** HTML für das Rezeptbild (img oder neutraler Platzhalter). cls z. B. "thumb", "sheet-img". */
  I.tag = function (r, cls) {
    const x = I.record(r);
    if (x) return `<img class="${esc(cls)} photo" src="${esc(x.url)}" alt="${esc(r.name)}" loading="lazy" decoding="async" data-rid="${esc(r.id)}" data-cls="${esc(cls)}">`;
    return ph(r, cls);
  };
  I.credit = function (r) {
    const x = I.record(r); if (!x) return '';
    if (x.own) return '<div class="credit">Eigenes Foto</div>';
    if (x.original) { const s = r.source || {}; return `<div class="credit">Originalbild${s.site ? ' von ' + esc(s.site) : ''}${s.url ? ` · <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Quelle</a>` : ''}</div>`; }
    const src = x.source === 'pexels' ? 'Pexels' : 'Wikimedia Commons';
    return `<div class="credit">${x.similar ? '<b>Beispielfoto</b> (ähnliches Gericht) · ' : ''}Foto: ${esc(x.author || 'unbekannt')} · ${esc(x.license)} · <a href="${esc(x.page)}" target="_blank" rel="noopener noreferrer">${src}</a></div>`;
  };

  let saveT = null;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { if (g.Store && g.Store.ready) g.Store.set('imgcache', I.cache); }, 400);
  }
  I.load = function () {
    if (!g.Store) return;
    I.cache = g.Store.get('imgcache', {}) || {};
    I.cfg = Object.assign({ pexelsKey: '' }, g.Store.get('imgcfg', {}));
  };
  I.saveCfg = cfg => { I.cfg = Object.assign(I.cfg, cfg); if (g.Store) g.Store.set('imgcfg', I.cfg); };

  I.paint = function (id) {
    if (typeof document === 'undefined' || !I.getRecipe) return;
    const r = I.getRecipe(id); if (!r) return;
    document.querySelectorAll('.ph[data-rid="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]').forEach(el => { el.outerHTML = I.tag(r, el.dataset.cls || 'thumb'); });
    if (I.onChange) I.onChange(id);
  };

  const queue = []; let active = 0, offline = false;
  const MAX = 2;
  function needs(r) {
    if (own(r) || original(r)) return false;
    const c = I.cache[r.id];
    if (c && c.url) return false;
    if (c && c.fail && Date.now() - (c.ts || 0) < RETRY_MS) return false;
    return !I.status[r.id] || I.status[r.id] === 'offline';
  }
  async function run(r) {
    I.status[r.id] = 'searching';
    try {
      const rec = await I.resolve(r);
      I.cache[r.id] = rec || { fail: true, ts: Date.now() };
      I.status[r.id] = rec ? 'ok' : 'none';
      persist();
    } catch (e) {
      I.status[r.id] = 'offline'; offline = true; // Netzfehler: nicht als „nicht gefunden“ speichern
    }
    I.paint(r.id);
  }
  function pump() {
    while (active < MAX && queue.length && !offline) {
      const r = queue.shift(); if (!needs(r)) continue;
      active++; run(r).finally(() => { active--; setTimeout(pump, 120); });
    }
  }
  /** Reiht Rezepte zur Suche ein. first=true: vorne anstellen (sichtbare Rezepte). */
  I.ensure = function (list, first) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    offline = false;
    const add = list.filter(r => needs(r) && !queue.includes(r));
    first ? queue.unshift(...add) : queue.push(...add);
    pump();
  };
  I.retryFailed = function (list) {
    list.forEach(r => { const c = I.cache[r.id]; if (c && c.fail) delete I.cache[r.id]; delete I.status[r.id]; });
    persist(); I.ensure(list, true);
  };
  I.reset = function (r) { delete I.cache[r.id]; delete I.status[r.id]; persist(); I.ensure([r], true); };
  I.stats = list => {
    let ok = 0, similar = 0, none = 0, pending = 0, ownN = 0;
    list.forEach(r => { const s = I.state(r); if (s === 'ok') { ok++; const x = I.record(r); if (x.similar) similar++; if (x.own || x.original) ownN++; } else if (s === 'none') none++; else pending++; });
    return { total: list.length, ok, similar, none, pending, own: ownN };
  };
  I.busy = () => active + queue.length > 0;

  /** Verkleinert ein Foto auf max. 960 px und liefert eine JPEG-Data-URL. */
  I.fromFile = async function (file) {
    const bmp = await new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; });
    const k = Math.min(1, 960 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', .8);
  };

  // Bild lässt sich nicht laden (gelöscht/gesperrt): Eintrag verwerfen, neutraler Zustand statt falscher Anzeige
  if (typeof document !== 'undefined') {
    document.addEventListener('error', ev => {
      const el = ev.target; if (!el || el.tagName !== 'IMG' || !el.classList.contains('photo')) return;
      const id = el.dataset.rid, r = I.getRecipe && I.getRecipe(id); if (!r) return;
      if (!own(r) && I.cache[id] && I.cache[id].url) { delete I.cache[id]; persist(); I.status[id] = 'offline'; }
      if (r.image && !own(r)) { /* Originalbild nicht erreichbar */ }
      el.outerHTML = ph(r, el.dataset.cls || 'thumb');
    }, true);
  }

  g.Images = I;
  if (typeof module !== 'undefined' && module.exports) module.exports = I;
})(typeof globalThis !== 'undefined' ? globalThis : self);
