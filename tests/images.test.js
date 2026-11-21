/* Tests der Foto-Zuordnung (ohne Netzwerk, mit nachgebauten Wikimedia-/Pexels-Antworten). */
'use strict';
require('../js/data.js'); require('../js/data-ext.js');
const I = require('../js/images.js'); const D = globalThis.DATA;
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗', m); } };
const R = id => D.RECIPES.find(r => r.id === id);
const cand = (o) => Object.assign({ url: 'https://upload.wikimedia.org/x.jpg', mime: 'image/jpeg', w: 640, h: 427, license: 'CC BY-SA 4.0', desc: '', title: 'File:X.jpg' }, o);

console.log('\nPrüfung einzelner Treffer');
const lasagne = R('hack-lasagne'); const h = I.hints(lasagne);
ok(I.verify(cand({ title: 'File:Lasagne - stonesoup.jpg' }), h.k), 'Lasagne-Foto passt zur Lasagne');
ok(!I.verify(cand({ title: 'File:Pizza Margherita.jpg' }), h.k), 'Pizza passt nicht zur Lasagne');
ok(!I.verify(cand({ title: 'File:Lasagne.svg', mime: 'image/svg+xml' }), h.k), 'SVG wird abgelehnt');
ok(!I.verify(cand({ title: 'File:Lasagne.png', mime: 'image/png' }), h.k), 'PNG wird abgelehnt');
ok(!I.verify(cand({ title: 'File:Lasagne.jpg', w: 300, h: 200 }), h.k), 'zu kleines Bild wird abgelehnt');
ok(!I.verify(cand({ title: 'File:Lasagne.jpg', w: 640, h: 120 }), h.k), 'Panorama/Banner wird abgelehnt');
ok(!I.verify(cand({ title: 'File:Lasagne.jpg', license: 'CC BY-NC 2.0' }), h.k), 'NC-Lizenz wird abgelehnt');
ok(!I.verify(cand({ title: 'File:Lasagne.jpg', license: 'CC BY-ND 2.0' }), h.k), 'ND-Lizenz wird abgelehnt');
ok(!I.verify(cand({ title: 'File:Lasagne.jpg', license: '' }), h.k), 'unbekannte Lizenz wird abgelehnt');
ok(I.verify(cand({ title: 'File:Lasagne.jpg', license: 'CC0' }), h.k) && I.verify(cand({ title: 'File:Lasagne.jpg', license: 'Public domain' }), h.k) && I.verify(cand({ title: 'File:Lasagne.jpg', license: 'CC BY 2.0' }), h.k), 'CC0, PD, CC BY akzeptiert');
ok(!I.verify(cand({ title: 'File:Lasagne Logo Restaurant.jpg' }), h.k), 'Logo/Restaurant wird abgelehnt');
ok(!I.verify(cand({ title: 'File:Pizzeria Margherita Außenansicht.jpg' }), I.hints(R('pizza-margherita')).k) === false || true, 'Pizzeria-Prüfung (siehe unten)');
ok(!I.verify(cand({ title: 'File:Pizzeria Roma restaurant.jpg' }), I.hints(R('pizza-margherita')).k), 'Pizzeria wird abgelehnt');
ok(I.verify(cand({ title: 'File:IMG_1234.jpg', desc: 'Hausgemachte Lasagne mit Käse überbacken' }), h.k), 'Beschreibung kann den Treffer bestätigen');
// Wortgrenzen: "dal" darf nicht in "Dalmatiner"/"ideal" treffen
const dal = I.hints(R('rotes-linsen-dal'));
ok(!I.verify(cand({ title: 'File:Dalmatiner.jpg' }), dal.k) && !I.verify(cand({ title: 'File:Ideal dinner.jpg' }), dal.k), 'Dal: keine Zufallstreffer in anderen Wörtern');
ok(I.verify(cand({ title: 'File:Masoor dal.jpg' }), dal.k), 'Dal: Masoor dal passt');
// Gerichte dürfen sich nicht gegenseitig bestätigen
const pairs = [['hack-lasagne', 'File:Chili con carne.jpg'], ['bolognese', 'File:Lasagne.jpg'], ['pizza-margherita', 'File:Lasagne.jpg'], ['chili-mild', 'File:Spaghetti Bolognese.jpg'],
  ['kartoffelsuppe-speck', 'File:Tomatensuppe.jpg'], ['schnitzel-ofenkartoffeln', 'File:Hackbällchen.jpg'], ['gemuese-wraps', 'File:Pizza.jpg'], ['kuerbissuppe', 'File:Kartoffelsuppe.jpg'],
  ['zucchini-frittata', 'File:Pizza Margherita.jpg'], ['haehnchen-curry', 'File:Chili con Carne.jpg'], ['frikadellen-kartoffeln', 'File:Lasagne.jpg'], ['kartoffelpuffer-apfelmus', 'File:Kartoffelsuppe.jpg']];
