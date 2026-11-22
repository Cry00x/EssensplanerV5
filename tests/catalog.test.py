"""Einkaufsliste ohne Gericht (Katalog durchstöbern). Aufruf: python3 tests/catalog.test.py [url]"""
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
fails, passed = [], 0
def check(c, m):
    global passed
    if c: passed += 1
    else: fails.append(m); print('  ✗', m)
with sync_playwright() as p:
    b = p.chromium.launch(); c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, locale='de-DE', service_workers='block')
    c.route('https://commons.wikimedia.org/**', lambda r: r.fulfill(json={'query': {'pages': {}}}))
    pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.goto(URL); pg.wait_for_selector('.tab')
    pg.click('.tab[data-id=shop]'); pg.evaluate("__app.App.S.delPlan(__app.st.weekStart); __app.render()"); pg.wait_for_timeout(300)
    check(pg.locator('[data-act=cat-open]').count() == 1 and pg.locator('[data-act=generate]').count() == 1 and pg.locator('.item').count() == 0, 'ohne Plan: Liste mit Katalog-Knopf statt leerer Seite')
    pg.click('[data-act=cat-open]'); pg.wait_for_selector('#catList .alt')
    n_all = pg.locator('#catList .alt').count(); check(n_all > 50, f'Katalog zeigt viele Artikel ({n_all})')
    pg.click('#catChips [data-catcat="Fleisch"]'); check(0 < pg.locator('#catList .alt').count() < n_all and pg.locator('#catList .cat-h').count() == 1, 'Kategorie-Filter')
    pg.click('#catChips [data-catcat=""]'); pg.fill('#catQ', 'eier'); check(pg.locator('#catList .alt').count() >= 1, 'Suche findet Eier')
    row = pg.locator('#catList .alt').filter(has_text='Eier').first
    row.locator('[data-catadd]').click(); row.locator('[data-catadd]').click()
    items = pg.evaluate("__app.App.S.get('extras:'+__app.st.weekStart, [])")
    check(len(items) == 1 and items[0]['name'].startswith('2× Eier'), f'zweimal + ergibt 2× Eier: {items}')
    pg.locator('#catList .alt').filter(has_text='Eier').first.locator('[data-catdec]').click()
    items = pg.evaluate("__app.App.S.get('extras:'+__app.st.weekStart, [])"); check(len(items) == 1 and not items[0]['name'].startswith('2×'), 'minus verringert')
    pg.locator('#catList .alt').filter(has_text='Eier').first.locator('[data-catdec]').click()
    check(pg.evaluate("__app.App.S.get('extras:'+__app.st.weekStart, [])") == [], 'minus bei 1 entfernt den Artikel')
    pg.fill('#catQ', 'kartoffel'); pg.locator('#catList [data-catadd]').first.click()
    pg.evaluate("document.querySelectorAll('.sheet-wrap').forEach(e=>e.remove());document.body.classList.remove('noscroll')")
    check(pg.locator('.item .item-t b').count() == 1 and 'Richtpreise' in pg.locator('.card.cat').inner_text(), 'Artikel steht in der Liste, Preissumme sichtbar')
    pg.locator('.item .box').first.click(); check(pg.evaluate("__app.App.S.get('extras:'+__app.st.weekStart, [])[0].done") is True, 'Abhaken funktioniert')
    pg.reload(); pg.wait_for_selector('.tab'); pg.click('.tab[data-id=shop]'); check('Kartoffel' in pg.locator('.card.cat').last.inner_text(), 'bleibt nach Neustart erhalten')
    pg.click('.tab[data-id=plan]'); pg.click('.sticky-actions [data-act=generate]'); pg.wait_for_timeout(500); pg.click('.tab[data-id=shop]')
    check(pg.locator('[data-act=cat-open]').count() == 1 and pg.locator('.item').count() > 3, 'mit Plan: Katalog zusätzlich zur Gerichte-Liste, Artikel bleibt')
    # eigene Menge + Verschieben in die nächste Woche
    pg.click('.tab[data-id=shop]'); pg.click('[data-act=cat-open]'); pg.wait_for_selector('#catList .alt'); pg.fill('#catQ', 'hähnchenbrust')
    pg.locator('#catList [data-catamt]').first.click(); pg.fill('[data-catform] input', '750'); pg.click('[data-catform] button'); pg.wait_for_timeout(600)
    pg.locator('#catList [data-catamt]').first.click(); pg.fill('[data-catform] input', '250'); pg.click('[data-catform] button'); pg.wait_for_timeout(600)
    names = pg.evaluate("__app.App.S.get('extras:'+__app.st.weekStart, []).map(e=>e.name)")
    check(any(n.startswith('1000 g Hähnchenbrust') for n in names), f'eigene Menge wird summiert: {names}')
    pg.evaluate("document.querySelectorAll('.sheet-wrap').forEach(e=>e.remove());document.body.classList.remove('noscroll')")
    check('Richtpreise' in pg.locator('.card.cat').last.inner_text(), 'Preissumme auch für Mengen')
    n0 = len(names); pg.click('[data-act=x-carry]'); pg.wait_for_timeout(800)
    nxt = pg.evaluate("__app.App.S.get('extras:'+__app.App.E.addWeeks(__app.st.weekStart,1), []).map(e=>e.name)")
    left = pg.evaluate("__app.App.S.get('extras:'+__app.st.weekStart, []).map(e=>e.name)")
    check(len(nxt) == n0 - 1 and len(left) == 1, f'offene Artikel in die nächste Woche verschoben: {nxt} / {left}')
    check(not errs, f'keine JS-Fehler {errs[:2]}'); b.close()
print(f'\n{passed} bestanden, {len(fails)} fehlgeschlagen'); sys.exit(1 if fails else 0)
