/* Tests für Budget, Einkaufsliste, Ausschlüsse und Planregeln. Ausführen: node tests/engine.test.js */
'use strict';
require('../js/data.js'); require('../js/data-ext.js');
const E = require('../js/engine.js');
const D = globalThis.DATA;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗', m); } };
const eq = (a, b, m) => ok(Math.abs(a - b) < 1e-6, `${m}: erwartet ${b}, erhalten ${a}`);
const section = t => console.log('\n' + t);
const base = (o) => E.makeCtx(Object.assign({ settings: {}, recipes: D.RECIPES }, o));
const ctx = base();

section('Datenbank');
ok(D.RECIPES.length >= 50, `mindestens 50 Rezepte (${D.RECIPES.length})`);
ok(new Set(D.RECIPES.map(r => r.id)).size === D.RECIPES.length, 'eindeutige IDs');
ok(new Set(D.RECIPES.map(r => r.name)).size === D.RECIPES.length, 'eindeutige Namen');
ok(D.RECIPES.every(r => r.ings.every(([id]) => D.ING[id])), 'alle Zutaten im Katalog');
ok(D.RECIPES.every(r => r.steps.length >= 3 && r.time >= 20 && r.time <= 45), 'Schritte ≥3 und Zeit 20–45 Min');
ok(D.RECIPES.filter(r => r.veg).length >= 20, 'mindestens 20 vegetarische Gerichte');
ok(D.RECIPES.every(r => ['leicht', 'mittel', 'anspruchsvoll'].includes(r.diff)), 'gültige Schwierigkeitsgrade');

section('Ausgeschlossene Lebensmittel (Fisch, Pilze, Brokkoli/Kohl, Laktose)');
const bannedWords = /fisch|lachs|thunfisch|garnele|meeresfr|pilz|champignon|brokkoli|broccoli|blumenkohl|kohl|rosenkohl|wirsing|rotkohl|weißkohl|sauerkraut|kohlrabi/i;
for (const r of D.RECIPES) {
  const names = r.ings.map(([id]) => D.ING[id].n).concat([r.name], r.steps);
  ok(!names.some(n => bannedWords.test(n)), `${r.name}: kein Fisch/Pilz/Kohl`);
  ok(E.violations(ctx, r).length === 0, `${r.name}: keine Verstöße (${E.violations(ctx, r).join(', ')})`);
  ok(E.isLactoseFree(ctx, r), `${r.name}: laktosefrei`);
  for (const [id] of r.ings) {
    const i = D.ING[id];
    if (/milch|sahne|joghurt|käse|quark|frischkäse|mozzarella/i.test(i.n) && !/kokos/i.test(i.n)) ok(/laktosefrei/i.test(i.n), `${r.name}: ${i.n} muss laktosefrei sein`);
  }
}
ok(Object.values(D.ING).every(i => !/butter|schmand|parmesan|pilz|champignon|brokkoli|fisch/i.test(i.n) || /laktosefrei/i.test(i.n)), 'Katalog ohne verbotene Zutaten (Butter nur laktosefrei)');
// Negativtest: Erkennung funktioniert tatsächlich
const bad = { id: 'x', name: 'Test', ings: [], steps: [] };
const c2 = E.makeCtx({ settings: {}, recipes: [], customIng: { m: { id: 'm', n: 'Champignons', cat: 'Obst und Gemüse', u: 'g', pack: 250, price: 1 }, b: { id: 'b', n: 'Brokkoli', u: 'g' }, k: { id: 'k', n: 'Vollmilch', u: 'ml' }, f: { id: 'f', n: 'Lachsfilet', u: 'g' }, ok: { id: 'ok', n: 'Laktosefreie Milch', u: 'ml' } } });
for (const [id, label] of [['m', 'Pilze'], ['b', 'Kohl'], ['k', 'Laktose'], ['f', 'Fisch']]) ok(E.violations(c2, { id: 'x', name: 'T', ings: [[id, 1]], steps: [] }).some(v => v.startsWith(label)), `Erkennung: ${label}`);
ok(E.violations(c2, { id: 'x', name: 'T', ings: [['ok', 1]], steps: [] }).length === 0, 'Laktosefreie Milch ist erlaubt');

