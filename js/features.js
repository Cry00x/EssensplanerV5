/* Erweiterungen der Oberfläche: Rezeptimport aus dem Internet, Familienplan, Foto-/Import-Einstellungen.
 * Hängt sich über window.App (app.js) ein und ersetzt nichts Bestehendes. */
(function () {
  'use strict';
  const A = window.App, Fam = A.Fam, S = A.S, E = A.E, D = A.D, esc = A.esc, $ = A.$;
  const money = n => A.money(n);
  const imp = { draft: null, url: '', via: '' };
  const proxies = () => { const p = (S.get('importProxy', '') || '').trim(); return p ? [p].concat(Importer.DEFAULT_PROXIES) : Importer.DEFAULT_PROXIES; };

  // ───────────── Rezeptimport ─────────────
  function importSheet(msg, url, html) {
    const top = A.st.sheets[A.st.sheets.length - 1]; if (top && top.dataset.imp) A.closeSheet();
    const el = A.openSheet(`<h2 class="sheet-title">Rezept aus dem Internet</h2>
      <p class="muted small">Füge den Link zu einem Rezept ein (z. B. Chefkoch, Lecker, EAT SMARTER, Rezeptwelt). Zutaten, Schritte, Portionen und Zeit werden gelesen, auf 4 Personen umgerechnet und an deine Ernährungsregeln angepasst. Die Quelle bleibt gespeichert.</p>
      ${msg ? `<div class="alert">${esc(msg)}</div>` : ''}
      <form data-form="import-url" class="form"><label class="field col"><span>Link zum Rezept</span><input name="url" type="url" inputmode="url" required placeholder="https://www.chefkoch.de/rezepte/…" value="${esc(url || '')}" autocomplete="off"></label>
        <button class="btn primary big-btn" type="submit">Rezept laden</button></form>
      <p class="muted small">Browser dürfen fremde Seiten nur über einen Vermittlungsdienst (Proxy) laden. Dabei sieht der Dienst, welchen Link du öffnest. Wer das nicht möchte, nutzt unten den Quelltext oder die manuelle Eingabe.</p>
      <details ${html ? 'open' : ''}><summary>Klappt nicht? Seitenquelltext einfügen</summary>
        <form data-form="import-html" class="form"><p class="muted small">Seite im Browser öffnen → Quelltext anzeigen (Mac: ⌥⌘U; iPhone: Lesezeichen-Trick oder Desktop) → alles kopieren und hier einfügen.</p>
        <input name="url" type="url" placeholder="Link der Seite (für die Quellenangabe)" value="${esc(url || '')}"><textarea name="html" rows="5" placeholder="&lt;html&gt; …" required>${esc(html || '')}</textarea>
        <button class="btn big-btn" type="submit">Aus Quelltext lesen</button></form></details>
      <button class="btn big-btn" data-act="new-recipe-from-import">✍️ Stattdessen manuell eingeben</button>`, 'tall');
    el.dataset.imp = '1';
  }
  function previewSheet(draft, url) {
    const c = A.ctx(), tmp = A.st.sheets[A.st.sheets.length - 1]; if (tmp && tmp.dataset.imp) A.closeSheet();
    imp.draft = draft; imp.url = url;
    const b = Importer.buildRecipe(c, draft, {}), r = b.recipe;
    const ings = r.ings.map(([id, a]) => { const i = c.ing[id] || b.newIng[id]; return `<li><span>${E.fmtAmount(a, i.u, i.u === 'Stk')}</span> ${esc(i.n)}${b.newIng[id] ? ' <small>(neu, Preis unbekannt)</small>' : ''}</li>`; }).join('');
    const el = A.openSheet(`<h2 class="sheet-title">Import prüfen</h2>
      <form data-form="import-save" class="form">
      ${b.dup ? `<div class="alert">⚠ ${esc(b.dup.reason)} („${esc(b.dup.recipe.name)}“). Du kannst trotzdem speichern.</div>` : ''}
      ${b.violations.length ? `<div class="alert">Passt nicht zu deinen Einstellungen: ${esc(b.violations.join(', '))}. Das Rezept wird gespeichert, aber nicht automatisch geplant.</div>` : ''}
      <label class="field col"><span>Name</span><input name="name" required value="${esc(r.name)}"></label>
      <p class="muted small">Quelle: ${esc(draft.source.site || url || 'Einfügung')} · ${draft.servings ? `Original für ${draft.servings} Portionen → umgerechnet auf 4` : 'Portionenangabe fehlt, 4 angenommen'} · ${r.time} Min</p>
      ${b.notes.length ? `<div class="alert">Laktosefrei angepasst:\n${b.notes.map(esc).join('\n')}</div>` : ''}
      ${b.unknown.length ? `<div class="alert">Preis unbekannt für: ${b.unknown.map(esc).join(', ')}. Diese Zutaten zählen mit 0 € im Budget (Preis später unter „Einzelpreise“ möglich).</div>` : ''}
      <div class="field col"><span>Küchenrichtung</span><div class="chips wrap">${D.CUISINES.map(k => `<label class="chip chk"><input type="checkbox" name="cuisine" value="${k}" ${r.cuisines.includes(k) ? 'checked' : ''}><span>${esc(A.cuisineLabel(k))}</span></label>`).join('')}</div></div>
      <h3>Zutaten (4 Personen)</h3><ul class="ings">${ings}</ul>
      <h3>Zubereitung</h3><ol class="steps">${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      ${draft.image ? `<label class="switch"><span><b>Originalbild der Seite verwenden</b><small>Nur wenn du die Rechte dafür hast oder die Seite es erlaubt. Sonst wird ein frei lizenziertes Foto gesucht – oder du lädst später ein eigenes hoch.</small></span><input type="checkbox" name="useimg"><i></i></label>` : ''}
      <button class="btn primary big-btn" type="submit">Rezept speichern</button></form>`, 'tall');
    el.dataset.imp = '2';
  }
  A.acts['import-recipe'] = () => importSheet();
  A.acts['new-recipe-from-import'] = () => { A.closeSheet(true); A.recipeEditor(null); };
  A.forms['import-url'] = async f => {
    const url = Importer.validUrl(f.elements.url.value); if (!url) { A.toast('Bitte einen gültigen Link eingeben'); return; }
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Lade …';
    try {
      const r = await Importer.fetchHtml(url, { proxies: proxies() });
      const d = Importer.fromHtml(r.html, url);
      if (!d) { importSheet('Auf dieser Seite wurde kein lesbares Rezept gefunden. Du kannst den Quelltext einfügen oder das Rezept manuell eingeben.', url); return; }
      previewSheet(d, url);
    } catch (e) { importSheet(e.message + ' Versuche den Quelltext einzufügen oder das Rezept manuell einzugeben.', url); }
  };
  A.forms['import-html'] = f => {
    const url = Importer.validUrl(f.elements.url.value) || '';
    const d = Importer.fromHtml(f.elements.html.value, url);
    if (!d) { importSheet('Im eingefügten Text wurde kein Rezept gefunden (es fehlen die Rezeptdaten der Seite).', url, f.elements.html.value); return; }
    previewSheet(d, url);
  };
  A.forms['import-save'] = async f => {
    const c = A.ctx(), d = Object.assign({}, imp.draft, { name: f.elements.name.value.trim() || imp.draft.name });
    const b = Importer.buildRecipe(c, d, { useImage: !!(f.elements.useimg && f.elements.useimg.checked) });
    const cu = [...f.querySelectorAll('input[name=cuisine]:checked')].map(x => x.value); if (cu.length) b.recipe.cuisines = cu;
    if (b.notes.length) b.recipe.notes = b.notes;
    if (S.recipes().some(r => r.id === b.recipe.id)) b.recipe.id += '-' + Date.now().toString(36).slice(-3);
    S.set('customIng', Object.assign({}, S.get('customIng', {}), b.newIng));
    await S.putRecipe(b.recipe); A.touch(); Images.ensure([b.recipe], true);
    A.closeSheet(true); A.st.tab = 'recipes'; A.st.recipeFilter = { q: '', type: 'own', ing: '', cuisine: '' }; A.render();
    A.toast(b.violations.length ? 'Gespeichert – wird aber nicht automatisch geplant' : 'Rezept importiert', 3500);
  };

  // ───────────── Fotos & Import: Einstellungen ─────────────
  function settingsPhotos(c) {
    const st = Images.stats(c.recipes);
    return `<section class="card"><h3>Fotos & Import</h3>
      <p class="muted small">Rezeptfotos werden beim ersten Start automatisch aus frei lizenzierten Quellen (Wikimedia Commons) gesucht, geprüft und dauerhaft dem Rezept zugeordnet. Stand: <b>${st.ok}</b> von ${st.total} Rezepten mit Foto${st.similar ? ` (davon ${st.similar} als „Beispielfoto“ ähnlicher Gerichte gekennzeichnet)` : ''}${st.none ? `, ${st.none} ohne passendes Foto` : ''}${st.pending ? `, ${st.pending} werden noch gesucht` : ''}. Nicht gefunden = neutraler Platzhalter; du kannst bei jedem Rezept ein eigenes Foto hochladen.</p>
      <label class="field col"><span>Pexels-Schlüssel (optional, kostenlos auf pexels.com/api)</span><input type="password" data-act="imgcfg" data-k="pexelsKey" value="${esc(Images.cfg.pexelsKey || '')}" autocomplete="off" placeholder="für mehr Treffer bei Alltagsgerichten"></label>
      <label class="field col"><span>Eigener Proxy für den Rezeptimport (optional, <code>{url}</code> als Platzhalter)</span><input type="url" data-act="impproxy" value="${esc(S.get('importProxy', ''))}" placeholder="https://mein-proxy.example/?u={url}"></label>
      <div class="row-actions"><button class="btn" data-act="photos-retry">🔍 Fehlende Fotos erneut suchen</button><button class="btn" data-act="import-recipe">🔗 Rezept importieren</button></div></section>`;
  }
  A.acts['photos-retry'] = () => { const c = A.ctx(); Images.retryFailed(c.recipes.filter(r => !r.photo)); A.toast('Suche gestartet – Fotos erscheinen nach und nach'); setTimeout(A.render, 4000); };
  A.changes.imgcfg = t => { Images.saveCfg({ pexelsKey: t.value.trim() }); A.toast(t.value.trim() ? 'Schlüssel gespeichert' : 'Schlüssel entfernt'); };
  A.changes.impproxy = t => { const v = t.value.trim(); if (v && !/\{url\}/.test(v)) { A.toast('Der Proxy braucht den Platzhalter {url}', 4000); return; } S.set('importProxy', v); A.toast('Gespeichert'); };

  // ───────────── Familienplan (Firebase Authentication + Realtime Database) ─────────────
  const ROLE_OPTS = [['admin', 'Admin'], ['member', 'Mitglied'], ['guest', 'Gast']];
  const DIETS = [['laktose', 'Laktosefrei'], ['fisch', 'Kein Fisch/Meeresfrüchte'], ['pilze', 'Keine Pilze'], ['kohl', 'Kein Brokkoli/Kohl']];
  const ui = { mode: 'in', busy: false };
  const fmtT = t => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const errBox = '<div class="formerr" id="fbErr" role="alert"></div>';
  const showErr = e => { const el = $('#fbErr'); if (el) el.textContent = e.message || String(e); else A.toast(e.message || String(e), 4500); };
  const busy = (f, on) => { const b = f && f.querySelector('button[type=submit]'); if (b) b.disabled = on; };

  function cardConfig() {
    return `<section class="card"><h3>👪 Familienplan</h3>
      <p class="muted small">Für den gemeinsamen Plan brauchst du ein kostenloses Firebase-Projekt (Anmeldung + Datenbank). Die Schritt-für-Schritt-Anleitung steht in <b>FIREBASE-ANLEITUNG.md</b>. Danach fügst du hier den „firebaseConfig“-Block aus der Firebase-Konsole ein. Er enthält keine Geheimnisse – geschützt wird der Zugriff durch Anmeldung und die Datenbankregeln.</p>
      <form data-form="fb-config" class="form"><textarea name="cfg" rows="6" required placeholder='const firebaseConfig = {\n  apiKey: "AIza…",\n  authDomain: "…firebaseapp.com",\n  databaseURL: "https://…firebasedatabase.app",\n  …\n};'></textarea>${errBox}<button class="btn primary big-btn" type="submit">Konfiguration speichern</button></form></section>`;
  }
  function cardAuth() {
    const up = ui.mode === 'up';
    return `<section class="card"><h3>👪 Familienplan – Anmeldung</h3>
      <p class="muted small">Melde dich an, um mit deiner Familie zu planen. Pläne, Einkaufsliste und Rezepte auf diesem Gerät bleiben unverändert.</p>
      <div class="chips"><button class="chip${!up ? ' on' : ''}" data-act="fb-mode" data-id="in">Anmelden</button><button class="chip${up ? ' on' : ''}" data-act="fb-mode" data-id="up">Registrieren</button></div>
      <form data-form="${up ? 'fb-signup' : 'fb-signin'}" class="form">
        ${up ? '<label class="field col"><span>Dein Name</span><input name="name" required autocomplete="name" maxlength="40"></label>' : ''}
        <label class="field col"><span>E-Mail-Adresse</span><input name="email" id="fbEmail" type="email" required autocomplete="email" inputmode="email" autocapitalize="none"></label>
        <label class="field col"><span>Passwort${up ? ' (mindestens 6 Zeichen)' : ''}</span><input name="password" type="password" required minlength="${up ? 6 : 1}" autocomplete="${up ? 'new-password' : 'current-password'}"></label>
        ${errBox}<button class="btn primary big-btn" type="submit">${up ? 'Konto erstellen' : 'Anmelden'}</button></form>
      ${up ? '' : '<button class="btn" data-act="fb-reset">Passwort vergessen?</button>'}
      <button class="btn big-btn" data-act="fb-google">Mit Google anmelden</button>
      <p class="muted small">Google-Anmeldung braucht ein Pop-up. Auf dem iPhone funktioniert sie am zuverlässigsten im Safari-Browser; in der installierten App nutzt du am besten E-Mail und Passwort.</p>
      <button class="btn small danger" data-act="fb-config-reset">Firebase-Konfiguration ändern</button></section>`;
  }
  function cardUser() {
    const u = Fam.user;
    return `<div class="alt member"><span class="alt-b"><b>${esc(u.name)}</b><small>${esc(u.email || 'Google-Konto')} · angemeldet</small></span><button class="btn" data-act="fb-signout">Abmelden</button></div>`;
  }
  function cardNoFamily() {
    return `<section class="card"><h3>👪 Familienplan</h3>${cardUser()}
      <p class="muted small">Plane gemeinsam: ein Wochenplan, eine Einkaufsliste und ein Budget für alle, mit Vorschlägen und Abstimmung – in Echtzeit auf allen Geräten.</p>
      <div class="row-actions"><button class="btn primary" data-act="fam-create">Familie gründen</button><button class="btn" data-act="fam-join">Mit Einladung beitreten</button></div></section>`;
  }
  function cardFamily() {
    const me = Fam.me(), mem = Fam.members(), admin = Fam.can('members'), meM = mem.find(m => m.id === me.id) || {}, diet = meM.diet || {}, dI = diet.intol || {};
    const meta = Fam.get('meta') || {};
    return `<section class="card"><h3>👪 ${esc(meta.name || 'Familie')}</h3>
      ${Fam.user ? cardUser() : '<p class="muted small">Nicht angemeldet – zuletzt bekannter Stand wird angezeigt.</p>'}
      <p class="muted small">Du bist <b>${esc(me.name)}</b> (${esc(Fam.roleLabel(Fam.role()) || '–')}). Admin: alles verwalten · Mitglied: Plan, Liste, Vorschläge und Abstimmung · Gast: nur ansehen. Die Rechte werden von der Datenbank erzwungen.</p>
      <div class="list tight">${mem.map(m => `<div class="alt member"><span class="alt-b"><b>${esc(m.name)}${m.id === me.id ? ' (du)' : ''}</b><small>${esc(Fam.roleLabel(m.role))}${m.diet ? ' · eigenes Ernährungsprofil' : ''}</small></span>
        ${admin && m.id !== me.id ? `<select data-act="fam-role" data-id="${esc(m.id)}" aria-label="Rolle von ${esc(m.name)}">${ROLE_OPTS.map(([k, l]) => `<option value="${k}"${m.role === k ? ' selected' : ''}>${l}</option>`).join('')}</select><button class="icon-btn" data-act="fam-remove" data-id="${esc(m.id)}" aria-label="${esc(m.name)} entfernen">${A.ICO.trash}</button>` : ''}</div>`).join('')}</div>
      ${admin ? `<div class="row-actions"><button class="btn" data-act="fam-invite" data-role="member">✉️ Mitglied einladen</button><button class="btn" data-act="fam-invite" data-role="guest">Gast einladen</button><button class="btn" data-act="fam-invites">Offene Einladungen</button></div>` : ''}
      <h3>Mein Ernährungsprofil</h3><p class="muted small">Jeder Ausschluss gilt für den gemeinsamen Plan.</p>
      ${DIETS.map(([k, l]) => `<label class="switch"><span><b>${l}</b></span><input type="checkbox" data-act="fam-diet" data-k="${k}" ${dI[k] ? 'checked' : ''}><i></i></label>`).join('')}
      <label class="field col"><span>Meine unerwünschten Lebensmittel (Komma-getrennt)</span><input type="text" data-act="fam-unwanted" value="${esc((diet.unwanted || []).join(', '))}" placeholder="z. B. Oliven" maxlength="200"></label>
      <div class="row-actions"><button class="btn" data-act="fam-sync">🔄 Jetzt abgleichen</button><button class="btn danger" data-act="fam-leave">Familie verlassen</button>${admin ? '<button class="btn danger" data-act="fam-dissolve">Familie auflösen</button>' : ''}</div>
      <p class="muted small" id="famState">Status: ${esc(Fam.status)}${Fam.last ? ' · zuletzt ' + fmtT(Fam.last) : ''}${Fam.error ? ' · ' + esc(Fam.error) : ''}</p></section>`;
  }
  function settingsFamily() {
    if (!Fam.configured()) return cardConfig();
    if (Fam.active()) return cardFamily();
    if (!Fam.authReady && (A.S.get('authHint', false) || A.S.get('pendingJoin', null))) return `<section class="card"><h3>👪 Familienplan</h3><p class="muted small">Verbinde mit Firebase …${Fam.error ? ' ' + esc(Fam.error) : ''}</p></section>`;
    return Fam.user ? cardNoFamily() : cardAuth();
  }
  A.settingsExtra = c => settingsFamily() + settingsPhotos(c);

  // Konfiguration
  A.forms['fb-config'] = f => { try { Fam.saveConfig(f.elements.cfg.value); A.toast('Firebase-Konfiguration gespeichert'); A.render(); Fam.connect().then(() => A.render(), () => A.render()); } catch (e) { showErr(e); } };
  A.acts['fb-config-reset'] = async () => { if (await A.askConfirm('Gespeicherte Firebase-Konfiguration entfernen? (Die mitgelieferte Konfiguration aus firebase-config.js bleibt.)', 'Entfernen')) { Fam.clearConfig(); A.render(); } };
  // Anmeldung
  A.acts['fb-mode'] = t => { ui.mode = t.dataset.id; A.render(); };
  A.forms['fb-signin'] = async f => { busy(f, true); try { await Fam.signIn(f.elements.email.value, f.elements.password.value); A.toast('Angemeldet'); A.render(); A.checkPendingJoin(); } catch (e) { showErr(e); busy(f, false); } };
  A.forms['fb-signup'] = async f => { busy(f, true); try { await Fam.signUp({ name: f.elements.name.value, email: f.elements.email.value, password: f.elements.password.value }); A.toast('Konto erstellt – du bist angemeldet'); A.render(); A.checkPendingJoin(); } catch (e) { showErr(e); busy(f, false); } };
  A.acts['fb-google'] = async () => { try { const u = await Fam.signInGoogle(); if (u) { A.toast('Angemeldet'); A.render(); A.checkPendingJoin(); } } catch (e) { showErr(e); } };
  A.acts['fb-reset'] = async () => { const el = $('#fbEmail'); try { await Fam.resetPassword(el ? el.value : ''); A.toast('Wenn ein Konto existiert, wurde eine E-Mail zum Zurücksetzen gesendet.', 5000); } catch (e) { showErr(e); } };
  A.acts['fb-signout'] = async () => { try { await Fam.signOut(); A.toast('Abgemeldet'); A.render(); } catch (e) { A.toast(e.message, 4000); } };

  // Familie gründen / beitreten
  A.acts['fam-create'] = () => A.openSheet(`<h2 class="sheet-title">Familie gründen</h2>
    <form data-form="fam-create" class="form">
    <label class="field col"><span>Name der Familie</span><input name="name" required maxlength="60" placeholder="z. B. Familie Müller"></label>
    <label class="field col"><span>Dein Name in der Familie</span><input name="myName" required maxlength="40" value="${esc(Fam.user ? Fam.user.name : '')}"></label>
    <p class="muted small">Du wirst Admin. Budget (${money(A.settingsRaw().budget)}), Personenzahl (${A.settingsRaw().persons}) und dein Ernährungsprofil werden aus deinen Einstellungen übernommen. Danach kannst du per Einladungslink weitere Personen hinzufügen.</p>
    ${errBox}<button class="btn primary big-btn" type="submit">Familie gründen</button></form>`, 'tall');
  A.forms['fam-create'] = async f => {
    busy(f, true);
    try { const s = A.settingsRaw(); await Fam.create({ name: f.elements.name.value, myName: f.elements.myName.value, budget: s.budget, persons: s.persons, diet: { intol: s.intol, allowSpicy: s.allowSpicy, unwanted: s.unwanted } }); A.closeSheet(true); A.toast('Familienplan gegründet. Lade jetzt Mitglieder ein.', 4000); A.render(); }
    catch (e) { showErr(e); busy(f, false); }
  };
  A.openJoin = code => { const el = A.openSheet(`<h2 class="sheet-title">Familie beitreten</h2>
    <form data-form="fam-join" class="form">
    <label class="field col"><span>Einladungslink oder -code</span><textarea name="code" rows="3" required placeholder="Einladungslink einfügen"></textarea></label>
    <label class="field col"><span>Dein Name in der Familie</span><input name="myName" required maxlength="40" value="${esc(Fam.user ? Fam.user.name : '')}"></label>
    ${errBox}<button class="btn primary big-btn" type="submit">Beitreten</button></form>`, 'tall'); if (code) el.querySelector('textarea').value = code; };
  A.acts['fam-join'] = () => A.openJoin('');
  A.forms['fam-join'] = async f => {
    busy(f, true);
    try { await Fam.join(f.elements.code.value, f.elements.myName.value); A.S.set('pendingJoin', null); A.applyFamily(); A.closeSheet(true); A.toast('Du bist dabei: ' + ((Fam.get('meta') || {}).name || 'Familie'), 4000); A.render(); }
    catch (e) { showErr(e); busy(f, false); }
  };
  /** Einladungslink wurde geöffnet (?join=…): nach Anmeldung den Beitritt anbieten */
  A.checkPendingJoin = () => {
    const code = A.S.get('pendingJoin', null); if (!code) return;
    if (!Fam.configured()) { A.st.tab = 'settings'; A.render(); A.toast('Einladung erhalten – richte zuerst Firebase ein (Familienplan-Karte).', 5000); return; }
    if (Fam.active()) { A.S.set('pendingJoin', null); return; }
    if (!Fam.signedIn()) { if (Fam.authReady) { A.st.tab = 'settings'; A.render(); A.toast('Einladung erhalten – melde dich an oder registriere dich, um beizutreten.', 5000); } return; }
    A.S.set('pendingJoin', null); A.st.tab = 'settings'; A.render(); A.openJoin(code);
  };
  A.acts['fam-invite'] = async t => {
    const b = t; b.disabled = true;
    try { const code = await Fam.invite(t.dataset.role), link = location.origin + location.pathname + '?join=' + code; A.textSheet('Einladung (' + Fam.roleLabel(t.dataset.role) + ')', link, 'Der Link gilt 48 Stunden und nur für eine Person. Er enthält keine Zugangsdaten – die Person muss sich trotzdem anmelden. Verschicke ihn nur an Vertraute.'); }
    catch (e) { A.toast(e.message, 5000); } b.disabled = false;
  };
  A.acts['fam-invites'] = async () => {
    try {
      const l = await Fam.listInvites();
      A.openSheet(`<h2 class="sheet-title">Offene Einladungen</h2>${l.length ? `<div class="list tight">${l.map(i => `<div class="alt member"><span class="alt-b"><b>${esc(Fam.roleLabel(i.role))}</b><small>gültig bis ${fmtT(i.expires)}</small></span><button class="btn danger" data-act="fam-revoke" data-id="${esc(i.code)}">Widerrufen</button></div>`).join('')}</div>` : '<p class="muted">Keine offenen Einladungen.</p>'}`);
    } catch (e) { A.toast(e.message, 5000); }
  };
  A.acts['fam-revoke'] = async t => { try { await Fam.revokeInvite(t.dataset.id); A.closeSheet(true); A.toast('Einladung widerrufen'); } catch (e) { A.toast(e.message, 4500); } };
  A.acts['fam-sync'] = () => A.famSync(false);
  A.acts['fam-leave'] = async () => { if (await A.askConfirm('Familienplan verlassen? Deine lokalen Pläne bleiben erhalten.', 'Verlassen')) { try { await Fam.removeMember(Fam.me().id); A.render(); A.toast('Familienplan verlassen'); } catch (e) { A.toast(e.message, 6000); } } };
  A.acts['fam-dissolve'] = async () => { if (await A.askConfirm('Familie für ALLE Mitglieder auflösen? Der gemeinsame Plan, die Liste und alle Vorschläge werden gelöscht. Lokale Pläne bleiben auf den Geräten erhalten.', 'Auflösen')) { try { await Fam.dissolve(); A.render(); A.toast('Familie aufgelöst'); } catch (e) { A.toast(e.message, 6000); } } };
  A.acts['fam-remove'] = async t => { if (await A.askConfirm('Dieses Mitglied aus der Familie entfernen?', 'Entfernen')) { try { await Fam.removeMember(t.dataset.id); } catch (e) { A.toast(e.message, 4500); } A.render(); } };
  A.changes['fam-role'] = t => { try { Fam.setRole(t.dataset.id, t.value); A.toast('Rolle geändert'); } catch (e) { A.toast(e.message, 4000); } A.render(); };
  function saveDiet(fn) { const m = Fam.members().find(x => x.id === Fam.me().id) || {}, d = JSON.parse(JSON.stringify(m.diet || { intol: {}, unwanted: [] })); fn(d); try { Fam.setMyDiet(d); } catch (e) { A.toast(e.message, 4000); } A.render(); }
  A.changes['fam-diet'] = t => saveDiet(d => { d.intol = d.intol || {}; d.intol[t.dataset.k] = t.checked; });
  A.changes['fam-unwanted'] = t => saveDiet(d => { d.unwanted = t.value.split(',').map(x => x.trim()).filter(Boolean); });

  // Vorschläge und Abstimmung (Startseite)
  A.homeExtra = c => {
    if (!Fam.active()) return '';
    const props = Fam.proposals(); if (!props.length) return '';
    const can = Fam.can('vote'), plan = Fam.can('plan');
    return `<section class="card"><strong>🗳 Vorschläge der Familie</strong><div class="list tight">${props.map(p => {
      const r = c.recipeMap[p.recipe]; if (!r) return '';
      return `<div class="prop"><button class="alt" data-act="open" data-id="${esc(r.id)}">${Images.tag(r, 'pic')}<span class="alt-b"><b>${esc(r.name)}</b><small>von ${esc(p.byName || '?')}${p.note ? ' · „' + esc(p.note) + '“' : ''}</small></span></button>
        <div class="vote-row"><button class="chip${p.mine === 'up' ? ' on' : ''}" data-act="fam-vote" data-id="${esc(p.id)}" data-v="up" ${can ? '' : 'disabled'} aria-label="Dafür">👍 ${p.up}</button>
        <button class="chip${p.mine === 'down' ? ' on' : ''}" data-act="fam-vote" data-id="${esc(p.id)}" data-v="down" ${can ? '' : 'disabled'} aria-label="Dagegen">👎 ${p.down}</button>
        ${plan ? `<button class="chip" data-act="fam-accept" data-id="${esc(p.id)}" data-rid="${esc(r.id)}">In den Plan</button>` : ''}
        ${plan || p.by === Fam.me().id ? `<button class="chip" data-act="fam-unprop" data-id="${esc(p.id)}" aria-label="Vorschlag entfernen">✕</button>` : ''}</div></div>`;
    }).join('')}</div></section>`;
  };
  A.acts['fam-vote'] = async t => { try { const p = Fam.proposals().find(x => x.id === t.dataset.id); Fam.vote(t.dataset.id, p && p.mine === t.dataset.v ? null : t.dataset.v); A.touch(); } catch (e) { A.toast(e.message, 3500); } A.render(); };
  A.acts['fam-unprop'] = t => { try { Fam.removeProposal(t.dataset.id); A.touch(); } catch (e) { A.toast(e.message, 3500); } A.render(); };
  A.acts['fam-accept'] = t => {
    if (!A.canPlan()) return; const p = A.plan(); if (!p) { A.toast('Erstelle zuerst einen Wochenplan.'); return; }
    const c = A.ctx(), id = t.dataset.rid; A.st.acceptPid = t.dataset.id;
    A.openSheet(`<h2 class="sheet-title">Für welchen Tag?</h2><div class="list tight">${E.DAYS.map((d, i) => { const r0 = c.recipeMap[p.days[i]], dup = E.canPlace(p, i, id); return `<button class="alt" data-act="pick" data-day="${i}" data-id="${esc(id)}"${dup ? ' disabled' : ''}><span class="alt-b"><b>${d}</b><small>${dup ? esc(dup) : 'ersetzt: ' + esc(r0 ? r0.name : '–')}</small></span></button>`; }).join('')}</div>`);
  };
  A.acts['fam-propose'] = t => {
    try { Fam.propose(t.dataset.id, ''); A.toast('Vorschlag an die Familie gesendet'); A.closeSheet(true); A.st.tab = 'home'; A.render(); } catch (e) { A.toast(e.message, 3500); }
  };
  A.sheetExtra = (r) => (Fam.active() && Fam.can('propose') ? `<div class="row-actions"><button class="btn" data-act="fam-propose" data-id="${esc(r.id)}">👪 Für Familie vorschlagen</button></div>` : '');
})();
