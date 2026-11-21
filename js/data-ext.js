/* Erweiterung der Grunddatenbank (ergänzt data.js, ändert dort nichts):
 *  - Küchenrichtungen je Rezept
 *  - Foto-Suchhinweise je Rezept (für die automatische Bildzuordnung, siehe images.js)
 *  - zusätzliche internationale Rezepte und eine laktosefreie Butter
 * Alle Mengen: 4 Personen. Rezept-IDs bleiben dauerhaft stabil. */
(function (g) {
  'use strict';
  const D = g.DATA, ING = D.ING;

  D.CUISINES = ['deutsch', 'italienisch', 'griechisch', 'türkisch', 'mexikanisch', 'asiatisch', 'chinesisch', 'japanisch', 'indisch', 'amerikanisch', 'französisch', 'mediterran', 'international'];
  D.CUISINE_LABEL = {
    deutsch: '🇩🇪 Deutsch', italienisch: '🇮🇹 Italienisch', griechisch: '🇬🇷 Griechisch', türkisch: '🇹🇷 Türkisch', mexikanisch: '🇲🇽 Mexikanisch', asiatisch: '🥢 Asiatisch',
    chinesisch: '🇨🇳 Chinesisch', japanisch: '🇯🇵 Japanisch', indisch: '🇮🇳 Indisch', amerikanisch: '🇺🇸 Amerikanisch', französisch: '🇫🇷 Französisch', mediterran: '🌊 Mediterran', international: '🌍 International'
  };

  // ── zusätzliche Zutat (laktosefrei) ──
  ING.butter = { id: 'butter', n: 'Laktosefreie Butter', cat: 'Milchprodukte', u: 'g', pack: 250, price: 2.29, kcal: 740, p: 0.7, c: 0.6, f: 82, dairy: true };

  const extra = [];
  function R(id, name, emoji, o, ings, steps) { extra.push(Object.assign({ id, name, emoji, veg: false, diff: 'leicht', carb: 'keine' }, o, { ings, steps })); }

  // ───────────── Griechisch ─────────────
  R('gyros-reispfanne', 'Gyros-Reispfanne mit Tzatziki', '🥙🍚', { time: 35, main: 'schwein', carb: 'reis', cuisines: ['griechisch'] },
    [['schwein', 500], ['reis', 280], ['zwiebeln', 150], ['paprika', 1], ['tomaten', 250], ['joghurt', 250], ['gurke', 1], ['knoblauch', 2], ['oel', 30], ['paprikapulver', 2], ['kraeuter', 2], ['salz', 2], ['pfeffer', 1]],
    ['Reis in Salzwasser garen.', 'Schweineschnitzel in dünne Streifen schneiden und mit Paprikapulver, Kräutern, Salz und Pfeffer würzen.', 'Im heißen Öl portionsweise knusprig braten, Zwiebel- und Paprikastreifen zugeben und 5 Minuten mitbraten.', 'Für das Tzatziki die halbe Gurke raspeln und mit laktosefreiem Joghurt, gepresstem Knoblauch und Salz verrühren.', 'Tomaten und restliche Gurke würfeln. Alles mit dem Reis anrichten.']);

  R('griechisches-haehnchen-ofen', 'Griechisches Ofenhähnchen mit Kartoffeln und Joghurtdip', '🍗🥔', { time: 45, main: 'haehnchen', carb: 'kartoffel', cuisines: ['griechisch', 'mediterran'] },
    [['haehnchenkeule', 1000], ['kartoffeln', 800], ['paprika', 1], ['zwiebeln', 150], ['joghurt', 250], ['gurke', 1], ['knoblauch', 2], ['oel', 40], ['kraeuter', 2], ['paprikapulver', 1], ['salz', 2], ['pfeffer', 1]],
    ['Backofen auf 200 °C vorheizen. Kartoffeln in Spalten, Paprika und Zwiebeln in Stücke schneiden.', 'Alles mit Öl, Kräutern, Paprikapulver, Salz und Pfeffer mischen und auf ein tiefes Blech geben, die Keulen darauflegen.', '40 Minuten backen, nach der Hälfte wenden, bis die Keulen goldbraun und gar sind.', 'Joghurt mit geraspelter Gurke, gepresstem Knoblauch und Salz verrühren und dazu servieren.']);

  // ───────────── Türkisch ─────────────
  R('koefte-reis-tomatensosse', 'Köfte mit Reis und Tomatensoße', '🍖🍚', { time: 40, main: 'hack', carb: 'reis', cuisines: ['türkisch'] },
    [['hack', 500], ['reis', 280], ['zwiebeln', 150], ['eier', 1], ['paniermehl', 40], ['passierte', 400], ['tomatenmark', 20], ['joghurt', 150], ['oel', 30], ['paprikapulver', 2], ['kreuzkuemmel', 1], ['salz', 2], ['pfeffer', 1]],
    ['Reis in Salzwasser garen.', 'Hack mit Hälfte der fein gewürfelten Zwiebel, Ei, Paniermehl, Paprikapulver, Kreuzkümmel, Salz und Pfeffer verkneten und längliche Röllchen formen.', 'Im Öl rundherum braun braten und herausnehmen.', 'Restliche Zwiebel anschwitzen, Tomatenmark und passierte Tomaten zugeben, 8 Minuten köcheln, Köfte kurz darin ziehen lassen.', 'Mit Reis und laktosefreiem Joghurt servieren.']);

  R('menemen-fladen', 'Menemen (türkisches Paprika-Tomaten-Rührei) mit Wraps', '🍳🍅', { veg: true, time: 25, main: 'ei', carb: 'brot', cuisines: ['türkisch'] },
    [['eier', 8], ['paprika', 2], ['tomaten', 400], ['zwiebeln', 100], ['wraps', 8], ['joghurt', 150], ['oel', 30], ['paprikapulver', 1], ['salz', 1], ['pfeffer', 1]],
    ['Zwiebeln und Paprika würfeln und im Öl 6 Minuten weich braten.', 'Gewürfelte Tomaten zugeben und 8 Minuten einkochen lassen, würzen.', 'Eier verquirlen, in die Pfanne gießen und unter vorsichtigem Rühren stocken lassen.', 'Wraps kurz erwärmen und mit laktosefreiem Joghurt zum Menemen servieren.']);

  // ───────────── Mexikanisch ─────────────
  R('haehnchen-quesadillas', 'Hähnchen-Quesadillas mit Mais und Käse', '🌮🧀', { time: 30, main: 'haehnchen', carb: 'brot', cuisines: ['mexikanisch'] },
    [['haehnchenbrust', 400], ['wraps', 8], ['kaese', 200], ['paprika', 1], ['mais', 140], ['zwiebeln', 100], ['tomaten', 250], ['joghurt', 150], ['oel', 30], ['paprikapulver', 2], ['kreuzkuemmel', 1], ['salz', 1], ['pfeffer', 1]],
    ['Hähnchen in kleine Würfel schneiden, würzen und im Öl 6 Minuten braten. Zwiebel und Paprika würfeln und 4 Minuten mitbraten, Mais zugeben.', 'Vier Wraps mit laktosefreiem Käse und der Hähnchenmischung belegen, mit je einem zweiten Wrap abdecken.', 'In einer Pfanne pro Seite 3 Minuten goldbraun backen und in Stücke schneiden.', 'Tomaten würfeln und mit Joghurt und etwas Salz als Beilage servieren.']);

  R('burrito-bowl', 'Burrito-Bowl mit Reis, Bohnen und Mais', '🥣🫘', { veg: true, time: 30, main: 'huelsen', carb: 'reis', cuisines: ['mexikanisch'] },
    [['reis', 250], ['kidney', 240], ['mais', 140], ['paprika', 1], ['tomaten', 250], ['gurke', 1], ['salat', 0.5], ['kaese', 80], ['joghurt', 200], ['oel', 20], ['paprikapulver', 1], ['kreuzkuemmel', 1], ['salz', 1], ['pfeffer', 1]],
    ['Reis in Salzwasser garen.', 'Bohnen und Mais abtropfen und mit Paprikapulver, Kreuzkümmel und etwas Öl 5 Minuten erwärmen.', 'Paprika, Tomaten und Gurke würfeln, Salat in Streifen schneiden.', 'Alles in Schalen anrichten, mit laktosefreiem Käse und Joghurt toppen.']);

  // ───────────── Japanisch / Chinesisch / Asiatisch ─────────────
  R('teriyaki-haehnchen-reis', 'Mildes Teriyaki-Hähnchen mit Reis und Gemüse', '🍗🍚', { time: 30, main: 'haehnchen', carb: 'reis', cuisines: ['japanisch', 'asiatisch'] },
    [['haehnchenbrust', 500], ['reis', 280], ['moehren', 200], ['paprika', 1], ['erbsen', 150], ['zwiebeln', 100], ['sojasauce', 60], ['zucker', 15], ['oel', 25], ['salz', 1], ['pfeffer', 1]],
    ['Reis in Salzwasser garen.', 'Hähnchen in Würfel schneiden und im Öl goldbraun braten, herausnehmen.', 'Möhrenstifte, Paprika- und Zwiebelstreifen 6 Minuten braten, Erbsen zugeben.', 'Sojasauce, Zucker und 100 ml Wasser verrühren, zum Gemüse geben und 3 Minuten einkochen lassen, Hähnchen unterheben und mit Reis servieren.']);

  R('gebratene-nudeln-gemuese', 'Gebratene Nudeln mit Gemüse und Ei', '🍜🥕', { veg: true, time: 25, main: 'gemuese', carb: 'nudel', cuisines: ['chinesisch', 'asiatisch'] },
    [['nudeln', 350], ['eier', 3], ['moehren', 200], ['paprika', 1], ['erbsen', 150], ['lauchzwiebeln', 1], ['sojasauce', 50], ['oel', 30], ['salz', 1], ['pfeffer', 1]],
    ['Nudeln bissfest kochen, abgießen und kalt abspülen.', 'Möhren in Stifte, Paprika in Streifen schneiden und im Öl 6 Minuten braten, Erbsen zugeben.', 'Eier verquirlen, an den Rand schieben und stocken lassen.', 'Nudeln und Sojasauce unterheben, 3 Minuten braten und mit Lauchzwiebelringen bestreut servieren.']);

  R('suess-saure-schweinepfanne', 'Mild süß-saure Schweinepfanne mit Reis', '🥘🍚', { time: 35, main: 'schwein', carb: 'reis', cuisines: ['chinesisch', 'asiatisch'] },
    [['schwein', 450], ['reis', 280], ['paprika', 2], ['moehren', 200], ['zwiebeln', 100], ['tomatenmark', 40], ['sojasauce', 40], ['zucker', 20], ['oel', 30], ['salz', 1], ['pfeffer', 1]],
    ['Reis in Salzwasser garen.', 'Fleisch in Streifen schneiden und im Öl 5 Minuten braten, herausnehmen.', 'Möhren, Paprika und Zwiebeln in Stücken 8 Minuten braten.', 'Tomatenmark, Sojasauce, Zucker und 150 ml Wasser verrühren, zugeben und 5 Minuten köcheln, Fleisch unterheben. Mit Reis servieren.']);

  // ───────────── Indisch ─────────────
  R('haehnchen-tikka-masala', 'Mildes Hähnchen-Tikka-Masala mit Reis', '🍛🍗', { time: 40, main: 'haehnchen', carb: 'reis', cuisines: ['indisch'], spicyVariant: 'Leicht scharfe Variante: eine Prise Chiliflocken zur Soße geben.' },
    [['haehnchenbrust', 500], ['reis', 280], ['joghurt', 150], ['passierte', 400], ['sahne', 100], ['zwiebeln', 150], ['knoblauch', 2], ['oel', 30], ['curry', 2], ['paprikapulver', 2], ['salz', 1], ['pfeffer', 1]],
    ['Hähnchen würfeln und mit Joghurt, Hälfte von Curry und Paprikapulver, Salz 10 Minuten marinieren. Reis garen.', 'Hähnchen im Öl anbraten, herausnehmen. Zwiebeln und Knoblauch im Bratfett andünsten.', 'Restliche Gewürze, passierte Tomaten zugeben und 10 Minuten köcheln.', 'Laktosefreie Sahne und Hähnchen zugeben, 5 Minuten ziehen lassen und mit Reis servieren.']);

  R('rotes-linsen-dal', 'Rotes Linsen-Dal mit Kokosmilch und Reis', '🍲🍚', { veg: true, time: 35, main: 'huelsen', carb: 'reis', cuisines: ['indisch'] },
    [['rotelinsen', 250], ['reis', 250], ['kokosmilch', 400], ['gehackte', 200], ['zwiebeln', 150], ['knoblauch', 2], ['spinat', 150], ['oel', 20], ['curry', 2], ['kreuzkuemmel', 1], ['bruehe', 1], ['salz', 1]],
    ['Reis in Salzwasser garen.', 'Zwiebeln und Knoblauch im Öl andünsten, Curry und Kreuzkümmel kurz mitrösten.', 'Linsen, Kokosmilch, gehackte Tomaten und 300 ml Wasser mit Brühe zugeben und 15 Minuten köcheln.', 'Aufgetauten Spinat unterrühren, abschmecken und mit Reis servieren.']);

  // ───────────── Amerikanisch ─────────────
  R('ofen-nuggets-kartoffelspalten', 'Knusprige Hähnchen-Nuggets mit Kartoffelspalten und Maissalat', '🍗🥔', { time: 45, diff: 'mittel', main: 'haehnchen', carb: 'kartoffel', cuisines: ['amerikanisch'] },
    [['haehnchenbrust', 500], ['paniermehl', 80], ['eier', 2], ['mehl', 50], ['kartoffeln', 800], ['mais', 280], ['gurke', 1], ['joghurt', 100], ['oel', 50], ['paprikapulver', 1], ['salz', 2], ['pfeffer', 1]],
    ['Backofen auf 200 °C vorheizen. Kartoffelspalten mit 30 ml Öl und Salz mischen und 35 Minuten backen.', 'Hähnchen in mundgerechte Stücke schneiden, würzen und nacheinander in Mehl, Ei und Paniermehl wenden.', 'Mit dem restlichen Öl beträufeln und auf einem Blech 20 Minuten backen, einmal wenden.', 'Mais, gewürfelte Gurke und Joghurt mit Salz und Pfeffer zum Salat mischen.']);

  // ───────────── Französisch / Mediterran ─────────────
  R('kartoffelgratin-salat', 'Kartoffelgratin mit gemischtem Salat', '🥔🧀', { veg: true, time: 45, main: 'kartoffel', carb: 'kartoffel', cuisines: ['französisch'] },
    [['kartoffeln', 1000], ['sahne', 200], ['milch', 150], ['knoblauch', 2], ['kaese', 120], ['butter', 20], ['salat', 0.5], ['tomaten', 250], ['gurke', 1], ['salz', 2], ['pfeffer', 1]],
    ['Backofen auf 180 °C vorheizen. Form mit laktosefreier Butter einfetten, Kartoffeln in dünne Scheiben hobeln.', 'Laktosefreie Sahne und Milch mit Knoblauch, Salz und Pfeffer verrühren.', 'Kartoffeln einschichten, Sahnemischung darübergießen, mit laktosefreiem Käse bestreuen.', '40 Minuten goldbraun backen. Salat, Tomaten und Gurke klein schneiden und dazu servieren.']);

  R('ratatouille-couscous', 'Gemüse-Ratatouille mit Couscous', '🥘🍅', { veg: true, time: 35, main: 'gemuese', carb: 'couscous', cuisines: ['französisch', 'mediterran'] },
    [['zucchini', 400], ['paprika', 2], ['zwiebeln', 150], ['gehackte', 400], ['knoblauch', 2], ['couscous', 250], ['bruehe', 2], ['oel', 30], ['kraeuter', 2], ['salz', 1], ['pfeffer', 1]],
    ['Gemüse in gleichmäßige Würfel schneiden. Couscous mit 300 ml heißem Wasser mit Brühe übergießen und quellen lassen.', 'Zwiebeln und Knoblauch im Öl andünsten, Paprika und Zucchini 8 Minuten mitbraten.', 'Gehackte Tomaten und Kräuter zugeben und 15 Minuten schmoren.', 'Mit Salz und Pfeffer abschmecken und mit dem Couscous servieren.']);

  extra.forEach(r => { if (!D.RECIPES.some(x => x.id === r.id)) D.RECIPES.push(r); });

  // ── Küchenrichtungen der Basisrezepte ──
  const C = {
    'haehnchen-reispfanne': ['international'], 'haehnchen-rahmgeschnetzeltes': ['deutsch'], 'haehnchenkeulen-ofen': ['deutsch'], 'haehnchen-wraps': ['mexikanisch', 'amerikanisch'],
    'haehnchen-curry': ['indisch', 'asiatisch'], 'haehnchen-nudelauflauf': ['italienisch'], 'haehnchen-kartoffelpfanne': ['deutsch'], 'haehnchen-couscous-bowl': ['mediterran', 'türkisch'],
    'hackbaellchen-pueree': ['deutsch'], 'bolognese': ['italienisch'], 'hackbaellchen-paprikasosse': ['deutsch'], 'hack-reispfanne': ['international'], 'hack-lasagne': ['italienisch'],
    'kartoffel-hack-auflauf': ['deutsch'], 'gefuellte-paprika-hack': ['deutsch', 'mediterran'], 'hack-wraps-bohnen': ['mexikanisch'], 'chili-mild': ['mexikanisch', 'amerikanisch'],
    'schnitzel-ofenkartoffeln': ['deutsch'], 'schweinegeschnetzeltes-reis': ['deutsch'], 'schweinestreifen-gemuesepfanne': ['asiatisch'], 'schnitzel-pizzaiola': ['italienisch'],
    'rindergeschnetzeltes-pueree': ['deutsch'], 'rind-gemuese-reis': ['asiatisch', 'chinesisch'], 'rind-kartoffel-eintopf': ['deutsch'], 'bratkartoffeln-speck-ei': ['deutsch'],
    'kartoffelsuppe-speck': ['deutsch'], 'linseneintopf-speck': ['deutsch'], 'frikadellen-kartoffeln': ['deutsch'], 'gemuese-wraps': ['mexikanisch', 'international'],
    'ofenkartoffeln-quark': ['deutsch'], 'kartoffelauflauf-cremig': ['deutsch', 'französisch'], 'gemuesepfanne-reis': ['asiatisch'], 'pizza-margherita': ['italienisch'], 'pizza-gemuese': ['italienisch'],
    'gemuese-lasagne': ['italienisch'], 'spaghetti-gemuesesosse': ['italienisch'], 'gemuese-nudelauflauf': ['deutsch'], 'kichererbsen-curry': ['indisch'], 'rote-linsen-eintopf': ['international'],
    'bohnen-mais-reispfanne': ['mexikanisch'], 'bohnen-wraps': ['mexikanisch'], 'eier-tomatensosse': ['mediterran', 'türkisch'], 'kartoffel-spinat-omelett': ['mediterran'],
    'spinat-kartoffel-auflauf': ['deutsch'], 'kartoffelpuffer-apfelmus': ['deutsch'], 'bratkartoffeln-gemuese-ei': ['deutsch'], 'suesskartoffel-kichererbsen': ['mediterran'],
    'gefuellte-paprika-vegi': ['mediterran'], 'zucchini-frittata': ['italienisch'], 'couscous-gemuesepfanne': ['mediterran'], 'tomatensuppe-nudeln': ['italienisch'], 'kuerbissuppe': ['deutsch'],
    'kuerbis-kartoffel-auflauf': ['deutsch'], 'eierreis-gemuese': ['chinesisch', 'asiatisch'], 'weisse-bohnen-eintopf': ['mediterran'], 'gemuese-pfannkuchen': ['französisch', 'deutsch'],
    'pellkartoffeln-ei-quark': ['deutsch'], 'reis-gemuese-auflauf': ['deutsch']
  };
  D.RECIPES.forEach(r => { if (!r.cuisines) r.cuisines = C[r.id] || ['international']; });

  /* ── Foto-Suchhinweise ──
   * q: gezielte Suchbegriffe, k: Schlüsselwörter, von denen mindestens eines im Dateititel/der Beschreibung stehen muss
   *    ("a+b" = beide Wörter), g/gk: allgemeinere Suche (Treffer werden als „Beispielfoto“ gekennzeichnet).
   * Ohne verlässlichen Treffer zeigt die App einen neutralen Zustand – nie ein Bild eines anderen Gerichts. */
  const H = {
    'haehnchen-reispfanne': [['Hähnchen Reispfanne', 'chicken fried rice', 'Hühnchen Reis Pfanne'], ['hähnchen+reis', 'hühnchen+reis', 'chicken+rice', 'reispfanne'], ['Reispfanne', 'fried rice'], ['reispfanne', 'fried rice', 'gebratener reis']],
    'haehnchen-rahmgeschnetzeltes': [['Geschnetzeltes Hähnchen Sahnesoße Nudeln', 'chicken cream sauce pasta'], ['geschnetzelt+nudel', 'hähnchen+rahm', 'chicken+cream+pasta'], ['Geschnetzeltes', 'Züricher Geschnetzeltes'], ['geschnetzelt']],
    'haehnchenkeulen-ofen': [['Hähnchenkeule Ofenkartoffeln', 'roasted chicken legs potatoes', 'Hähnchenschenkel Kartoffeln'], ['hähnchen+kartoffel', 'chicken+potato', 'hähnchenkeule', 'chicken legs'], ['Hähnchenschenkel gebacken', 'roast chicken legs'], ['hähnchen', 'chicken leg', 'hähnchenschenkel']],
    'haehnchen-wraps': [['Hähnchen Wrap', 'chicken wrap', 'Wrap Hähnchen Gemüse'], ['hähnchen+wrap', 'chicken+wrap', 'wrap'], ['Wrap Tortilla gefüllt', 'wrap sandwich'], ['wrap']],
    'haehnchen-curry': [['Hähnchen Curry Reis', 'chicken curry rice'], ['hähnchen+curry', 'chicken+curry', 'curry+reis'], ['Curry Reis', 'Chicken curry'], ['curry']],
    'haehnchen-nudelauflauf': [['Nudelauflauf', 'Nudelauflauf Hähnchen', 'baked pasta'], ['nudelauflauf', 'baked pasta', 'pasta+auflauf'], ['Nudelauflauf'], ['nudelauflauf', 'pasta bake']],
    'haehnchen-kartoffelpfanne': [['Bratkartoffeln Hähnchen', 'Kartoffelpfanne', 'chicken potato skillet'], ['kartoffelpfanne', 'hähnchen+kartoffel', 'chicken+potato'], ['Bratkartoffeln', 'Kartoffelpfanne'], ['bratkartoffel', 'kartoffelpfanne']],
    'haehnchen-couscous-bowl': [['Couscous Hähnchen Bowl', 'couscous chicken salad'], ['couscous+hähnchen', 'couscous+chicken', 'couscous+bowl'], ['Couscous Salat', 'Couscous'], ['couscous']],
    'hackbaellchen-pueree': [['Hackbällchen Tomatensoße Kartoffelpüree', 'Hackbällchen', 'meatballs mashed potatoes'], ['hackbällchen', 'meatball', 'frikadelle+püree'], ['Hackbällchen', 'Köttbullar', 'meatballs'], ['hackbällchen', 'meatball', 'köttbullar']],
    'bolognese': [['Spaghetti Bolognese', 'spaghetti bolognese'], ['bolognese', 'ragù', 'ragu'], ['Spaghetti Bolognese'], ['bolognese']],
    'hackbaellchen-paprikasosse': [['Hackbällchen Reis Soße', 'Hackbällchen', 'meatballs rice'], ['hackbällchen', 'meatball'], ['Hackbällchen', 'meatballs'], ['hackbällchen', 'meatball']],
    'hack-reispfanne': [['Hackfleisch Reispfanne', 'Reispfanne Hack'], ['reispfanne', 'hack+reis'], ['Reispfanne', 'Reis Hackfleisch Pfanne'], ['reispfanne', 'hack+reis']],
    'hack-lasagne': [['Lasagne', 'Lasagne Bolognese', 'lasagna'], ['lasagne', 'lasagna'], ['Lasagne al forno'], ['lasagne', 'lasagna']],
    'kartoffel-hack-auflauf': [['Kartoffel Hackfleisch Auflauf', 'Kartoffelauflauf Hack'], ['kartoffelauflauf', 'kartoffel+hack', 'potato+casserole'], ['Kartoffelauflauf', 'Kartoffelgratin'], ['kartoffelauflauf', 'gratin']],
    'gefuellte-paprika-hack': [['Gefüllte Paprika', 'stuffed peppers'], ['gefüllte paprika', 'stuffed pepper', 'stuffed+pepper', 'paprika+gefüllt'], ['Gefüllte Paprikaschoten'], ['gefüllte paprika', 'stuffed pepper', 'paprika+gefüllt']],
    'hack-wraps-bohnen': [['Wrap Hackfleisch Bohnen', 'burrito', 'Burrito'], ['burrito', 'wrap', 'hack+wrap'], ['Burrito', 'Tortilla Wrap'], ['burrito', 'wrap']],
    'chili-mild': [['Chili con Carne', 'chili con carne'], ['chili con carne', 'chili+carne', 'chilli+carne'], ['Chili con Carne'], ['chili con carne', 'chilli con carne']],
    'schnitzel-ofenkartoffeln': [['Schnitzel Kartoffeln', 'Schweineschnitzel Bratkartoffeln', 'Wiener Schnitzel Kartoffeln'], ['schnitzel+kartoffel', 'schnitzel+potato', 'schnitzel+bratkartoffel'], ['Schweineschnitzel', 'Schnitzel'], ['schnitzel']],
    'schweinegeschnetzeltes-reis': [['Schweinegeschnetzeltes Reis', 'Geschnetzeltes Reis Sahnesoße'], ['geschnetzeltes+reis', 'schweinegeschnetzeltes'], ['Geschnetzeltes'], ['geschnetzelt']],
    'schweinestreifen-gemuesepfanne': [['Gemüsepfanne Schweinefleisch Nudeln', 'Pfannengericht Fleisch Gemüse Nudeln', 'stir fry noodles pork'], ['gemüsepfanne+nudel', 'stir+fry+noodle', 'nudel+pfanne+gemüse'], ['Gebratene Nudeln', 'stir fry noodles'], ['gebratene nudeln', 'stir fry', 'chow mein']],
    'schnitzel-pizzaiola': [['Schnitzel Tomate Mozzarella überbacken', 'Pizzaiola Schnitzel', 'Cotoletta pizzaiola'], ['pizzaiola', 'schnitzel+mozzarella', 'schnitzel+tomate', 'überbacken+schnitzel'], ['Überbackenes Schnitzel', 'Schnitzel'], ['schnitzel']],
    'rindergeschnetzeltes-pueree': [['Rindergeschnetzeltes Kartoffelpüree', 'Geschnetzeltes Püree'], ['rindergeschnetzeltes', 'geschnetzeltes+püree', 'beef+mashed'], ['Rindergeschnetzeltes', 'Beef Stroganoff'], ['rindergeschnetzeltes', 'stroganoff']],
    'rind-gemuese-reis': [['Rindfleisch Gemüse Reis Pfanne', 'beef stir fry rice', 'Rindfleisch Gemüsepfanne'], ['rindfleisch+gemüse', 'beef+stir', 'beef+vegetable'], ['Beef stir fry', 'Rindfleisch Pfanne asiatisch'], ['beef stir fry', 'rindfleisch+pfanne']],
    'rind-kartoffel-eintopf': [['Rindfleisch Kartoffel Eintopf', 'Gulasch Eintopf', 'beef potato stew'], ['eintopf', 'stew', 'gulasch'], ['Eintopf Rindfleisch', 'beef stew'], ['rindfleisch+eintopf', 'beef stew', 'gulasch']],
    'bratkartoffeln-speck-ei': [['Bratkartoffeln Spiegelei', 'Bratkartoffeln mit Speck', 'Bauernfrühstück'], ['bratkartoffel', 'bauernfrühstück'], ['Bratkartoffeln'], ['bratkartoffel']],
    'kartoffelsuppe-speck': [['Kartoffelsuppe', 'Kartoffelsuppe Speck'], ['kartoffelsuppe', 'potato soup'], ['Kartoffelsuppe'], ['kartoffelsuppe', 'potato soup']],
    'linseneintopf-speck': [['Linseneintopf', 'Linsensuppe'], ['linseneintopf', 'linsensuppe', 'lentil+soup', 'lentil+stew'], ['Linsensuppe', 'Linseneintopf'], ['linsensuppe', 'linseneintopf', 'lentil soup']],
    'frikadellen-kartoffeln': [['Frikadellen Kartoffeln', 'Frikadelle', 'Buletten'], ['frikadelle', 'bulette', 'hacksteak'], ['Frikadelle'], ['frikadelle', 'bulette']],
    'gemuese-wraps': [['Gemüse Wrap', 'vegetarian wrap', 'veggie wrap'], ['gemüse+wrap', 'veggie+wrap', 'vegetable+wrap', 'vegetarian+wrap'], ['Wrap Gemüse', 'Wraps'], ['wrap']],
    'ofenkartoffeln-quark': [['Ofenkartoffel Kräuterquark', 'Ofenkartoffeln', 'Baked potato quark'], ['ofenkartoffel', 'baked potato', 'quark+kartoffel'], ['Ofenkartoffel', 'baked potato'], ['ofenkartoffel', 'baked potato']],
    'kartoffelauflauf-cremig': [['Kartoffelauflauf', 'Kartoffelgratin'], ['kartoffelauflauf', 'kartoffelgratin', 'gratin dauphinois', 'potato gratin'], ['Kartoffelgratin', 'Gratin dauphinois'], ['kartoffelgratin', 'gratin']],
    'gemuesepfanne-reis': [['Gemüsepfanne Reis', 'vegetable stir fry rice'], ['gemüsepfanne', 'vegetable+stir', 'stir+fry+rice'], ['Gemüsepfanne', 'vegetable stir fry'], ['gemüsepfanne', 'vegetable stir']],
    'pizza-margherita': [['Pizza Margherita', 'pizza margherita'], ['margherita'], ['Pizza Margherita'], ['pizza margherita', 'margherita']],
    'pizza-gemuese': [['Gemüsepizza', 'Pizza Gemüse', 'vegetable pizza'], ['gemüsepizza', 'vegetable+pizza', 'pizza+gemüse', 'veggie+pizza', 'pizza+paprika'], ['Pizza vegetarisch', 'Pizza'], ['pizza']],
    'gemuese-lasagne': [['Gemüselasagne', 'vegetable lasagna'], ['gemüselasagne', 'vegetable+lasagn', 'lasagne+gemüse', 'veggie+lasagn'], ['Lasagne', 'Lasagna'], ['lasagne', 'lasagna']],
    'spaghetti-gemuesesosse': [['Spaghetti Tomatensoße', 'Spaghetti al pomodoro', 'Nudeln Tomatensoße'], ['pomodoro', 'tomatensoße', 'tomatensauce', 'tomato+sauce+pasta', 'spaghetti+tomat'], ['Spaghetti Tomatensauce', 'Spaghetti al pomodoro'], ['pomodoro', 'tomatensoße', 'tomatensauce', 'spaghetti+tomat']],
    'gemuese-nudelauflauf': [['Nudelauflauf Gemüse', 'Nudelauflauf'], ['nudelauflauf', 'pasta+bake', 'baked+pasta'], ['Nudelauflauf'], ['nudelauflauf', 'pasta bake', 'baked pasta']],
    'kichererbsen-curry': [['Kichererbsen Curry', 'chickpea curry', 'Chana Masala'], ['kichererbsen+curry', 'chickpea+curry', 'chana', 'channa'], ['Chana Masala', 'Kichererbsen'], ['chana masala', 'channa', 'chickpea']],
    'rote-linsen-eintopf': [['Rote Linsen Suppe', 'red lentil soup', 'Rote Linsensuppe'], ['rote+linsen', 'red+lentil'], ['Linsensuppe', 'lentil soup'], ['linsensuppe', 'lentil soup', 'linseneintopf']],
    'bohnen-mais-reispfanne': [['Reis Bohnen Mais Pfanne', 'rice and beans'], ['reis+bohnen', 'rice+beans', 'reispfanne'], ['Reis mit Bohnen', 'rice and beans'], ['reis+bohnen', 'rice+beans']],
    'bohnen-wraps': [['Bohnen Wrap', 'bean burrito', 'Burrito'], ['bohnen+wrap', 'bean+burrito', 'burrito'], ['Burrito', 'Wrap'], ['burrito', 'wrap']],
    'eier-tomatensosse': [['Shakshuka', 'Eier in Tomatensoße'], ['shakshuka', 'eier+tomatensoße', 'eggs+tomato'], ['Shakshuka'], ['shakshuka']],
    'kartoffel-spinat-omelett': [['Kartoffelomelett Spinat', 'Tortilla de patatas', 'Kartoffel Omelett'], ['omelett+kartoffel', 'tortilla+patata', 'tortilla de patatas', 'kartoffelomelett', 'potato+omelet', 'potato+omelette'], ['Spanische Tortilla', 'Tortilla de patatas'], ['tortilla de patatas', 'spanische tortilla', 'tortilla espa']],
    'spinat-kartoffel-auflauf': [['Spinat Kartoffel Auflauf', 'Kartoffelauflauf Spinat'], ['spinat+kartoffel', 'spinach+potato'], ['Kartoffelauflauf', 'Kartoffelgratin'], ['kartoffelauflauf', 'kartoffelgratin', 'gratin']],
    'kartoffelpuffer-apfelmus': [['Kartoffelpuffer Apfelmus', 'Reibekuchen', 'Kartoffelpuffer'], ['kartoffelpuffer', 'reibekuchen', 'kartoffelpfannkuchen'], ['Kartoffelpuffer', 'Reibekuchen'], ['kartoffelpuffer', 'reibekuchen']],
    'bratkartoffeln-gemuese-ei': [['Bratkartoffeln Spiegelei', 'Bratkartoffeln Gemüse'], ['bratkartoffel'], ['Bratkartoffeln'], ['bratkartoffel']],
    'suesskartoffel-kichererbsen': [['Süßkartoffel Kichererbsen', 'sweet potato chickpea'], ['süßkartoffel+kichererbsen', 'sweet+potato+chickpea', 'süsskartoffel+kichererbsen'], ['Süßkartoffel Ofengemüse', 'roasted sweet potato'], ['süßkartoffel', 'sweet potato', 'süsskartoffel']],
    'gefuellte-paprika-vegi': [['Gefüllte Paprika Reis', 'stuffed peppers rice'], ['gefüllte paprika', 'stuffed+pepper', 'paprika+gefüllt'], ['Gefüllte Paprika'], ['gefüllte paprika', 'stuffed pepper', 'paprika+gefüllt']],
    'zucchini-frittata': [['Frittata', 'Zucchini Frittata'], ['frittata'], ['Frittata'], ['frittata']],
    'couscous-gemuesepfanne': [['Couscous Gemüse', 'Couscous Gemüsepfanne', 'vegetable couscous'], ['couscous+gemüse', 'couscous+vegetable', 'couscous+kichererbsen'], ['Couscous', 'Couscous Salat'], ['couscous']],
    'tomatensuppe-nudeln': [['Tomatensuppe', 'Tomatensuppe Nudeln', 'tomato soup'], ['tomatensuppe', 'tomato+soup'], ['Tomatensuppe'], ['tomatensuppe', 'tomato soup']],
    'kuerbissuppe': [['Kürbissuppe', 'pumpkin soup', 'Hokkaido Suppe'], ['kürbissuppe', 'pumpkin+soup', 'hokkaido+suppe', 'butternut+soup'], ['Kürbissuppe', 'pumpkin soup'], ['kürbissuppe', 'pumpkin soup']],
    'kuerbis-kartoffel-auflauf': [['Kürbis Kartoffel Auflauf', 'Kürbisgratin'], ['kürbis+kartoffel', 'kürbisauflauf', 'kürbisgratin', 'pumpkin+gratin'], ['Kürbisgratin', 'Kürbis Ofengericht'], ['kürbisgratin', 'kürbisauflauf', 'pumpkin gratin']],
    'eierreis-gemuese': [['Gebratener Reis Ei', 'egg fried rice', 'Eierreis'], ['eierreis', 'egg+fried+rice', 'gebratener reis', 'fried rice'], ['Egg fried rice', 'Gebratener Reis'], ['egg fried rice', 'gebratener reis', 'fried rice']],
    'weisse-bohnen-eintopf': [['Weiße Bohnen Eintopf', 'white bean stew', 'Weißer Bohneneintopf'], ['bohneneintopf', 'white+bean+stew', 'weiße+bohnen', 'bohnensuppe', 'bean+stew'], ['Bohneneintopf', 'Bohnensuppe'], ['bohneneintopf', 'bohnensuppe', 'bean stew', 'bean soup']],
    'gemuese-pfannkuchen': [['Herzhafte Pfannkuchen Gemüse', 'Pfannkuchen gefüllt', 'savoury crêpe'], ['pfannkuchen+gemüse', 'crêpe+gemüse', 'crepe+gemüse', 'herzhafte pfannkuchen', 'galette'], ['Pfannkuchen', 'Crêpe herzhaft'], ['pfannkuchen', 'crêpe', 'crepe']],
    'pellkartoffeln-ei-quark': [['Pellkartoffeln Quark', 'Pellkartoffeln Kräuterquark'], ['pellkartoffel', 'quark+kartoffel', 'kartoffeln+quark'], ['Pellkartoffeln'], ['pellkartoffel']],
    'reis-gemuese-auflauf': [['Reisauflauf Gemüse', 'Reis Gemüse Auflauf'], ['reisauflauf', 'reis+gemüse+auflauf', 'rice+casserole'], ['Reisauflauf', 'rice casserole'], ['reisauflauf', 'rice casserole']],
    'gyros-reispfanne': [['Gyros Reis', 'Gyrospfanne', 'Gyros'], ['gyros'], ['Gyros'], ['gyros']],
    'griechisches-haehnchen-ofen': [['Griechisches Hähnchen Kartoffeln', 'Greek roasted chicken potatoes', 'Hähnchen Ofen Kartoffeln griechisch'], ['griechisch+hähnchen', 'greek+chicken', 'kotopoulo', 'greek+roast'], ['Hähnchenschenkel Ofen', 'roast chicken potatoes'], ['hähnchen+kartoffel', 'chicken+potato', 'roast chicken']],
    'koefte-reis-tomatensosse': [['Köfte', 'Kofta', 'Köfte Reis'], ['köfte', 'kofte', 'kofta', 'kefta'], ['Köfte', 'Kofta'], ['köfte', 'kofte', 'kofta']],
    'menemen-fladen': [['Menemen', 'Menemen türkisches Rührei'], ['menemen'], ['Menemen'], ['menemen']],
    'haehnchen-quesadillas': [['Quesadilla', 'Hähnchen Quesadilla', 'chicken quesadilla'], ['quesadilla'], ['Quesadilla'], ['quesadilla']],
    'burrito-bowl': [['Burrito Bowl', 'Burrito bowl rice beans'], ['burrito+bowl', 'burrito bowl'], ['Burrito Bowl'], ['burrito bowl']],
    'teriyaki-haehnchen-reis': [['Teriyaki Hähnchen', 'chicken teriyaki rice', 'Chicken teriyaki'], ['teriyaki'], ['Chicken teriyaki'], ['teriyaki']],
    'gebratene-nudeln-gemuese': [['Gebratene Nudeln Gemüse', 'vegetable chow mein', 'Chow Mein', 'Bami Goreng'], ['gebratene nudeln', 'chow mein', 'stir+fried+noodle', 'stir+fry+noodle', 'bami goreng', 'lo mein'], ['Gebratene Nudeln', 'Chow mein'], ['gebratene nudeln', 'chow mein', 'stir fried noodle', 'lo mein']],
    'suess-saure-schweinepfanne': [['Süßsaures Schweinefleisch', 'sweet and sour pork', 'Süß-sauer Schweinefleisch'], ['süß-sauer', 'süßsauer', 'sweet+sour', 'sweet+and+sour'], ['Süßsauer Pfanne', 'Sweet and sour pork'], ['süßsauer', 'süß-sauer', 'sweet and sour']],
    'haehnchen-tikka-masala': [['Chicken Tikka Masala', 'Hähnchen Tikka Masala'], ['tikka masala', 'tikka+masala'], ['Chicken Tikka Masala'], ['tikka masala']],
    'rotes-linsen-dal': [['Dal Linsen Reis', 'Dal', 'Linsen Dal', 'Dhal'], ['dhal', 'dal makhani', 'tarka dal', 'linsen+dal', 'masoor dal', 'lentil+dal'], ['Dal', 'Dhal'], ['dhal', 'dal makhani', 'tarka dal', 'lentil dal', 'masoor']],
    'ofen-nuggets-kartoffelspalten': [['Chicken Nuggets Kartoffelspalten', 'Chicken Nuggets', 'Hähnchen Nuggets'], ['nugget'], ['Chicken Nuggets'], ['nugget']],
    'kartoffelgratin-salat': [['Kartoffelgratin', 'Gratin dauphinois'], ['kartoffelgratin', 'gratin dauphinois', 'potato gratin', 'dauphinois'], ['Kartoffelgratin', 'Gratin dauphinois'], ['kartoffelgratin', 'gratin dauphinois', 'potato gratin']],
    'ratatouille-couscous': [['Ratatouille', 'Ratatouille Couscous'], ['ratatouille'], ['Ratatouille'], ['ratatouille']]
  };
  D.IMG_HINTS = {};
  for (const [id, h] of Object.entries(H)) D.IMG_HINTS[id] = { q: h[0], k: h[1], g: h[2], gk: h[3] };
})(typeof globalThis !== 'undefined' ? globalThis : self);