section('Kostenberechnung');
const R = id => D.RECIPES.find(r => r.id === id);
// Hähnchen-Reispfanne: manuell nachgerechnet
const r1 = R('haehnchen-reispfanne');
let hand = 500 / 500 * 4.99 + 300 / 1000 * 1.89 + 2 / 3 * 1.99 + 150 / 1000 * 1.29 + 200 / 1000 * 1.19 + 140 / 285 * 0.69 + 2 /* Brühe=Vorrat */ * 0 + 30 / 150 * 0.99;
eq(E.recipeCost(ctx, r1, 4).cost, hand, 'Kosten Hähnchen-Reispfanne (4 P.)');
eq(E.recipeCost(ctx, r1, 8).cost, hand * 2, 'Kosten skalieren linear mit Personen');
eq(E.recipeCost(ctx, r1, 2).cost, hand / 2, 'Kosten für 2 Personen');
const pf = E.makeCtx({ settings: { priceFactor: 1.1 }, recipes: D.RECIPES });
eq(E.recipeCost(pf, r1, 4).cost, hand * 1.1, 'Preisfaktor 110 %');
const ov = E.makeCtx({ settings: { priceOverrides: { haehnchenbrust: 6.99 } }, recipes: D.RECIPES });
eq(E.recipeCost(ov, r1, 4).cost, hand - 4.99 + 6.99, 'Einzelpreis überschrieben');
const noPantry = E.makeCtx({ settings: { pantryBasics: false }, recipes: D.RECIPES });
ok(E.recipeCost(noPantry, r1, 4).cost > hand, 'ohne Vorräte höhere Kosten (Öl/Brühe zählen)');

section('Einkaufsliste');
// Zwei Rezepte: gleiche Zutaten werden addiert, auf Packungen aufgerundet
const a = R('haehnchen-reispfanne'), b = R('hack-reispfanne');
const L = E.shoppingList(ctx, [{ r: a, persons: 4 }, { r: b, persons: 4 }]);
const it = id => L.items.find(i => i.id === id);
eq(it('reis').totalNeed, 580, 'Reis addiert (300+280 g)');
eq(it('reis').packs, 1, 'Reis: 1 Packung à 1 kg');
eq(it('paprika').totalNeed, 4, 'Paprika addiert (2+2)');
eq(it('paprika').packs, 2, 'Paprika: 4 Stk → 2 Packungen à 3 (aufgerundet)');
eq(it('mais').totalNeed, 280, 'Mais addiert (140+140)');
eq(it('mais').packs, 1, 'Mais: 280 g passt in 1 Dose à 285 g');
eq(it('zwiebeln').totalNeed, 250, 'Zwiebeln addiert');
ok(!it('oel') && !it('salz') && !it('paprikapulver'), 'Vorrat (Öl, Salz, Gewürze) nicht auf der Liste');
const sumCost = L.items.reduce((s, i) => s + i.cost, 0);
eq(L.total, sumCost, 'Gesamtpreis = Summe der Positionen');
eq(it('reis').cost, 1.89, 'Positionspreis Reis');
ok(L.items.every(i => E.CATS.includes(i.cat)), 'Alle Kategorien gültig');
ok(L.items.every(i => i.packs * i.pack >= i.need - 1e-9), 'Packungen decken Bedarf');
ok(L.items.every(i => i.packs === 0 || (i.packs - 1) * i.pack < i.need), 'nicht unnötig viele Packungen');
// Personenzahl
const L8 = E.shoppingList(ctx, [{ r: a, persons: 8 }]);
eq(L8.items.find(i => i.id === 'haehnchenbrust').totalNeed, 1000, '8 Personen: 1000 g Hähnchen');
eq(L8.items.find(i => i.id === 'haehnchenbrust').packs, 2, '8 Personen: 2 Packungen');
// Vorrat des Nutzers
const st1 = E.makeCtx({ settings: { stock: { reis: true, mais: true } }, recipes: D.RECIPES });
const Ls = E.shoppingList(st1, [{ r: a, persons: 4 }, { r: b, persons: 4 }]);
ok(Ls.items.find(i => i.id === 'reis').packs === 0 && Ls.total < L.total, 'Eigener Vorrat reduziert Einkauf');
eq(L.total - Ls.total, 1.89 + 0.69 * 1, 'Ersparnis = Reis + Mais');
const stp = E.makeCtx({ settings: { stock: { haehnchenbrust: 300 } }, recipes: D.RECIPES });
eq(E.shoppingList(stp, [{ r: a, persons: 4 }]).items.find(i => i.id === 'haehnchenbrust').need, 200, 'Teilvorrat 300 g von 500 g');
// Kategorie-Sortierung
ok(Object.keys(L.byCat).join() === E.CATS.join(), 'Kategorien in Soll-Reihenfolge');
ok(L.byCat['Fleisch'].every(i => i.cat === 'Fleisch'), 'Kategorie Fleisch korrekt');
// Export
const txt = E.listToText(ctx, L, 'T'); ok(txt.includes('[ ]') && txt.includes('Gesamt'), 'Text-Export');
ok(E.listToCSV(ctx, L).split('\r\n').length > 5, 'CSV-Export');