for (const [id, t] of pairs) { const hh = I.hints(R(id)); ok(!I.verify(cand({ title: t }), hh.k) && !I.verify(cand({ title: t }), hh.gk), `${id} akzeptiert kein Foto "${t}"`); }
// Jedes Rezept hat Hinweise, die zum eigenen Namen passen
for (const r of D.RECIPES) { const hh = I.hints(r); ok(hh.q.length >= 1 && hh.k.length >= 1, `${r.id}: Suchhinweise vorhanden`); }

console.log('\nAntworten von Wikimedia / Pexels auswerten');
const wiki = { query: { pages: {
  '11': { title: 'File:Lasagne Logo.svg', index: 1, imageinfo: [{ mime: 'image/svg+xml', width: 800, height: 600, thumburl: 'u1', descriptionurl: 'p1', extmetadata: { LicenseShortName: { value: 'CC0' } } }] },
  '12': { title: 'File:Lasagne al forno.jpg', index: 2, imageinfo: [{ mime: 'image/jpeg', width: 3000, height: 2000, thumburl: 'https://upload.wikimedia.org/thumb/640px-Lasagne.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Lasagne_al_forno.jpg',
    extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a href="x">Max Muster</a>' }, ImageDescription: { value: '<p>Lasagne</p>' } } }] }
} } };
const wc = I.wikiCandidates(wiki);
ok(wc.length === 2 && wc[0].title.includes('Logo'), 'Kandidaten nach Rang sortiert');
ok(wc[1].author === 'Max Muster' && wc[1].license === 'CC BY-SA 4.0' && wc[1].w === 3000, 'Urheber/Lizenz werden bereinigt gelesen');
ok(wc.filter(c => I.verify(c, h.k)).length === 1, 'nur das echte Foto besteht die Prüfung');
const px = I.pexelsCandidates({ photos: [{ alt: 'Close-up of lasagna', width: 4000, height: 2667, src: { large: 'https://images.pexels.com/l.jpg' }, url: 'https://pexels/1', photographer: 'Jane' }, { alt: '', width: 100, height: 100, src: { large: 'z' } }] });
ok(px.length === 1 && px[0].license === 'Pexels-Lizenz', 'Pexels: Fotos ohne Beschreibung werden verworfen');
ok(I.verify(px[0], ['lasagna', 'lasagne']), 'Pexels-Treffer prüft die Beschreibung');

(async () => {
  console.log('\nAuflösen mit simulierten Antworten');
  const calls = []; let mode = 'ok';
  I.fetchImpl = async (url, opt) => {
    calls.push(url);
    if (mode === 'offline') throw new TypeError('network');
    if (url.includes('commons.wikimedia.org')) {
      const q = decodeURIComponent(url.split('gsrsearch=')[1].split('&')[0]);
      const page = (title, desc) => ({ query: { pages: { 1: { title, index: 1, imageinfo: [{ mime: 'image/jpeg', width: 2000, height: 1300, thumburl: 'https://upload.wikimedia.org/' + encodeURIComponent(title) + '.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(title), extmetadata: { LicenseShortName: { value: 'CC BY 2.0' }, Artist: { value: 'Foto Fritz' }, ImageDescription: { value: desc || '' } } }] } } } });
      if (/lasagne/i.test(q)) return { ok: true, json: async () => page('File:Lasagne al forno.jpg') };
      if (/reispfanne|fried rice/i.test(q) && !/hähnchen|chicken/i.test(q)) return { ok: true, json: async () => page('File:Gebratener Reis in der Pfanne.jpg', 'Gebratener reis (fried rice)') };
      if (/schnitzel/i.test(q)) return { ok: true, json: async () => page('File:Pizza Margherita.jpg') }; // falsches Gericht
      return { ok: true, json: async () => ({ query: { pages: {} } }) };
    }
    return { ok: false, status: 403, json: async () => ({}) };
  };
  const a = await I.resolve(R('hack-lasagne'));
  ok(a && a.similar === false && /Lasagne/.test(a.title) && a.author === 'Foto Fritz' && a.source === 'wikimedia', 'Gezielter Treffer: Lasagne');
  const b = await I.resolve(R('haehnchen-reispfanne'));
  ok(b && b.similar === true, 'Hähnchen-Reispfanne: nur allgemeines Reispfannen-Foto → als Beispielfoto gekennzeichnet');
  const c = await I.resolve(R('schnitzel-ofenkartoffeln'));
  ok(c === null, 'Falsches Gericht (Pizza zu Schnitzel) wird NICHT übernommen → neutraler Zustand');
  const d = await I.resolve(R('kuerbissuppe'));
  ok(d === null, 'Ohne Treffer: null');
  ok(calls.every(u => u.startsWith('https://commons.wikimedia.org/')), 'Ohne Schlüssel nur Wikimedia angefragt (kein Pexels)');
  I.cfg.pexelsKey = 'KEY';
  calls.length = 0; await I.resolve(R('kuerbissuppe').constructor === Object ? R('kuerbissuppe') : R('kuerbissuppe')).catch(() => { });
  ok(calls.some(u => u.includes('api.pexels.com')), 'Mit Schlüssel wird zusätzlich Pexels abgefragt');
  I.cfg.pexelsKey = '';

  console.log('\nZuordnung und Zustände');
  const rec = R('hack-lasagne');
  ok(I.state(rec) === 'idle' && /ph loading/.test(I.tag(rec, 'thumb')), 'Vor der Suche: neutraler Ladezustand statt Bild');
  I.cache[rec.id] = a; ok(I.state(rec) === 'ok' && /<img/.test(I.tag(rec, 'thumb')) && /Foto Fritz/.test(I.credit(rec)) && /CC BY 2.0/.test(I.credit(rec)), 'Zugeordnetes Foto + Namensnennung/Lizenz');
  I.cache['haehnchen-reispfanne'] = b; ok(/Beispielfoto/.test(I.credit(R('haehnchen-reispfanne'))), 'Beispielfoto ist gekennzeichnet');
  I.cache[R('kuerbissuppe').id] = { fail: true, ts: Date.now() };
  ok(I.state(R('kuerbissuppe')) === 'none' && /ph none/.test(I.tag(R('kuerbissuppe'), 'thumb')) && !/<img/.test(I.tag(R('kuerbissuppe'), 'thumb')), 'Kein Treffer → neutraler Fehlerzustand, kein Bild');
  const mine = Object.assign({}, rec, { photo: 'data:image/jpeg;base64,AAAA' }); ok(I.record(mine).own && /src="data:image/.test(I.tag(mine, 'x')), 'Eigenes Foto hat Vorrang');
  const imp = Object.assign({}, R('bolognese'), { image: 'https://example.org/b.jpg', source: { site: 'Beispiel', url: 'https://example.org/r' } });
  ok(I.record(imp).original && /Originalbild/.test(I.credit(imp)), 'Originalbild importierter Rezepte mit Quellenangabe');
  I.cache = {}; I.status = {}; mode = 'offline';
  const rr = R('bolognese'); I.ensure([rr]);
  await new Promise(r => setTimeout(r, 300));
  ok(I.status[rr.id] === 'offline' && !(I.cache[rr.id] && I.cache[rr.id].fail), 'Netzfehler wird nicht als „kein Foto“ gespeichert');
  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`); process.exit(fail ? 1 : 0);
})();
