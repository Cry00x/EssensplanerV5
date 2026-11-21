/* Oberfläche und Anwendungslogik (Vanilla JS, keine Abhängigkeiten). */
(function () {
  'use strict';
  const E = Engine, D = DATA, S = Store;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = E.money;
  const SANDBOX = !!window.__SANDBOX__; // eingebettet (z. B. Artifact): kein Service Worker, kein Drucken/Download, kein confirm()

  // Erweiterungspunkte für features.js (Import, Familienplan)
  const App = { acts: {}, forms: {}, changes: {}, sheetExtra: null, homeExtra: null, settingsExtra: null };
  const Fam = FamilyFB.makeFamily({ store: { get: (k, d) => S.get(k, d), set: (k, v) => S.set(k, v) } });
  const st = {
    tab: 'home', weekStart: E.mondayOf(), recipeFilter: { q: '', type: 'all', ing: '', cuisine: '' },
    sheets: [], installHidden: false
  };
  const TABS = [
    { id: 'home', label: 'Start', icon: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>' },
    { id: 'plan', label: 'Wochenplan', icon: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>' },
    { id: 'recipes', label: 'Rezepte', icon: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M8 8h7M8 12h7"/>' },
    { id: 'shop', label: 'Einkauf', icon: '<path d="M4 5h2l2 11h10l2-8H7"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>' },
    { id: 'settings', label: 'Mehr', icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>' }
  ];

  // ───────────── Daten-Helfer ─────────────
  // eigene Einstellungen (zum Bearbeiten) und wirksame Einstellungen (mit Familienbudget und vereinigten Ernährungsprofilen)
  const settingsRaw = () => Object.assign(E.defaultSettings(), S.get('settings', {}), { intol: Object.assign(E.defaultSettings().intol, (S.get('settings', {}) || {}).intol || {}) });
  const settings = () => Fam.effective(settingsRaw());
  const canPlan = () => { if (!Fam.active() || Fam.can('plan')) return true; toast('Als ' + Fam.roleLabel(Fam.role()) + ' darfst du den gemeinsamen Plan nicht ändern.', 3500); return false; };
  function ctx() {
    // Verlauf: die zuletzt geplanten Wochen vor der angezeigten Woche (für „nicht zu früh wiederholen“)
    const hist = S.plans().filter(p => p.weekStart < st.weekStart).slice(0, 3).map(p => ({ weekStart: p.weekStart, days: p.days.filter(Boolean) }));
    return E.makeCtx({
      settings: settings(), recipes: S.recipes(), ratings: S.get('ratings', {}), favorites: S.get('favorites', {}),
      blocked: S.get('blocked', {}), customIng: S.get('customIng', {}), history: hist
    });
  }
  const plan = () => S.plan(st.weekStart);
  function save(key, val) { S.set(key, val); touch(); }
  function touch() { S.set('syncUpdatedAt', Date.now()); Sync.schedule(onPulled); Fam.schedule(() => { applyFamily(); render(); }); }
  function savePlan(p) { p.updatedAt = Date.now(); S.putPlan(p); if (Fam.active() && Fam.can('plan')) { try { Fam.putPlan(p); } catch (e) { } } touch(); }
  function onPulled() { toast('Daten aus der Cloud übernommen'); render(); }
  // Änderungen anderer Familienmitglieder in den lokalen Speicher übernehmen
  function applyFamily() {
    if (!Fam.active()) return false; let ch = false; const fp = Fam.plans();
    Object.keys(fp).forEach(ws => { const l = S.plan(ws), r = fp[ws]; if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) { S.putPlan({ weekStart: ws, days: r.days, locked: r.locked || [], persons: r.persons, createdAt: l ? l.createdAt : r.updatedAt, updatedAt: r.updatedAt }); ch = true; } });
    return ch;
  }
  async function famSync(quiet) {
    if (!Fam.active()) return;
    try { await Fam.sync(); applyFamily(); render(); if (!quiet) toast('Familienplan ist aktuell'); }
    catch (e) { if (!quiet) toast('Familienplan: ' + e.message, 4500); }
  }
  // Echtzeit: Änderungen anderer Familienmitglieder kommen von selbst an (Firebase-Listener)
  let famT = null;
  function onFamChange() {
    if (Fam.removed && S.get('family', null)) { Fam.leave(); toast('Du bist nicht mehr Mitglied dieser Familie – der Familienplan wurde auf diesem Gerät getrennt.', 5000); render(); return; }
    clearTimeout(famT);
    famT = setTimeout(() => {
      applyFamily();
      const ae = document.activeElement, typing = ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && !ae.closest('.sheet');
      if (!typing) render(); // nicht mitten in der Eingabe neu zeichnen
    }, 60);
  }
  // Grundrezepte: neue Rezepte ergänzen, fehlende Küchenzuordnung nachtragen – eigene Änderungen und Löschungen bleiben unberührt
  function seedRecipes() {
    const v = S.get('seedVersion', 0), had = S.recipes().length > 0;
    if (had && v >= D.VERSION) return;
    const gone = new Set(S.get('deletedBase', []));
    const have = new Set(S.recipes().map(r => r.id));
    D.RECIPES.forEach(r => {
      if (gone.has(r.id)) return;
      if (!have.has(r.id)) S.putRecipe(Object.assign({}, r, { base: true }));
      else { const cur = S.recipes().find(x => x.id === r.id); if (cur && cur.base && !cur.cuisines && r.cuisines) S.putRecipe(Object.assign({}, cur, { cuisines: r.cuisines })); }
    });
    S.set('seedVersion', D.VERSION);
  }

  // ───────────── UI-Grundbausteine ─────────────
  function toast(msg, ms) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
    $('#toastRoot').appendChild(el); setTimeout(() => el.classList.add('hide'), ms || 2600); setTimeout(() => el.remove(), (ms || 2600) + 400);
  }
  const icon = p => `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true">${p}</svg>`;
  const ICO = {
    swap: icon('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'), lock: icon('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    unlock: icon('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>'),
    heart: icon('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'), plus: icon('<path d="M12 5v14M5 12h14"/>'),
    close: icon('<path d="M6 6l12 12M18 6 6 18"/>'), clock: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    share: icon('<path d="M12 16V4M7 9l5-5 5 5M5 14v5h14v-5"/>'), print: icon('<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>'),
    left: icon('<path d="M15 5l-7 7 7 7"/>'), right: icon('<path d="M9 5l7 7-7 7"/>'), dice: icon('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>'),
    link: icon('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    globe: icon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
    trash: icon('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>')
  };
  const cuisineLabel = id => (D.CUISINE_LABEL && D.CUISINE_LABEL[id]) || id;
  const cuisineBadge = r => `<span class="badge cu">${esc(cuisineLabel(E.primaryCuisine(r)))}</span>`;
  const badges = (c, r) => [
    r.veg ? '<span class="badge veg">🌱 Vegetarisch</span>' : '<span class="badge meat">🍖 Mit Fleisch</span>',
    E.isLactoseFree(c, r) ? '<span class="badge lf">Laktosefrei</span>' : '',
    cuisineBadge(r)
  ].join('');
  const stars = (id, val, interactive) => [1, 2, 3, 4, 5].map(n =>
    `<button class="star${n <= (val || 0) ? ' on' : ''}" ${interactive ? `data-act="rate" data-id="${esc(id)}" data-n="${n}"` : 'tabindex="-1" disabled'} aria-label="${n} Sterne">★</button>`).join('');
  const costBadge = (c, r, persons) => { const x = E.recipeCost(c, r, persons); return `<span class="cost">${money(x.cost)}${x.unknown ? '*' : ''}</span>`; };

  // ───────────── Rendering ─────────────
  function render() {
    const y = window.scrollY;
    renderTabbar(); renderTop();
    const v = $('#view');
    const c = ctx();
    const fn = { home: viewHome, plan: viewPlan, recipes: viewRecipes, shop: viewShop, settings: viewSettings }[st.tab];
    v.innerHTML = fn(c);
    v.classList.toggle('shop-print', st.tab === 'shop');
    afterRender();
    window.scrollTo(0, y);
  }
  function renderTabbar() {
    $('#tabbar').innerHTML = TABS.map(t => `<button class="tab${st.tab === t.id ? ' active' : ''}" data-act="tab" data-id="${t.id}" ${st.tab === t.id ? 'aria-current="page"' : ''}>${icon(t.icon)}<span>${t.label}</span></button>`).join('');
  }
  function renderTop() {
    const t = { home: 'Essensplaner', plan: 'Wochenplan', recipes: 'Rezepte', shop: 'Einkaufsliste', settings: 'Einstellungen' }[st.tab];
    $('#topTitle').textContent = t;
    $('#topActions').innerHTML = st.tab === 'recipes' ? `<button class="icon-btn" data-act="import-recipe" aria-label="Rezept aus dem Internet importieren">${ICO.link}</button><button class="icon-btn" data-act="new-recipe" aria-label="Eigenes Rezept hinzufügen">${ICO.plus}</button>` : '';
  }
  function afterRender() {
    // sichtbare Rezepte ohne Foto zuerst suchen lassen
    const ids = [...new Set([...document.querySelectorAll('#view .ph[data-rid], .sheet .ph[data-rid]')].map(e => e.dataset.rid))];
    if (ids.length) { const c = ctx(); Images.ensure(ids.map(i => c.recipeMap[i]).filter(Boolean), true); }
  }

  const weekLabel = ws => {
    const a = E.parseIso(ws), b = E.parseIso(E.addWeeks(ws, 1)); b.setDate(b.getDate() - 1);
    const f = d => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
    return `KW ${E.weekNumber(ws)} · ${f(a)}–${f(b)}`;
  };
  function weekNav() {
    return `<div class="weeknav"><button class="icon-btn" data-act="week" data-d="-1" aria-label="Vorherige Woche">${ICO.left}</button>
      <div class="weeknav-label">${esc(weekLabel(st.weekStart))}${st.weekStart === E.mondayOf() ? ' <small>(diese Woche)</small>' : ''}</div>
      <button class="icon-btn" data-act="week" data-d="1" aria-label="Nächste Woche">${ICO.right}</button></div>`;
  }
  function budgetCard(sum, p) {
    const pct = Math.min(100, sum.budget ? sum.total / sum.budget * 100 : 0);
    return `<section class="card budget ${sum.over ? 'over' : ''}">
      <div class="budget-row"><div><div class="muted">Einkauf der Woche (Schätzung)</div><div class="big">${money(sum.total)}</div></div>
      <div class="right"><div class="muted">${sum.over ? 'Überschritten um' : 'Noch übrig'}</div><div class="big ${sum.over ? 'bad' : 'good'}">${money(Math.abs(sum.remaining))}</div></div></div>
      <div class="bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      <div class="muted small">Budget ${money(sum.budget)} · ${p.persons} Personen · ${sum.veg} vegetarisch, ${sum.meat} mit Fleisch</div>
      ${sum.over ? `<button class="btn warn" data-act="optimize">💡 Günstigere Gerichte vorschlagen lassen</button>` : ''}</section>`;
  }
  function warnings(sum) {
    const w = sum.warnings.filter(x => x.type !== 'budget');
    if (!w.length) return '';
    const fixable = w.some(x => x.type === 'ineligible' || x.type === 'missing');
    return `<section class="card note"><strong>Hinweise</strong><ul>${w.map(x => `<li>${esc(x.text)}</li>`).join('')}</ul>${fixable ? '<button class="btn" data-act="repair">Unpassende Gerichte ersetzen</button>' : ''}</section>`;
  }
  function emptyPlan() {
    return `<section class="card empty"><div class="empty-ico">🍽️</div><h2>Noch kein Plan für diese Woche</h2>
      <p>Der Planer wählt sieben passende Mittagessen aus – abwechslungsreich, laktosefrei und im Budget.</p>
      <button class="btn primary big-btn" data-act="generate">Wochenplan erstellen</button></section>`;
  }

  // ───────────── Start ─────────────
  function installCard() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    if (SANDBOX || !ios || standalone || st.installHidden || S.get('installHidden', false)) return '';
    return `<section class="card install"><strong>📲 Als App installieren</strong>
      <p>Tippe unten in Safari auf <b>Teilen</b> <span class="kbd">⎙</span> und dann auf <b>„Zum Home-Bildschirm“</b>.</p>
      <button class="btn small" data-act="hide-install">Verstanden</button></section>`;
  }
  function viewHome(c) {
    const p = plan();
    if (!p) return installCard() + weekNav() + (App.homeExtra ? App.homeExtra(c) : '') + emptyPlan() + recoBlock(c, []);
    const sum = E.summary(c, p);
    const isNow = st.weekStart === E.mondayOf();
    const today = isNow ? (new Date().getDay() + 6) % 7 : 0;
    const upcoming = [];
    for (let i = today; i < 7 && upcoming.length < 3; i++) if (p.days[i]) upcoming.push(i);
    const first = upcoming[0], fr = first !== undefined ? c.recipeMap[p.days[first]] : null;
    return installCard() + weekNav() + budgetCard(sum, p) + warnings(sum) + (App.homeExtra ? App.homeExtra(c) : '') +
      (fr ? `<h2 class="h2">${isNow && first === today ? 'Heute zum Mittagessen' : 'Nächstes Mittagessen'}</h2>
      <button class="hero" data-act="open" data-id="${esc(fr.id)}" data-day="${first}">
        ${Images.tag(fr, 'pic hero-pic')}<div class="hero-body"><div class="muted">${E.DAYS[first]}</div><div class="hero-title">${esc(fr.name)}</div>
        <div class="meta">${ICO.clock} ${fr.time} Min · ${costBadge(c, fr, p.persons)}</div></div></button>` : '') +
      (upcoming.length > 1 ? `<h2 class="h2">Danach</h2><div class="list">${upcoming.slice(1).map(i => dayCard(c, p, i, sum, true)).join('')}</div>` : '') +
      `<div class="row-actions"><button class="btn" data-act="goto" data-id="plan">Ganzen Wochenplan ansehen</button><button class="btn" data-act="goto" data-id="shop">Einkaufsliste öffnen</button></div>` +
      recoBlock(c, p.days.filter(Boolean)) + `<p class="muted small">* Preise sind Schätzwerte (Richtwerte Aldi Süd), keine Live-Preise.</p>`;
  }
  function recoBlock(c, ex) {
    const rec = E.recommendations(c, ex, 4); if (!rec.length) return '';
    return `<h2 class="h2">Empfehlungen für dich</h2><div class="hscroll">${rec.map(({ r, reason }) => `<button class="mini" data-act="open" data-id="${esc(r.id)}">${Images.tag(r, 'pic')}<div class="mini-t">${esc(r.name)}</div><div class="muted small">${esc(reason)}</div></button>`).join('')}</div>`;
  }

  // ───────────── Wochenplan ─────────────
  function dayCard(c, p, i, sum, compact) {
    const r = c.recipeMap[p.days[i]];
    if (!r) return `<div class="card">${E.DAYS[i]}: <em>Rezept nicht gefunden</em> <button class="btn small" data-act="swap" data-day="${i}">Wählen</button></div>`;
    const isToday = st.weekStart === E.mondayOf() && (new Date().getDay() + 6) % 7 === i;
    const locked = p.locked && p.locked[i];
    return `<article class="day ${isToday ? 'today' : ''}">
      <button class="day-main" data-act="open" data-id="${esc(r.id)}" data-day="${i}" aria-label="${esc(E.DAYS[i])}: ${esc(r.name)} – Rezept öffnen">
        ${Images.tag(r, 'pic')}
        <div class="day-body"><div class="day-name">${E.DAYS[i]}${isToday ? ' · heute' : ''}</div><div class="day-title">${esc(r.name)}</div>
          <div class="meta">${ICO.clock} ${r.time} Min · ${costBadge(c, r, p.persons)}</div><div class="badges">${badges(c, r)}</div></div></button>
      ${compact ? '' : `<div class="day-actions"><button class="icon-btn ${locked ? 'on' : ''}" data-act="lock" data-day="${i}" aria-label="${locked ? 'Gericht entsperren' : 'Gericht fixieren'}" aria-pressed="${!!locked}">${locked ? ICO.lock : ICO.unlock}</button>
        <button class="btn swap" data-act="swap" data-day="${i}">${ICO.swap} Tauschen</button></div>`}</article>`;
  }
  function cuisineBar(c) {
    const sel = c.settings.cuisines || [];
    return `<section class="card"><strong>Küchenrichtungen für die Planung</strong><div class="chips">
      <button class="chip${!sel.length ? ' on' : ''}" data-act="cuisine-all">Alle</button>${D.CUISINES.filter(x => x !== 'international').map(k => `<button class="chip${sel.includes(k) ? ' on' : ''}" data-act="cuisine-toggle" data-id="${k}">${esc(cuisineLabel(k))}</button>`).join('')}</div>
      <p class="muted small">${sel.length ? 'Nur Gerichte aus den gewählten Richtungen werden geplant. ' : 'Ohne Auswahl sind alle Richtungen möglich. '}„Überrasch mich international“ mischt mehrere Küchen in einer Woche.</p></section>`;
  }
  function viewPlan(c) {
    const p = plan();
    if (!p) return weekNav() + emptyPlan();
    const sum = E.summary(c, p);
    return weekNav() + budgetCard(sum, p) + warnings(sum) +
      `<div class="list">${[0, 1, 2, 3, 4, 5, 6].map(i => dayCard(c, p, i, sum)).join('')}</div>
      ${cuisineBar(c)}
      <div class="row-actions sticky-actions"><button class="btn primary" data-act="generate">🔄 Ganze Woche neu</button>
      <button class="btn" data-act="regen-free">Nur nicht fixierte neu</button>
      <button class="btn" data-act="generate-intl">${ICO.globe} Überrasch mich international</button>
      <button class="btn" data-act="optimize">💶 Budget optimieren</button></div>
      <p class="muted small">Tipp: Mit dem Schloss fixierst du ein Gericht – es bleibt bei „Neu erstellen“ erhalten. Beim Tauschen wird das Budget sofort neu berechnet. * Preise = Schätzwerte.</p>`;
  }

  // ───────────── Rezepte ─────────────
  function filteredRecipes(c) {
    const f = st.recipeFilter, q = f.q.trim().toLowerCase(), ing = f.ing.trim().toLowerCase();
    return c.recipes.filter(r => {
      if (c.blocked[r.id] && f.type !== 'blocked') return false;
      if (f.type === 'veg' && !r.veg) return false; if (f.type === 'meat' && r.veg) return false;
      if (f.type === 'fast' && r.time > 30) return false; if (f.type === 'fav' && !c.favorites[r.id]) return false;
      if (f.type === 'blocked' && !c.blocked[r.id]) return false; if (f.type === 'own' && !r.custom) return false;
      if (f.cuisine && !E.cuisinesOf(r).includes(f.cuisine)) return false;
      if (q && !(r.name.toLowerCase().includes(q) || r.ings.some(([id]) => (c.ing[id] ? c.ing[id].n : '').toLowerCase().includes(q)))) return false;
      if (ing && !r.ings.some(([id]) => (c.ing[id] ? c.ing[id].n : '').toLowerCase().includes(ing))) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }
  function viewRecipes(c) {
    const f = st.recipeFilter, list = filteredRecipes(c);
    const chips = [['all', 'Alle'], ['veg', '🌱 Vegetarisch'], ['meat', '🍖 Fleisch'], ['fast', '⏱ bis 30 Min'], ['fav', '♥ Favoriten'], ['own', 'Eigene / importiert'], ['blocked', '⏸ Inaktiv']];
    return `<div class="searchbar"><input id="recipeQ" type="search" placeholder="Rezept oder Zutat suchen …" value="${esc(f.q)}" autocomplete="off" enterkeyhint="search">
      <input id="recipeIng" type="search" placeholder="Enthält Zutat (z. B. Paprika)" value="${esc(f.ing)}" autocomplete="off"></div>
      <div class="chips" role="tablist">${chips.map(([k, l]) => `<button class="chip${f.type === k ? ' on' : ''}" data-act="rfilter" data-id="${k}">${l}</button>`).join('')}</div>
      <div class="chips"><button class="chip${!f.cuisine ? ' on' : ''}" data-act="rcuisine" data-id="">🌍 Alle Küchen</button>${D.CUISINES.filter(x => x !== 'international').map(k => `<button class="chip${f.cuisine === k ? ' on' : ''}" data-act="rcuisine" data-id="${k}">${esc(cuisineLabel(k))}</button>`).join('')}</div>
      <p class="muted small" id="recipeCount">${list.length} von ${c.recipes.length} Rezepten${Object.keys(c.blocked).length ? ' · inaktive Rezepte werden nicht geplant' : ''}</p>
      <div class="grid" id="recipeGrid">${recipeGrid(c, list)}</div>`;
  }
  function recipeGrid(c, list) {
    if (!list.length) return '<p class="muted pad">Keine Rezepte gefunden.</p>';
    const per = settings().persons;
    return list.map(r => `<button class="rcard" data-act="open" data-id="${esc(r.id)}">${Images.tag(r, 'pic')}
      ${c.favorites[r.id] ? '<span class="fav">♥</span>' : ''}${c.blocked[r.id] ? '<span class="off">Inaktiv</span>' : ''}<div class="rcard-b"><div class="rcard-t">${esc(r.name)}</div>
      <div class="meta">${ICO.clock} ${r.time} Min · ${costBadge(c, r, per)}</div><div class="badges">${badges(c, r)}</div></div></button>`).join('');
  }

  // ───────────── Einkaufsliste ─────────────
  // Einkaufsliste: bei aktivem Familienplan gemeinsam (Haken und Zusatzartikel), sonst lokal
  const checked = () => (Fam.active() ? Fam.checked(st.weekStart) : S.get('checked:' + st.weekStart, {}));
  const extras = () => (Fam.active() ? Fam.extras(st.weekStart) : S.get('extras:' + st.weekStart, []));
  const canShop = () => { if (!Fam.active() || Fam.can('shop')) return true; toast('Als ' + Fam.roleLabel(Fam.role()) + ' kannst du die gemeinsame Liste nur ansehen.', 3500); return false; };
  function writeChecked(id, on) { if (!canShop()) return false; if (Fam.active()) { Fam.setChecked(st.weekStart, id, on); touch(); } else { const m = S.get('checked:' + st.weekStart, {}); if (on) m[id] = true; else delete m[id]; save('checked:' + st.weekStart, m); } return true; }
  function writeExtras(list) { if (!canShop()) return false; if (Fam.active()) { Fam.setExtras(st.weekStart, list); touch(); } else save('extras:' + st.weekStart, list); return true; }
  function viewShop(c) {
    const p = plan();
    if (!p) return weekNav() + emptyPlan();
    const sum = E.summary(c, p), L = sum.list, chk = checked(), ex = extras();
    const total = L.visible.length + ex.length, done = L.visible.filter(i => chk[i.id]).length + ex.filter(e => e.done).length;
    let html = weekNav() + `<section class="card summary-card"><div class="budget-row"><div><div class="muted">Gesamtkosten (geschätzt)</div><div class="big">${money(L.total)}</div></div>
      <div class="right"><div class="muted">Budget ${money(sum.budget)}</div><div class="big ${sum.over ? 'bad' : 'good'}">${sum.over ? '+' : '−'}${money(Math.abs(sum.remaining))}</div></div></div>
      <div class="muted small">${done} von ${total} Artikeln erledigt · Preise sind Schätzungen, aufgerundet auf Packungsgrößen</div>
      ${sum.over ? '<div class="alert">⚠ Budget überschritten – im Wochenplan Gerichte tauschen oder „Budget optimieren“ nutzen.</div>' : ''}
      <div class="row-actions tight no-print"><button class="btn small" data-act="share-list">${ICO.share} ${SANDBOX ? 'Liste kopieren' : 'Teilen'}</button>${SANDBOX ? '' : `<button class="btn small" data-act="print">${ICO.print} Drucken</button><button class="btn small" data-act="csv">CSV</button>`}<button class="btn small" data-act="reset-checks">Haken löschen</button></div></section>`;
    for (const cat of E.CATS) {
      const items = (L.byCat[cat] || []).filter(i => i.packs > 0);
      if (!items.length) continue;
      const sub = items.reduce((s, i) => s + i.cost, 0);
      html += `<section class="card cat"><h3>${cat}<span>${money(sub)}</span></h3>${items.map(i => `
        <label class="item${chk[i.id] ? ' done' : ''}"><input type="checkbox" data-act="check" data-id="${esc(i.id)}" ${chk[i.id] ? 'checked' : ''}>
        <span class="box" aria-hidden="true"></span><span class="item-t"><b>${esc(i.name)}</b>
        <small>${i.packs}× ${E.fmtAmount(i.pack, i.unit, true)} · benötigt ${E.fmtAmount(i.need, i.unit, i.whole)}${i.stockUsed ? ' (Vorrat berücksichtigt)' : ''}</small></span>
        <span class="price">${i.unknownPrice ? '–' : money(i.cost)}<small>${i.unknownPrice ? 'Preis fehlt' : money(i.price) + '/Pck.'}</small></span></label>`).join('')}</section>`;
    }
    html += `<section class="card cat"><h3>Eigene Artikel</h3>${ex.map((e, i) => `<label class="item${e.done ? ' done' : ''}"><input type="checkbox" data-act="xcheck" data-i="${i}" ${e.done ? 'checked' : ''}><span class="box"></span>
      <span class="item-t"><b>${esc(e.name)}</b></span><button class="icon-btn no-print" data-act="xdel" data-i="${i}" aria-label="Entfernen">${ICO.close}</button></label>`).join('')}
      <form class="addrow no-print" data-form="xadd"><input name="n" placeholder="Weiteren Artikel hinzufügen …" autocomplete="off" required><button class="btn small primary" type="submit">Hinzufügen</button></form></section>`;
    const hid = L.items.filter(i => i.packs === 0 && !i.pantry);
    if (hid.length) html += `<p class="muted small">Aus dem Vorrat gedeckt: ${hid.map(i => esc(i.name)).join(', ')}.</p>`;
    html += `<p class="muted small">Vorhandene Grundzutaten (Öl, Gewürze, Mehl, Zucker, Brühe) sind nicht enthalten. Unter „Mehr“ kannst du weitere Vorräte eintragen und Preise anpassen.</p>`;
    return html;
  }

  // ───────────── Einstellungen ─────────────
  function stepper(key, val, min, max, step, unit) {
    return `<div class="stepper"><button class="icon-btn" data-act="step" data-k="${key}" data-d="-${step}" data-min="${min}" data-max="${max}" aria-label="weniger">−</button><span>${val}${unit || ''}</span><button class="icon-btn" data-act="step" data-k="${key}" data-d="${step}" data-min="${min}" data-max="${max}" aria-label="mehr">+</button></div>`;
  }
  function sw(path, val, label, sub) { return `<label class="switch"><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" data-act="toggle" data-k="${path}" ${val ? 'checked' : ''}><i></i></label>`; }
  function viewSettings(c) {
    const s = settingsRaw(), eff = settings(), sc = Sync.config(), un = Sync.status;
    const known = Sync.last || S.get('syncLast', null);
    return `${Fam.active() ? '<section class="card note"><b>👪 Familienplan aktiv</b><p class="small">Budget und Personenzahl gelten für die ganze Familie (ändern: nur Admins). Die Ernährungsregeln aller Mitglieder werden zusammengeführt – jeder Ausschluss gilt für alle.</p></section>' : ''}
    <section class="card"><h3>Planung</h3>
      <div class="field"><span>Personenanzahl</span>${stepper('persons', eff.persons, 1, 12, 1)}</div>
      <div class="field"><span>Wochenbudget</span><div class="inline"><input type="number" inputmode="decimal" min="10" step="5" value="${eff.budget}" data-act="num" data-k="budget"><span>€</span></div></div>
      <div class="field"><span>Gewünschte vegetarische Gerichte</span>${stepper('vegTarget', s.vegTarget, 0, 7, 1, ' von 7')}</div>
      <div class="field"><span>Max. Zubereitungszeit</span>${stepper('maxTime', s.maxTime, 20, 90, 5, ' Min')}</div>
      <div class="field"><span>Einkaufsmarkt</span><select data-act="sel" data-k="market">${['Aldi Süd', 'Aldi Nord', 'Lidl', 'Rewe', 'Edeka', 'Netto'].map(m => `<option${s.market === m ? ' selected' : ''}>${m}</option>`).join('')}</select></div>
      <p class="muted small">Die Preise sind Richtwerte für Aldi Süd und bleiben Schätzungen – es gibt keine kostenlose offizielle Preis-Schnittstelle. Anpassbar über den Preisfaktor und einzelne Artikelpreise.</p>
      <div class="field"><span>Preisfaktor (Teuerung)</span><div class="inline"><input type="number" inputmode="decimal" min="50" max="200" step="1" value="${Math.round(s.priceFactor * 100)}" data-act="num" data-k="priceFactor" data-div="100"><span>%</span></div></div>
      <div class="row-actions"><button class="btn" data-act="prices">Einzelpreise anpassen</button><button class="btn" data-act="stock">Vorräte eintragen</button></div></section>
    <section class="card"><h3>Ernährung & Unverträglichkeiten</h3>
      ${sw('intol.laktose', s.intol.laktose, 'Laktosefrei', 'Nur laktosefreie Milchprodukte')}
      ${sw('intol.fisch', s.intol.fisch, 'Kein Fisch / Meeresfrüchte')}${sw('intol.pilze', s.intol.pilze, 'Keine Pilze')}${sw('intol.kohl', s.intol.kohl, 'Kein Brokkoli / Kohlgemüse')}
      ${sw('allowSpicy', s.allowSpicy, 'Leicht scharfe Gerichte erlauben', 'Standard: mild gewürzt')}
      <label class="field col"><span>Unerwünschte Lebensmittel (Komma-getrennt)</span><input type="text" data-act="list" data-k="unwanted" value="${esc((s.unwanted || []).join(', '))}" placeholder="z. B. Spinat, Zucchini"></label>
      <label class="field col"><span>Bevorzugte Lebensmittel (Komma-getrennt)</span><input type="text" data-act="list" data-k="preferred" value="${esc((s.preferred || []).join(', '))}" placeholder="z. B. Hähnchen, Kartoffeln"></label></section>
    ${App.settingsExtra ? App.settingsExtra(c) : ''}
    <section class="card"><h3>Meine Daten</h3>
      <div class="row-actions"><button class="btn" data-act="history">Vergangene Wochenpläne (${S.plans().length})</button><button class="btn" data-act="goto-fav">Lieblingsgerichte (${Object.keys(S.get('favorites', {})).length})</button></div>
      <div class="row-actions"><button class="btn" data-act="export">Sicherung exportieren</button><button class="btn" data-act="import">Sicherung importieren</button></div>
      <input type="file" id="importFile" accept="application/json,.json" hidden>
      <p class="muted small">Alles wird dauerhaft auf diesem Gerät gespeichert (${S.backend === 'indexeddb' ? 'IndexedDB' : S.backend === 'localstorage' ? 'localStorage' : 'nur Arbeitsspeicher – nach dem Schließen weg!'}).</p></section>
    <section class="card"><h3>Cloud-Synchronisierung (optional)</h3>
      <p class="muted small">Ohne Eintrag bleiben deine Daten nur auf diesem Gerät. Wenn du einen eigenen Speicher hast (WebDAV/Nextcloud-Datei, eigener Server mit GET/PUT für JSON), trage die Adresse ein – Abgleich erfolgt automatisch, sobald du online bist.</p>
      <label class="field col"><span>Adresse (HTTPS)</span><input type="url" data-act="sync" data-k="url" value="${esc(sc.url)}" placeholder="https://…/essensplaner.json"></label>
      <label class="field col"><span>Zugangs-Token (optional)</span><input type="password" data-act="sync" data-k="token" value="${esc(sc.token)}" autocomplete="off"></label>
      <div class="row-actions"><button class="btn" data-act="sync-now">Jetzt synchronisieren</button></div>
      <p class="muted small" id="syncState">Status: ${esc(un)}${known ? ' · zuletzt ' + new Date(known).toLocaleString('de-DE') : ''}${Sync.error ? ' · ' + esc(Sync.error) : ''}</p></section>
    <section class="card"><h3>Info</h3><p class="muted small">Essensplaner ${D.VERSION}.0 · ${c.recipes.length} Rezepte · funktioniert komplett offline, ohne KI- oder Preis-Schnittstellen. Nährwerte sind Näherungswerte (rohe Zutaten, pro Portion).</p>
      <button class="btn danger" data-act="reset">Alle Daten löschen</button></section>`;
  }

  // ───────────── Bottom Sheets ─────────────
  function openSheet(html, cls) {
    const root = $('#sheetRoot');
    const el = document.createElement('div'); el.className = 'sheet-wrap';
    el.innerHTML = `<div class="sheet-back" data-act="close-sheet"></div><div class="sheet ${cls || ''}" role="dialog" aria-modal="true">
      <div class="sheet-grab"></div><button class="icon-btn sheet-x" data-act="close-sheet" aria-label="Schließen">${ICO.close}</button><div class="sheet-body">${html}</div></div>`;
    root.appendChild(el); document.body.classList.add('noscroll');
    requestAnimationFrame(() => el.classList.add('in'));
    st.sheets.push(el); return el;
  }
  function closeSheet(all) {
    do {
      const el = st.sheets.pop(); if (!el) break;
      el.classList.remove('in'); setTimeout(() => el.remove(), 250);
    } while (all && st.sheets.length);
    if (!st.sheets.length) document.body.classList.remove('noscroll');
  }

  function recipeSheet(id, day, persons) {
    const c = ctx(), r = c.recipeMap[id]; if (!r) return;
    const p = plan();
    persons = persons || (p ? p.persons : c.settings.persons);
    const cost = E.recipeCost(c, r, persons), nut = E.nutrition(c, r);
    const rt = c.ratings[id] || 0, fav = !!c.favorites[id];
    const ings = E.recipeIngredients(c, r, persons);
    const viol = E.violations(c, r);
    const html = `${Images.tag(r, 'sheet-img')}${Images.credit(r)}
      <h2 class="sheet-title">${esc(r.name)}</h2>
      <div class="badges">${badges(c, r)}<span class="badge">${r.diff}</span><span class="badge">${ICO.clock} ${r.time} Min</span></div>
      ${viol.length ? `<div class="alert">Passt nicht zu deinen Einstellungen: ${esc(viol.join(', '))}</div>` : ''}
      ${c.blocked[id] ? '<div class="alert">⏸ Dieses Rezept ist inaktiv und wird nicht automatisch geplant.</div>' : ''}
      ${r.source && r.source.url ? `<p class="muted small">Quelle: <a href="${esc(r.source.url)}" target="_blank" rel="noopener noreferrer">${esc(r.source.site || r.source.url)}</a>${r.source.author ? ' · ' + esc(r.source.author) : ''}${r.source.originalServings ? ` · Original für ${r.source.originalServings} Portionen, hier auf 4 umgerechnet` : ''}</p>` : ''}
      ${(r.notes || []).length ? `<div class="alert">${r.notes.map(esc).join('\n')}</div>` : ''}
      <div class="rowflex"><div class="stars">${stars(id, rt, true)}</div>
        <button class="btn small ${fav ? 'primary' : ''}" data-act="fav" data-id="${esc(id)}">${ICO.heart} ${fav ? 'Favorit' : 'Merken'}</button></div>
      <div class="field"><span>Portionen für</span><div class="stepper"><button class="icon-btn" data-act="rpers" data-id="${esc(id)}" data-day="${day == null ? '' : day}" data-n="${persons - 1}">−</button><span>${persons} Pers.</span><button class="icon-btn" data-act="rpers" data-id="${esc(id)}" data-day="${day == null ? '' : day}" data-n="${persons + 1}">+</button></div></div>
      <div class="facts"><div><b>${money(cost.cost)}${cost.unknown ? '*' : ''}</b><small>Kosten (anteilig)</small></div><div><b>${money(cost.cost / persons)}</b><small>pro Person</small></div>
      <div><b>${nut.complete ? Math.round(nut.kcal) : '–'}</b><small>kcal/Portion</small></div></div>
      ${nut.complete ? `<div class="muted small">Eiweiß ${Math.round(nut.protein)} g · Kohlenhydrate ${Math.round(nut.carbs)} g · Fett ${Math.round(nut.fat)} g pro Portion (Näherung)</div>` : '<div class="muted small">Nährwerte nicht berechenbar (unbekannte Zutaten).</div>'}
      <h3>Zutaten</h3><ul class="ings">${ings.map(i => `<li class="${i.pantry ? 'pantry' : ''}"><span>${E.fmtAmount(i.amount, i.unit, i.whole)}</span> ${esc(i.name)}${i.pantry ? ' <small>(Vorrat)</small>' : ''}</li>`).join('')}</ul>
      <h3>Zubereitung</h3><ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      ${r.spicyVariant ? `<p class="muted small">🌶️ ${esc(r.spicyVariant)}</p>` : ''}
      <div class="row-actions">${day != null && day !== '' ? `<button class="btn" data-act="swap" data-day="${day}">${ICO.swap} Tauschen</button>` : (p ? '<button class="btn primary" data-act="put-in-plan" data-id="' + esc(id) + '">In den Wochenplan setzen</button>' : '')}
        <button class="btn" data-act="edit-recipe" data-id="${esc(id)}">Bearbeiten</button>
        <button class="btn" data-act="block" data-id="${esc(id)}">${c.blocked[id] ? '▶ Aktivieren' : '⏸ Deaktivieren'}</button></div>
      <div class="row-actions"><label class="btn file-btn">📷 Foto ${r.photo ? 'ändern' : 'hochladen'}<input type="file" accept="image/*" id="photoFile" data-id="${esc(id)}" hidden></label>
        ${r.photo ? `<button class="btn" data-act="photo-remove" data-id="${esc(id)}">Eigenes Foto entfernen</button>` : `<button class="btn" data-act="photo-search" data-id="${esc(id)}">🔍 Foto neu suchen</button>`}</div>
      ${App.sheetExtra ? App.sheetExtra(r, c) : ''}
      <div class="row-actions">${r.base && r.edited ? `<button class="btn" data-act="restore-recipe" data-id="${esc(id)}">Original wiederherstellen</button>` : ''}<button class="btn danger" data-act="del-recipe" data-id="${esc(id)}">${ICO.trash} Löschen</button></div>`;
    const top = st.sheets[st.sheets.length - 1];
    if (top && top.dataset.recipe) { top.querySelector('.sheet-body').innerHTML = html; top.querySelector('.sheet').scrollTop = 0; return; }
    const el = openSheet(html, 'tall'); el.dataset.recipe = id;
  }
  function refreshRecipeSheet(id, day, persons) { const top = st.sheets[st.sheets.length - 1]; if (top && top.dataset.recipe) { const sc = top.querySelector('.sheet').scrollTop; recipeSheet(id, day, persons); top.querySelector('.sheet').scrollTop = sc; } }

  function swapSheet(day) {
    const c = ctx(), p = plan(); if (!p) return;
    const cur = c.recipeMap[p.days[day]], alts = E.alternatives(c, p, day, { limit: 14, sameType: swapSheet.mode !== 'all' });
    const html = `<h2 class="sheet-title">${E.DAYS[day]} tauschen</h2><p class="muted">Aktuell: <b>${esc(cur ? cur.name : '–')}</b>. Der Rest der Woche bleibt unverändert.</p>
      <div class="chips"><button class="chip${swapSheet.mode !== 'all' ? ' on' : ''}" data-act="swapmode" data-m="same" data-day="${day}">Gleiche Art${cur ? (cur.veg ? ' (vegetarisch)' : ' (Fleisch)') : ''}</button><button class="chip${swapSheet.mode === 'all' ? ' on' : ''}" data-act="swapmode" data-m="all" data-day="${day}">Alle</button></div>
      <button class="btn primary" data-act="swap-random" data-day="${day}">${ICO.dice} Zufälliger Vorschlag</button>
      <div class="list tight">${alts.length ? alts.map(a => `<button class="alt" data-act="pick" data-day="${day}" data-id="${esc(a.r.id)}">${Images.tag(a.r, 'pic')}
        <span class="alt-b"><b>${esc(a.r.name)}</b><small>${a.r.time} Min · ${a.r.veg ? '🌱 vegetarisch' : '🍖 Fleisch'}${a.issues.length ? ' · ⚠ ' + esc(a.issues[0]) : ''}</small></span>
        <span class="delta ${a.delta <= 0 ? 'good' : 'bad'}">${a.delta <= 0 ? '−' : '+'}${money(Math.abs(a.delta))}<small>Woche: ${money(a.total)}</small></span></button>`).join('') : '<p class="muted pad">Keine passenden Alternativen gefunden.</p>'}</div>`;
    const top = st.sheets[st.sheets.length - 1];
    if (top && top.dataset.swap) { top.querySelector('.sheet-body').innerHTML = html; return; }
    const el = openSheet(html, 'tall'); el.dataset.swap = '1';
  }

  function recipeEditor(id) {
    const c = ctx(), r = id ? c.recipeMap[id] : null;
    const ingText = r ? r.ings.map(([i, a]) => { const x = c.ing[i]; return `${Math.round(a * 100) / 100} ${x.u === 'Stk' ? 'Stk' : x.u} ${x.n}`; }).join('\n') : '';
    const mains = [['haehnchen', 'Hähnchen'], ['hack', 'Hackfleisch'], ['schwein', 'Schwein'], ['rind', 'Rind'], ['ei', 'Ei'], ['kartoffel', 'Kartoffel'], ['huelsen', 'Hülsenfrüchte'], ['gemuese', 'Gemüse'], ['pizza', 'Pizza/Teig'], ['kuerbis', 'Kürbis']];
    const carbs = [['keine', 'Keine'], ['reis', 'Reis'], ['nudel', 'Nudeln'], ['kartoffel', 'Kartoffeln'], ['brot', 'Wraps/Teig'], ['couscous', 'Couscous'], ['huelsen', 'Hülsenfrüchte']];
    const html = `<h2 class="sheet-title">${r ? 'Rezept bearbeiten' : 'Eigenes Rezept'}</h2>
      <form data-form="recipe" data-id="${esc(id || '')}" class="form">
      <label class="field col"><span>Name</span><input name="name" required value="${esc(r ? r.name : '')}" placeholder="z. B. Kartoffel-Hähnchen-Pfanne"></label>
      <div class="two"><label class="field col"><span>Zeit (Min)</span><input name="time" type="number" inputmode="numeric" min="5" max="240" required value="${r ? r.time : 30}"></label>
        <label class="field col"><span>Schwierigkeit</span><select name="diff">${['leicht', 'mittel', 'anspruchsvoll'].map(d => `<option${r && r.diff === d ? ' selected' : ''}>${d}</option>`).join('')}</select></label></div>
      <div class="two"><label class="field col"><span>Hauptzutat</span><select name="main">${mains.map(([k, l]) => `<option value="${k}"${r && r.main === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field col"><span>Beilage</span><select name="carb">${carbs.map(([k, l]) => `<option value="${k}"${r && r.carb === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
      ${sw0('veg', r ? r.veg : false, 'Vegetarisch')}
      <div class="field col"><span>Küchenrichtung (mehrere möglich)</span><div class="chips wrap">${D.CUISINES.map(k => `<label class="chip chk"><input type="checkbox" name="cuisine" value="${k}" ${r && E.cuisinesOf(r).includes(k) ? 'checked' : ''}><span>${esc(cuisineLabel(k))}</span></label>`).join('')}</div></div>
      <label class="field col"><span>Zutaten für <b>4 Personen</b> – eine pro Zeile</span><textarea name="ings" rows="7" required placeholder="500 g Hähnchenbrustfilet&#10;300 g Reis&#10;2 Stk Paprika&#10;200 g Linsen | 500 | 1,79">${esc(ingText)}</textarea></label>
      <p class="muted small">Format: „Menge Einheit Name“. Bekannte Zutaten (z. B. „Reis“) nutzen automatisch Preis und Packungsgröße. Neue Zutaten: optional „| Packungsgröße | Packungspreis“ anhängen. Einheiten: g, kg, ml, l, Stk, EL, TL.</p>
      <label class="field col"><span>Zubereitung – ein Schritt pro Zeile</span><textarea name="steps" rows="6" required>${esc(r ? r.steps.join('\n') : '')}</textarea></label>
      <label class="field col"><span>Foto (optional)</span><input name="photo" type="file" accept="image/*"></label>
      <div class="formerr" id="formErr" role="alert"></div>
      <button class="btn primary big-btn" type="submit">Speichern</button></form>`;
    openSheet(html, 'tall');
  }
  const sw0 = (name, val, label) => `<label class="switch"><span><b>${label}</b></span><input type="checkbox" name="${name}" ${val ? 'checked' : ''}><i></i></label>`;

  function pricesSheet() {
    const c = ctx(), s = c.settings;
    const ids = Object.values(c.ing).filter(i => !i.pantry).sort((a, b) => a.cat.localeCompare(b.cat) || a.n.localeCompare(b.n, 'de'));
    openSheet(`<h2 class="sheet-title">Einzelpreise anpassen</h2><p class="muted small">Packungspreise in €. Leer lassen = Richtwert × Preisfaktor. Trage hier aktuelle Aldi-Süd-Preise aus dem Prospekt oder der Aldi-App ein.</p>
      <div class="list tight">${ids.map(i => `<label class="field price-row"><span>${esc(i.n)}<small>${E.fmtAmount(i.pack, i.u, true)} · ${i.cat}</small></span>
      <div class="inline"><input type="number" inputmode="decimal" step="0.01" min="0" data-act="pover" data-id="${esc(i.id)}" value="${s.priceOverrides[i.id] != null ? s.priceOverrides[i.id] : ''}" placeholder="${(i.price * s.priceFactor).toFixed(2).replace('.', ',')}"><span>€</span></div></label>`).join('')}</div>`, 'tall');
  }
  function stockSheet() {
    const c = ctx(), s = c.settings;
    const ids = Object.values(c.ing).filter(i => !i.pantry).sort((a, b) => a.cat.localeCompare(b.cat) || a.n.localeCompare(b.n, 'de'));
    openSheet(`<h2 class="sheet-title">Vorhandene Vorräte</h2><p class="muted small">Was angehakt ist, wird nicht eingekauft und der Planer bevorzugt Gerichte damit. Öl, Gewürze, Mehl, Zucker und Brühe sind bereits standardmäßig vorhanden.</p>
      <div class="list tight">${ids.map(i => `<label class="switch"><span><b>${esc(i.n)}</b><small>${i.cat}</small></span><input type="checkbox" data-act="stk" data-id="${esc(i.id)}" ${s.stock[i.id] ? 'checked' : ''}><i></i></label>`).join('')}</div>`, 'tall');
  }
  function historySheet() {
    const c = ctx(), ps = S.plans();
    openSheet(`<h2 class="sheet-title">Wochenpläne</h2><div class="list tight">${ps.map(p => {
      const rs = p.days.map(id => c.recipeMap[id]).filter(Boolean);
      return `<button class="alt" data-act="open-week" data-id="${p.weekStart}"><span class="alt-b"><b>${esc(weekLabel(p.weekStart))}</b><small>${esc(rs.map(r => r.name).join(' · ')).slice(0, 160)}</small></span><span class="delta">${money(E.planList(c, p).total)}</span></button>`;
    }).join('') || '<p class="muted pad">Noch keine Pläne gespeichert.</p>'}</div>`, 'tall');
  }

  // In-App-Bestätigung (confirm() ist in eingebetteten Ansichten blockiert)
  function askConfirm(msg, okLabel) {
    return new Promise(res => {
      const el = openSheet(`<h2 class="sheet-title">Bist du sicher?</h2><p>${esc(msg)}</p>
        <div class="row-actions"><button class="btn" data-ans="0">Abbrechen</button><button class="btn danger" data-ans="1">${esc(okLabel || 'Ja, löschen')}</button></div>`);
      el.addEventListener('click', e => { const b = e.target.closest('[data-ans]'); if (b) { closeSheet(); res(b.dataset.ans === '1'); } });
      el.querySelector('.sheet-back').addEventListener('click', () => res(false));
    });
  }
  // Text anzeigen und zum Kopieren markierbar machen (Fallback für Teilen/Export)
  function textSheet(title, text, hint) {
    const el = openSheet(`<h2 class="sheet-title">${esc(title)}</h2>${hint ? `<p class="muted small">${esc(hint)}</p>` : ''}
      <textarea id="copyArea" rows="12" readonly></textarea>
      <button class="btn primary big-btn" data-act="copy-area">In die Zwischenablage kopieren</button>`, 'tall');
    el.querySelector('#copyArea').value = text;
  }

  // ───────────── Aktionen ─────────────
  function generate(keepLocked, international) {
    if (!canPlan()) return;
    const c = ctx(), cur = plan();
    try {
      const keep = keepLocked && cur ? cur.days.map((id, i) => (cur.locked && cur.locked[i] ? id : null)) : [];
      const np = E.generatePlan(c, { weekStart: st.weekStart, persons: c.settings.persons, keep, international: !!international });
      if (cur) np.createdAt = cur.createdAt;
      savePlan(np);
      const sum = E.summary(c, np);
      toast(international ? '🌍 Internationale Woche: ' + [...new Set(np.days.map(id => cuisineLabel(E.primaryCuisine(c.recipeMap[id]))))].join(', ') : (sum.over ? 'Plan erstellt – Budget überschritten, siehe Hinweis' : 'Neuer Wochenplan erstellt: ' + money(sum.total)), international ? 4200 : 2600);
      if (sum.over) { const o = E.optimizeBudget(c, np); if (o.swaps.length && o.total < sum.total) { savePlan(o.plan); toast(`Automatisch günstiger gemacht: ${money(o.total)}`, 3200); } }
    } catch (e) { toast(e.message, 5000); }
    render();
  }
  function doSwap(day, id) {
    const p = plan(); if (!p || !canPlan()) return;
    const dup = E.canPlace(p, day, id); if (dup) { toast('Nicht möglich: ' + dup + '. Jedes Gericht kommt nur einmal pro Woche vor.', 4200); return; }
    const np = E.swapDay(p, day, id);
    if (st.acceptPid) { try { Fam.removeProposal(st.acceptPid); } catch (e) { } st.acceptPid = null; } if (np.locked) np.locked[day] = false;
    savePlan(np); const sum = E.summary(ctx(), np);
    toast(`Getauscht – Woche jetzt ${money(sum.total)}${sum.over ? ' (über Budget!)' : ''}`);
    closeSheet(true); render();
  }
  function listText() { const c = ctx(), p = plan(); return E.listToText(c, E.planList(c, p), `Einkaufsliste ${weekLabel(p.weekStart)} (${c.settings.market}, Preise geschätzt)`); }
  function download(name, mime, text) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function setPath(obj, path, val) { const k = path.split('.'); let o = obj; k.slice(0, -1).forEach(x => { o = o[x] = o[x] || {}; }); o[k[k.length - 1]] = val; }
  function updateSettings(fn) {
    const before = settingsRaw(), s = settingsRaw(); fn(s);
    // Familienbudget und Personenzahl gehören der Familie (nur Admins)
    if (Fam.active() && (s.budget !== before.budget || s.persons !== before.persons)) {
      if (!Fam.can('settings')) { toast('Budget und Personenzahl der Familie kann nur ein Admin ändern.', 3800); return; }
      try { Fam.setMeta({ budget: s.budget, persons: s.persons }); } catch (e) { toast(e.message); }
    }
    save('settings', s);
    const eff = settings(), p = plan(); if (p && p.persons !== eff.persons && (!Fam.active() || Fam.can('plan'))) { p.persons = eff.persons; savePlan(p); }
  }

  document.addEventListener('click', async ev => {
    const t = ev.target.closest('[data-act]'); if (!t) return;
    const a = t.dataset.act, id = t.dataset.id, day = t.dataset.day === '' || t.dataset.day === undefined ? null : +t.dataset.day;
    switch (a) {
      case 'tab': st.tab = id; render(); window.scrollTo(0, 0); break;
      case 'goto': st.tab = id; render(); window.scrollTo(0, 0); break;
      case 'goto-fav': st.tab = 'recipes'; st.recipeFilter.type = 'fav'; render(); window.scrollTo(0, 0); break;
      case 'week': st.weekStart = E.addWeeks(st.weekStart, +t.dataset.d); render(); break;
      case 'open': recipeSheet(id, day); break;
      case 'close-sheet': closeSheet(); break;
      case 'generate': generate(false); break;
      case 'generate-intl': generate(false, true); break;
      case 'cuisine-all': updateSettings(s => { s.cuisines = []; }); render(); break;
      case 'cuisine-toggle': updateSettings(s => { const a = s.cuisines || []; s.cuisines = a.includes(id) ? a.filter(x => x !== id) : a.concat(id); }); render(); break;
      case 'rcuisine': st.recipeFilter.cuisine = id || ''; render(); break;
      case 'regen-free': generate(true); break;
      case 'lock': { if (!canPlan()) break; const p = plan(); p.locked = p.locked || Array(7).fill(false); p.locked[day] = !p.locked[day]; savePlan(p); render(); break; }
      case 'swap': swapSheet(day); break;
      case 'swapmode': swapSheet.mode = t.dataset.m; swapSheet(day); break;
      case 'swap-random': { const c = ctx(), np = E.randomSwap(c, plan(), day); if (np) doSwap(day, np.days[day]); else toast('Keine Alternative gefunden'); break; }
      case 'pick': doSwap(day, id); break;
      case 'put-in-plan': {
        const p = plan(), c = ctx();
        openSheet(`<h2 class="sheet-title">Für welchen Tag?</h2><div class="list tight">${E.DAYS.map((d, i) => { const r0 = c.recipeMap[p.days[i]]; return `<button class="alt" data-act="pick" data-day="${i}" data-id="${esc(id)}"><span class="alt-b"><b>${d}</b><small>ersetzt: ${esc(r0 ? r0.name : '–')}</small></span></button>`; }).join('')}</div>`);
        break;
      }
      case 'optimize': {
        if (!canPlan()) break;
        const c = ctx(), p = plan(), o = E.optimizeBudget(c, p);
        if (!o.swaps.length) { toast('Keine günstigere Kombination gefunden – Budget oder Fixierungen prüfen', 4000); break; }
        openSheet(`<h2 class="sheet-title">Günstigere Vorschläge</h2><p>${o.reached ? 'Damit liegt die Woche im Budget:' : 'Budget wird damit noch nicht erreicht, aber es wird günstiger:'} <b>${money(o.total)}</b></p>
          <ul class="ings">${o.swaps.map(s => `<li><b>${E.DAYS[s.day]}</b>: ${esc(s.from || '–')} → ${esc(s.to)} <small>(−${money(s.saving)})</small></li>`).join('')}</ul>
          <button class="btn primary big-btn" data-act="apply-opt">Übernehmen</button>`);
        st.pendingOpt = o.plan; break;
      }
      case 'apply-opt': if (!canPlan()) break; savePlan(st.pendingOpt); closeSheet(true); toast('Günstigere Gerichte übernommen'); render(); break;
      case 'repair': { if (!canPlan()) break; const r = E.repairPlan(ctx(), plan()); if (r.changes.length) { savePlan(r.plan); toast(r.changes.length + ' Gericht(e) ersetzt'); } render(); break; }
      case 'rate': { const rs = S.get('ratings', {}); rs[id] = rs[id] === +t.dataset.n ? 0 : +t.dataset.n; save('ratings', rs); refreshRecipeSheet(id, null); break; }
      case 'fav': { const f = S.get('favorites', {}); if (f[id]) delete f[id]; else f[id] = true; save('favorites', f); const top = st.sheets[st.sheets.length - 1]; if (top && top.dataset.recipe) refreshRecipeSheet(id, null); render(); break; }
      case 'rpers': refreshRecipeSheet(id, day, Math.max(1, Math.min(24, +t.dataset.n))); break;
      case 'block': { const b = S.get('blocked', {}); if (b[id]) delete b[id]; else b[id] = true; save('blocked', b); closeSheet(); toast(b[id] ? 'Rezept ist inaktiv – wird nicht mehr geplant' : 'Rezept aktiviert'); render(); break; }
      case 'photo-remove': { const r = S.recipes().find(x => x.id === id); if (r) { const n = Object.assign({}, r); delete n.photo; await S.putRecipe(n); touch(); Images.ensure([n], true); refreshRecipeSheet(id, null); render(); } break; }
      case 'photo-search': { const r = S.recipes().find(x => x.id === id); if (r) { Images.reset(r); toast('Foto wird gesucht …'); refreshRecipeSheet(id, null); } break; }
      case 'restore-recipe': { const o = D.RECIPES.find(x => x.id === id); if (o && await askConfirm('Alle deine Änderungen an diesem Rezept verwerfen und das Original wiederherstellen?', 'Wiederherstellen')) { const cur = S.recipes().find(x => x.id === id); await S.putRecipe(Object.assign({}, o, { base: true, photo: cur && cur.photo })); touch(); closeSheet(true); render(); } break; }
      case 'rfilter': st.recipeFilter.type = id; render(); break;
      case 'new-recipe': recipeEditor(null); break;
      case 'edit-recipe': closeSheet(); recipeEditor(id); break;
      case 'del-recipe': {
        const r0 = S.recipes().find(x => x.id === id);
        if (await askConfirm(r0 && r0.base ? 'Dieses mitgelieferte Rezept wirklich löschen? Es kommt auch bei Updates nicht zurück. (Tipp: „Deaktivieren“ blendet es nur aus der Planung aus.)' : 'Dieses Rezept wirklich löschen?')) {
          if (r0 && r0.base) { const g = S.get('deletedBase', []); if (!g.includes(id)) g.push(id); S.set('deletedBase', g); }
          await S.delRecipe(id); const f = S.get('favorites', {}); if (f[id]) { delete f[id]; S.set('favorites', f); } touch(); closeSheet(true); toast('Rezept gelöscht'); render();
        } break;
      }
      case 'hide-install': st.installHidden = true; save('installHidden', true); render(); break;
      case 'step': updateSettings(s => { s[t.dataset.k] = Math.max(+t.dataset.min, Math.min(+t.dataset.max, s[t.dataset.k] + +t.dataset.d)); }); render(); break;
      case 'share-list': {
        const text = listText();
        if (navigator.share && !SANDBOX) { try { await navigator.share({ title: 'Einkaufsliste', text }); break; } catch (e) { if (e && e.name === 'AbortError') break; } }
        try { await navigator.clipboard.writeText(text); toast('Liste in die Zwischenablage kopiert'); } catch (e) { textSheet('Einkaufsliste', text, 'Text markieren und kopieren.'); }
        break;
      }
      case 'copy-area': { const ta = $('#copyArea'); ta.select(); ta.setSelectionRange(0, 1e9); let okc = false; try { await navigator.clipboard.writeText(ta.value); okc = true; } catch (e) { try { okc = document.execCommand('copy'); } catch (e2) { } } toast(okc ? 'Kopiert' : 'Bitte Text markieren und manuell kopieren'); break; }
      case 'print': window.print(); break;
      case 'csv': { const c = ctx(); download(`einkaufsliste-${st.weekStart}.csv`, 'text/csv;charset=utf-8', E.listToCSV(c, E.planList(c, plan()))); break; }
      case 'reset-checks': if (!canShop()) break; Object.keys(checked()).forEach(k => writeChecked(k, false)); writeExtras(extras().map(e => Object.assign({}, e, { done: false }))); render(); break;
      case 'xdel': { const x = extras().slice(); x.splice(+t.dataset.i, 1); writeExtras(x); render(); break; }
      case 'prices': pricesSheet(); break;
      case 'stock': stockSheet(); break;
      case 'history': historySheet(); break;
      case 'open-week': st.weekStart = id; closeSheet(true); st.tab = 'plan'; render(); window.scrollTo(0, 0); break;
      case 'export': if (SANDBOX) textSheet('Sicherung', JSON.stringify(S.exportAll()), 'Kopiere diesen Text und speichere ihn z. B. in einer Notiz. Zum Wiederherstellen als .json-Datei importieren.'); else download('essensplaner-sicherung.json', 'application/json', JSON.stringify(S.exportAll())); break;
      case 'import': $('#importFile').click(); break;
      case 'sync-now': { const r = await Sync.run(onPulled); toast({ push: 'Hochgeladen', pull: 'Daten übernommen', equal: 'Alles aktuell', error: 'Fehler: ' + (Sync.error || ''), skipped: 'Keine Adresse eingetragen oder offline' }[r], 3500); render(); break; }
      default: if (App.acts[a]) await App.acts[a](t, ev); break;
      case 'reset': if (await askConfirm('Wirklich ALLE Daten (Pläne, Rezepte, Einstellungen, Bewertungen) löschen?', 'Alles löschen')) { await S.resetAll(); seedRecipes(); st.weekStart = E.mondayOf(); toast('Zurückgesetzt'); render(); } break;
    }
  });

  document.addEventListener('change', async ev => {
    const t = ev.target, a = t.dataset && t.dataset.act;
    if (t.id === 'importFile' && t.files[0]) {
      try { await S.importAll(JSON.parse(await t.files[0].text())); seedRecipes(); toast('Sicherung importiert'); render(); } catch (e) { toast('Import fehlgeschlagen: ' + e.message, 4500); }
      t.value = ''; return;
    }
    if (t.id === 'photoFile' && t.files[0]) {
      const r = S.recipes().find(x => x.id === t.dataset.id);
      try { const data = await Images.fromFile(t.files[0]); await S.putRecipe(Object.assign({}, r, { photo: data })); touch(); toast('Foto gespeichert'); refreshRecipeSheet(r.id, null); render(); } catch (e) { toast('Foto konnte nicht gelesen werden', 3500); }
      t.value = ''; return;
    }
    if (a && App.changes[a]) { await App.changes[a](t, ev); return; }
    if (!a) return;
    if (a === 'check') { writeChecked(t.dataset.id, t.checked); render(); }
    else if (a === 'xcheck') { const x = JSON.parse(JSON.stringify(extras())); x[+t.dataset.i].done = t.checked; writeExtras(x); render(); }
    else if (a === 'toggle') { updateSettings(s => setPath(s, t.dataset.k, t.checked)); render(); }
    else if (a === 'num') { let v = parseFloat(String(t.value).replace(',', '.')); if (isNaN(v) || v <= 0) { render(); return; } if (t.dataset.div) v /= +t.dataset.div; updateSettings(s => { s[t.dataset.k] = v; }); render(); }
    else if (a === 'sel') { updateSettings(s => { s[t.dataset.k] = t.value; }); render(); }
    else if (a === 'list') { updateSettings(s => { s[t.dataset.k] = t.value.split(',').map(x => x.trim()).filter(Boolean); }); render(); }
    else if (a === 'sync') { const c = Object.assign({}, Sync.config()); c[t.dataset.k] = t.value.trim(); S.set('sync', c); touch(); }
    else if (a === 'pover') { updateSettings(s => { const v = parseFloat(String(t.value).replace(',', '.')); if (isNaN(v) || t.value === '') delete s.priceOverrides[t.dataset.id]; else s.priceOverrides[t.dataset.id] = v; }); render(); }
    else if (a === 'stk') { updateSettings(s => { if (t.checked) s.stock[t.dataset.id] = true; else delete s.stock[t.dataset.id]; }); render(); }
  });

  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.id === 'recipeQ' || t.id === 'recipeIng') {
      st.recipeFilter[t.id === 'recipeQ' ? 'q' : 'ing'] = t.value;
      const c = ctx(); $('#recipeGrid').innerHTML = recipeGrid(c, filteredRecipes(c));
      $('#recipeCount').textContent = filteredRecipes(c).length + ' von ' + c.recipes.length + ' Rezepten'; afterRender();
    }
  });

  document.addEventListener('submit', async ev => {
    const f = ev.target.closest('form[data-form]'); if (!f) return; ev.preventDefault();
    if (App.forms[f.dataset.form]) { await App.forms[f.dataset.form](f, ev); return; }
    if (f.dataset.form === 'xadd') {
      const n = f.elements.n.value.trim(); if (!n) return;
      const x = extras().slice(); x.push({ name: n, done: false }); writeExtras(x); render(); return;
    }
    if (f.dataset.form === 'recipe') {
      const c = ctx(), fd = f.elements, err = $('#formErr');
      const parsed = E.parseIngredientLines(c, fd.ings.value);
      if (parsed.errors.length) { err.textContent = parsed.errors.join('\n'); return; }
      if (!parsed.ings.length) { err.textContent = 'Bitte mindestens eine Zutat angeben.'; return; }
      const steps = fd.steps.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      const id = f.dataset.id || 'c-' + Date.now().toString(36);
      const old = f.dataset.id ? c.recipeMap[f.dataset.id] : null;
      const cu = [...f.querySelectorAll('input[name=cuisine]:checked')].map(x => x.value);
      const r = Object.assign({ emoji: '🍽️', custom: true }, old || {}, {
        id, name: fd.name.value.trim(), veg: fd.veg.checked, time: +fd.time.value, diff: fd.diff.value, main: fd.main.value, carb: fd.carb.value,
        cuisines: cu.length ? cu : ['international'], ings: parsed.ings, steps
      });
      if (old && old.base) r.edited = true;
      if (!r.photo) delete r.photo;
      if (fd.photo.files[0]) { try { r.photo = await Images.fromFile(fd.photo.files[0]); } catch (e) { } }
      if (old && old.name !== r.name && !r.photo) { delete (Images.cache || {})[r.id]; }
      const ci = Object.assign({}, S.get('customIng', {}), parsed.newIng); S.set('customIng', ci);
      await S.putRecipe(r); touch();
      const v = E.violations(ctx(), r);
      closeSheet(true); toast(v.length ? 'Gespeichert – wird aber nicht automatisch geplant: ' + v[0] : 'Rezept gespeichert', v.length ? 5000 : 2600);
      st.tab = 'recipes'; render();
    }
  });

  // ───────────── Start ─────────────
  function onlineState() { $('#offlineBanner').hidden = navigator.onLine; }
  window.addEventListener('online', onlineState); window.addEventListener('offline', onlineState);

  async function boot() {
    await S.init(); seedRecipes();
    Images.load(); Images.getRecipe = id => S.recipes().find(r => r.id === id);
    if (!S.get('settings')) S.set('settings', E.defaultSettings());
    // Neue Woche: automatisch Plan vorschlagen, falls noch keiner existiert
    if (!plan()) { try { const np = E.generatePlan(ctx(), { weekStart: st.weekStart }); S.putPlan(np); } catch (e) { } }
    onlineState(); Sync.attach(onPulled); render();
    if (Sync.enabled()) Sync.run(onPulled);
    // Familienplan (Firebase): Einladungslink merken, Verbindung nur herstellen, wenn schon genutzt oder eine Einladung wartet
    Fam.onError = m => toast(m, 5000); Fam.listeners.push(onFamChange);
    const jp = new URLSearchParams(location.search).get('join');
    if (jp) { S.set('pendingJoin', jp); try { history.replaceState(null, '', location.pathname); } catch (e) { } }
    Fam.boot().then(() => { applyFamily(); render(); if (App.checkPendingJoin) App.checkPendingJoin(); });
    window.addEventListener('online', () => { if (Fam.active() && Fam.user) Fam.sync().catch(() => { }); });
    // alle Rezepte im Hintergrund mit Fotos versorgen (einmal gefunden, bleibt das Foto dauerhaft zugeordnet)
    setTimeout(() => Images.ensure(S.recipes()), 1500);
    if (!SANDBOX && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service Worker nicht verfügbar', e));
      // Neue App-Version: sobald der aktualisierte Service Worker übernimmt, einmal neu laden (nicht bei der Erstinstallation)
      const had = !!navigator.serviceWorker.controller; let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!had || reloaded) return; reloaded = true; location.reload(); });
    }
    window.__app = { st, render, ctx, plan, App };
  }
  Object.assign(App, { st, render, ctx, plan, settings, settingsRaw, Fam, S, E, D, esc, $, toast, openSheet, closeSheet, askConfirm, textSheet, save, touch, savePlan, icon, ICO, money, cuisineLabel, recipeSheet, recipeEditor, famSync, applyFamily, canPlan, weekLabel, refreshRecipeSheet });
  window.App = App;
  boot();
})();
