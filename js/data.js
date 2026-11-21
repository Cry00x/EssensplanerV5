/* Grunddatenbank: Zutatenkatalog (Preise = Schätzwerte, Aldi-Süd-Richtwerte) und Rezepte.
 * Alle Mengen in den Rezepten gelten für 4 Personen.
 * Einheiten: g, ml, Stk, TL, EL. Preise: Packungspreis in Euro für Packungsgröße `pack`.
 * Nährwerte je 100 g bzw. 100 ml (kcal, Eiweiß, Kohlenhydrate, Fett). */
(function (g) {
  'use strict';
  const F = 'Fleisch', M = 'Milchprodukte', G = 'Obst und Gemüse', T = 'Trockenprodukte', K = 'Konserven', S = 'Sonstiges';
  const ING = {};
  function ing(id, n, cat, u, pack, price, nut, o) {
    ING[id] = Object.assign({ id, n, cat, u, pack, price, kcal: nut[0], p: nut[1], c: nut[2], f: nut[3] }, o || {});
  }

  // Fleisch
  ing('haehnchenbrust', 'Hähnchenbrustfilet', F, 'g', 500, 4.99, [110, 23, 0, 1.5]);
  ing('haehnchenkeule', 'Hähnchen-Unterkeulen', F, 'g', 1000, 3.99, [165, 19, 0, 10]);
  ing('hack', 'Hackfleisch (gemischt)', F, 'g', 500, 3.99, [250, 17, 0, 20]);
  ing('schwein', 'Schweineschnitzel', F, 'g', 500, 4.19, [110, 22, 0, 2.5]);
  ing('rind', 'Rindergeschnetzeltes', F, 'g', 500, 6.49, [120, 21, 0, 4]);
  ing('speck', 'Speckwürfel', F, 'g', 200, 1.69, [350, 14, 0, 33]);

  // Milchprodukte & Eier (ausschließlich laktosefreie Varianten)
  ing('eier', 'Eier', M, 'Stk', 10, 2.89, [140, 12.5, 1, 10], { g: 60, whole: true });
  ing('milch', 'Laktosefreie Milch', M, 'ml', 1000, 1.15, [47, 3.4, 4.8, 1.6], { dairy: true });
  ing('sahne', 'Laktosefreie Sahne', M, 'ml', 200, 1.19, [290, 2.4, 3.3, 30], { dairy: true });
  ing('joghurt', 'Laktosefreier Joghurt natur', M, 'g', 500, 1.15, [66, 3.8, 4.5, 3.5], { dairy: true });
  ing('kaese', 'Laktosefreier Käse (gerieben)', M, 'g', 200, 1.99, [350, 25, 0, 28], { dairy: true });
  ing('mozzarella', 'Laktosefreier Mozzarella', M, 'g', 125, 1.25, [240, 18, 1, 18], { dairy: true });
  ing('frischkaese', 'Laktosefreier Frischkäse', M, 'g', 200, 1.35, [250, 6, 3, 24], { dairy: true });
  ing('quark', 'Laktosefreier Quark', M, 'g', 500, 1.39, [70, 12, 4, 0.3], { dairy: true });

  // Obst und Gemüse
  ing('kartoffeln', 'Kartoffeln (festkochend)', G, 'g', 2000, 2.69, [70, 2, 15, 0.1]);
  ing('suesskartoffel', 'Süßkartoffeln', G, 'g', 500, 1.29, [85, 1.5, 18, 0.3]);
  ing('zwiebeln', 'Zwiebeln', G, 'g', 1000, 1.29, [40, 1.1, 8, 0.2]);
  ing('knoblauch', 'Knoblauchzehen', G, 'Stk', 30, 0.79, [140, 6, 28, 0.1], { g: 4 });
  ing('paprika', 'Paprika (bunt)', G, 'Stk', 3, 1.99, [35, 1, 6, 0.4], { g: 180 });
  ing('moehren', 'Möhren', G, 'g', 1000, 1.19, [35, 0.9, 7, 0.2]);
  ing('gurke', 'Salatgurke', G, 'Stk', 1, 0.79, [13, 0.6, 2, 0.2], { g: 400 });
  ing('tomaten', 'Tomaten', G, 'g', 500, 1.49, [18, 0.9, 2.6, 0.2]);
  ing('zucchini', 'Zucchini', G, 'g', 500, 1.19, [20, 1.6, 2, 0.4]);
  ing('lauchzwiebeln', 'Lauchzwiebeln (Bund)', G, 'Stk', 1, 0.79, [28, 1.8, 3, 0.3], { g: 80 });
  ing('kuerbis', 'Hokkaido-Kürbis', G, 'g', 1000, 2.19, [35, 1.5, 6, 0.2]);
  ing('salat', 'Eisbergsalat', G, 'Stk', 1, 0.99, [14, 0.9, 2, 0.2], { g: 400 });

  // Trockenprodukte
  ing('reis', 'Langkornreis', T, 'g', 1000, 1.89, [350, 7, 78, 0.6]);
  ing('nudeln', 'Nudeln (Penne/Spirelli)', T, 'g', 500, 0.85, [355, 12.5, 72, 1.5]);
  ing('lasagne', 'Lasagneplatten', T, 'g', 250, 0.95, [355, 12.5, 72, 1.5]);
  ing('couscous', 'Couscous', T, 'g', 500, 1.29, [355, 12, 72, 1.5]);
  ing('rotelinsen', 'Rote Linsen', T, 'g', 500, 1.79, [340, 26, 51, 1.5]);
  ing('paniermehl', 'Paniermehl', T, 'g', 400, 0.65, [350, 12, 72, 1.5]);
  ing('hefe', 'Trockenhefe (Beutel)', T, 'Stk', 3, 0.55, [330, 40, 30, 6], { g: 7 });

  // Konserven
  ing('mais', 'Mais (Dose)', K, 'g', 285, 0.69, [90, 3, 16, 1.3]);
  ing('kidney', 'Kidneybohnen (Dose)', K, 'g', 240, 0.69, [105, 7, 14, 0.5]);
  ing('kichererbsen', 'Kichererbsen (Dose)', K, 'g', 240, 0.75, [125, 7, 15, 2.7]);
  ing('weissebohnen', 'Weiße Bohnen (Dose)', K, 'g', 240, 0.69, [95, 6.5, 12, 0.6]);
  ing('gehackte', 'Gehackte Tomaten (Dose)', K, 'g', 400, 0.59, [25, 1.3, 4, 0.2]);
  ing('passierte', 'Passierte Tomaten', K, 'g', 500, 0.69, [30, 1.5, 5, 0.2]);
  ing('tomatenmark', 'Tomatenmark', K, 'g', 200, 0.89, [90, 4.5, 15, 0.5]);
  ing('kokosmilch', 'Kokosmilch', K, 'ml', 400, 1.35, [180, 1.5, 3, 18]);
  ing('apfelmus', 'Apfelmus', K, 'g', 720, 1.19, [65, 0.3, 15, 0.1]);

  // Sonstiges
  ing('wraps', 'Weizentortillas (Wraps)', S, 'Stk', 8, 1.49, [300, 8, 50, 7], { g: 50 });
  ing('spinat', 'Blattspinat (TK)', S, 'g', 450, 1.19, [25, 2.9, 0.8, 0.4]);
  ing('erbsen', 'Erbsen (TK)', S, 'g', 450, 1.29, [70, 5.5, 10, 0.5]);
  ing('sojasauce', 'Sojasauce', S, 'ml', 150, 0.99, [70, 6, 8, 0]);

  // Grundzutaten / Vorrat (standardmäßig vorhanden)
  ing('oel', 'Öl (Raps-/Sonnenblumenöl)', S, 'ml', 1000, 2.19, [830, 0, 0, 92], { pantry: true });
  ing('salz', 'Salz', S, 'TL', 200, 0.35, [0, 0, 0, 0], { pantry: true });
  ing('pfeffer', 'Pfeffer', S, 'TL', 60, 1.19, [0, 0, 0, 0], { pantry: true });
  ing('paprikapulver', 'Paprikapulver (edelsüß)', S, 'TL', 50, 1.29, [0, 0, 0, 0], { pantry: true });
  ing('kraeuter', 'Italienische Kräuter', S, 'TL', 40, 1.19, [0, 0, 0, 0], { pantry: true });
  ing('curry', 'Currypulver (mild)', S, 'TL', 50, 1.29, [0, 0, 0, 0], { pantry: true });
  ing('kreuzkuemmel', 'Kreuzkümmel', S, 'TL', 50, 1.29, [0, 0, 0, 0], { pantry: true });
  ing('zucker', 'Zucker', S, 'g', 1000, 1.29, [400, 0, 100, 0], { pantry: true });
  ing('bruehe', 'Gemüsebrühe (Pulver)', S, 'TL', 100, 1.49, [0, 0, 0, 0], { pantry: true });
  ing('mehl', 'Weizenmehl', S, 'g', 1000, 0.99, [340, 10, 70, 1], { pantry: true });

  const RECIPES = [];
  /* R(id, Name, Emoji, {veg,time,diff,main,carb,spicyVariant}, [[zutat, menge4pers]...], [schritte]) */
  function R(id, name, emoji, o, ings, steps) {
    RECIPES.push(Object.assign({ id, name, emoji, veg: false, diff: 'leicht', carb: 'keine' }, o, { ings, steps }));
  }
  const CHILI = 'Leicht scharfe Variante: zusätzlich eine Prise Chiliflocken mitbraten.';

  // ───────────── Fleischgerichte ─────────────
  R('haehnchen-reispfanne', 'Hähnchen-Reispfanne mit Paprika und Mais', '🍗🍚', { time: 35, main: 'haehnchen', carb: 'reis', spicyVariant: CHILI },
    [['haehnchenbrust', 500], ['reis', 300], ['paprika', 2], ['zwiebeln', 150], ['moehren', 200], ['mais', 140], ['oel', 30], ['bruehe', 2], ['paprikapulver', 1], ['sojasauce', 30], ['salz', 1], ['pfeffer', 1]],
    ['Reis nach Packungsangabe in Salzwasser garen.', 'Hähnchenbrust in Würfel schneiden und mit Salz, Pfeffer und Paprikapulver würzen. Im heißen Öl 5 Minuten anbraten, dann herausnehmen.', 'Zwiebeln würfeln, Möhren in dünne Scheiben und Paprika in Streifen schneiden. Alles in derselben Pfanne 8 Minuten braten.', 'Mais, Brühe (in 150 ml Wasser gelöst) und Sojasauce zugeben, kurz einköcheln lassen.', 'Hähnchen und Reis unterheben, 2 Minuten durchziehen lassen und servieren.']);

  R('haehnchen-rahmgeschnetzeltes', 'Hähnchen-Paprika-Rahmgeschnetzeltes mit Nudeln', '🍗🍝', { time: 30, main: 'haehnchen', carb: 'nudel' },
    [['haehnchenbrust', 500], ['nudeln', 350], ['paprika', 2], ['zwiebeln', 100], ['sahne', 200], ['tomatenmark', 30], ['oel', 20], ['paprikapulver', 2], ['bruehe', 1], ['salz', 1], ['pfeffer', 1]],
    ['Nudeln in Salzwasser bissfest kochen.', 'Hähnchen in Streifen schneiden, würzen und im Öl goldbraun anbraten.', 'Zwiebeln und Paprika zugeben und 5 Minuten mitbraten. Tomatenmark einrühren.', 'Mit laktosefreier Sahne und 100 ml Wasser mit Brühe ablöschen, 8 Minuten sanft köcheln.', 'Nudeln abgießen und mit der Soße servieren.']);

  R('haehnchenkeulen-ofen', 'Hähnchenkeulen mit Ofenkartoffeln und Möhren', '🍗🥔', { time: 45, main: 'haehnchen', carb: 'kartoffel' },
    [['haehnchenkeule', 1000], ['kartoffeln', 800], ['moehren', 400], ['zwiebeln', 150], ['oel', 40], ['paprikapulver', 2], ['kraeuter', 1], ['salz', 2], ['pfeffer', 1]],
    ['Backofen auf 200 °C (Ober-/Unterhitze) vorheizen.', 'Kartoffeln in Spalten, Möhren in Stücke und Zwiebeln in Spalten schneiden. Mit der Hälfte des Öls und den Gewürzen mischen.', 'Keulen mit restlichem Öl, Paprikapulver, Salz und Pfeffer einreiben und mit dem Gemüse auf ein tiefes Blech legen.', 'Etwa 40 Minuten backen, nach der Hälfte der Zeit wenden, bis die Keulen goldbraun sind und gar (Saft klar).']);

  R('haehnchen-wraps', 'Hähnchen-Wraps mit Mais und Gurke', '🌯🍗', { time: 25, main: 'haehnchen', carb: 'brot' },
    [['haehnchenbrust', 400], ['wraps', 8], ['gurke', 1], ['tomaten', 250], ['salat', 0.5], ['mais', 140], ['joghurt', 150], ['oel', 20], ['paprikapulver', 1], ['salz', 1], ['pfeffer', 1]],
    ['Hähnchen in Streifen schneiden, mit Paprikapulver, Salz und Pfeffer würzen und im Öl 6–8 Minuten braten.', 'Gurke und Tomaten würfeln, Salat in Streifen schneiden, Mais abtropfen lassen.', 'Joghurt mit etwas Salz glattrühren und die Wraps kurz in der Pfanne oder im Ofen erwärmen.', 'Wraps mit Joghurt bestreichen, mit Hähnchen und Gemüse füllen und einrollen.']);

  R('haehnchen-curry', 'Mildes Hähnchen-Curry mit Reis', '🍛🍗', { time: 35, main: 'haehnchen', carb: 'reis', spicyVariant: CHILI },
    [['haehnchenbrust', 500], ['reis', 280], ['kokosmilch', 400], ['zwiebeln', 150], ['paprika', 1], ['moehren', 200], ['erbsen', 150], ['curry', 2], ['oel', 20], ['bruehe', 1], ['salz', 1], ['pfeffer', 1]],
    ['Reis in Salzwasser garen.', 'Hähnchen würfeln und im Öl anbraten. Zwiebeln, Möhrenscheiben und Paprikastreifen zugeben.', 'Currypulver kurz mitrösten, mit Kokosmilch und 100 ml Wasser mit Brühe ablöschen.', '12 Minuten köcheln lassen, Erbsen zugeben, 3 Minuten ziehen lassen und mit Salz und Pfeffer abschmecken. Mit Reis servieren.']);

  R('haehnchen-nudelauflauf', 'Hähnchen-Nudelauflauf mit Tomaten und Käse', '🍝🧀', { time: 45, main: 'haehnchen', carb: 'nudel' },
    [['haehnchenbrust', 400], ['nudeln', 300], ['passierte', 500], ['sahne', 100], ['mozzarella', 125], ['kaese', 100], ['zwiebeln', 100], ['paprika', 1], ['oel', 20], ['kraeuter', 2], ['salz', 1], ['pfeffer', 1]],
    ['Backofen auf 200 °C vorheizen. Nudeln 3 Minuten kürzer als angegeben kochen.', 'Hähnchenwürfel mit Zwiebeln und Paprika im Öl anbraten, mit passierten Tomaten, laktosefreier Sahne, Kräutern, Salz und Pfeffer 5 Minuten köcheln.', 'Nudeln mit der Soße mischen und in eine Auflaufform geben.', 'Mit laktosefreiem Mozzarella (in Scheiben) und laktosefreiem Reibekäse belegen und 20 Minuten überbacken.']);

  R('haehnchen-kartoffelpfanne', 'Hähnchen-Kartoffelpfanne mit Paprika', '🥔🍗', { time: 35, main: 'haehnchen', carb: 'kartoffel' },
    [['haehnchenbrust', 450], ['kartoffeln', 800], ['paprika', 2], ['zwiebeln', 150], ['oel', 40], ['paprikapulver', 2], ['kraeuter', 1], ['salz', 2], ['pfeffer', 1]],
    ['Kartoffeln schälen, in Würfel schneiden und 8 Minuten in Salzwasser vorgaren, abgießen.', 'Hähnchen würfeln, würzen und im Öl 5 Minuten anbraten, herausnehmen.', 'Kartoffeln in der Pfanne 10 Minuten goldbraun braten, Zwiebeln und Paprika zugeben und 5 Minuten mitbraten.', 'Hähnchen zurück in die Pfanne geben, mit Kräutern abschmecken und servieren.']);

  R('haehnchen-couscous-bowl', 'Hähnchen-Couscous-Bowl mit Tzatziki', '🥙🍗', { time: 30, main: 'haehnchen', carb: 'couscous' },
    [['haehnchenbrust', 450], ['couscous', 250], ['gurke', 1], ['tomaten', 250], ['paprika', 1], ['joghurt', 250], ['knoblauch', 2], ['oel', 25], ['kreuzkuemmel', 1], ['paprikapulver', 1], ['bruehe', 1], ['salz', 1], ['pfeffer', 1]],
    ['Couscous mit 300 ml heißem Wasser mit Brühe übergießen und 5 Minuten quellen lassen.', 'Hähnchenstreifen mit Kreuzkümmel, Paprikapulver, Salz und Pfeffer würzen und im Öl 8 Minuten braten.', 'Für das Tzatziki die halbe Gurke raspeln, mit Joghurt und gepresstem Knoblauch verrühren und salzen.', 'Restliche Gurke, Tomaten und Paprika würfeln. Alles in Schalen anrichten.']);

  R('hackbaellchen-pueree', 'Hackbällchen in Tomatensoße mit Kartoffelpüree', '🍝🥔', { time: 40, main: 'hack', carb: 'kartoffel' },
    [['hack', 500], ['zwiebeln', 100], ['eier', 1], ['paniermehl', 40], ['passierte', 500], ['kartoffeln', 900], ['milch', 100], ['oel', 20], ['kraeuter', 2], ['salz', 2], ['pfeffer', 1], ['paprikapulver', 1]],
    ['Kartoffeln schälen, würfeln und in Salzwasser 15–18 Minuten kochen.', 'Hack mit fein gewürfelter Zwiebel, Ei, Paniermehl, Salz, Pfeffer und Paprikapulver verkneten und kleine Bällchen formen.', 'Bällchen im Öl rundherum anbraten, passierte Tomaten und Kräuter zugeben und 12 Minuten sanft garen.', 'Kartoffeln abgießen, mit erwärmter laktosefreier Milch und etwas Salz zu Püree stampfen. Alles zusammen servieren.']);

  R('bolognese', 'Spaghetti Bolognese mit Möhren', '🍝', { time: 35, main: 'hack', carb: 'nudel', spicyVariant: CHILI },
    [['hack', 500], ['nudeln', 400], ['gehackte', 400], ['moehren', 200], ['zwiebeln', 150], ['knoblauch', 2], ['tomatenmark', 40], ['oel', 20], ['kraeuter', 2], ['zucker', 5], ['salz', 1], ['pfeffer', 1]],
    ['Zwiebeln, Knoblauch und Möhren sehr fein würfeln. Nudeln in Salzwasser kochen.', 'Hack im Öl krümelig anbraten, Gemüse zugeben und 5 Minuten mitbraten.', 'Tomatenmark einrühren, gehackte Tomaten, Kräuter, Zucker, Salz und Pfeffer zugeben.', 'Soße 15 Minuten köcheln lassen und mit den Nudeln servieren.']);

  R('hackbaellchen-paprikasosse', 'Hackbällchen mit Paprikasoße und Reis', '🍚🥘', { time: 40, main: 'hack', carb: 'reis' },
    [['hack', 500], ['reis', 280], ['paprika', 2], ['zwiebeln', 150], ['eier', 1], ['paniermehl', 40], ['passierte', 250], ['sahne', 100], ['oel', 30], ['paprikapulver', 2], ['salz', 2], ['pfeffer', 1]],
    ['Reis in Salzwasser garen.', 'Hack mit halber Zwiebel, Ei, Paniermehl, Salz, Pfeffer verkneten und zu Bällchen formen. Im Öl rundherum braun braten und herausnehmen.', 'Restliche Zwiebel und Paprika würfeln, im Bratfett anschwitzen, Paprikapulver zugeben.', 'Passierte Tomaten und laktosefreie Sahne einrühren, Bällchen 10 Minuten in der Soße ziehen lassen. Mit Reis servieren.']);

  R('hack-reispfanne', 'Hack-Reispfanne mit Paprika und Mais', '🍚🥘', { time: 30, main: 'hack', carb: 'reis' },
    [['hack', 400], ['reis', 280], ['paprika', 2], ['mais', 140], ['zwiebeln', 100], ['tomatenmark', 30], ['bruehe', 2], ['oel', 20], ['paprikapulver', 2], ['salz', 1], ['pfeffer', 1]],
    ['Reis in Salzwasser garen.', 'Hack im Öl krümelig braun braten, Zwiebel und Paprika in Würfeln zugeben und 5 Minuten braten.', 'Tomatenmark und Paprikapulver einrühren, Mais und 200 ml Brühe zugeben und 5 Minuten köcheln.', 'Reis unterheben, mit Salz und Pfeffer abschmecken.']);

  R('hack-lasagne', 'Hack-Lasagne mit laktosefreier Béchamel', '🍝🧀', { time: 45, diff: 'mittel', main: 'hack', carb: 'nudel' },
    [['hack', 400], ['lasagne', 250], ['passierte', 500], ['zwiebeln', 100], ['moehren', 150], ['milch', 500], ['mehl', 40], ['oel', 40], ['kaese', 150], ['mozzarella', 125], ['kraeuter', 2], ['salz', 2], ['pfeffer', 1]],
    ['Backofen auf 200 °C vorheizen. Hack mit Zwiebel und geraspelten Möhren anbraten, passierte Tomaten und Kräuter zugeben, 10 Minuten köcheln.', 'Béchamel: 20 ml Öl erhitzen, Mehl einrühren, nach und nach laktosefreie Milch zugeben und unter Rühren 5 Minuten köcheln. Mit Salz und Pfeffer würzen.', 'Form abwechselnd mit Hacksoße, Lasagneplatten und Béchamel schichten.', 'Mit laktosefreiem Käse und Mozzarella bestreuen und 25 Minuten backen.']);

  R('kartoffel-hack-auflauf', 'Kartoffel-Hack-Auflauf mit Käse', '🥔🧀', { time: 45, main: 'hack', carb: 'kartoffel' },
    [['hack', 400], ['kartoffeln', 900], ['zwiebeln', 100], ['paprika', 1], ['sahne', 200], ['kaese', 120], ['oel', 20], ['paprikapulver', 1], ['kraeuter', 1], ['salz', 2], ['pfeffer', 1]],
    ['Backofen auf 200 °C vorheizen. Kartoffeln in dünne Scheiben hobeln und 5 Minuten in Salzwasser vorgaren.', 'Hack mit Zwiebel und Paprika im Öl anbraten und würzen.', 'Kartoffeln und Hack schichtweise in eine Form geben, laktosefreie Sahne darübergießen.', 'Mit laktosefreiem Käse bestreuen und 25 Minuten goldbraun backen.']);

  R('gefuellte-paprika-hack', 'Gefüllte Paprika mit Hack und Reis', '🫑🍚', { time: 45, diff: 'mittel', main: 'hack', carb: 'reis' },
    [['paprika', 4], ['hack', 350], ['reis', 150], ['zwiebeln', 100], ['passierte', 400], ['kaese', 80], ['oel', 20], ['paprikapulver', 1], ['kraeuter', 1], ['salz', 1], ['pfeffer', 1]],
    ['Backofen auf 190 °C vorheizen. Reis halb gar kochen (ca. 8 Minuten).', 'Deckel der Paprika abschneiden und entkernen. Hack mit Zwiebel anbraten, mit Reis, Salz, Pfeffer, Paprikapulver und Kräutern mischen.', 'Paprika füllen, in eine Form stellen, passierte Tomaten rundherum gießen.', 'Mit laktosefreiem Käse bestreuen und 30 Minuten garen.']);

  R('hack-wraps-bohnen', 'Hack-Wraps mit Bohnen und Mais', '🌯🫘', { time: 25, main: 'hack', carb: 'brot', spicyVariant: CHILI },
    [['hack', 350], ['wraps', 8], ['kidney', 240], ['mais', 140], ['paprika', 1], ['tomaten', 250], ['salat', 0.5], ['joghurt', 150], ['oel', 15], ['paprikapulver', 2], ['kreuzkuemmel', 1], ['salz', 1], ['pfeffer', 1]],
    ['Hack im Öl krümelig braten, mit Paprikapulver, Kreuzkümmel, Salz und Pfeffer würzen.', 'Bohnen und Mais abtropfen lassen und 3 Minuten mitbraten.', 'Paprika und Tomaten würfeln, Salat schneiden. Wraps erwärmen.', 'Wraps mit Joghurt bestreichen, Hackmischung und Gemüse einfüllen und einrollen.']);

  R('chili-mild', 'Mildes Chili con Carne mit Reis', '🍲🍚', { time: 40, main: 'hack', carb: 'reis', spicyVariant: CHILI },
    [['hack', 400], ['reis', 250], ['kidney', 240], ['mais', 140], ['gehackte', 400], ['paprika', 1], ['zwiebeln', 150], ['tomatenmark', 30], ['oel', 20], ['paprikapulver', 2], ['kreuzkuemmel', 1], ['salz', 1], ['pfeffer', 1]],
    ['Reis in Salzwasser garen.', 'Hack mit Zwiebeln im Öl anbraten, Tomatenmark und Gewürze einrühren.', 'Gehackte Tomaten, Paprikawürfel, Bohnen und Mais zugeben.', '20 Minuten bei mittlerer Hitze köcheln, abschmecken und mit Reis servieren.']);

  R('schnitzel-ofenkartoffeln', 'Schweineschnitzel mit Ofenkartoffeln und Gurkensalat', '🥩🥔', { time: 45, diff: 'mittel', main: 'schwein', carb: 'kartoffel' },
    [['schwein', 500], ['kartoffeln', 800], ['gurke', 1], ['eier', 2], ['mehl', 50], ['paniermehl', 80], ['joghurt', 100], ['oel', 70], ['paprikapulver', 1], ['salz', 3], ['pfeffer', 1], ['kraeuter', 1]],
    ['Backofen auf 200 °C vorheizen. Kartoffelspalten mit 30 ml Öl, Salz und Kräutern mischen und 35 Minuten backen.', 'Schnitzel flach klopfen, salzen und pfeffern. Nacheinander in Mehl, verquirltem Ei und Paniermehl wenden.', 'Im restlichen Öl pro Seite 3–4 Minuten goldbraun braten.', 'Gurke hobeln, mit Joghurt, Salz und Pfeffer anmachen. Alles zusammen servieren.']);

  R('schweinegeschnetzeltes-reis', 'Schweinegeschnetzeltes in Sahnesoße mit Reis', '🥩🍚', { time: 30, main: 'schwein', carb: 'reis' },
    [['schwein', 500], ['reis', 280], ['paprika', 1], ['zwiebeln', 150], ['sahne', 200], ['oel', 25], ['paprikapulver', 2], ['bruehe', 1], ['salz', 1], ['pfeffer', 1]],
    ['Reis in Salzwasser garen.', 'Schnitzel in Streifen schneiden, würzen und im Öl portionsweise scharf anbraten.', 'Zwiebeln und Paprika zugeben, 4 Minuten braten, Paprikapulver einrühren.', 'Mit laktosefreier Sahne und 100 ml Wasser mit Brühe ablöschen, 6 Minuten köcheln. Mit Reis servieren.']);

  R('schweinestreifen-gemuesepfanne', 'Schweinestreifen-Gemüsepfanne mit Nudeln', '🥘🍝', { time: 30, main: 'schwein', carb: 'nudel' },
    [['schwein', 400], ['nudeln', 350], ['paprika', 2], ['moehren', 200], ['zucchini', 250], ['zwiebeln', 100], ['sojasauce', 40], ['oel', 30], ['paprikapulver', 1], ['salz', 1], ['pfeffer', 1]],
    ['Nudeln in Salzwasser bissfest kochen.', 'Fleisch in Streifen schneiden und im Öl 5 Minuten braten, herausnehmen.', 'Möhren in Stifte, Paprika, Zucchini und Zwiebeln in Streifen schneiden und 8 Minuten braten.', 'Fleisch, Sojasauce und Gewürze zugeben, Nudeln untermischen und servieren.']);

  R('schnitzel-pizzaiola', 'Überbackene Schnitzel mit Tomate und Mozzarella', '🥩🍅', { time: 40, diff: 'mittel', main: 'schwein', carb: 'kartoffel' },
    [['schwein', 500], ['tomaten', 250], ['mozzarella', 125], ['kartoffeln', 800], ['oel', 45], ['kraeuter', 2], ['salz', 2], ['pfeffer', 1]],
    ['Backofen auf 200 °C vorheizen. Kartoffelspalten mit 25 ml Öl und Salz mischen und 30 Minuten backen.', 'Schnitzel würzen und im restlichen Öl pro Seite 2 Minuten anbraten, in eine Form legen.', 'Tomatenscheiben und laktosefreien Mozzarella darauf verteilen, mit Kräutern bestreuen.', '12 Minuten im Ofen überbacken und mit den Kartoffelspalten servieren.']);

  R('rindergeschnetzeltes-pueree', 'Rindergeschnetzeltes mit Paprika und Kartoffelpüree', '🥩🥔', { time: 40, main: 'rind', carb: 'kartoffel' },
    [['rind', 500], ['kartoffeln', 900], ['paprika', 2], ['zwiebeln', 150], ['milch', 100], ['tomatenmark', 20], ['oel', 30], ['paprikapulver', 2], ['bruehe', 1], ['salz', 2], ['pfeffer', 1]],
    ['Kartoffeln schälen, würfeln und 15–18 Minuten in Salzwasser kochen.', 'Fleisch trocken tupfen, würzen und im heißen Öl portionsweise kurz anbraten.', 'Zwiebeln und Paprika zugeben, Tomatenmark einrühren, mit 150 ml Wasser mit Brühe ablöschen und 10 Minuten köcheln.', 'Kartoffeln mit warmer laktosefreier Milch und Salz zu Püree stampfen und zusammen anrichten.']);

  R('rind-gemuese-reis', 'Rindfleisch-Gemüse-Pfanne mit Reis', '🥘🍚', { time: 35, main: 'rind', carb: 'reis' },
    [['rind', 400], ['reis', 280], ['paprika', 1], ['moehren', 200], ['zucchini', 250], ['zwiebeln', 100], ['sojasauce', 40], ['oel', 30], ['salz', 1], ['pfeffer', 1]],
    ['Reis in Salzwasser garen.', 'Rindfleisch in dünne Streifen schneiden und im Öl 3 Minuten scharf anbraten, herausnehmen.', 'Möhrenstifte, Paprika-, Zucchini- und Zwiebelstreifen 8 Minuten braten.', 'Fleisch und Sojasauce zugeben, 2 Minuten schwenken, mit Salz und Pfeffer abschmecken. Mit Reis servieren.']);

  R('rind-kartoffel-eintopf', 'Schneller Rindfleisch-Kartoffel-Eintopf', '🍲🥩', { time: 45, main: 'rind', carb: 'kartoffel' },
    [['rind', 400], ['kartoffeln', 700], ['moehren', 300], ['zwiebeln', 150], ['gehackte', 400], ['tomatenmark', 20], ['oel', 20], ['bruehe', 2], ['paprikapulver', 2], ['kraeuter', 1], ['salz', 1], ['pfeffer', 1]],
    ['Fleisch in kleine Würfel schneiden und im Öl rundherum anbraten.', 'Zwiebeln zugeben, Tomatenmark und Paprikapulver einrühren.', 'Möhren- und Kartoffelwürfel zugeben, mit gehackten Tomaten und 500 ml Wasser mit Brühe auffüllen.', '25 Minuten köcheln, bis alles weich ist, und mit Kräutern, Salz und Pfeffer abschmecken.']);

  R('bratkartoffeln-speck-ei', 'Bratkartoffeln mit Speck und Spiegelei', '🥔🍳', { time: 35, main: 'kartoffel', carb: 'kartoffel' },
    [['kartoffeln', 1000], ['speck', 150], ['zwiebeln', 150], ['eier', 4], ['gurke', 1], ['oel', 40], ['kraeuter', 1], ['salz', 2], ['pfeffer', 1]],
    ['Kartoffeln waschen und 20 Minuten in der Schale kochen, abkühlen lassen, pellen und in Scheiben schneiden.', 'Speck im Öl auslassen, Kartoffeln zugeben und 12 Minuten knusprig braten.', 'Zwiebeln zugeben und 4 Minuten mitbraten, würzen.', 'Spiegeleier braten, Gurke in Scheiben schneiden und alles zusammen servieren.']);

  R('kartoffelsuppe-speck', 'Kartoffelsuppe mit Speck und Möhren', '🥣🥔', { time: 35, main: 'kartoffel', carb: 'kartoffel' },
    [['kartoffeln', 800], ['moehren', 250], ['zwiebeln', 100], ['speck', 100], ['sahne', 100], ['oel', 15], ['bruehe', 3], ['kraeuter', 1], ['salz', 1], ['pfeffer', 1]],
    ['Zwiebeln würfeln und im Öl glasig dünsten, Speck zugeben und ausbraten.', 'Kartoffel- und Möhrenwürfel zugeben, mit 1 Liter Wasser mit Brühe aufgießen.', '20 Minuten kochen, einen Teil der Suppe grob pürieren.', 'Laktosefreie Sahne einrühren und mit Salz, Pfeffer und Kräutern abschmecken.']);

  R('linseneintopf-speck', 'Linseneintopf mit Möhren und Speck', '🍲🥕', { time: 35, main: 'huelsen', carb: 'huelsen' },
    [['rotelinsen', 250], ['moehren', 300], ['kartoffeln', 400], ['zwiebeln', 100], ['speck', 80], ['gehackte', 400], ['oel', 15], ['bruehe', 2], ['kreuzkuemmel', 1], ['salz', 1], ['pfeffer', 1]],
    ['Speck und Zwiebeln im Öl anbraten.', 'Möhren- und Kartoffelwürfel, Linsen und gehackte Tomaten zugeben.', 'Mit 800 ml Wasser mit Brühe aufgießen und Kreuzkümmel zugeben.', '20 Minuten köcheln, bis die Linsen zerfallen, und abschmecken.']);

  R('frikadellen-kartoffeln', 'Frikadellen mit Kartoffeln und Gurkensalat', '🍔🥔', { time: 40, main: 'hack', carb: 'kartoffel' },
    [['hack', 500], ['kartoffeln', 900], ['gurke', 1], ['zwiebeln', 100], ['eier', 1], ['paniermehl', 50], ['joghurt', 100], ['oel', 30], ['paprikapulver', 1], ['salz', 3], ['pfeffer', 1]],
    ['Kartoffeln schälen und 20 Minuten in Salzwasser kochen.', 'Hack mit fein gewürfelter Zwiebel, Ei, Paniermehl, Salz, Pfeffer und Paprikapulver verkneten, zu flachen Frikadellen formen.', 'Im Öl pro Seite 5–6 Minuten braten.', 'Gurke hobeln und mit Joghurt, Salz und Pfeffer anmachen. Alles zusammen servieren.']);

  // ───────────── Vegetarische Gerichte ─────────────
  R('gemuese-wraps', 'Gemüse-Wraps mit Frischkäse', '🌯🥕', { veg: true, time: 20, main: 'gemuese', carb: 'brot' },
    [['wraps', 8], ['frischkaese', 200], ['paprika', 2], ['gurke', 1], ['moehren', 200], ['mais', 140], ['salat', 0.5], ['tomaten', 150], ['salz', 1], ['pfeffer', 1]],
    ['Paprika und Gurke in Streifen schneiden, Möhren raspeln, Tomaten würfeln, Salat in Streifen schneiden.', 'Wraps kurz in einer Pfanne erwärmen.', 'Mit laktosefreiem Frischkäse bestreichen, mit Salz und Pfeffer würzen.', 'Gemüse und Mais darauf verteilen, einrollen und halbieren.']);

  R('ofenkartoffeln-quark', 'Ofenkartoffeln mit Kräuterquark', '🥔🥒', { veg: true, time: 45, main: 'kartoffel', carb: 'kartoffel' },
    [['kartoffeln', 1000], ['quark', 500], ['gurke', 1], ['lauchzwiebeln', 1], ['oel', 20], ['kraeuter', 2], ['paprikapulver', 1], ['salz', 2], ['pfeffer', 1]],
    ['Backofen auf 200 °C vorheizen. Kartoffeln waschen, längs halbieren, mit Öl, Paprikapulver und Salz einreiben.', 'Mit der Schnittfläche nach unten auf ein Blech legen und 35 Minuten backen.', 'Laktosefreien Quark mit Kräutern, fein gehackten Lauchzwiebeln, Salz und Pfeffer verrühren.', 'Gurke in Scheiben schneiden und alles zusammen servieren.']);

  R('kartoffelauflauf-cremig', 'Cremiger Kartoffelauflauf mit Erbsen', '🥔🧀', { veg: true, time: 45, main: 'kartoffel', carb: 'kartoffel' },
    [['kartoffeln', 1000], ['sahne', 200], ['milch', 100], ['kaese', 150], ['zwiebeln', 100], ['erbsen', 150], ['knoblauch', 2], ['oel', 10], ['kraeuter', 1], ['salz', 2], ['pfeffer', 1]],
    ['Backofen auf 200 °C vorheizen. Kartoffeln schälen und in dünne Scheiben schneiden.', 'Laktosefreie Sahne und Milch mit gepresstem Knoblauch, Salz, Pfeffer und Kräutern verrühren.', 'Kartoffeln, Zwiebelringe und Erbsen in die geölte Form schichten, Sahnemischung darübergießen.', 'Mit laktosefreiem Käse bestreuen und 35 Minuten goldbraun backen.']);

  R('gemuesepfanne-reis', 'Bunte Gemüsepfanne mit Reis', '🥘🍚', { veg: true, time: 30, main: 'gemuese', carb: 'reis' },
    [['reis', 280], ['paprika', 2], ['zucchini', 300], ['moehren', 250], ['mais', 140], ['zwiebeln', 100], ['sojasauce', 30], ['oel', 30], ['bruehe', 1], ['paprikapulver', 1], ['salz', 1], ['pfeffer', 1]],
    ['Reis in Salzwasser garen.', 'Möhren in Scheiben, Paprika, Zucchini und Zwiebeln in Stücke schneiden.', 'Möhren zuerst 5 Minuten im Öl braten, restliches Gemüse und Mais zugeben und 8 Minuten braten.', 'Mit Brühe (100 ml Wasser), Sojasauce und Gewürzen abschmecken und mit Reis servieren.']);

  R('pizza-margherita', 'Selbstgemachte Pizza Margherita', '🍕', { veg: true, time: 45, diff: 'mittel', main: 'pizza', carb: 'brot' },
    [['mehl', 500], ['hefe', 1], ['oel', 40], ['gehackte', 400], ['mozzarella', 250], ['kaese', 100], ['kraeuter', 2], ['zucker', 5], ['salz', 2]],
    ['Mehl, Hefe, Salz, Zucker, 300 ml lauwarmes Wasser und 30 ml Öl zu einem glatten Teig kneten und 20 Minuten gehen lassen. Ofen auf 220 °C vorheizen.', 'Gehackte Tomaten mit Kräutern und einer Prise Salz würzen.', 'Teig halbieren, auf zwei Blechen dünn ausrollen und mit Tomatensoße bestreichen.', 'Mit laktosefreiem Mozzarella und Reibekäse belegen und 15 Minuten backen.']);

  R('pizza-gemuese', 'Gemüsepizza mit Paprika und Mais', '🍕🫑', { veg: true, time: 45, diff: 'mittel', main: 'pizza', carb: 'brot' },
    [['mehl', 500], ['hefe', 1], ['oel', 40], ['passierte', 300], ['mozzarella', 125], ['kaese', 150], ['paprika', 1], ['mais', 140], ['zucchini', 200], ['zwiebeln', 100], ['kraeuter', 2], ['zucker', 5], ['salz', 2]],
    ['Mehl, Hefe, Salz, Zucker, 300 ml lauwarmes Wasser und 30 ml Öl verkneten und 20 Minuten gehen lassen. Ofen auf 220 °C vorheizen.', 'Paprika, Zucchini und Zwiebeln in dünne Scheiben schneiden.', 'Teig auf zwei Blechen ausrollen, mit passierten Tomaten und Kräutern bestreichen.', 'Gemüse und Mais verteilen, mit laktosefreiem Käse und Mozzarella belegen und 15 Minuten backen.']);

  R('gemuese-lasagne', 'Gemüse-Lasagne mit laktosefreier Béchamel', '🍝🥒', { veg: true, time: 45, diff: 'mittel', main: 'gemuese', carb: 'nudel' },
    [['lasagne', 250], ['zucchini', 400], ['paprika', 2], ['moehren', 200], ['passierte', 500], ['milch', 500], ['mehl', 40], ['oel', 40], ['kaese', 150], ['mozzarella', 125], ['zwiebeln', 100], ['kraeuter', 2], ['salz', 2], ['pfeffer', 1]],
    ['Backofen auf 200 °C vorheizen. Gemüse würfeln und mit Zwiebeln 8 Minuten im Öl braten, passierte Tomaten und Kräuter zugeben und 5 Minuten köcheln.', 'Béchamel: Öl erhitzen, Mehl einrühren, nach und nach laktosefreie Milch zugeben und unter Rühren 5 Minuten köcheln. Würzen.', 'Form abwechselnd mit Gemüsesoße, Lasagneplatten und Béchamel schichten.', 'Mit laktosefreiem Käse und Mozzarella bestreuen und 25 Minuten backen.']);

  R('spaghetti-gemuesesosse', 'Nudeln mit Tomaten-Gemüsesoße', '🍝🍅', { veg: true, time: 30, main: 'gemuese', carb: 'nudel' },
    [['nudeln', 400], ['gehackte', 400], ['moehren', 200], ['zucchini', 250], ['zwiebeln', 100], ['knoblauch', 2], ['tomatenmark', 20], ['kaese', 60], ['oel', 20], ['kraeuter', 2], ['zucker', 5], ['salz', 1], ['pfeffer', 1]],
    ['Nudeln in Salzwasser bissfest kochen.', 'Zwiebeln und Knoblauch im Öl andünsten, geraspelte Möhren und Zucchini zugeben und 5 Minuten braten.', 'Tomatenmark einrühren, gehackte Tomaten, Kräuter, Zucker, Salz und Pfeffer zugeben und 12 Minuten köcheln.', 'Mit Nudeln mischen und mit laktosefreiem Käse bestreut servieren.']);

  R('gemuese-nudelauflauf', 'Gemüse-Nudelauflauf mit Käse', '🍝🧀', { veg: true, time: 45, main: 'gemuese', carb: 'nudel' },
    [['nudeln', 300], ['paprika', 1], ['zucchini', 250], ['mais', 140], ['sahne', 200], ['milch', 100], ['kaese', 150], ['zwiebeln', 100], ['oel', 15], ['kraeuter', 1], ['salz', 1], ['pfeffer', 1]],
    ['Backofen auf 200 °C vorheizen. Nudeln 3 Minuten kürzer als angegeben kochen.', 'Gemüsewürfel mit Zwiebeln im Öl 5 Minuten anbraten.', 'Nudeln, Gemüse und Mais in eine Form geben. Laktosefreie Sahne und Milch mit Salz, Pfeffer und Kräutern verrühren und darübergießen.', 'Mit laktosefreiem Käse bestreuen und 25 Minuten überbacken.']);

  R('kichererbsen-curry', 'Mildes Kichererbsen-Curry mit Reis', '🍛🫘', { veg: true, time: 35, main: 'huelsen', carb: 'reis', spicyVariant: CHILI },
    [['kichererbsen', 480], ['reis', 280], ['kokosmilch', 400], ['gehackte', 400], ['zwiebeln', 150], ['paprika', 1], ['spinat', 200], ['curry', 2], ['oel', 20], ['bruehe', 1], ['salz', 1], ['pfeffer', 1]],
    ['Reis in Salzwasser garen.', 'Zwiebeln und Paprikawürfel im Öl 5 Minuten braten, Currypulver kurz mitrösten.', 'Gehackte Tomaten, Kokosmilch, abgetropfte Kichererbsen und Brühe (100 ml Wasser) zugeben, 12 Minuten köcheln.', 'Aufgetauten Spinat unterrühren, 3 Minuten ziehen lassen, abschmecken und mit Reis servieren.']);

  R('rote-linsen-eintopf', 'Rote-Linsen-Eintopf mit Möhren und Kartoffeln', '🍲🥕', { veg: true, time: 35, main: 'huelsen', carb: 'kartoffel' },
    [['rotelinsen', 250], ['kartoffeln', 400], ['moehren', 250], ['zwiebeln', 150], ['gehackte', 400], ['joghurt', 100], ['oel', 20], ['bruehe', 2], ['kreuzkuemmel', 1], ['curry', 1], ['salz', 1], ['pfeffer', 1]],
    ['Zwiebeln im Öl andünsten, Möhren- und Kartoffelwürfel zugeben.', 'Linsen, gehackte Tomaten, Kreuzkümmel und Curry zugeben, mit 800 ml Wasser mit Brühe auffüllen.', '20 Minuten köcheln, bis Linsen und Gemüse weich sind.', 'Abschmecken und mit einem Klecks laktosefreiem Joghurt servieren.']);

  R('bohnen-mais-reispfanne', 'Bohnen-Mais-Reispfanne mit Paprika', '🥘🫘', { veg: true, time: 30, main: 'huelsen', carb: 'reis' },
    [['reis', 280], ['kidney', 240], ['mais', 140], ['paprika', 2], ['zwiebeln', 100], ['passierte', 250], ['tomatenmark', 20], ['kaese', 80], ['oel', 30], ['paprikapulver', 2], ['kreuzkuemmel', 1], ['salz', 1], ['pfeffer', 1]],
    ['Reis in Salzwasser garen.', 'Zwiebeln und Paprika im Öl 6 Minuten braten, Tomatenmark und Gewürze einrühren.', 'Bohnen, Mais und passierte Tomaten zugeben und 8 Minuten köcheln.', 'Reis unterheben, mit laktosefreiem Käse bestreuen und kurz schmelzen lassen.']);

  R('bohnen-wraps', 'Bohnen-Wraps mit Käse und Salat', '🌯🫘', { veg: true, time: 25, main: 'huelsen', carb: 'brot', spicyVariant: CHILI },
    [['wraps', 8], ['kidney', 240], ['mais', 140], ['paprika', 1], ['tomaten', 250], ['kaese', 100], ['salat', 0.5], ['joghurt', 150], ['zwiebeln', 50], ['oel', 15], ['paprikapulver', 1], ['kreuzkuemmel', 1], ['salz', 1]],
    ['Zwiebel würfeln und im Öl andünsten, Bohnen, Mais, Paprikapulver und Kreuzkümmel zugeben und 5 Minuten braten. Leicht zerdrücken.', 'Paprika und Tomaten würfeln, Salat schneiden.', 'Wraps erwärmen, mit Joghurt bestreichen und mit Bohnenmischung, Gemüse und laktosefreiem Käse füllen.', 'Einrollen und servieren.']);

  R('eier-tomatensosse', 'Eier in Tomaten-Paprika-Soße mit Kartoffeln', '🍳🍅', { veg: true, time: 35, main: 'ei', carb: 'kartoffel' },
    [['eier', 8], ['gehackte', 400], ['paprika', 2], ['zwiebeln', 100], ['knoblauch', 2], ['kartoffeln', 800], ['oel', 25], ['paprikapulver', 1], ['kreuzkuemmel', 1], ['salz', 2], ['pfeffer', 1]],
    ['Kartoffeln schälen, würfeln und 15 Minuten in Salzwasser kochen.', 'Zwiebeln, Knoblauch und Paprika im Öl 6 Minuten braten, Gewürze und gehackte Tomaten zugeben und 8 Minuten köcheln.', 'In der Soße acht Mulden formen und die Eier hineinschlagen.', 'Mit Deckel 6–8 Minuten stocken lassen und mit den Kartoffeln servieren.']);

  R('kartoffel-spinat-omelett', 'Kartoffel-Spinat-Omelett', '🍳🥬', { veg: true, time: 30, main: 'ei', carb: 'kartoffel' },
    [['eier', 8], ['kartoffeln', 500], ['spinat', 300], ['zwiebeln', 100], ['kaese', 80], ['milch', 50], ['oel', 30], ['salz', 1], ['pfeffer', 1]],
    ['Kartoffeln in dünne Scheiben schneiden und im Öl 10 Minuten braten. Zwiebel würfeln und mitbraten.', 'Spinat auftauen und gut ausdrücken, zu den Kartoffeln geben.', 'Eier mit laktosefreier Milch, Salz und Pfeffer verquirlen und darübergießen.', 'Mit Deckel bei kleiner Hitze 10 Minuten stocken lassen, mit laktosefreiem Käse bestreuen und in Stücke schneiden.']);

  R('spinat-kartoffel-auflauf', 'Spinat-Kartoffel-Auflauf mit Ei', '🥬🥔', { veg: true, time: 45, main: 'kartoffel', carb: 'kartoffel' },
    [['kartoffeln', 800], ['spinat', 450], ['sahne', 200], ['kaese', 100], ['eier', 2], ['zwiebeln', 50], ['knoblauch', 1], ['oel', 10], ['salz', 2], ['pfeffer', 1]],
    ['Backofen auf 200 °C vorheizen. Kartoffeln in Scheiben schneiden und 5 Minuten vorkochen.', 'Aufgetauten Spinat ausdrücken und mit Zwiebel und Knoblauch kurz im Öl dünsten.', 'Kartoffeln und Spinat in eine Form schichten. Laktosefreie Sahne mit Eiern, Salz und Pfeffer verquirlen und darübergießen.', 'Mit laktosefreiem Käse bestreuen und 30 Minuten backen.']);

  R('kartoffelpuffer-apfelmus', 'Kartoffelpuffer mit Apfelmus und Gurkensalat', '🥔🍎', { veg: true, time: 40, diff: 'mittel', main: 'kartoffel', carb: 'kartoffel' },
    [['kartoffeln', 1000], ['zwiebeln', 100], ['eier', 2], ['mehl', 40], ['apfelmus', 360], ['gurke', 1], ['oel', 80], ['salz', 2], ['pfeffer', 1]],
    ['Kartoffeln und Zwiebeln fein reiben und in einem Tuch gut ausdrücken.', 'Mit Eiern, Mehl, Salz und Pfeffer zu einem Teig vermengen.', 'Im heißen Öl portionsweise kleine Puffer von beiden Seiten je 4 Minuten goldbraun braten, auf Küchenpapier abtropfen.', 'Gurke hobeln, mit Salz anmachen und mit Apfelmus zu den Puffern servieren.']);

  R('bratkartoffeln-gemuese-ei', 'Bratkartoffeln mit Gemüse und Spiegelei', '🥔🍳', { veg: true, time: 35, main: 'kartoffel', carb: 'kartoffel' },
    [['kartoffeln', 900], ['paprika', 1], ['zucchini', 250], ['zwiebeln', 100], ['eier', 4], ['oel', 50], ['paprikapulver', 1], ['kraeuter', 1], ['salz', 2], ['pfeffer', 1]],
    ['Kartoffeln waschen, 20 Minuten kochen, pellen und in Scheiben schneiden.', 'Im Öl 12 Minuten knusprig braten.', 'Paprika, Zucchini und Zwiebeln in Stücken zugeben und 6 Minuten mitbraten. Würzen.', 'Spiegeleier braten und auf der Pfanne anrichten.']);

  R('suesskartoffel-kichererbsen', 'Süßkartoffel-Kichererbsen-Ofengemüse mit Joghurtdip', '🍠🫘', { veg: true, time: 45, main: 'huelsen', carb: 'kartoffel' },
    [['suesskartoffel', 500], ['kichererbsen', 240], ['paprika', 2], ['zwiebeln', 100], ['joghurt', 250], ['knoblauch', 1], ['oel', 30], ['paprikapulver', 2], ['kreuzkuemmel', 1], ['salz', 2], ['pfeffer', 1]],
    ['Backofen auf 200 °C vorheizen. Süßkartoffeln würfeln, Paprika und Zwiebeln in Stücke schneiden.', 'Mit abgetropften Kichererbsen, Öl, Paprikapulver, Kreuzkümmel, Salz und Pfeffer mischen und auf ein Blech geben.', '30 Minuten backen, einmal wenden.', 'Laktosefreien Joghurt mit gepresstem Knoblauch und Salz verrühren und dazu servieren.']);

  R('gefuellte-paprika-vegi', 'Gefüllte Paprika mit Reis, Bohnen und Käse', '🫑🍚', { veg: true, time: 45, diff: 'mittel', main: 'gemuese', carb: 'reis' },
    [['paprika', 4], ['reis', 200], ['kidney', 240], ['mais', 140], ['passierte', 300], ['zwiebeln', 100], ['kaese', 120], ['oel', 20], ['paprikapulver', 1], ['kraeuter', 1], ['salz', 1], ['pfeffer', 1]],
    ['Backofen auf 190 °C vorheizen. Reis halb gar kochen (ca. 8 Minuten).', 'Paprika entkernen. Zwiebel im Öl anbraten, mit Reis, Bohnen, Mais, Gewürzen und der Hälfte des Käses mischen.', 'Paprika füllen und in eine Form stellen, passierte Tomaten rundherum gießen.', 'Mit restlichem laktosefreiem Käse bestreuen und 30 Minuten garen.']);

  R('zucchini-frittata', 'Zucchini-Kartoffel-Frittata', '🍳🥒', { veg: true, time: 35, main: 'ei', carb: 'kartoffel' },
    [['eier', 8], ['zucchini', 300], ['kartoffeln', 400], ['zwiebeln', 100], ['kaese', 80], ['milch', 50], ['oel', 30], ['salz', 1], ['pfeffer', 1]],
    ['Kartoffeln in dünne Scheiben schneiden und 5 Minuten vorkochen.', 'Zucchini und Zwiebeln würfeln, mit den Kartoffeln im Öl 8 Minuten braten.', 'Eier mit laktosefreier Milch, Salz und Pfeffer verquirlen, in die Pfanne gießen.', 'Mit laktosefreiem Käse bestreuen und zugedeckt 10 Minuten bei kleiner Hitze stocken lassen.']);

  R('couscous-gemuesepfanne', 'Couscous-Gemüsepfanne mit Kichererbsen', '🥘🫘', { veg: true, time: 30, main: 'huelsen', carb: 'couscous' },
    [['couscous', 250], ['kichererbsen', 240], ['paprika', 2], ['zucchini', 250], ['moehren', 150], ['zwiebeln', 100], ['joghurt', 150], ['bruehe', 2], ['oel', 30], ['kreuzkuemmel', 1], ['paprikapulver', 1], ['salz', 1], ['pfeffer', 1]],
    ['Couscous mit 300 ml heißem Wasser mit Brühe übergießen und 5 Minuten quellen lassen.', 'Gemüse klein schneiden und im Öl 8 Minuten braten, Gewürze zugeben.', 'Kichererbsen zugeben und 3 Minuten mitbraten.', 'Couscous unterheben und mit laktosefreiem Joghurt servieren.']);

  R('tomatensuppe-nudeln', 'Cremige Tomatensuppe mit Nudeln', '🥣🍅', { veg: true, time: 30, main: 'gemuese', carb: 'nudel' },
    [['passierte', 500], ['gehackte', 400], ['sahne', 100], ['zwiebeln', 100], ['moehren', 150], ['knoblauch', 2], ['nudeln', 200], ['kaese', 60], ['bruehe', 2], ['oel', 20], ['kraeuter', 2], ['zucker', 5], ['salz', 1], ['pfeffer', 1]],
    ['Zwiebeln, Knoblauch und Möhren würfeln und im Öl 5 Minuten dünsten.', 'Passierte und gehackte Tomaten zugeben, mit 500 ml Wasser mit Brühe auffüllen und 15 Minuten köcheln. Pürieren.', 'Nudeln direkt in der Suppe 8 Minuten garen.', 'Laktosefreie Sahne einrühren, mit Kräutern, Zucker, Salz und Pfeffer abschmecken, mit laktosefreiem Käse servieren.']);

  R('kuerbissuppe', 'Kürbis-Möhren-Suppe mit Kartoffeln', '🎃🥕', { veg: true, time: 35, main: 'kuerbis', carb: 'kartoffel' },
    [['kuerbis', 700], ['moehren', 300], ['kartoffeln', 300], ['zwiebeln', 100], ['sahne', 100], ['oel', 20], ['bruehe', 2], ['curry', 1], ['salz', 1], ['pfeffer', 1]],
    ['Kürbis (mit Schale), Möhren, Kartoffeln und Zwiebeln würfeln.', 'Zwiebeln im Öl andünsten, restliches Gemüse und Curry zugeben, kurz mitbraten.', 'Mit 900 ml Wasser mit Brühe aufgießen und 20 Minuten köcheln.', 'Fein pürieren, laktosefreie Sahne einrühren und abschmecken.']);

  R('kuerbis-kartoffel-auflauf', 'Kürbis-Kartoffel-Auflauf mit Käse', '🎃🥔', { veg: true, time: 45, main: 'kuerbis', carb: 'kartoffel' },
    [['kuerbis', 500], ['kartoffeln', 700], ['sahne', 200], ['kaese', 120], ['zwiebeln', 100], ['oel', 15], ['kraeuter', 1], ['salz', 2], ['pfeffer', 1]],
    ['Backofen auf 200 °C vorheizen. Kürbis und Kartoffeln in dünne Scheiben schneiden.', 'Mit Zwiebelringen in die geölte Form schichten.', 'Laktosefreie Sahne mit Salz, Pfeffer und Kräutern würzen und darübergießen.', 'Mit laktosefreiem Käse bestreuen und 35 Minuten backen.']);

  R('eierreis-gemuese', 'Eierreis mit Erbsen, Möhren und Mais', '🍳🍚', { veg: true, time: 25, main: 'ei', carb: 'reis' },
    [['reis', 300], ['eier', 4], ['erbsen', 150], ['moehren', 150], ['mais', 140], ['lauchzwiebeln', 1], ['sojasauce', 30], ['oel', 30], ['salz', 1], ['pfeffer', 1]],
    ['Reis in Salzwasser garen und gut abtropfen lassen.', 'Möhren in kleine Würfel schneiden und im Öl 5 Minuten braten, Erbsen und Mais zugeben.', 'Eier verquirlen, an den Rand schieben und stocken lassen.', 'Reis, Sojasauce und in Ringe geschnittene Lauchzwiebeln unterheben, abschmecken.']);

  R('weisse-bohnen-eintopf', 'Weißer-Bohnen-Eintopf mit Kartoffeln und Tomate', '🍲🫘', { veg: true, time: 35, main: 'huelsen', carb: 'kartoffel' },
    [['weissebohnen', 480], ['kartoffeln', 500], ['gehackte', 400], ['moehren', 200], ['zwiebeln', 100], ['knoblauch', 2], ['oel', 20], ['bruehe', 2], ['kraeuter', 2], ['paprikapulver', 1], ['salz', 1], ['pfeffer', 1]],
    ['Zwiebeln und Knoblauch im Öl andünsten, Möhren- und Kartoffelwürfel zugeben.', 'Mit gehackten Tomaten und 500 ml Wasser mit Brühe auffüllen, 15 Minuten köcheln.', 'Abgetropfte Bohnen zugeben und weitere 8 Minuten ziehen lassen.', 'Mit Kräutern, Paprikapulver, Salz und Pfeffer abschmecken.']);

  R('gemuese-pfannkuchen', 'Herzhafte Pfannkuchen mit Gemüsefüllung', '🥞🥕', { veg: true, time: 35, main: 'ei', carb: 'brot' },
    [['mehl', 250], ['milch', 500], ['eier', 3], ['paprika', 1], ['mais', 140], ['zucchini', 200], ['kaese', 100], ['oel', 40], ['salz', 2], ['pfeffer', 1]],
    ['Mehl, laktosefreie Milch, Eier und Salz zu einem glatten Teig verrühren und 10 Minuten quellen lassen.', 'Paprika und Zucchini fein würfeln und 5 Minuten im Öl braten, mit Mais, Salz und Pfeffer würzen.', 'Aus dem Teig nacheinander dünne Pfannkuchen backen.', 'Mit Gemüse und laktosefreiem Käse füllen und zusammenklappen.']);

  R('pellkartoffeln-ei-quark', 'Pellkartoffeln mit Ei und Kräuterquark', '🥔🥚', { veg: true, time: 35, main: 'kartoffel', carb: 'kartoffel' },
    [['kartoffeln', 1000], ['eier', 4], ['quark', 500], ['gurke', 1], ['lauchzwiebeln', 1], ['kraeuter', 2], ['salz', 2], ['pfeffer', 1]],
    ['Kartoffeln waschen und in der Schale 20–25 Minuten kochen. Eier in den letzten 9 Minuten mitkochen.', 'Laktosefreien Quark mit Kräutern, Lauchzwiebelringen, Salz und Pfeffer verrühren.', 'Gurke in Scheiben schneiden und salzen.', 'Kartoffeln und Eier pellen und mit Quark und Gurke servieren.']);

  R('reis-gemuese-auflauf', 'Reis-Gemüse-Auflauf mit Käse', '🍚🧀', { veg: true, time: 45, main: 'gemuese', carb: 'reis' },
    [['reis', 250], ['paprika', 1], ['zucchini', 250], ['mais', 140], ['erbsen', 150], ['sahne', 150], ['milch', 100], ['kaese', 150], ['zwiebeln', 100], ['oel', 10], ['kraeuter', 1], ['salz', 1], ['pfeffer', 1]],
    ['Backofen auf 200 °C vorheizen. Reis 10 Minuten in Salzwasser vorkochen.', 'Gemüse würfeln und mit Zwiebeln im Öl 5 Minuten anbraten.', 'Reis, Gemüse, Mais und Erbsen in eine Form geben, mit laktosefreier Sahne und Milch, Kräutern, Salz und Pfeffer übergießen.', 'Mit laktosefreiem Käse bestreuen und 25 Minuten überbacken.']);

  g.DATA = { VERSION: 2, ING, RECIPES };
})(typeof globalThis !== 'undefined' ? globalThis : self);
