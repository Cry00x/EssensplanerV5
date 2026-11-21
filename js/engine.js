/* Engine: Kosten, Einkaufsliste, Wochenplanung, Tausch, Budgetoptimierung.
 * Reine Logik ohne DOM – läuft im Browser und in Node (für die Tests). */
(function (g) {
  'use strict';
  const D = g.DATA;
  const E = {};

  E.DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  E.DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  E.CATS = ['Fleisch', 'Milchprodukte', 'Obst und Gemüse', 'Trockenprodukte', 'Konserven', 'Sonstiges'];
  E.CARB_LIMITS = { reis: 2, nudel: 2, kartoffel: 3, brot: 2, couscous: 1, huelsen: 2 };
  const MAIN_LIMIT = 2;

  // ───────────── Datum ─────────────
  const pad = n => String(n).padStart(2, '0');
  E.iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  E.parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  E.mondayOf = (date) => {
    const x = date ? new Date(date) : new Date();
    const d = new Date(x.getFullYear(), x.getMonth(), x.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return E.iso(d);
  };
  E.addWeeks = (iso, n) => { const d = E.parseIso(iso); d.setDate(d.getDate() + 7 * n); return E.iso(d); };
  E.weekNumber = (iso) => { // ISO-Kalenderwoche
    const d = E.parseIso(iso); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const w1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  };

  // ───────────── Einstellungen & Kontext ─────────────
  E.defaultSettings = () => ({
    persons: 4, budget: 120, market: 'Aldi Süd', priceFactor: 1, vegTarget: 3, maxTime: 45,
    intol: { laktose: true, fisch: true, pilze: true, kohl: true },
    unwanted: [], preferred: [], cuisines: [], allowSpicy: false, pantryBasics: true,
    priceOverrides: {}, stock: {}
  });

  E.makeCtx = function (st) {
    const settings = Object.assign(E.defaultSettings(), st.settings || {});
    settings.intol = Object.assign(E.defaultSettings().intol, (st.settings && st.settings.intol) || {});
    const recipes = st.recipes || [];
    const recipeMap = {};
    recipes.forEach(r => { recipeMap[r.id] = r; });
    return {
      settings, recipes, recipeMap,
      ratings: st.ratings || {}, favorites: st.favorites || {}, blocked: st.blocked || {},
      ing: Object.assign({}, D.ING, st.customIng || {}),
      history: st.history || [] // [{weekStart, days:[ids]}], neueste zuerst
    };
  };

  // ───────────── Zutaten, Preise, Mengen ─────────────
  E.priceOf = (ctx, id) => {
    const ov = ctx.settings.priceOverrides[id];
    if (ov !== undefined && ov !== null && ov !== '' && !isNaN(+ov)) return +ov;
    const i = ctx.ing[id];
    return (i && i.price ? i.price : 0) * ctx.settings.priceFactor;
  };
  E.isPantry = (ctx, id) => !!(ctx.ing[id] && ctx.ing[id].pantry && ctx.settings.pantryBasics);
  E.scale = (amount, persons) => amount * persons / 4;
  const grams = (i, amount) => i.u === 'g' || i.u === 'ml' ? amount : (i.g ? amount * i.g : 0);

  E.recipeIngredients = (ctx, r, persons) => r.ings.map(([id, a]) => {
    const i = ctx.ing[id] || { n: id, u: 'Stk' };
    return { id, name: i.n, unit: i.u, amount: E.scale(a, persons), pantry: E.isPantry(ctx, id), whole: !!i.whole };
  });

  /** Anteilige Kosten des Gerichts (Zutatenmenge / Packung × Packungspreis), ohne Vorräte. */
  E.recipeCost = (ctx, r, persons) => {
    let cost = 0, unknown = false;
    for (const [id, a] of r.ings) {
      const i = ctx.ing[id]; if (!i || E.isPantry(ctx, id)) continue;
      const p = E.priceOf(ctx, id);
      if (!p || !i.pack) { unknown = true; continue; }
      cost += E.scale(a, persons) / i.pack * p;
    }
    return { cost, unknown };
  };

  /** Nährwerte pro Portion (Rohgewicht, aus Durchschnittswerten je 100 g berechnet). */
  E.nutrition = (ctx, r) => {
    let kcal = 0, p = 0, c = 0, f = 0, missing = 0;
    for (const [id, a] of r.ings) {
      const i = ctx.ing[id];
      if (!i || i.kcal === undefined) { missing++; continue; }
      const gr = grams(i, a); // Basis: 4 Personen
      kcal += gr / 100 * i.kcal; p += gr / 100 * i.p; c += gr / 100 * i.c; f += gr / 100 * i.f;
    }
    return { kcal: kcal / 4, protein: p / 4, carbs: c / 4, fat: f / 4, complete: missing === 0 };
  };

  // ───────────── Ausschlüsse ─────────────
  const FISH_RE = /fisch|lachs|thunfisch|forelle|hering|makrele|garnele|shrimp|krabbe|muschel|tintenfisch|calamari|meeresfr|surimi|sardine|anchov|kabeljau|seelachs|scholle|pangasius|zander|karpfen|krebs|hummer|scampi|austern/i;
  const PILZ_RE = /pilz|champignon|steinpilz|pfifferling|shiitake|egerling|morchel|kräuterseitling|seitling/i;
  const KOHL_RE = /brokkoli|broccoli|blumenkohl|romanesco|kohlrabi|rosenkohl|weißkohl|weisskohl|rotkohl|blaukraut|wirsing|grünkohl|gruenkohl|spitzkohl|chinakohl|pak ?choi|sauerkraut|kohl(?!e)/i;
  const DAIRY_RE = /milch|sahne|rahm|joghurt|jogurt|käse|kaese|quark|butter|schmand|mozzarella|parmesan|feta|ricotta|mascarpone|molke|kefir|pudding/i;
  const LF_OK_RE = /laktosefrei|kokos|hafer|soja|mandel|pflanz/i;
  E.REGEX = { FISH_RE, PILZ_RE, KOHL_RE, DAIRY_RE, LF_OK_RE };

  /** Gründe, warum ein Rezept nicht zu den Einstellungen passt (leeres Array = passt). */
  E.violations = (ctx, r) => {
    const s = ctx.settings, out = [];
    const names = r.ings.map(([id]) => (ctx.ing[id] ? ctx.ing[id].n : id));
    const all = names.concat([r.name]);
    if (s.intol.fisch && all.some(n => FISH_RE.test(n))) out.push('Fisch/Meeresfrüchte');
    if (s.intol.pilze && all.some(n => PILZ_RE.test(n))) out.push('Pilze');
    if (s.intol.kohl && all.some(n => KOHL_RE.test(n))) out.push('Kohlgemüse');
    if (s.intol.laktose) {
      const bad = names.find(n => DAIRY_RE.test(n) && !LF_OK_RE.test(n));
      if (bad) out.push('Laktose (' + bad + ')');
    }
    for (const w of (s.unwanted || [])) {
      const t = String(w).trim().toLowerCase(); if (!t) continue;
      if (all.some(n => n.toLowerCase().includes(t))) out.push('Unerwünscht: ' + w);
    }
    return out;
  };
  E.isLactoseFree = (ctx, r) => !r.ings.some(([id]) => ctx.ing[id] && DAIRY_RE.test(ctx.ing[id].n) && !LF_OK_RE.test(ctx.ing[id].n));
  E.cuisinesOf = r => (r.cuisines && r.cuisines.length ? r.cuisines : ['international']);
  /** Hauptküche für Abwechslung: erste nicht-deutsche Küche, sonst die erste. */
  E.primaryCuisine = r => { const c = E.cuisinesOf(r); return c.find(x => x !== 'deutsch') || c[0]; };
  E.cuisineOk = (ctx, r) => { const w = ctx.settings.cuisines || []; return !w.length || E.cuisinesOf(r).some(c => w.includes(c)); };
  E.isActive = (ctx, r) => !ctx.blocked[r.id];
  E.isEligible = (ctx, r) =>
    !ctx.blocked[r.id] && r.time <= ctx.settings.maxTime && E.cuisineOk(ctx, r) &&
    (ctx.settings.allowSpicy || !r.spicy) && E.violations(ctx, r).length === 0;
  /** Gibt einen Hinweistext zurück, wenn das Gericht an anderer Stelle der Woche schon steht (sonst null). */
  E.canPlace = (plan, idx, id) => { const j = plan.days.findIndex((x, i) => i !== idx && x === id); return j >= 0 ? `Schon für ${E.DAYS[j]} eingeplant` : null; };

  // ───────────── Einkaufsliste ─────────────
  /** entries: [{r, persons}] → aggregierte Liste mit Packungsrundung, Vorräten und Kosten. */
  E.shoppingList = (ctx, entries) => {
    const need = {};
    for (const { r, persons } of entries) {
      if (!r) continue;
      for (const [id, a] of r.ings) need[id] = (need[id] || 0) + E.scale(a, persons);
    }
    const items = [];
    let total = 0, proRata = 0, waste = 0;
    for (const id of Object.keys(need)) {
      const i = ctx.ing[id]; if (!i) continue;
      if (E.isPantry(ctx, id)) continue;
      let n = need[id], stockUsed = 0;
      const st = ctx.settings.stock[id];
      if (st === true) { stockUsed = n; n = 0; }
      else if (typeof st === 'number' && st > 0) { stockUsed = Math.min(st, n); n -= stockUsed; }
      const price = E.priceOf(ctx, id);
      const pack = i.pack || 1;
      const packs = n > 1e-9 ? Math.ceil(n / pack - 1e-9) : 0;
      const cost = packs * price;
      const leftover = packs * pack - n;
      items.push({
        id, name: i.n, cat: i.cat, unit: i.u, need: n, totalNeed: need[id], stockUsed, pack, packs, price, cost, leftover,
        unknownPrice: !price, whole: !!i.whole, pantry: !!i.pantry
      });
      total += cost; proRata += pack ? n / pack * price : 0;
      if (packs) waste += leftover / pack * price;
    }
    const byCat = {};
    E.CATS.forEach(c => { byCat[c] = []; });
    for (const it of items) { (byCat[it.cat] = byCat[it.cat] || []).push(it); }
    Object.values(byCat).forEach(a => a.sort((x, y) => x.name.localeCompare(y.name, 'de')));
    const visible = items.filter(i => i.packs > 0);
    return { items, visible, byCat, total, proRata, waste };
  };

  E.planEntries = (ctx, plan) =>
    plan.days.map(id => id ? ctx.recipeMap[id] : null).filter(Boolean).map(r => ({ r, persons: plan.persons }));
  E.planList = (ctx, plan) => E.shoppingList(ctx, E.planEntries(ctx, plan));

  // ───────────── Regeln & Bewertung ─────────────
  /** Prüft Planregeln, liefert Strafwert und lesbare Hinweise. rs: Array aus Rezepten (oder null). */
  E.analyze = (ctx, rs) => {
    let penalty = 0; const issues = [];
    const carbCount = {}, mainCount = {};
    rs.forEach((r, i) => {
      if (!r) return;
      carbCount[r.carb] = (carbCount[r.carb] || 0) + 1;
      mainCount[r.main] = (mainCount[r.main] || 0) + 1;
      const n = rs[i + 1];
      if (n) {
        if (r.carb !== 'keine' && r.carb === n.carb) { penalty += 15; issues.push(`${E.DAYS[i]} und ${E.DAYS[i + 1]}: gleiche Beilage (${carbLabel(r.carb)})`); }
        if (r.main === n.main) { penalty += 12; issues.push(`${E.DAYS[i]} und ${E.DAYS[i + 1]}: gleiche Hauptzutat`); }
        if (r.veg === n.veg) penalty += 3; // Fleisch/Vegetarisch sollen sich abwechseln (weich)
      }
    });
    for (const [c, n] of Object.entries(carbCount)) {
      const lim = E.CARB_LIMITS[c] || 3;
      if (c !== 'keine' && n > lim) { penalty += 12 * (n - lim); issues.push(`${carbLabel(c)} kommt ${n}× vor (empfohlen: max. ${lim}×)`); }
    }
    if ((carbCount.reis || 0) + (carbCount.nudel || 0) > 4) penalty += 10;
    for (const [m, n] of Object.entries(mainCount)) if (n > MAIN_LIMIT) { penalty += 10 * (n - MAIN_LIMIT); issues.push(`Hauptzutat „${m}“ kommt ${n}× vor`); }
    const seen = new Set();
    rs.forEach(r => { if (r) { if (seen.has(r.id)) { penalty += 100; issues.push('Gericht doppelt: ' + r.name); } seen.add(r.id); } });
    return { penalty, issues };
  };
  function carbLabel(c) { return { reis: 'Reis', nudel: 'Nudeln', kartoffel: 'Kartoffeln', brot: 'Wraps/Teig', couscous: 'Couscous', huelsen: 'Hülsenfrüchte' }[c] || c; }
  E.carbLabel = carbLabel;

  /** Gelerntes Geschmacksprofil aus Bewertungen: Ø-Abweichung von 3 Sternen je Hauptzutat/Beilage. */
  E.learnPrefs = (ctx) => {
    const acc = { main: {}, carb: {} };
    for (const [id, rt] of Object.entries(ctx.ratings)) {
      const r = ctx.recipeMap[id]; if (!r || !rt) continue;
      for (const k of ['main', 'carb']) { const a = acc[k][r[k]] = acc[k][r[k]] || { s: 0, n: 0 }; a.s += rt - 3; a.n++; }
    }
    const out = { main: {}, carb: {} };
    for (const k of ['main', 'carb']) for (const [key, a] of Object.entries(acc[k])) out[k][key] = a.s / (a.n + 1);
    return out;
  };

  function prefWords(ctx) { return (ctx.settings.preferred || []).map(w => String(w).trim().toLowerCase()).filter(Boolean); }

  /** Negativer Wert = Rezept ist beliebter/passender (wird beim Score abgezogen). */
  E.recipeBonus = (ctx, r, learned) => {
    let b = 0;
    if (ctx.favorites[r.id]) b -= 1.5;
    const rt = ctx.ratings[r.id]; if (rt) b -= (rt - 3) * 1.2;
    learned = learned || E.learnPrefs(ctx);
    b -= (learned.main[r.main] || 0) * 0.8 + (learned.carb[r.carb] || 0) * 0.4;
    const pw = prefWords(ctx);
    if (pw.length) {
      const names = r.ings.filter(([id]) => ctx.ing[id] && !ctx.ing[id].pantry).map(([id]) => ctx.ing[id].n.toLowerCase());
      if (pw.some(w => names.some(n => n.includes(w)))) b -= 1.5;
    }
    const h = ctx.history.findIndex(p => p.days.includes(r.id));
    if (h === 0) b += 6; else if (h === 1) b += 3; else if (h === 2) b += 1.5;
    return b;
  };

  /** Gesamtbewertung eines Plans (kleiner = besser): Einkaufskosten, Budget, Reste, Überschneidung, Regeln, Vorlieben. */
  E.scorePlan = (ctx, ids, persons, learned, intl) => {
    const rs = ids.map(id => id ? ctx.recipeMap[id] : null);
    const list = E.shoppingList(ctx, rs.filter(Boolean).map(r => ({ r, persons })));
    const budget = ctx.settings.budget;
    let s = list.total;
    if (list.total > budget) s += 50 + (list.total - budget) * 20;
    s += list.waste * 0.25;
    const use = {};
    rs.forEach(r => { if (r) new Set(r.ings.map(x => x[0])).forEach(id => { if (!(ctx.ing[id] && ctx.ing[id].pantry)) use[id] = (use[id] || 0) + 1; }); });
    s -= Object.values(use).filter(n => n >= 2).length * 0.6;
    list.items.forEach(it => { if (it.stockUsed > 0) s -= 0.8; });
    s += E.analyze(ctx, rs).penalty;
    const veg = rs.filter(r => r && r.veg).length;
    s += 25 * Math.abs(veg - Math.min(ctx.settings.vegTarget, rs.filter(Boolean).length));
    if (intl) {
      const cc = {}; rs.forEach(r => { if (r) { const c = E.primaryCuisine(r); cc[c] = (cc[c] || 0) + 1; } });
      Object.values(cc).forEach(n => { if (n > 2) s += 15 * (n - 2); });
      s -= Object.keys(cc).length * 2;
    }
    learned = learned || E.learnPrefs(ctx);
    rs.forEach(r => { if (r) s += E.recipeBonus(ctx, r, learned); });
    return s;
  };

  // ───────────── Planerzeugung ─────────────
  E.rng = (seed) => { // mulberry32 – für reproduzierbare Tests
    let a = seed >>> 0;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  };
  const shuffle = (a, rng) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function combos(arr, k) {
    if (k === 0) return [[]]; if (arr.length < k) return [];
    const [h, ...t] = arr; return combos(t, k - 1).map(c => [h, ...c]).concat(combos(t, k));
  }

  E.generatePlan = function (ctx, opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;
    const persons = opts.persons || ctx.settings.persons;
    const keep = (opts.keep || []).concat(Array(7).fill(null)).slice(0, 7);
    let pool = ctx.recipes.filter(r => E.isEligible(ctx, r));
    if (opts.international) {
      const intl = pool.filter(r => E.cuisinesOf(r).some(c => c !== 'deutsch'));
      if (intl.length >= 10) pool = intl;
    }
    // Gerichte der Vorwoche möglichst meiden (nur wenn genug Alternativen bleiben)
    const recent = new Set(ctx.history && ctx.history[0] ? ctx.history[0].days : []);
    const fresh = pool.filter(r => !recent.has(r.id));
    if (fresh.length >= 14 && fresh.filter(r => r.veg).length >= 5 && fresh.filter(r => !r.veg).length >= 5) pool = fresh;
    const free = [0, 1, 2, 3, 4, 5, 6].filter(i => !keep[i]);
    const usedKeep = new Set(keep.filter(Boolean));
    const vegPool = pool.filter(r => r.veg && !usedKeep.has(r.id)), meatPool = pool.filter(r => !r.veg && !usedKeep.has(r.id));
    if (vegPool.length + meatPool.length < free.length) throw new Error('Zu wenige passende Rezepte für die aktuellen Einstellungen (' + pool.length + ' verfügbar). Bitte Filter lockern.');
    const lockedVeg = keep.filter(id => id && ctx.recipeMap[id] && ctx.recipeMap[id].veg).length;
    let needVeg = Math.max(0, Math.min(ctx.settings.vegTarget - lockedVeg, free.length));
    needVeg = Math.min(needVeg, vegPool.length);
    if (free.length - needVeg > meatPool.length) needVeg = free.length - meatPool.length;
    const learned = E.learnPrefs(ctx);

    // Typmuster: Fleisch/Vegetarisch möglichst abwechselnd
    const keepVeg = keep.map(id => id ? !!(ctx.recipeMap[id] && ctx.recipeMap[id].veg) : null);
    let best = [], bestPen = Infinity;
    for (const c of combos(free, needVeg)) {
      const t = keepVeg.slice(); free.forEach(i => { t[i] = c.includes(i); });
      let pen = 0; for (let i = 0; i < 6; i++) if (t[i] === t[i + 1]) pen++;
      if (pen < bestPen) { bestPen = pen; best = [t]; } else if (pen === bestPen) best.push(t);
    }

    const ok = (ids, i, r) => {
      const prev = ids[i - 1] && ctx.recipeMap[ids[i - 1]], next = ids[i + 1] && ctx.recipeMap[ids[i + 1]];
      for (const n of [prev, next]) if (n && ((r.carb !== 'keine' && r.carb === n.carb) || r.main === n.main)) return false;
      const rs = ids.map(x => x && ctx.recipeMap[x]).filter(Boolean);
      if (rs.filter(x => x.main === r.main).length >= MAIN_LIMIT) return false;
      if (opts.international) {
        const pc = E.primaryCuisine(r);
        if (rs.filter(x => E.primaryCuisine(x) === pc).length >= 2) return false;
        for (const n of [prev, next]) if (n && E.primaryCuisine(n) === pc) return false;
      }
      if (r.carb !== 'keine' && rs.filter(x => x.carb === r.carb).length >= (E.CARB_LIMITS[r.carb] || 3)) return false;
      return true;
    };

    let bestIds = null, bestScore = Infinity;
    for (let restart = 0; restart < 6; restart++) {
      const types = best[Math.floor(rng() * best.length)];
      const ids = keep.slice(); const used = new Set(usedKeep);
      for (const i of shuffle(free, rng)) {
        const src = types[i] ? vegPool : meatPool;
        let cands = src.filter(r => !used.has(r.id));
        let strict = cands.filter(r => ok(ids, i, r));
        if (!strict.length) strict = cands;
        if (!strict.length) strict = pool.filter(r => !used.has(r.id));
        strict = strict.map(r => [r, E.recipeBonus(ctx, r, learned) + rng() * 3]).sort((a, b) => a[1] - b[1]);
        ids[i] = strict[0][0].id; used.add(ids[i]);
      }
      let cur = E.scorePlan(ctx, ids, persons, learned, !!opts.international);
      for (let it = 0; it < 90; it++) { // lokale Suche
        const i = free[Math.floor(rng() * free.length)];
        const r0 = ctx.recipeMap[ids[i]];
        const src = (r0 && r0.veg) ? vegPool : meatPool;
        const cand = src[Math.floor(rng() * src.length)];
        if (!cand || ids.includes(cand.id)) continue;
        const trial = ids.slice(); trial[i] = cand.id;
        const sc = E.scorePlan(ctx, trial, persons, learned, !!opts.international);
        if (sc < cur) { cur = sc; ids[i] = cand.id; }
      }
      if (cur < bestScore) { bestScore = cur; bestIds = ids.slice(); }
    }
    return {
      weekStart: opts.weekStart || E.mondayOf(), days: bestIds, locked: keep.map(Boolean), persons,
      createdAt: Date.now(), updatedAt: Date.now()
    };
  };

  // ───────────── Plan-Zusammenfassung ─────────────
  E.summary = (ctx, plan) => {
    const list = E.planList(ctx, plan);
    const rs = plan.days.map(id => id ? ctx.recipeMap[id] || null : null);
    const budget = ctx.settings.budget;
    const warnings = [];
    if (list.total > budget + 1e-9) warnings.push({ type: 'budget', text: `Budget um ${E.money(list.total - budget)} überschritten.` });
    rs.forEach((r, i) => {
      if (plan.days[i] && !r) warnings.push({ type: 'missing', text: `${E.DAYS[i]}: Rezept existiert nicht mehr.` });
      else if (r && !E.isEligible(ctx, r)) {
        const v = E.violations(ctx, r);
        warnings.push({ type: 'ineligible', day: i, text: `${E.DAYS[i]}: „${r.name}“ passt nicht mehr zu den Einstellungen${v.length ? ' (' + v.join(', ') + ')' : ''}.` });
      }
    });
    E.analyze(ctx, rs).issues.forEach(t => warnings.push({ type: 'rule', text: t }));
    return {
      list, total: list.total, budget, remaining: budget - list.total, over: list.total > budget + 1e-9,
      veg: rs.filter(r => r && r.veg).length, meat: rs.filter(r => r && !r.veg).length,
      perDay: rs.map(r => r ? E.recipeCost(ctx, r, plan.persons).cost : 0), warnings
    };
  };

  // ───────────── Tauschen ─────────────
  E.swapDay = (plan, idx, recipeId) => {
    const p = JSON.parse(JSON.stringify(plan)); p.days[idx] = recipeId; p.updatedAt = Date.now(); return p;
  };

  /** Alternativen für einen Tag (Rest des Plans bleibt unverändert), nach Gesamtbewertung sortiert. */
  E.alternatives = (ctx, plan, idx, opts) => {
    opts = opts || {};
    const cur = plan.days[idx] && ctx.recipeMap[plan.days[idx]];
    const baseTotal = E.planList(ctx, plan).total;
    const inPlan = new Set(plan.days.filter(Boolean));
    const learned = E.learnPrefs(ctx);
    let pool = ctx.recipes.filter(r => !inPlan.has(r.id) && E.isEligible(ctx, r));
    if (opts.sameType !== false && cur) pool = pool.filter(r => r.veg === cur.veg);
    const out = pool.map(r => {
      const ids = plan.days.slice(); ids[idx] = r.id;
      const total = E.shoppingList(ctx, ids.filter(Boolean).map(id => ({ r: ctx.recipeMap[id], persons: plan.persons }))).total;
      return { r, total, delta: total - baseTotal, score: E.scorePlan(ctx, ids, plan.persons, learned), issues: E.analyze(ctx, ids.map(id => id && ctx.recipeMap[id])).issues };
    });
    out.sort((a, b) => a.score - b.score);
    return out.slice(0, opts.limit || 12);
  };

  E.randomSwap = (ctx, plan, idx, rng) => {
    const alts = E.alternatives(ctx, plan, idx, { limit: 6 });
    if (!alts.length) return null;
    const pick = alts[Math.floor((rng || Math.random)() * alts.length)];
    return E.swapDay(plan, idx, pick.r.id);
  };

  /** Ersetzt nicht mehr passende/fehlende Rezepte, ohne die übrigen Tage anzufassen. */
  E.repairPlan = (ctx, plan) => {
    let p = plan; const changes = [];
    plan.days.forEach((id, i) => {
      const r = id && ctx.recipeMap[id];
      const dup = id && p.days.indexOf(id) !== i; // zweites Vorkommen desselben Gerichts
      if (r && !dup && E.isEligible(ctx, r)) return;
      const alts = E.alternatives(ctx, p, i, { sameType: false, limit: 1 });
      if (alts[0]) { p = E.swapDay(p, i, alts[0].r.id); changes.push({ day: i, from: r ? r.name : null, to: alts[0].r.name }); }
    });
    return { plan: p, changes };
  };

  /** Tauscht automatisch die Gerichte, die am meisten sparen, bis das Budget eingehalten wird. */
  E.optimizeBudget = (ctx, plan) => {
    let p = plan; const swaps = [];
    for (let step = 0; step < 14; step++) {
      const cur = E.planList(ctx, p).total;
      if (cur <= ctx.settings.budget + 1e-9) break;
      const basePen = E.analyze(ctx, p.days.map(id => id && ctx.recipeMap[id])).penalty;
      let best = null;
      p.days.forEach((id, i) => {
        if (!id || p.locked[i]) return;
        const r0 = ctx.recipeMap[id];
        const inPlan = new Set(p.days.filter(Boolean));
        for (const r of ctx.recipes) {
          if (inPlan.has(r.id) || r.veg !== (r0 && r0.veg) || !E.isEligible(ctx, r)) continue;
          const ids = p.days.slice(); ids[i] = r.id;
          const rs = ids.map(x => x && ctx.recipeMap[x]);
          if (E.analyze(ctx, rs).penalty > basePen) continue;
          const t = E.shoppingList(ctx, rs.filter(Boolean).map(x => ({ r: x, persons: p.persons }))).total;
          if (t < cur - 0.005 && (!best || t < best.total)) best = { i, r, total: t, from: r0 };
        }
      });
      if (!best) break;
      swaps.push({ day: best.i, from: best.from ? best.from.name : null, to: best.r.name, saving: cur - best.total });
      p = E.swapDay(p, best.i, best.r.id);
    }
    return { plan: p, swaps, total: E.planList(ctx, p).total, reached: E.planList(ctx, p).total <= ctx.settings.budget + 1e-9 };
  };

  E.recommendations = (ctx, excludeIds, n) => {
    const ex = new Set(excludeIds || []);
    const learned = E.learnPrefs(ctx);
    return ctx.recipes.filter(r => !ex.has(r.id) && E.isEligible(ctx, r))
      .map(r => ({ r, b: E.recipeBonus(ctx, r, learned) })).sort((a, b) => a.b - b.b).slice(0, n || 4)
      .map(({ r }) => {
        const rt = ctx.ratings[r.id];
        const reason = ctx.favorites[r.id] ? 'Lieblingsgericht' : rt >= 4 ? `Von dir mit ${rt} ★ bewertet`
          : ctx.history.some(p => p.days.includes(r.id)) ? 'Schon länger nicht gekocht' : 'Passt zu deinen Einstellungen';
        return { r, reason };
      });
  };

  // ───────────── Formatierung ─────────────
  const nf = (x, d) => x.toLocaleString('de-DE', { maximumFractionDigits: d === undefined ? 2 : d });
  E.money = x => x.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const FR = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
  function quarters(a) {
    const q = Math.round(a * 4) / 4, w = Math.floor(q), f = q - w;
    if (q === 0) return '¼';
    return (w ? String(w) : '') + (f ? (w ? ' ' : '') + FR[f] : '');
  }
  E.fmtAmount = (a, u, whole) => {
    if (u === 'g') return a >= 1000 ? nf(a / 1000, 2) + ' kg' : nf(a >= 50 ? Math.round(a / 5) * 5 : Math.round(a), 0) + ' g';
    if (u === 'ml') return a >= 1000 ? nf(a / 1000, 2) + ' l' : nf(a >= 50 ? Math.round(a / 5) * 5 : Math.round(a), 0) + ' ml';
    if (u === 'Stk') return (whole ? String(Math.max(1, Math.round(a))) : quarters(a)) + ' Stk';
    return quarters(a) + ' ' + u;
  };

  E.listToText = (ctx, list, title) => {
    const lines = [title || 'Einkaufsliste', ''];
    for (const c of E.CATS) {
      const its = (list.byCat[c] || []).filter(i => i.packs > 0); if (!its.length) continue;
      lines.push(c.toUpperCase());
      its.forEach(i => lines.push(`[ ] ${i.name}: ${E.fmtAmount(i.need, i.unit, i.whole)} → ${i.packs}× ${E.fmtAmount(i.pack, i.unit, true)} (${E.money(i.cost)}${i.unknownPrice ? ', Preis unbekannt' : ''})`));
      lines.push('');
    }
    lines.push(`Gesamt (geschätzt): ${E.money(list.total)}`);
    return lines.join('\n');
  };
  E.listToCSV = (ctx, list) => {
    const q = s => '"' + String(s).replace(/"/g, '""') + '"';
    const rows = [['Kategorie', 'Artikel', 'Benötigt', 'Packungen', 'Packungsgröße', 'Einzelpreis (Schätzung)', 'Summe'].map(q).join(';')];
    for (const c of E.CATS) (list.byCat[c] || []).filter(i => i.packs > 0).forEach(i =>
      rows.push([c, i.name, E.fmtAmount(i.need, i.unit, i.whole), i.packs, E.fmtAmount(i.pack, i.unit, true), nf(i.price, 2), nf(i.cost, 2)].map(q).join(';')));
    rows.push(['', 'GESAMT', '', '', '', '', nf(list.total, 2)].map(q).join(';'));
    return '﻿' + rows.join('\r\n');
  };

  // ───────────── Eigene Rezepte: Zutatenzeilen parsen ─────────────
  const UNIT_MAP = { g: ['g', 1], gr: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], l: ['ml', 1000], stk: ['Stk', 1], 'stück': ['Stk', 1], st: ['Stk', 1], el: ['EL', 1], tl: ['TL', 1] };
  const slug = s => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const num = s => { s = String(s).trim().replace('½', '.5').replace('¼', '.25').replace('¾', '.75').replace(',', '.'); const v = parseFloat(s); return isNaN(v) ? null : v; };

  /** Zeilenformat: "500 g Hähnchenbrust" oder "300 g Linsen | 500 | 1,79" (Packungsgröße | Packungspreis). */
  E.parseIngredientLines = (ctx, text) => {
    const ings = [], newIng = {}, errors = [];
    String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach((line, ln) => {
      const [main, packS, priceS] = line.split('|').map(s => s.trim());
      const m = main.match(/^([\d.,½¼¾]+)\s*([a-zA-ZäöüÄÖÜ]*)\s+(.+)$/);
      if (!m) { errors.push(`Zeile ${ln + 1}: „${line}“ – erwartet z. B. „500 g Hähnchenbrust“.`); return; }
      const amount = num(m[1]); const uk = (m[2] || 'Stk').toLowerCase(); const name = m[3].trim();
      if (amount === null || !UNIT_MAP[uk]) { errors.push(`Zeile ${ln + 1}: Menge/Einheit nicht erkannt („${m[1]} ${m[2]}“).`); return; }
      const [unit, factor] = UNIT_MAP[uk];
      const lname = name.toLowerCase();
      const all = Object.assign({}, ctx.ing, newIng);
      const exact = Object.values(all).filter(i => i.n.toLowerCase() === lname);
      // Wird eine eigene Packung/ein eigener Preis angegeben, soll bewusst eine NEUE Zutat entstehen.
      const cands = (packS || priceS) ? exact : exact
        .concat(Object.values(all).filter(i => i.n.toLowerCase().startsWith(lname)))
        .concat(Object.values(all).filter(i => i.n.toLowerCase().includes(lname)));
      let hit = cands[0];
      if (hit && hit.u !== unit) {
        if (hit.g && hit.u === 'Stk' && unit === 'g') { ings.push([hit.id, amount * factor / hit.g]); return; }
        if (hit.u === 'TL' && unit === 'EL') { ings.push([hit.id, amount * factor * 3]); return; } // 1 EL = 3 TL
        if (hit.u === 'EL' && unit === 'TL') { ings.push([hit.id, amount * factor / 3]); return; }
        errors.push(`Zeile ${ln + 1}: „${hit.n}“ wird in ${hit.u} geführt, nicht in ${unit}.`); return;
      }
      if (hit) { ings.push([hit.id, amount * factor]); return; }
      const id = 'x-' + slug(name);
      const pack = packS ? num(packS) : null, price = priceS ? num(priceS) : null;
      newIng[id] = { id, n: name, cat: 'Sonstiges', u: unit, pack: pack || amount * factor, price: price || 0, custom: true };
      ings.push([id, amount * factor]);
    });
    return { ings, newIng, errors };
  };

  g.Engine = E;
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
})(typeof globalThis !== 'undefined' ? globalThis : self);
