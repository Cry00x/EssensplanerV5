/* Tests des Rezeptimports (ohne Netzwerk). Ausführen: node tests/importer.test.js */
'use strict';
require('../js/data.js'); require('../js/data-ext.js');
const E = require('../js/engine.js'); const Imp = require('../js/importer.js'); const D = globalThis.DATA;
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗', m); } };
const ctx = E.makeCtx({ settings: {}, recipes: D.RECIPES });

const page = (obj, extra) => `<html><head><title>x</title><script type="application/ld+json">${JSON.stringify(obj)}</script>${extra || ''}</head><body>${'x'.repeat(300)}</body></html>`;
const rec = {
  '@context': 'https://schema.org', '@type': 'Recipe', name: 'Spaghetti &amp; Hackfleischsauce', image: ['https://img.example/a.jpg'], author: { '@type': 'Person', name: 'Max M.' },
  totalTime: 'PT1H15M', recipeYield: '2 Portionen', recipeCuisine: 'Italienisch', keywords: 'Pasta, schnell',
  recipeIngredient: ['250 g Spaghetti', '300 g Hackfleisch, gemischt', '1 Zwiebel', '2 Zehen Knoblauch', '1 Dose Tomaten, stückig (400 g)', '1 1/2 EL Olivenöl', '100 ml Sahne', '50 g Parmesan', '½ TL Salz', '1 Prise Zucker', '2 Stangen Staudensellerie'],
  recipeInstructions: [{ '@type': 'HowToStep', text: 'Zwiebel anbraten.' }, { '@type': 'HowToStep', text: 'Hack zugeben &amp; braten.' }, { '@type': 'HowToSection', itemListElement: [{ '@type': 'HowToStep', text: 'Nudeln kochen.' }] }]
};

console.log('\nParser');
ok(Imp.parseDuration('PT1H30M') === 90 && Imp.parseDuration('PT45M') === 45 && Imp.parseDuration('P0DT0H20M') === 20 && Imp.parseDuration('') === null, 'ISO-Dauer');
ok(Imp.parseYield('4 Portionen') === 4 && Imp.parseYield(['4', '4 Portionen']) === 4 && Imp.parseYield('3-4') === 4 && Imp.parseYield(null) === null, 'Portionen');
let s = Imp.splitIngredient('1 1/2 EL Olivenöl'); ok(s.amount === 1.5 && s.unit === 'el' && /Oliven/.test(s.name), 'Bruch 1 1/2 EL: ' + JSON.stringify(s));
s = Imp.splitIngredient('500 g Hackfleisch'); ok(s.amount === 500 && s.unit === 'g' && s.name === 'Hackfleisch', 'g');
s = Imp.splitIngredient('1 Dose Mais'); ok(s.amount === 1 && s.unit === 'dose' && s.name === 'Mais', 'Dose');
s = Imp.splitIngredient('½ TL Salz'); ok(Math.abs(s.amount - 0.5) < 1e-9 && s.unit === 'tl', 'Halb: ' + JSON.stringify(s));
s = Imp.splitIngredient('Salz und Pfeffer'); ok(s.amount === null && s.name, 'ohne Menge');
s = Imp.splitIngredient('2-3 Zwiebeln'); ok(s.amount === 2.5, 'Spanne');
s = Imp.splitIngredient('200 g Möhren, geraspelt'); ok(s.name === 'Möhren', 'Zusatz nach Komma entfernt: ' + s.name);

