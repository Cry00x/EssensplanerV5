"""Oberfläche des Familienplans im Browser – gegen die SIMULATION von Firebase (tests/lib/fakefb.js), NICHT gegen echtes Firebase.
Jedes „Gerät“ hat einen eigenen simulierten Server; der Datenbestand wird beim Start vom vorherigen Gerät kopiert (Seed).
Aufruf: python3 tests/firebase-ui.test.py [url] [screenshot-ordner]"""
import sys, json, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
SHOT = sys.argv[2] if len(sys.argv) > 2 else None
FAKE = (ROOT / 'lib' / 'fakefb.js').read_text(); RULES = (ROOT.parent / 'database.rules.json').read_text()
CFG_TEXT = '''const firebaseConfig = {
  apiKey: "AIzaSyTESTTESTTESTTESTTESTTESTTESTTEST0",
  authDomain: "essensplaner-family.firebaseapp.com",
  databaseURL: "https://essensplaner-family-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "essensplaner-family"
};'''
fails, passed = [], 0
def check(c, m):
    global passed
    if c: passed += 1
    else: fails.append(m); print('  ✗', m)
def device(b, seed=None, suffix=''):
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='de-DE', service_workers='block')
    c.route('https://commons.wikimedia.org/**', lambda r: r.fulfill(json={'query': {'pages': {}}}))
    c.add_init_script(FAKE + f"\nwindow.__srv = FakeFirebase.makeServer({RULES}); " + (f"(function(s){{ __srv.db = s.db; __srv.users = s.users; }})({json.dumps(seed)});" if seed else '') + "\nwindow.FIREBASE_SDK = __srv.sdk(); window.__tick = 0;")
    pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.goto(URL + suffix); pg.wait_for_selector('.tab'); return c, pg, errs
def state(pg): return pg.evaluate("({db: __srv.db, users: __srv.users.map(u=>({uid:u.uid,email:u.email,password:u.password,displayName:u.displayName}))})")
def close_sheets(pg): pg.evaluate("document.querySelectorAll('.sheet-wrap').forEach(e=>e.remove());document.body.classList.remove('noscroll');__app.st.sheets.length=0")
def toast(pg): return pg.locator('.toast').last.inner_text()