section('Wochenplan: Regeln über viele Zufallsläufe');
const budgetCtx = base();
let overBudget = 0, runs = 60, minT = 1e9, maxT = 0, sumT = 0;
for (let s = 1; s <= runs; s++) {
  const p = E.generatePlan(budgetCtx, { weekStart: '2026-11-16', rng: E.rng(s) });
  ok(p.days.length === 7 && p.days.every(Boolean), `Lauf ${s}: sieben Gerichte`);
  ok(new Set(p.days).size === 7, `Lauf ${s}: keine Dubletten`);
  const rs = p.days.map(id => budgetCtx.recipeMap[id]);
  const veg = rs.filter(r => r.veg).length;
  ok(veg === 3, `Lauf ${s}: 3 vegetarische Gerichte (${veg})`);
  ok(rs.every(r => E.isEligible(budgetCtx, r)), `Lauf ${s}: nur zulässige Rezepte`);
  let consecutiveCarb = 0, consecutiveMain = 0;
  for (let i = 0; i < 6; i++) { if (rs[i].carb !== 'keine' && rs[i].carb === rs[i + 1].carb) consecutiveCarb++; if (rs[i].main === rs[i + 1].main) consecutiveMain++; }
  ok(consecutiveCarb <= 1, `Lauf ${s}: höchstens 1× gleiche Beilage hintereinander (${consecutiveCarb})`);
  ok(consecutiveMain === 0, `Lauf ${s}: nie gleiche Hauptzutat an Folgetagen`);
  const rice = rs.filter(r => r.carb === 'reis').length, noodle = rs.filter(r => r.carb === 'nudel').length;
  ok(rice + noodle <= 4 && rice <= 2 && noodle <= 2, `Lauf ${s}: nicht täglich Nudeln/Reis (Reis ${rice}, Nudeln ${noodle})`);
  const mains = {}; rs.forEach(r => { mains[r.main] = (mains[r.main] || 0) + 1; });
  ok(Math.max(...Object.values(mains)) <= 2, `Lauf ${s}: Hauptzutat max. 2×`);
  const sum = E.summary(budgetCtx, p);
  if (sum.over) overBudget++;
  minT = Math.min(minT, sum.total); maxT = Math.max(maxT, sum.total); sumT += sum.total;
  eq(sum.total + sum.remaining, 120, `Lauf ${s}: Budget − Kosten = Rest`);
}
console.log(`  Kosten über ${runs} Pläne: min ${minT.toFixed(2)} €, Ø ${(sumT / runs).toFixed(2)} €, max ${maxT.toFixed(2)} €`);
ok(overBudget === 0, `Standardbudget 120 € wird in allen Läufen eingehalten (${overBudget} Überschreitungen)`);
const stableA = E.generatePlan(budgetCtx, { rng: E.rng(5) }).days.join(), stableB = E.generatePlan(budgetCtx, { rng: E.rng(5) }).days.join();
ok(stableA === stableB, 'Reproduzierbar bei gleichem Zufallsstartwert');
const diff = new Set(); for (let s = 1; s <= 20; s++) diff.add(E.generatePlan(budgetCtx, { rng: E.rng(s) }).days.join());
ok(diff.size >= 15, `Neue Pläne unterscheiden sich (${diff.size}/20 verschieden)`);

