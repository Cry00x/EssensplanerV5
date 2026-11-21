/* Rezeptimport aus dem Internet.
 * Die meisten Rezeptseiten (u. a. Chefkoch, Lecker, EAT SMARTER, Rezeptwelt) liefern ihre Rezepte zusätzlich als
 * maschinenlesbare schema.org-Daten (JSON-LD, Typ "Recipe"). Dieses Modul liest sie aus, wandelt Zutaten in die
 * Zutatenliste der App um (laktosefreie Entsprechungen, Preise nur wenn bekannt), rechnet auf 4 Personen um und
 * erkennt Duplikate. Seiten können aus dem Browser nur über einen Proxy geladen werden (CORS); schlägt das fehl,
 * lässt sich der Seitenquelltext einfügen oder das Rezept manuell eingeben. */
(function (g) {
  'use strict';
  const Imp = {};
  const E = () => g.Engine;

  // ───────────── Hilfen ─────────────
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', deg: '°', frac12: '½', frac14: '¼', frac34: '¾', ndash: '–', mdash: '—', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê' };
  Imp.decode = s => String(s == null ? '' : s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-zA-Z0-9]+);/g, (m, n) => (n in ENT ? ENT[n] : m));
  const clean = s => Imp.decode(String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').trim();
  const slug = s => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /** ISO-8601-Dauer (PT1H30M) → Minuten */
  Imp.parseDuration = function (v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return Math.round(v);
    const m = String(v).match(/^P(?:(\d+)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+)S)?$/i);
    if (!m) { const n = parseInt(String(v), 10); return isNaN(n) ? null : n; }
    return Math.round((+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0)) || null;
  };
  Imp.parseYield = function (v) {
    if (Array.isArray(v)) v = v.find(x => /\d/.test(String(x))) || v[0];
    const m = String(v == null ? '' : v).match(/(\d+)(?:\s*[-–]\s*(\d+))?/);
    return m ? (m[2] ? Math.round((+m[1] + +m[2]) / 2) : +m[1]) : null;
  };

  // ───────────── Rezeptdaten aus HTML ─────────────
  function typeIs(n, t) { const x = n && n['@type']; return Array.isArray(x) ? x.some(y => String(y).toLowerCase() === t) : String(x || '').toLowerCase() === t; }
  function findRecipe(node, depth) {
    depth = depth || 0; if (!node || depth > 6) return null;
    if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n, depth + 1); if (r) return r; } return null; }
    if (typeof node !== 'object') return null;
    if (typeIs(node, 'recipe')) return node;
    for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) if (node[k]) { const r = findRecipe(node[k], depth + 1); if (r) return r; }
    return null;
  }
  Imp.jsonLdBlocks = function (html) {
    const out = []; const re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi; let m;
    while ((m = re.exec(html))) { try { out.push(JSON.parse(m[1].trim())); } catch (e) { try { out.push(JSON.parse(m[1].replace(/[\u0000-\u001f]+/g, ' ').trim())); } catch (e2) { /* ungültiger Block */ } } }
    return out;
  };
  function imageOf(v) {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) { for (const x of v) { const u = imageOf(x); if (u) return u; } return ''; }
    return v.url || v.contentUrl || '';
  }
  function stepsOf(v) {
    const out = [];
    (function walk(x) {
      if (!x) return;
      if (typeof x === 'string') { clean(x).split(/\n+/).forEach(t => { if (t) out.push(t); }); return; }
      if (Array.isArray(x)) return x.forEach(walk);
      if (x.itemListElement) return walk(x.itemListElement);
      if (x.text) return walk(x.text);
      if (x.name && typeIs(x, 'howtostep')) return walk(x.name);
    })(v);
    // eine einzige lange Textmasse in Sätze/Absätze aufteilen
    if (out.length === 1 && out[0].length > 240) {
      const parts = out[0].split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9])/); const chunks = []; let cur = '';
      parts.forEach(p => { cur = cur ? cur + ' ' + p : p; if (cur.length > 110) { chunks.push(cur); cur = ''; } }); if (cur) chunks.push(cur); return chunks;
    }
    return out;
  }
  const listOf = v => (Array.isArray(v) ? v : (v ? String(v).split(/[,;]/) : [])).map(x => clean(typeof x === 'object' ? x.name || '' : x)).filter(Boolean);

  /** HTML-Text einer Rezeptseite → Rohdaten des Rezepts oder null. */
  Imp.fromHtml = function (html, url) {
    const node = findRecipe(Imp.jsonLdBlocks(String(html || '')));
    let host = ''; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { }
    if (!node) return null;
    const ingredients = (Array.isArray(node.recipeIngredient) ? node.recipeIngredient : (node.ingredients ? [].concat(node.ingredients) : [])).map(x => clean(x)).filter(Boolean);
    const steps = stepsOf(node.recipeInstructions);
    if (!ingredients.length && !steps.length) return null;
    const author = node.author ? clean(Array.isArray(node.author) ? (node.author[0] && node.author[0].name) || node.author[0] : node.author.name || node.author) : '';
    const total = Imp.parseDuration(node.totalTime), prep = Imp.parseDuration(node.prepTime), cook = Imp.parseDuration(node.cookTime);
    return {
      name: clean(node.name) || (host ? 'Rezept von ' + host : 'Importiertes Rezept'), servings: Imp.parseYield(node.recipeYield), time: total || ((prep || 0) + (cook || 0)) || null,
      ingredients, steps, image: imageOf(node.image), cuisine: listOf(node.recipeCuisine).concat(listOf(node.recipeCategory), listOf(node.keywords)),
      source: { url: url || '', site: host, author }
    };
  };

  // ───────────── Zutaten-Parser ─────────────
  const UNITS = {
    g: ['g', 1], gr: ['g', 1], gramm: ['g', 1], kg: ['g', 1000], kilo: ['g', 1000], ml: ['ml', 1], l: ['ml', 1000], liter: ['ml', 1000], dl: ['ml', 100], cl: ['ml', 10],
    el: ['EL', 1], essl: ['EL', 1], esslöffel: ['EL', 1], tl: ['TL', 1], teelöffel: ['TL', 1], prise: ['TL', .25], prisen: ['TL', .25], msp: ['TL', .25], messerspitze: ['TL', .25],
    tasse: ['ml', 250], tassen: ['ml', 250],
    bund: ['Stk', 1], bünde: ['Stk', 1], dose: ['Stk', 1], dosen: ['Stk', 1], pck: ['Stk', 1], päckchen: ['Stk', 1], pkt: ['Stk', 1], packung: ['Stk', 1], packungen: ['Stk', 1], becher: ['Stk', 1],
    scheibe: ['Stk', 1], scheiben: ['Stk', 1], stange: ['Stk', 1], stangen: ['Stk', 1], stück: ['Stk', 1], stücke: ['Stk', 1], stk: ['Stk', 1], st: ['Stk', 1],
    zehe: ['Stk', 1], zehen: ['Stk', 1], glas: ['Stk', 1], gläser: ['Stk', 1], handvoll: ['Stk', 1], zweig: ['Stk', 1], zweige: ['Stk', 1], blatt: ['Stk', 1], blätter: ['Stk', 1], kopf: ['Stk', 1], knolle: ['Stk', 1], knollen: ['Stk', 1]
  };
  const PACKISH = new Set(['dose', 'dosen', 'pck', 'päckchen', 'pkt', 'packung', 'packungen', 'becher', 'glas', 'gläser']);
  const FRAC = { '½': ' 1/2', '¼': ' 1/4', '¾': ' 3/4', '⅓': ' 1/3', '⅔': ' 2/3', '⅛': ' 1/8' };
  const numOf = s => { s = String(s).trim(); let t = 0; s.split(/\s+/).forEach(p => { if (p.includes('/')) { const [a, b] = p.split('/'); t += +a / +b; } else t += parseFloat(p.replace(',', '.')); }); return t; };

  /** Zerlegt eine Zutatenzeile in { amount, unit(roh), name, raw }. */
  Imp.splitIngredient = function (line) {
    let t = String(line || '').replace(/[½¼¾⅓⅔⅛]/g, m => FRAC[m]).replace(/(\d)\s+(1\/\d)/, '$1 $2').replace(/^[\s•*\-–]+/, '').trim();
    t = t.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    const m = t.match(/^(?:ca\.?|circa|etwa|ungefähr)?\s*(\d+\/\d+|\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?)(?:\s*(?:-|–|bis)\s*(\d+(?:[.,]\d+)?))?\s*(.*)$/i);
    let amount = null, rest = t;
    if (m) { amount = numOf(m[1]); if (m[2]) amount = (amount + numOf(m[2])) / 2; rest = m[3]; }
    let unit = null;
    const um = rest.match(/^([A-Za-zäöüÄÖÜß]+)\.?(?:\s+|$)(.*)$/);
    if (um && UNITS[um[1].toLowerCase()] && (amount !== null)) { unit = um[1].toLowerCase(); rest = um[2]; }
    rest = rest.replace(/\s+(zum|zur|zu|nach|für|evtl\.?|optional)\b.*$/i, '').replace(/,.*$/, '').replace(/\s+oder\s+.*$/i, '').replace(/^(von|vom|der|die|das)\s+/i, '').trim();
    return { amount, unit, name: rest, raw: line };
  };

  // Zuordnung auf den Zutatenkatalog (Reihenfolge wichtig: Spezielles vor Allgemeinem)
  const ALIAS = [
    [/pilz|champignon|pfifferling|steinpilz|shiitake/, null],
    [/h(ä|ae)hnchen.*unterkeule|h(ä|ae)hnchenkeule|h(ü|ue)hnerkeule|h(ä|ae)hnchenschenkel/, 'haehnchenkeule'],
    [/h(ä|ae)hnchen|h(ü|ue)hner|poularde|geflügel/, 'haehnchenbrust'],
    [/hack|gehacktes|bolognese(?!soße)/, 'hack'],
    [/schweine|schnitzel|nackensteak|kotelett/, 'schwein'],
    [/rind|gulasch|beef/, 'rind'],
    [/speck|bacon|schinkenw/, 'speck'],
    [/frisch(k|ä)se|frischkaese|doppelrahm/, 'frischkaese'],
    [/mozzarella/, 'mozzarella'],
    [/quark/, 'quark'],
    [/butterschmalz|^butter\b|butter$|margarine/, 'butter'],
    [/kokosmilch|kokosnussmilch|kokosrahm/, 'kokosmilch'],
    [/sahne|schlagobers|creme fra(î|i)che|crème fraîche|schmand|kochcreme/, 'sahne'],
    [/joghurt|jogurt/, 'joghurt'],
    [/k(ä|ae)se|parmesan|gouda|emmentaler|gratink|cheddar|edamer|bergk/, 'kaese'],
    [/^eier?$|^eier\b|^ei\b|vollei|^hühnerei/, 'eier'],
    [/milch(?!reis)/, 'milch'],
    [/s(ü|ue)ß(-)?kartoffel|süsskartoffel|batate/, 'suesskartoffel'],
    [/kartoffel/, 'kartoffeln'],
    [/lauchzwiebel|fr(ü|ue)hlingszwiebel|frühlingslauch/, 'lauchzwiebeln'],
    [/zwiebel/, 'zwiebeln'],
    [/knoblauch/, 'knoblauch'],
    [/paprikapulver|paprika edels|paprika rosen|paprika, ?ed/, 'paprikapulver'],
    [/paprika|spitzpaprika/, 'paprika'],
    [/m(ö|oe)hre|karotte|mohrr(ü|ue)be|wurzel/, 'moehren'],
    [/gurke|gurken/, 'gurke'],
    [/tomatenmark/, 'tomatenmark'],
    [/passierte/, 'passierte'],
    [/dosentomate|stückige tomate|gehackte tomate|geschälte tomate|tomaten.*dose|tomaten.*stückig|tomaten.*gehackt|tomaten.*geschält/, 'gehackte'],
    [/tomate/, 'tomaten'],
    [/zucchini/, 'zucchini'],
    [/k(ü|ue)rbis|hokkaido|butternut/, 'kuerbis'],
    [/eisberg|kopfsalat|^salat\b|römersalat/, 'salat'],
    [/spinat/, 'spinat'],
    [/erbsen/, 'erbsen'],
    [/mais\b|maiskörner|zuckermais/, 'mais'],
    [/kidney|rote bohnen/, 'kidney'],
    [/kichererbse/, 'kichererbsen'],
    [/wei(ß|ss)e bohnen|cannellini|weissbohnen/, 'weissebohnen'],
    [/rote linsen|linsen/, 'rotelinsen'],
    [/lasagne/, 'lasagne'],
    [/couscous/, 'couscous'],
    [/nudel|spaghetti|penne|fusilli|spirelli|tagliatelle|makkaroni|pasta|farfalle|rigatoni/, 'nudeln'],
    [/reis\b|basmati|langkorn|jasmin|risotto/, 'reis'],
    [/paniermehl|semmelbr(ö|oe)sel|panko/, 'paniermehl'],
    [/hefe/, 'hefe'],
    [/tortilla|wrap|fladenbrot/, 'wraps'],
    [/apfelmus/, 'apfelmus'],
    [/soja(sauce|soße)|sojasoße|shoyu/, 'sojasauce'],
    [/oliven(ö|oe)l|raps(ö|oe)l|sonnenblumen(ö|oe)l|speise(ö|oe)l|pflanzen(ö|oe)l|brat(ö|oe)l|^(ö|oe)l\b|(ö|oe)l$/, 'oel'],
    [/^salz|meersalz|jodsalz|salz$/, 'salz'],
    [/pfeffer/, 'pfeffer'],
    [/^zucker|puderzucker|rohrzucker|zucker$/, 'zucker'],
    [/^mehl|weizenmehl|mehl$/, 'mehl'],
    [/curry/, 'curry'],
    [/kreuzk(ü|ue)mmel|kumin|cumin/, 'kreuzkuemmel'],
    [/br(ü|ue)he|bouillon|fond|gemüsebrühe/, 'bruehe'],
    [/oregano|basilikum|thymian|rosmarin|kräuter|kraeuter|petersilie|majoran|italienische/, 'kraeuter']
  ];
  const NOTE_SUB = { milch: 'Milch', sahne: 'Sahne/Crème fraîche/Schmand', kaese: 'Käse', joghurt: 'Joghurt', quark: 'Quark', frischkaese: 'Frischkäse', mozzarella: 'Mozzarella', butter: 'Butter' };

  const guessCat = name => {
    const n = name.toLowerCase();
    if (/fleisch|wurst|schinken|hähnchen|filet|steak|salami|lamm|pute|ente|gans|hack|speck/.test(n)) return 'Fleisch';
    if (/milch|sahne|käse|joghurt|quark|butter|feta|schmand|rahm/.test(n)) return 'Milchprodukte';
    if (/dose|konserve|passiert|tomatenmark|mark\b|eingelegt|oliven|gurken.*glas|mais\b/.test(n)) return 'Konserven';
    if (/mehl|reis|nudel|linsen|haferflock|stärke|grieß|bulgur|couscous|quinoa|nüsse|mandeln|zucker|backpulver|semmel|brösel|müsli/.test(n)) return 'Trockenprodukte';
    if (/gemüse|salat|lauch|sellerie|apfel|zitrone|limette|petersilie|basilikum|ingwer|banane|birne|orange|beere|kohlrabi|radieschen|aubergine|fenchel|rübe|spargel|avocado|dill|schnittlauch|minze|koriander|obst|pflaume|traube|melone|ananas|mango|lauch/.test(n)) return 'Obst und Gemüse';
    return 'Sonstiges';
  };

  // typisches Stückgewicht für Zutaten, die im Katalog in Gramm geführt werden
  const PIECE_G = { zwiebeln: 80, tomaten: 120, moehren: 100, kartoffeln: 90, suesskartoffel: 300, zucchini: 250, gurke: 400, kuerbis: 800, salat: 300, lauchzwiebeln: 20, spinat: 250, apfelmus: 350 };
  function convert(amount, unitWord, ing) {
    ing = Object.assign({}, ing); if (!ing.g && PIECE_G[ing.id]) ing.g = PIECE_G[ing.id];
    const U = unitWord ? UNITS[unitWord] : null, cu = U ? U[0] : null, f = U ? U[1] : 1;
    if (amount == null) return ing.pantry ? (ing.u === 'TL' ? 1 : (ing.u === 'ml' ? 10 : 10)) : (ing.u === 'Stk' ? 1 : null);
    let v = amount * f;
    if (unitWord && PACKISH.has(unitWord) && (ing.u === 'g' || ing.u === 'ml')) return amount * ing.pack;
    if (cu === ing.u || (cu == null && ing.u === 'Stk')) return v;
    if (ing.u === 'g' || ing.u === 'ml') { if (cu === 'EL') return v * 15; if (cu === 'TL') return v * 5; if (cu === 'g' || cu === 'ml') return v; if (cu === 'Stk' || cu == null) return ing.g ? v * ing.g : null; }
    if (ing.u === 'TL') { if (cu === 'EL') return v * 3; if (cu === 'g' || cu === 'ml') return v / 5; if (cu === 'Stk' || cu == null) return v; }
    if (ing.u === 'EL') { if (cu === 'TL') return v / 3; if (cu === 'g' || cu === 'ml') return v / 15; }
    if (ing.u === 'Stk') { if (cu === 'g' || cu === 'ml') return ing.g ? v / ing.g : null; if (cu === 'Stk') return v; }
    return null;
  }

  /** Wandelt eine Zutatenzeile in { id, amount, ing?, note? } um. `custom` sammelt neu angelegte Zutaten. */
  Imp.mapIngredient = function (ctx, line, custom) {
    const p = Imp.splitIngredient(line);
    let name = p.name; if (!name) return null;
    if (/:$/.test(name)) return null; // Zwischenüberschrift
    const lname = name.toLowerCase();
    const all = Object.assign({}, ctx.ing, custom);
    for (const [re, id] of ALIAS) {
      if (!re.test(lname)) continue;
      if (id === null) break; // Pilze: bewusst als eigene (ausgeschlossene) Zutat anlegen
      const ing = all[id]; if (!ing) continue;
      const amt = convert(p.amount, p.unit, ing);
      if (amt == null) break; // Einheit nicht umrechenbar → eigene Zutat
      const note = NOTE_SUB[id] && !/laktosefrei/i.test(name) && /milch|sahne|rahm|schmand|k(ä|ae)se|parmesan|gouda|emmentaler|cheddar|edamer|joghurt|jogurt|quark|butter|margarine|mozzarella|frisch/i.test(lname) ? `${cap(name)} → ${ing.n}` : null;
      return { id, amount: amt, note };
    }
    // Nicht im Katalog: eigene Zutat (Preis unbekannt)
    const U = p.unit ? UNITS[p.unit] : null;
    const unit = U ? U[0] : 'Stk';
    const amount = p.amount == null ? 1 : p.amount * (U ? U[1] : 1);
    const nm = cap(name.replace(/^\d+\s*/, ''));
    const id = 'x-' + slug(nm);
    const base = ctx.ing[id] || custom[id];
    if (!base) custom[id] = { id, n: nm, cat: guessCat(nm), u: unit, pack: Math.max(amount, unit === 'g' ? 250 : unit === 'ml' ? 250 : 1), price: 0, custom: true };
    const ing = custom[id] || ctx.ing[id];
    const a = convert(p.amount == null ? 1 : p.amount, p.unit, ing);
    return { id, amount: a == null ? amount : a, note: null, unknown: true, ing };
  };

  // ───────────── Rezept bauen ─────────────
  const CUISINE_MAP = [[/deutsch|german|hausmann/, 'deutsch'], [/italien|italian|pasta|pizza/, 'italienisch'], [/griech|greek/, 'griechisch'], [/türk|tuerk|turk/, 'türkisch'], [/mexik|mexic|tex-?mex/, 'mexikanisch'],
    [/chines|chinese/, 'chinesisch'], [/japan/, 'japanisch'], [/ind(isch|ian)|curry/, 'indisch'], [/amerik|american|usa|burger/, 'amerikanisch'], [/franz|french/, 'französisch'], [/mediterr|spanisch|spanish|orient|arab|libanes|marokk/, 'mediterran'], [/asia|thai|vietnam|korean|koreanisch/, 'asiatisch']];
  Imp.cuisinesFrom = list => { const out = []; String(list.join(' ')).toLowerCase().split(/[,;|]/).forEach(() => { }); const t = list.join(' ').toLowerCase(); CUISINE_MAP.forEach(([re, c]) => { if (re.test(t) && !out.includes(c)) out.push(c); }); return out.length ? out.slice(0, 3) : ['international']; };

  const MEAT_RE = /fleisch|hack|wurst|schinken|speck|hähnchen|hühn|pute|schwein|rind|lamm|salami|gulasch|schnitzel|bacon|kasseler|gyros|steak|filet|fisch|lachs|thunfisch|garnele|gelatine/i;
  function infer(items, ctx) {
    const ids = items.map(i => i.id), has = x => ids.includes(x), amt = x => (items.find(i => i.id === x) || {}).amount || 0;
    const veg = !items.some(i => (ctx.ing[i.id] || i.ing || {}).cat === 'Fleisch' || MEAT_RE.test((ctx.ing[i.id] || i.ing || {}).n || ''));
    let main = 'gemuese';
    if (has('haehnchenbrust') || has('haehnchenkeule')) main = 'haehnchen'; else if (has('hack')) main = 'hack'; else if (has('schwein')) main = 'schwein'; else if (has('rind')) main = 'rind';
    else if (has('mehl') && has('hefe')) main = 'pizza'; else if (amt('eier') >= 3) main = 'ei'; else if (has('kichererbsen') || has('kidney') || has('weissebohnen') || has('rotelinsen')) main = 'huelsen';
    else if (amt('kartoffeln') >= 400) main = 'kartoffel'; else if (has('kuerbis')) main = 'kuerbis';
    let carb = 'keine';
    if (has('reis')) carb = 'reis'; else if (has('nudeln') || has('lasagne')) carb = 'nudel'; else if (has('couscous')) carb = 'couscous'; else if (has('wraps')) carb = 'brot'; else if (amt('kartoffeln') >= 400) carb = 'kartoffel'; else if (has('kidney') || has('kichererbsen') || has('rotelinsen') || has('weissebohnen')) carb = 'huelsen';
    return { veg, main, carb };
  }

  /** Normalisierter Name für den Dublettenvergleich */
  const normName = s => String(s || '').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(mit|und|in|aus|der|die|das|a|an|auf|nach|art)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const toks = s => new Set(normName(s).split(' ').filter(t => t.length > 2));
  Imp.similarity = (a, b) => { const A = toks(a), B = toks(b); if (!A.size || !B.size) return 0; let i = 0; A.forEach(t => { if (B.has(t)) i++; }); return i / (A.size + B.size - i); };
  /** Gibt ein vorhandenes Rezept zurück, das (nach Quelle oder Name) dasselbe sein dürfte. */
  Imp.findDuplicate = function (recipes, name, url) {
    for (const r of recipes) {
      if (url && r.source && r.source.url && r.source.url.replace(/[#?].*$/, '') === url.replace(/[#?].*$/, '')) return { recipe: r, reason: 'Dieselbe Quelle wurde schon importiert.' };
      if (normName(r.name) === normName(name)) return { recipe: r, reason: 'Ein Rezept mit gleichem Namen existiert.' };
      if (Imp.similarity(r.name, name) >= 0.75) return { recipe: r, reason: 'Ein sehr ähnliches Rezept existiert.' };
    }
    return null;
  };

  /** Rohdaten → Rezept im Format der App (für 4 Personen). */
  Imp.buildRecipe = function (ctx, draft, opts) {
    opts = opts || {};
    const custom = {}, notes = [], unknown = [], items = [];
    draft.ingredients.forEach(line => {
      const m = Imp.mapIngredient(ctx, line, custom); if (!m) return;
      const ex = items.find(i => i.id === m.id); if (ex) ex.amount += m.amount; else items.push(m);
      if (m.note && !notes.includes(m.note)) notes.push(m.note);
      if (m.unknown && !unknown.includes(m.ing.n)) unknown.push(m.ing.n);
    });
    const servings = draft.servings && draft.servings > 0 ? draft.servings : 4, k = 4 / servings;
    const ings = items.map(i => {
      const ing = ctx.ing[i.id] || custom[i.id] || i.ing; let a = i.amount * k;
      a = ing.u === 'Stk' || ing.u === 'EL' || ing.u === 'TL' ? Math.max(0.25, Math.round(a * 4) / 4) : Math.max(1, Math.round(a));
      return [i.id, a];
    });
    const inf = infer(items, ctx);
    const time = Math.max(5, draft.time || 30);
    const idBase = 'i-' + slug(draft.name).slice(0, 36) + '-' + hash((draft.source && draft.source.url) || draft.name).slice(0, 5);
    const recipe = {
      id: opts.id || idBase, name: draft.name, emoji: '🍽️', veg: inf.veg, time, diff: time <= 30 ? 'leicht' : (time <= 50 ? 'mittel' : 'anspruchsvoll'),
      main: inf.main, carb: inf.carb, cuisines: Imp.cuisinesFrom(draft.cuisine || []), ings, steps: draft.steps.length ? draft.steps : ['Zubereitung siehe Originalquelle.'],
      custom: true, imported: true, source: Object.assign({ importedAt: Date.now(), originalServings: draft.servings || null }, draft.source || {})
    };
    if (opts.useImage && draft.image) recipe.image = draft.image;
    const dup = Imp.findDuplicate(ctx.recipes, recipe.name, recipe.source.url);
    const E_ = E();
    const tmpCtx = E_.makeCtx({ settings: ctx.settings, recipes: [], customIng: Object.assign({}, ctx.ing, custom) });
    return { recipe, newIng: custom, notes, unknown, dup, violations: E_.violations(tmpCtx, recipe), servings: draft.servings || null };
  };

  // ───────────── Laden ─────────────
  Imp.DEFAULT_PROXIES = ['https://api.allorigins.win/raw?url={url}', 'https://corsproxy.io/?{url}'];
  Imp.validUrl = u => { try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } };
  /** Versucht direkt, dann über Proxys. Gibt { html, via } zurück oder wirft einen Fehler mit Erklärung. */
  Imp.fetchHtml = async function (url, opts) {
    opts = opts || {}; const f = opts.fetchImpl || ((u, o) => g.fetch(u, o));
    const targets = [{ via: 'direkt', url }].concat((opts.proxies || Imp.DEFAULT_PROXIES).filter(Boolean).map(p => ({ via: p.replace(/^https?:\/\//, '').split('/')[0], url: p.replace('{url}', encodeURIComponent(url)) })));
    const errs = [];
    for (const t of targets) {
      try {
        const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; const to = ctl ? setTimeout(() => ctl.abort(), opts.timeout || 14000) : null;
        const res = await f(t.url, ctl ? { signal: ctl.signal } : {}); if (to) clearTimeout(to);
        if (!res.ok) { errs.push(`${t.via}: HTTP ${res.status}`); continue; }
        const html = await res.text();
        if (html && html.length > 200 && /<\w+/.test(html)) return { html, via: t.via };
        errs.push(`${t.via}: leere Antwort`);
      } catch (e) { errs.push(`${t.via}: ${e && e.name === 'AbortError' ? 'Zeitüberschreitung' : 'nicht erreichbar'}`); }
    }
    const err = new Error('Die Seite konnte nicht geladen werden (' + errs.join('; ') + ').'); err.details = errs; throw err;
  };

  g.Importer = Imp;
  if (typeof module !== 'undefined' && module.exports) module.exports = Imp;
})(typeof globalThis !== 'undefined' ? globalThis : self);