with sync_playwright() as p:
    b = p.chromium.launch()
    # ───── Gerät A (Admin) ─────
    ca, A, ea = device(b)
    A.click('.tab[data-id=settings]')
    check('firebaseConfig' in A.locator('form[data-form=fb-config]').locator('xpath=..').inner_text() or A.locator('form[data-form=fb-config]').count() == 1, 'ohne API-Schlüssel: Konfigurationsformular statt Fehler „Load failed“')
    A.fill('[name=cfg]', 'apiKey: "xyz"'); A.click('form[data-form=fb-config] button[type=submit]'); check('fehlt' in A.locator('#fbErr').inner_text() or 'API' in A.locator('#fbErr').inner_text(), 'unvollständige Konfiguration wird erklärt')
    A.fill('[name=cfg]', CFG_TEXT); A.click('form[data-form=fb-config] button[type=submit]'); A.wait_for_selector('form[data-form=fb-signin]')
    check(A.locator('form[data-form=fb-signin]').count() == 1, 'Konfiguration gespeichert → Anmeldeformular')
    if SHOT: A.screenshot(path=f'{SHOT}/fb-login.png', full_page=True)
    A.click('[data-act=fb-mode][data-id=up]'); A.fill('[name=name]', 'Anna'); A.fill('[name=email]', 'anna@example.de'); A.fill('[name=password]', 'geheim123')
    A.click('form[data-form=fb-signup] button[type=submit]'); A.wait_for_selector('[data-act=fam-create]', timeout=8000)
    check('Anna' in A.locator('.card').filter(has_text='angemeldet').first.inner_text() and 'anna@example.de' in A.locator('.card').filter(has_text='angemeldet').first.inner_text(), 'Registrierung: angemeldeter Benutzer wird angezeigt')
    A.click('[data-act=fb-signout]'); A.wait_for_selector('[data-act=fb-mode][data-id=in]'); A.click('[data-act=fb-mode][data-id=in]'); A.wait_for_selector('form[data-form=fb-signin]')
    A.fill('[name=email]', 'anna@example.de'); A.fill('[name=password]', 'falsch'); A.click('form[data-form=fb-signin] button[type=submit]'); A.wait_for_function("document.querySelector('#fbErr') && document.querySelector('#fbErr').textContent.length>0")
    check('Passwort ist falsch' in A.locator('#fbErr').inner_text(), 'falsches Passwort: deutsche Fehlermeldung')
    A.fill('[name=password]', ''); A.click('[data-act=fb-reset]'); A.wait_for_timeout(300)
    A.fill('[name=email]', 'anna@example.de'); A.click('[data-act=fb-reset]'); A.wait_for_timeout(300)
    check('Zurücksetzen' in toast(A) and 'anna@example.de' in A.evaluate("__srv.resets"), 'Passwort zurücksetzen')
    A.fill('[name=password]', 'geheim123'); A.click('form[data-form=fb-signin] button[type=submit]'); A.wait_for_selector('[data-act=fam-create]')
    A.click('[data-act=fb-signout]'); A.wait_for_selector('[data-act=fb-google]'); A.wait_for_timeout(700); A.evaluate("__srv.googleMode='closed'"); A.click('[data-act=fb-google]'); A.wait_for_timeout(600)
    check('abgebrochen' in A.locator('#fbErr').inner_text(), 'Google abgebrochen: Meldung')
    A.evaluate("__srv.googleMode='ok'"); A.click('[data-act=fb-google]'); A.wait_for_selector('[data-act=fam-create]'); A.click('[data-act=fb-signout]'); A.wait_for_selector('form[data-form=fb-signin]')
    A.fill('[name=email]', 'anna@example.de'); A.fill('[name=password]', 'geheim123'); A.click('form[data-form=fb-signin] button[type=submit]'); A.wait_for_selector('[data-act=fam-create]')
    # Familie gründen
    A.click('[data-act=fam-create]'); A.wait_for_selector('form[data-form=fam-create]'); A.fill('[name=name]', 'Familie Müller'); A.click('form[data-form=fam-create] button[type=submit]'); A.wait_for_selector('.member', timeout=8000)
    check('Admin' in A.locator('.card').filter(has_text='Du bist').first.inner_text(), 'Familie gegründet, Anna ist Admin')
    fid = A.evaluate("Object.keys(__srv.db.families)[0]"); check(bool(fid) and A.evaluate("__srv.db.families[Object.keys(__srv.db.families)[0]].meta.budget") == 120, 'Familienbudget aus den Einstellungen übernommen')
    # Einladungen
    A.click('[data-act=fam-invite][data-role=member]'); A.wait_for_selector('#copyArea'); link_m = A.locator('#copyArea').input_value(); close_sheets(A)
    A.click('[data-act=fam-invite][data-role=guest]'); A.wait_for_selector('#copyArea'); link_g = A.locator('#copyArea').input_value(); close_sheets(A)
    check('?join=' in link_m and 'AIza' not in link_m and 'apiKey' not in link_m and link_m != link_g, 'Einladungslinks enthalten nur einen Zufallscode, keine Zugangsdaten')
    A.click('[data-act=fam-invites]'); A.wait_for_selector('[data-act=fam-revoke]'); check(A.locator('[data-act=fam-revoke]').count() == 2, 'offene Einladungen sichtbar'); close_sheets(A)
    # Plan und Einkaufsliste landen in der Datenbank
    A.click('.tab[data-id=plan]'); A.click('.sticky-actions [data-act=generate]'); A.wait_for_timeout(500)
    plans = A.evaluate("__srv.db.families[Object.keys(__srv.db.families)[0]].plans"); check(plans and len(list(plans.values())[0]['days']) == 7, 'Wochenplan wird in der Datenbank gespeichert')
    A.click('.tab[data-id=shop]'); A.locator('.item .box').first.click(); A.wait_for_timeout(400)
    check(A.evaluate("Object.values(__srv.db.families[Object.keys(__srv.db.families)[0]].checks||{}).length") == 1, 'Abhaken wird in der Datenbank gespeichert')
    A.click('.tab[data-id=settings]'); A.fill('[data-k=budget]', '140'); A.press('[data-k=budget]', 'Tab'); A.wait_for_timeout(400)
    check(A.evaluate("__srv.db.families[Object.keys(__srv.db.families)[0]].meta.budget") == 140, 'Admin ändert gemeinsames Budget')
    if SHOT: A.screenshot(path=f'{SHOT}/fb-family.png', full_page=True)
    seedA = state(A)

    # ───── Gerät B (Mitglied) tritt über Link bei ─────
    cb, B, eb = device(b, seedA, '?join=' + link_m.split('?join=')[1])
    B.click('.tab[data-id=settings]'); B.evaluate("1"); B.wait_for_timeout(400)
    check(B.locator('form[data-form=fb-config]').count() == 1, 'neues Gerät: Konfiguration nötig (wird nur lokal gespeichert)')
    B.fill('[name=cfg]', CFG_TEXT); B.click('form[data-form=fb-config] button[type=submit]'); B.wait_for_selector('form[data-form=fb-signup], form[data-form=fb-signin]')
    B.click('[data-act=fb-mode][data-id=up]'); B.fill('[name=name]', 'Ben'); B.fill('[name=email]', 'ben@example.de'); B.fill('[name=password]', 'geheim123'); B.click('form[data-form=fb-signup] button[type=submit]')
    B.wait_for_selector('form[data-form=fam-join]', timeout=8000)
    check(link_m.split('?join=')[1] in B.locator('[name=code]').input_value(), 'Einladungslink wird nach der Registrierung automatisch vorgeschlagen')
    B.click('form[data-form=fam-join] button[type=submit]'); B.wait_for_selector('.member', timeout=8000)
    check('Mitglied' in B.locator('.card').filter(has_text='Du bist').first.inner_text() and B.locator('.list.tight .member').count() == 2, 'Ben ist Mitglied; sieht beide Mitglieder')
    B.click('.tab[data-id=plan]'); B.wait_for_timeout(400); check(B.locator('.day-title').count() == 7, 'Familienplan von Anna ist bei Ben angekommen')
    B.click('.tab[data-id=settings]'); B.fill('[data-k=budget]', '999'); B.press('[data-k=budget]', 'Tab'); B.wait_for_timeout(300)
    check('Admin' in toast(B) and B.evaluate("__srv.db.families[Object.keys(__srv.db.families)[0]].meta.budget") == 140, 'Mitglied kann Budget nicht ändern')
    check(B.locator('[data-act=fam-invite]').count() == 0 and B.locator('[data-act=fam-dissolve]').count() == 0, 'Mitglied sieht keine Admin-Knöpfe')
    # Einladung ist verbraucht
    check(link_m.split('?join=')[1] not in json.dumps(B.evaluate("Object.keys(__srv.db.invites||{})")), 'Einladung nach dem Beitritt gelöscht')
    seedB = state(B)

    # ───── Gerät C (Gast) ─────
    cc, C, ec = device(b, seedB, '?join=' + link_g.split('?join=')[1])
    C.click('.tab[data-id=settings]'); C.fill('[name=cfg]', CFG_TEXT); C.click('form[data-form=fb-config] button[type=submit]'); C.wait_for_selector('form[data-form=fb-signin]')
    C.click('[data-act=fb-mode][data-id=up]'); C.fill('[name=name]', 'Cleo'); C.fill('[name=email]', 'cleo@example.de'); C.fill('[name=password]', 'geheim123'); C.click('form[data-form=fb-signup] button[type=submit]')
    C.wait_for_selector('form[data-form=fam-join]'); C.click('form[data-form=fam-join] button[type=submit]'); C.wait_for_selector('.member', timeout=8000)
    check('Gast' in C.locator('.card').filter(has_text='Du bist').first.inner_text(), 'Cleo ist Gast')
    C.click('.tab[data-id=plan]'); before = C.locator('.day-title').all_inner_texts(); C.click('.sticky-actions [data-act=generate]'); C.wait_for_timeout(400)
    check(C.locator('.day-title').all_inner_texts() == before and 'darfst' in toast(C), 'Gast kann den Plan nicht ändern')
    C.click('.tab[data-id=shop]'); C.locator('.item .box').nth(3).click(); C.wait_for_timeout(300); check('ansehen' in toast(C), 'Gast kann die Liste nicht ändern')
    C.click('.tab[data-id=recipes]'); C.fill('#recipeQ', 'Lasagne'); C.locator('.rcard').first.click(); C.wait_for_selector('.sheet-title'); check(C.locator('[data-act=fam-propose]').count() == 0, 'Gast sieht „Vorschlagen“ nicht')
    if SHOT: C.screenshot(path=f'{SHOT}/fb-guest.png')
    check(not [e for e in ea + eb + ec if e], f'Keine JS-Fehler: {(ea + eb + ec)[:3]}')
    b.close()
print(f'\n{passed} bestanden, {len(fails)} fehlgeschlagen'); sys.exit(1 if fails else 0)