section('Budget, Tausch, Optimierung');
const tight = base({ settings: { budget: 35 } });
const pT = E.generatePlan(tight, { rng: E.rng(3) });
const sT = E.summary(tight, pT);
console.log(`  Plan bei 35 € Budget kostet ${sT.total.toFixed(2)} €`);
ok(sT.total < E.summary(budgetCtx, E.generatePlan(budgetCtx, { rng: E.rng(3) })).total + 1, 'Knappes Budget führt zu günstigerem Plan');
const veryTight = base({ settings: { budget: 10 } });
const pV = E.generatePlan(veryTight, { rng: E.rng(3) });
ok(E.summary(veryTight, pV).over && E.summary(veryTight, pV).warnings.some(w => w.type === 'budget'), 'Warnung bei Überschreitung');
const opt = E.optimizeBudget(veryTight, pV);
ok(opt.total <= E.summary(veryTight, pV).total, 'Optimierung macht den Plan nicht teurer');
// Tausch verändert nur einen Tag und rechnet neu
const p0 = E.generatePlan(budgetCtx, { rng: E.rng(11) });
const alts = E.alternatives(budgetCtx, p0, 2, { limit: 5 });
ok(alts.length === 5 && alts.every(x => !p0.days.includes(x.r.id)), 'Alternativen sind noch nicht im Plan');
const p1 = E.swapDay(p0, 2, alts[0].r.id);
ok(p1.days.every((id, i) => i === 2 ? id === alts[0].r.id : id === p0.days[i]), 'Tausch ändert nur den gewählten Tag');
eq(E.planList(budgetCtx, p1).total - E.planList(budgetCtx, p0).total, alts[0].delta, 'Preisdifferenz beim Tausch stimmt');
ok(alts.every(x => x.r.veg === budgetCtx.recipeMap[p0.days[2]].veg), 'Gleiche Art (veg/Fleisch) beim Tausch');
// Fixierte Gerichte bleiben erhalten
const keep = Array(7).fill(null); keep[0] = p0.days[0]; keep[4] = p0.days[4];
const pk = E.generatePlan(budgetCtx, { rng: E.rng(99), keep });
ok(pk.days[0] === p0.days[0] && pk.days[4] === p0.days[4], 'Fixierte Gerichte bleiben');
ok(new Set(pk.days).size === 7, 'Keine Dubletten mit Fixierung');
// Reparatur
const strict = E.makeCtx({ settings: { unwanted: ['Hähnchen'] }, recipes: D.RECIPES });
const rep = E.repairPlan(strict, { days: ['haehnchen-reispfanne', ...p0.days.slice(1)], locked: Array(7).fill(false), persons: 4 });
ok(rep.changes.length >= 1 && E.isEligible(strict, strict.recipeMap[rep.plan.days[0]]), 'Reparatur ersetzt unerwünschte Gerichte');