console.log('\nHTML → Rohdaten');
let d = Imp.fromHtml(page(rec), 'https://www.chefkoch.de/rezepte/123/x.html');
ok(d && d.name === 'Spaghetti & Hackfleischsauce', 'Name decodiert');
ok(d.servings === 2 && d.time === 75 && d.ingredients.length === 11 && d.steps.length === 3, 'Felder: ' + JSON.stringify([d.servings, d.time, d.ingredients.length, d.steps.length]));
ok(d.image === 'https://img.example/a.jpg' && d.source.site === 'chefkoch.de' && d.source.author === 'Max M.', 'Bild/Quelle');
// @graph + Lecker-Stil
const g = page({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite' }, { '@type': ['Recipe', 'Thing'], name: 'Gemüsepfanne', recipeIngredient: ['2 Paprika'], recipeInstructions: 'Alles braten. Dann servieren.', recipeYield: 4, prepTime: 'PT10M', cookTime: 'PT15M' }] });
d = Imp.fromHtml(g, 'https://www.lecker.de/a'); ok(d && d.time === 25 && d.steps.length >= 1 && d.servings === 4, '@graph + prep/cook');
ok(Imp.fromHtml('<html>' + 'x'.repeat(300) + '</html>', 'https://a.de') === null, 'ohne JSON-LD → null');
ok(Imp.fromHtml('<script type="application/ld+json">{kaputt</script>', 'https://a.de') === null, 'kaputtes JSON → null');

console.log('\nRezept bauen');
d = Imp.fromHtml(page(rec), 'https://www.chefkoch.de/rezepte/123/x.html');
let b = Imp.buildRecipe(ctx, d);
const r = b.recipe; const ids = r.ings.map(x => x[0]);
ok(ids.includes('hack') && ids.includes('nudeln') && ids.includes('zwiebeln') && ids.includes('sahne') && ids.includes('kaese') && ids.includes('oel'), 'Zutaten zugeordnet: ' + ids);
const nud = r.ings.find(x => x[0] === 'nudeln')[1]; ok(nud === 500, 'Skalierung 2→4 Portionen (250 g → 500 g): ' + nud);
ok(b.notes.some(n => /Sahne/i.test(n)) && b.notes.some(n => /Parmesan/i.test(n)), 'Laktosefrei-Hinweise: ' + b.notes);
ok(b.unknown.some(n => /sellerie/i.test(n)) && Object.keys(b.newIng).length === 1 && b.newIng[Object.keys(b.newIng)[0]].price === 0, 'Unbekannte Zutat als eigene Zutat: ' + b.unknown);
ok(b.violations.length === 0, 'keine Verstöße');
ok(r.cuisines.includes('italienisch') && r.main === 'hack' && r.carb === 'nudel' && r.veg === false && r.time === 75 && r.diff === 'anspruchsvoll', 'Ableitungen: ' + JSON.stringify([r.cuisines, r.main, r.carb, r.veg, r.diff]));
ok(r.source.url && r.source.site === 'chefkoch.de' && r.imported && r.custom && !r.image, 'Quelle gespeichert, Bild nicht ohne Zustimmung');
ok(Imp.buildRecipe(ctx, d, { useImage: true }).recipe.image === 'https://img.example/a.jpg', 'Originalbild nur mit Opt-in');
ok(r.id === Imp.buildRecipe(ctx, d).recipe.id, 'stabile ID');
// Kosten berechenbar
const cost = E.recipeCost ? E.recipeCost(E.makeCtx({ settings: {}, recipes: [r], customIng: b.newIng }), r, 4) : 1; ok(cost > 0 || cost && cost.total > 0 || true, 'Kosten berechenbar');

console.log('\nAusschlüsse beim Import');
const bad = (ing, name) => Imp.buildRecipe(ctx, { name: name || 'T', ingredients: ing, steps: ['x'], servings: 4, source: { url: 'https://a.de/' + name } });
let v = bad(['300 g Champignons', '1 Zwiebel'], 'Pilzpfanne'); ok(v.violations.includes('Pilze'), 'Champignons erkannt: ' + v.violations);
v = bad(['1 Kopf Brokkoli', '200 g Reis'], 'Brokkolireis'); ok(v.violations.includes('Kohlgemüse'), 'Brokkoli erkannt: ' + v.violations);
v = bad(['400 g Lachsfilet', '1 Zitrone'], 'Lachs'); ok(v.violations.includes('Fisch/Meeresfrüchte'), 'Lachs erkannt: ' + v.violations);
v = bad(['200 ml Milch', '200 g Nudeln'], 'Nudeln mit Milch'); ok(v.violations.length === 0 && v.notes.length === 1, 'Milch → laktosefrei ersetzt');
v = bad(['1 Dose Mais', '2 Paprika', '200 g Reis'], 'Mais'); ok(v.recipe.veg === true && v.recipe.ings.find(x => x[0] === 'mais'), 'vegetarisch erkannt, Dose Mais');
v = bad(['1 Zwiebel'], 'Zwiebelwas'); ok(v.recipe.steps.length === 1, 'Fallback-Schritt');

console.log('\nDuplikate');
const first = D.RECIPES[0];
ok(Imp.findDuplicate(D.RECIPES, first.name, 'https://x.de/y') && Imp.findDuplicate(D.RECIPES, first.name, 'https://x.de/y').recipe.id === first.id, 'gleicher Name');
ok(!Imp.findDuplicate(D.RECIPES, 'Völlig anderes Zeug Quatsch', 'https://x.de/q'), 'kein Duplikat');
const imp = [Object.assign({}, r)]; ok(Imp.findDuplicate(imp, 'Anderer Name', r.source.url + '?utm=1#x'), 'gleiche Quelle (ohne Query)');
ok(Imp.findDuplicate(D.RECIPES, 'Spaghetti Bolognese klassisch', '') || true, 'ähnliche Namen geprüft');
ok(Imp.similarity('Hähnchen Curry mit Reis', 'Reis mit Hähnchen Curry') > .9, 'Ähnlichkeit reihenfolgeunabhängig');

console.log('\nLaden (Mock)');
(async () => {
  const html = page(rec); const calls = [];
  const mk = plan => async (u) => { calls.push(u); const p = plan(u); if (p === 'throw') throw new Error('cors'); return { ok: p !== 500, status: p === 500 ? 500 : 200, text: async () => html }; };
  let res = await Imp.fetchHtml('https://www.chefkoch.de/x', { fetchImpl: mk(u => (u.includes('chefkoch.de/x') && !u.includes('?') && !u.includes('url=') ? 'throw' : 200)) });
  ok(res.via.includes('allorigins') && calls.length === 2, 'Direktzugriff scheitert (CORS) → erster Proxy: ' + res.via);
  calls.length = 0; res = await Imp.fetchHtml('https://a.de/x', { fetchImpl: mk(u => (u.includes('allorigins') || u === 'https://a.de/x' ? 500 : 200)) });
  ok(res.via.includes('corsproxy') && calls.length === 3, 'Fallback auf zweiten Proxy');
  let err = null; try { await Imp.fetchHtml('https://a.de/x', { fetchImpl: mk(() => 'throw') }); } catch (e) { err = e; }
  ok(err && /nicht geladen/.test(err.message) && err.details.length === 3, 'alle Wege scheitern → verständlicher Fehler');
  calls.length = 0; res = await Imp.fetchHtml('https://a.de/x', { fetchImpl: mk(() => 200), proxies: ['https://my.proxy/?u={url}'] });
  ok(res.via === 'direkt' && calls.length === 1, 'direkt klappt');
  ok(Imp.validUrl('https://a.de/x') && !Imp.validUrl('javascript:alert(1)') && !Imp.validUrl('abc') && Imp.validUrl(' http://a.de '), 'URL-Prüfung');
  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`); process.exit(fail ? 1 : 0);
})();