section('Einstellungen wirken');
const vegOnly = base({ settings: { vegTarget: 7 } });
ok(E.generatePlan(vegOnly, { rng: E.rng(1) }).days.every(id => vegOnly.recipeMap[id].veg), '7 vegetarisch möglich');
const noVeg = base({ settings: { vegTarget: 0 } });
const nv = E.generatePlan(noVeg, { rng: E.rng(2) });
ok(nv.days.filter(id => noVeg.recipeMap[id].veg).length === 0, 'vegTarget 0 → nur Fleisch');
const fast = base({ settings: { maxTime: 30 } });
ok(E.generatePlan(fast, { rng: E.rng(4) }).days.every(id => fast.recipeMap[id].time <= 30), 'Max. Zubereitungszeit eingehalten');
const unw = base({ settings: { unwanted: ['Paprika'] } });
ok(E.generatePlan(unw, { rng: E.rng(6) }).days.every(id => !unw.recipeMap[id].ings.some(([i]) => /paprika/i.test(D.ING[i].n))), 'Unerwünschte Zutat taucht nicht auf');
const pref = base({ settings: { preferred: ['Kartoffeln'] } });
let withP = 0, without = 0;
for (let s = 1; s <= 20; s++) {
  withP += E.generatePlan(pref, { rng: E.rng(s) }).days.filter(id => pref.recipeMap[id].ings.some(([i]) => i === 'kartoffeln')).length;
  without += E.generatePlan(budgetCtx, { rng: E.rng(s) }).days.filter(id => budgetCtx.recipeMap[id].ings.some(([i]) => i === 'kartoffeln')).length;
}
ok(withP >= without, `Bevorzugte Zutat häufiger (${withP} vs. ${without})`);
const blocked = base({ blocked: { 'bolognese': true } });
ok(!E.generatePlan(blocked, { rng: E.rng(1) }).days.includes('bolognese'), 'Ausgeblendete Rezepte werden nicht geplant');
const pantryPlan = base({ settings: { stock: { kichererbsen: true, kokosmilch: true, rotelinsen: true } } });
let usesStock = 0; for (let s = 1; s <= 10; s++) usesStock += E.generatePlan(pantryPlan, { rng: E.rng(s) }).days.filter(id => pantryPlan.recipeMap[id].ings.some(([i]) => ['kichererbsen', 'kokosmilch', 'rotelinsen'].includes(i))).length;
let noStock = 0; for (let s = 1; s <= 10; s++) noStock += E.generatePlan(budgetCtx, { rng: E.rng(s) }).days.filter(id => budgetCtx.recipeMap[id].ings.some(([i]) => ['kichererbsen', 'kokosmilch', 'rotelinsen'].includes(i))).length;
ok(usesStock > noStock, `Vorhandene Zutaten werden bevorzugt (${usesStock} vs. ${noStock})`);
let threw = false; try { E.generatePlan(base({ settings: { unwanted: ['Kartoffel', 'Reis', 'Nudel', 'Wrap', 'Hähnchen', 'Hack', 'Ei', 'Bohnen', 'Kürbis', 'Zucchini', 'Schwein', 'Rind', 'Linsen', 'Couscous'] } }), { rng: E.rng(1) }); } catch (e) { threw = true; } ok(threw, 'Verständliche Fehlermeldung bei zu wenigen Rezepten');

section('Bewertungen & Verlauf');
const rated = base({ ratings: { 'bolognese': 5, 'hack-reispfanne': 5, 'chili-mild': 1 } });
const reco = E.recommendations(rated, [], 3).map(x => x.r.id);
ok(reco.includes('bolognese') || reco.includes('hack-reispfanne'), 'Gut bewertete Gerichte werden empfohlen');
const hist = base({ history: [{ weekStart: '2026-11-09', days: ['bolognese'] }] });
ok(E.recipeBonus(hist, D.RECIPES.find(r => r.id === 'bolognese')) > E.recipeBonus(budgetCtx, D.RECIPES.find(r => r.id === 'bolognese')), 'Letzte Woche gekocht → wird weniger bevorzugt');

section('Eigene Rezepte');
const parsed = E.parseIngredientLines(ctx, '500 g Hähnchenbrustfilet\n300 g Reis\n2 Stk Paprika\n200 g Linsen | 500 | 1,79\n1 kg Kartoffeln\n1 EL Salz');
ok(parsed.errors.length === 0, 'Zutatenzeilen ohne Fehler');
ok(parsed.ings.some(([i, a]) => i === 'kartoffeln' && a === 1000), 'kg wird zu g');
ok(Object.values(parsed.newIng).some(i => i.n === 'Linsen' && i.pack === 500 && i.price === 1.79), 'Neue Zutat mit Packung/Preis');
ok(E.parseIngredientLines(ctx, 'irgendwas').errors.length === 1, 'Fehlerhafte Zeile wird gemeldet');

section('Datum');
eq(new Date(E.mondayOf(new Date(2026, 10, 18))).getTime() > 0 ? 1 : 0, 1, 'mondayOf liefert Datum');
ok(E.mondayOf(new Date(2026, 10, 18)) === '2026-11-16', 'Montag der Woche zum 18.11.2026');
ok(E.mondayOf(new Date(2026, 10, 22)) === '2026-11-16', 'Sonntag gehört zur Woche davor');
ok(E.addWeeks('2026-12-28', 1) === '2027-01-04', 'Wochenwechsel über Jahresgrenze');
eq(E.weekNumber('2026-11-16'), 47, 'KW 47');


section('Küchenrichtungen, International-Modus, Duplikate, Verlauf');
ok(D.RECIPES.length >= 70, `Datenbank erweitert (${D.RECIPES.length} Rezepte)`);
ok(D.RECIPES.every(r => Array.isArray(r.cuisines) && r.cuisines.length && r.cuisines.every(c => D.CUISINES.includes(c))), 'Jedes Rezept hat gültige Küchenrichtung(en)');
ok(D.CUISINES.length === 13 && ['deutsch', 'italienisch', 'griechisch', 'türkisch', 'mexikanisch', 'asiatisch', 'chinesisch', 'japanisch', 'indisch', 'amerikanisch', 'französisch', 'mediterran', 'international'].every(c => D.CUISINES.includes(c)), 'Alle geforderten Küchen vorhanden');
ok(D.CUISINES.every(c => D.RECIPES.some(r => r.cuisines.includes(c))), 'Jede Küche hat mindestens ein Rezept');
const ital = base({ settings: { cuisines: ['italienisch'] } });
const pI = E.generatePlan(ital, { rng: E.rng(1) });
ok(pI.days.every(id => ital.recipeMap[id].cuisines.includes('italienisch')), 'Küchenfilter: nur italienische Gerichte');
const intlCtx = base();
for (let s = 1; s <= 25; s++) {
  const p = E.generatePlan(intlCtx, { rng: E.rng(s), international: true });
  const rs = p.days.map(id => intlCtx.recipeMap[id]);
  ok(new Set(p.days).size === 7, `International ${s}: keine Dubletten`);
  ok(rs.every(r => r.cuisines.some(c => c !== 'deutsch')), `International ${s}: keine rein deutschen Gerichte`);
  const cc = {}; rs.forEach(r => { const c = E.primaryCuisine(r); cc[c] = (cc[c] || 0) + 1; });
  ok(Math.max(...Object.values(cc)) <= 2, `International ${s}: höchstens 2× dieselbe Küche (${JSON.stringify(cc)})`);
  ok(rs.every(r => E.isEligible(intlCtx, r)), `International ${s}: Ernährungsregeln eingehalten`);
  ok(E.summary(intlCtx, p).total <= 120, `International ${s}: im Budget`);
}
// Duplikatschutz beim manuellen Setzen
const pd = E.generatePlan(intlCtx, { rng: E.rng(2) });
ok(E.canPlace(pd, 0, pd.days[3]) !== null && /Schon für/.test(E.canPlace(pd, 0, pd.days[3])), 'canPlace meldet Duplikat');
ok(E.canPlace(pd, 3, pd.days[3]) === null, 'canPlace erlaubt das Gericht am eigenen Tag');
ok(E.canPlace(pd, 0, 'unbekannt') === null, 'canPlace erlaubt neues Gericht');
const dupPlan = Object.assign({}, pd, { days: [pd.days[0], pd.days[0], ...pd.days.slice(2)] });
const fixed = E.repairPlan(intlCtx, dupPlan);
ok(new Set(fixed.plan.days).size === 7, 'Reparatur entfernt doppeltes Gericht');
ok(fixed.plan.days[0] === pd.days[0], 'Reparatur behält die erste Fundstelle');
// Aktiv/Inaktiv
const inactiveIds = D.RECIPES.filter(r => r.veg).slice(0, 20).map(r => r.id); const inact = {}; inactiveIds.forEach(i => { inact[i] = true; });
const ia = base({ blocked: inact });
for (let s = 1; s <= 15; s++) ok(E.generatePlan(ia, { rng: E.rng(s) }).days.every(id => !inact[id]), `Inaktive Rezepte nie geplant (Lauf ${s})`);
ok(E.alternatives(ia, E.generatePlan(ia, { rng: E.rng(1) }), 0, { limit: 30, sameType: false }).every(a => !inact[a.r.id]), 'Alternativen enthalten keine inaktiven Rezepte');
// Verlauf: Gerichte der Vorwoche werden gemieden
let reused = 0, total = 0;
for (let s = 1; s <= 30; s++) {
  const wk1 = E.generatePlan(base(), { rng: E.rng(s) });
  const wk2 = E.generatePlan(base({ history: [{ weekStart: '2026-11-09', days: wk1.days }] }), { rng: E.rng(s + 100) });
  reused += wk2.days.filter(id => wk1.days.includes(id)).length; total += 7;
}
ok(reused === 0, `Vorwoche wird nicht wiederholt (${reused} Wiederholungen in ${total} Gerichten)`);
const eng = E.makeCtx({ settings: { cuisines: [] }, recipes: D.RECIPES });
ok(E.cuisinesOf({}).join() === 'international', 'Ohne Küchenangabe: international');

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
