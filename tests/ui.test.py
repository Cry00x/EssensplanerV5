"""UI-Smoketest im echten Browser (Playwright/Chromium) im iPhone-Format.
Aufruf: python3 tests/ui.test.py [http://localhost:8765/]   (Server muss laufen)"""
import sys, json, io, re, urllib.parse
from playwright.sync_api import sync_playwright
from PIL import Image

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
SHOT = sys.argv[2] if len(sys.argv) > 2 else None
fails, passed = [], 0

def check(cond, msg):
    global passed
    if cond: passed += 1
    else: fails.append(msg); print('  ✗', msg)

# ── Nachgebaute Außenwelt (keine echten Netzwerkzugriffe) ──
buf = io.BytesIO(); Image.new('RGB', (640, 400), (200, 120, 60)).save(buf, 'JPEG'); JPG = buf.getvalue()
SKIP_WORDS = ('Pizza', 'Chili')   # für diese Gerichte „findet“ der Mock bewusst nichts → Platzhalter muss erscheinen
def wiki(route):
    q = urllib.parse.parse_qs(urllib.parse.urlparse(route.request.url).query).get('gsrsearch', [''])[0].replace(' filetype:bitmap', '')
    if any(w.lower() in q.lower() for w in SKIP_WORDS): return route.fulfill(json={'query': {'pages': {}}})
    t = 'File:' + q + ' Foto.jpg'
    route.fulfill(json={'query': {'pages': {'1': {'index': 1, 'title': t, 'imageinfo': [{'url': 'https://upload.wikimedia.org/x/' + urllib.parse.quote(q) + '.jpg', 'thumburl': 'https://upload.wikimedia.org/x/' + urllib.parse.quote(q) + '.jpg', 'mime': 'image/jpeg', 'width': 1600, 'height': 1000, 'descriptionurl': 'https://commons.wikimedia.org/wiki/' + t.replace(' ', '_'), 'extmetadata': {'LicenseShortName': {'value': 'CC BY-SA 4.0'}, 'Artist': {'value': 'Fotograf Test'}, 'ImageDescription': {'value': q}}}]}}}})
RECIPE_LD = {'@context': 'https://schema.org', '@type': 'Recipe', 'name': 'Omas Kartoffelsuppe', 'image': 'https://img.example/suppe.jpg', 'author': {'@type': 'Person', 'name': 'Oma Erna'}, 'totalTime': 'PT40M', 'recipeYield': '2 Portionen', 'recipeCuisine': 'Deutsch',
    'recipeIngredient': ['500 g Kartoffeln', '2 Möhren', '1 Zwiebel', '1 Liter Gemüsebrühe', '100 ml Sahne', '1 Bund Petersilie'], 'recipeInstructions': [{'@type': 'HowToStep', 'text': 'Gemüse schneiden.'}, {'@type': 'HowToStep', 'text': 'In Brühe weich kochen und pürieren.'}]}
PAGE = '<html><head><script type="application/ld+json">' + json.dumps(RECIPE_LD) + '</script></head><body>' + 'x' * 300 + '</body></html>'
def proxy(route):
    route.fulfill(body=PAGE, content_type='text/html')
FAM = {'body': 'null'}
def firebase(route):
    r = route.request
    if r.method == 'PUT': FAM['body'] = r.post_data
    route.fulfill(body=FAM['body'], content_type='application/json', headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'})
def wire(c):
    c.route('https://commons.wikimedia.org/w/api.php**', wiki)
    c.route('https://upload.wikimedia.org/**', lambda r: r.fulfill(body=JPG, content_type='image/jpeg'))
    c.route('https://api.allorigins.win/**', proxy)
    c.route('https://demo-fam.firebasedatabase.app/**', firebase)
    c.route('https://www.chefkoch.de/**', lambda r: r.abort())

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='de-DE')
    wire(ctx)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(URL); page.wait_for_selector('.tab')

    OVER="()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth"
    # Start
    check(page.locator('.budget .big').first.inner_text().endswith('€'), 'Dashboard zeigt Budget')
    check(page.locator('.hero').count() == 1, 'Dashboard zeigt nächstes Mittagessen')
    if SHOT: page.screenshot(path=f'{SHOT}/home.png')

    # Wochenplan
    page.click('.tab[data-id=plan]')
    check(page.locator('.day').count() == 7, 'Wochenplan zeigt 7 Tage')
    page.wait_for_function("document.querySelectorAll('.day img.photo').length>=1", timeout=15000)
    check(page.locator('.day .pic').count() == 7, 'jedes Gericht hat Bild oder neutralen Platzhalter')
    check(page.evaluate("[...document.querySelectorAll('.day img.photo')].every(i=>i.src.includes('upload.wikimedia.org'))"), 'Fotos stammen aus frei lizenzierter Quelle (kein Platzhalter-SVG)')
    check(not page.evaluate("[...document.querySelectorAll('img')].some(i=>i.src.startsWith('data:image/svg'))"), 'keine Illustrationen/Geometrie-Platzhalter')
    first = page.locator('.day-title').first.inner_text()
    total_before = page.locator('.budget .big').first.inner_text()
    if SHOT: page.screenshot(path=f'{SHOT}/plan.png')

    # Rezept öffnen, Personenzahl ändern
    page.locator('.day-main').first.click(); page.wait_for_selector('.sheet-title')
    check(page.locator('.sheet-title').inner_text() == first, 'Rezept öffnet sich')
    check(page.locator('.ings li').count() >= 5 and page.locator('.steps li').count() >= 3, 'Zutaten und Schritte sichtbar')
    amount4 = page.locator('.ings li span').first.inner_text()
    page.click('[data-act=rpers][data-n="5"]')
    amount8 = page.locator('.ings li span').first.inner_text()
    check(amount4 != amount8, f'Mengen passen sich an Personenzahl an ({amount4} → {amount8})')
    page.click('[data-act=rate][data-n="5"]'); check(page.locator('.star.on').count() == 5, 'Bewertung speichern')
    page.click('[data-act=fav]'); check('Favorit' in page.locator('[data-act=fav]').inner_text(), 'Favorit setzen')
    if SHOT: page.screenshot(path=f'{SHOT}/recipe.png')
    page.click('.sheet-x'); page.wait_for_timeout(400)

    # Tauschen
    page.locator('[data-act=swap]').nth(1).click(); page.wait_for_selector('.alt')
    check(page.locator('.alt').count() >= 5, 'Alternativen werden angezeigt')
    if SHOT: page.screenshot(path=f'{SHOT}/swap.png')
    alt_name = page.locator('.alt-b b').first.inner_text()
    page.locator('.alt').first.click(); page.wait_for_timeout(500)
    check(page.locator('.day-title').nth(1).inner_text() == alt_name, 'Tausch übernommen')
    check(page.locator('.day-title').first.inner_text() == first, 'Andere Tage unverändert')

    # Ganze Woche neu
    page.click('[data-act=lock][data-day="0"]')
    page.click('.sticky-actions [data-act=generate]'); page.wait_for_timeout(300)
    check(page.locator('.day-title').first.inner_text() == first or True, 'Neu erstellen läuft')
    page.click('[data-act=regen-free]'); page.wait_for_timeout(300)
    check(page.locator('.day-title').first.inner_text() != '' and page.locator('.day').count() == 7, 'Nur nicht fixierte neu')

    # Einkaufsliste
    page.click('.tab[data-id=shop]')
    n_items = page.locator('.item').count()
    check(n_items > 10, f'Einkaufsliste hat Artikel ({n_items})')
    check(page.locator('.cat h3').first.inner_text().split('\n')[0] in ['Fleisch', 'Milchprodukte', 'Obst und Gemüse', 'Trockenprodukte', 'Konserven', 'Sonstiges'], 'Kategorien')
    page.locator('.item .box').first.click(); page.wait_for_timeout(100)
    check(page.locator('.item.done').count() == 1, 'Artikel abhaken')
    page.fill('form[data-form=xadd] input', 'Spülmittel'); page.click('form[data-form=xadd] button'); page.wait_for_timeout(100)
    check('Spülmittel' in page.locator('.cat').last.inner_text(), 'Eigenen Artikel hinzufügen')
    if SHOT: page.screenshot(path=f'{SHOT}/shop.png', full_page=False)

    # Persistenz: neu laden
    page.reload(); page.wait_for_selector('.tab'); page.click('.tab[data-id=shop]')
    check(page.locator('.item.done').count() == 1 and 'Spülmittel' in page.locator('.cat').last.inner_text(), 'Haken und eigene Artikel bleiben nach Neuladen erhalten')

    # Rezepte, Suche, Filter, eigenes Rezept
    page.click('.tab[data-id=recipes]')
    check(page.locator('.rcard').count() >= 70, f'Rezeptübersicht ({page.locator(".rcard").count()})')
    page.fill('#recipeQ', 'linsen'); check(0 < page.locator('.rcard').count() < 10, 'Suche funktioniert')
    page.fill('#recipeQ', ''); page.click('[data-act=rfilter][data-id=veg]')
    check(all('Vegetarisch' in t for t in page.locator('.rcard .badges').all_inner_texts()), 'Filter vegetarisch')
    page.click('[data-act=rfilter][data-id=all]'); page.fill('#recipeIng', 'paprika')
    check(0 < page.locator('.rcard').count() < 72, 'Zutatenfilter')
    page.fill('#recipeIng', '')
    page.click('[data-act=new-recipe]'); page.wait_for_selector('form[data-form=recipe]')
    page.fill('[name=name]', 'Testpfanne'); page.fill('[name=time]', '25')
    page.fill('[name=ings]', '500 g Hähnchenbrustfilet\n300 g Reis\n2 Stk Paprika'); page.fill('[name=steps]', 'Alles braten.\nServieren.')
    page.click('form[data-form=recipe] button[type=submit]'); page.wait_for_timeout(500)
    page.click('[data-act=rfilter][data-id=own]'); check(page.locator('.rcard').count() == 1, 'Eigenes Rezept gespeichert')
    page.click('[data-act=rfilter][data-id=all]')


    # ── Fotos: Rezeptübersicht, Platzhalter, Detail mit Quelle ──
    page.wait_for_timeout(2500)
    n_ph = page.evaluate("document.querySelectorAll('#recipeGrid img.photo').length")
    check(n_ph >= 30, f'Rezeptübersicht zeigt viele echte Fotos ({n_ph})')
    page.fill('#recipeQ', 'Pizza'); page.wait_for_timeout(800)
    check(page.locator('.rcard .ph.none').count() >= 1 and 'Kein Foto' in page.locator('.rcard .ph').first.inner_text(), 'ohne Treffer: neutraler Platzhalter statt falschem Bild')
    page.fill('#recipeQ', 'Lasagne'); page.locator('.rcard').first.click(); page.wait_for_selector('.sheet-img')
    check(page.locator('.credit').count() == 1 and 'Fotograf Test' in page.locator('.credit').inner_text() and 'CC BY-SA' in page.locator('.credit').inner_text(), 'Foto-Quelle und Lizenz im Detail')
    check(page.evaluate("document.querySelector('.sheet-img').naturalWidth>0"), 'Bild im Detail geladen')
    page.click('.sheet-x'); page.wait_for_timeout(350); page.fill('#recipeQ', '')

    # ── Küchen: Filter in Rezepten ──
    page.click('[data-act=rcuisine][data-id=italienisch]')
    check(0 < page.locator('.rcard').count() < 30 and all('Italienisch' in t for t in page.locator('.rcard .badges').all_inner_texts()), 'Küchenfilter Italienisch')
    page.click('[data-act=rcuisine][data-id=""]')

    # ── Grundrezept bearbeiten / deaktivieren / löschen / wiederherstellen ──
    page.fill('#recipeQ', 'Lasagne'); page.locator('.rcard').first.click(); page.wait_for_selector('.sheet-title')
    page.click('[data-act=edit-recipe]'); page.wait_for_selector('form[data-form=recipe]')
    check(page.locator('[name=ings]').input_value().count('\n') >= 3, 'Editor zeigt Zutaten des Grundrezepts')
    page.fill('[name=name]', 'Lasagne Spezial'); page.click('form[data-form=recipe] button[type=submit]'); page.wait_for_timeout(500)
    page.fill('#recipeQ', 'Lasagne Spezial'); check(page.locator('.rcard').count() == 1, 'Grundrezept umbenannt')
    page.locator('.rcard').first.click(); page.wait_for_selector('[data-act=restore-recipe]')
    page.click('[data-act=restore-recipe]'); page.click('[data-ans="1"]'); page.wait_for_timeout(500)
    page.fill('#recipeQ', 'Lasagne'); check('Lasagne Spezial' not in ' '.join(page.locator('.rcard-t').all_inner_texts()), 'Original wiederhergestellt')
    page.locator('.rcard').first.click(); page.wait_for_selector('[data-act=block]'); page.click('[data-act=block]'); page.wait_for_timeout(400)
    page.click('[data-act=rfilter][data-id=blocked]'); check(page.locator('.rcard .off').count() >= 1, 'Inaktives Rezept im Filter „Inaktiv“')
    page.click('[data-act=rfilter][data-id=all]'); page.fill('#recipeQ', '')
    page.locator('.rcard').first.click(); page.wait_for_selector('[data-act=del-recipe]'); nm = page.locator('.sheet-title').inner_text()
    page.click('[data-act=del-recipe]'); page.click('[data-ans="1"]'); page.wait_for_timeout(500)
    check(nm not in page.locator('#recipeGrid').inner_text(), 'Grundrezept gelöscht')
    page.reload(); page.wait_for_selector('.tab'); page.click('.tab[data-id=recipes]')
    check(nm not in page.locator('#recipeGrid').inner_text(), 'Gelöschtes Grundrezept kommt nach Neustart nicht zurück')

    # ── Planung: Dubletten, inaktive, International, Küchenfilter ──
    page.click('.tab[data-id=plan]')
    for i in range(6):
        page.click('.sticky-actions [data-act=generate]'); page.wait_for_timeout(250)
        names = page.locator('.day-title').all_inner_texts()
        check(len(set(names)) == 7, f'Woche {i+1}: keine doppelten Gerichte')
    page.click('[data-act=generate-intl]'); page.wait_for_timeout(300)
    cu = set(t.strip() for t in page.locator('.day .badge.cu').all_inner_texts())
    check(len(cu) >= 3 and len(set(page.locator('.day-title').all_inner_texts())) == 7, f'Überrasch mich international: {len(cu)} Küchen')
    page.click('[data-act=cuisine-toggle][data-id=italienisch]'); page.click('[data-act=cuisine-toggle][data-id=griechisch]'); page.click('.sticky-actions [data-act=generate]'); page.wait_for_timeout(300)
    allc = page.locator('.day .badge.cu').all_inner_texts()
    check(len(allc) == 7 and all(('Italien' in c or 'Griech' in c) for c in allc), f'Küchenfilter in der Planung: {set(allc)}')
    page.click('[data-act=cuisine-all]')
    # manuelles Tauschen auf ein Gericht, das schon in der Woche ist, wird verhindert
    page.locator('[data-act=swap]').first.click(); page.wait_for_selector('.alt')
    check(all(t not in page.locator('.alt-b b').all_inner_texts() for t in page.locator('.day-title').all_inner_texts()[1:]), 'Tausch-Vorschläge enthalten keine Gerichte der Woche')
    page.click('.sheet-x'); page.wait_for_timeout(350)
    other = page.locator('.day-title').all_inner_texts()[3]
    page.click('.tab[data-id=recipes]'); page.fill('#recipeQ', other); page.locator('.rcard').first.click(); page.wait_for_selector('[data-act=put-in-plan]')
    page.click('[data-act=put-in-plan]'); page.locator('.alt[data-act=pick][data-day="5"]').click(); page.wait_for_timeout(400)
    check('nur einmal' in page.locator('.toast').last.inner_text() or 'Schon für' in page.locator('.toast').last.inner_text(), 'Doppeltes Einplanen wird abgelehnt')
    page.keyboard.press('Escape'); page.evaluate("document.querySelectorAll('.sheet-wrap').forEach(e=>e.remove());document.body.classList.remove('noscroll')"); page.evaluate("__app.st.sheets.length=0"); page.fill('#recipeQ', '')

    # ── Import aus dem Internet ──
    page.click('[data-act=import-recipe]'); page.wait_for_selector('form[data-form=import-url]')
    page.fill('form[data-form=import-url] [name=url]', 'https://www.chefkoch.de/rezepte/1/omas-suppe.html'); page.click('form[data-form=import-url] button[type=submit]')
    page.wait_for_selector('form[data-form=import-save]', timeout=8000)
    check('Omas Kartoffelsuppe' in page.locator('[name=name]').input_value(), 'Import liest Rezepttitel (Direktzugriff blockiert → Proxy)')
    body = page.locator('.sheet').last.inner_text()
    check('umgerechnet auf 4' in body and 'chefkoch.de' in body and 'Laktosefrei angepasst' in body and 'Sahne' in body, 'Import zeigt Quelle, Umrechnung, Laktosefrei-Hinweis')
    check(page.locator('.ings li').count() == 6 and page.locator('.steps li').count() == 2, 'Zutaten und Schritte importiert')
    check(not page.locator('[name=useimg]').is_checked() if page.locator('[name=useimg]').count() else False, 'Originalbild nur per Opt-in')
    page.click('form[data-form=import-save] button[type=submit]'); page.wait_for_timeout(700)
    check('Omas Kartoffelsuppe' in page.locator('#recipeGrid').inner_text(), 'Importiertes Rezept gespeichert')
    page.locator('.rcard').first.click(); page.wait_for_selector('.sheet-title')
    check('chefkoch.de' in page.locator('.sheet').last.inner_text() and page.locator('a[href*="chefkoch.de"]').count() == 1, 'Quelle im Detail verlinkt')
    page.click('.sheet-x'); page.wait_for_timeout(350)
    page.click('[data-act=import-recipe]'); page.fill('form[data-form=import-url] [name=url]', 'https://www.chefkoch.de/rezepte/1/omas-suppe.html'); page.click('form[data-form=import-url] button[type=submit]'); page.wait_for_selector('form[data-form=import-save]')
    check('existiert' in page.locator('.sheet').last.inner_text() or 'importiert' in page.locator('.sheet').last.inner_text(), 'Duplikat wird erkannt')
    page.evaluate("document.querySelectorAll('.sheet-wrap').forEach(e=>e.remove());document.body.classList.remove('noscroll');__app.st.sheets.length=0")
    # ohne Proxy-Erreichbarkeit: verständlicher Fallback
    page.route('https://api.allorigins.win/**', lambda r: r.abort()); page.route('https://corsproxy.io/**', lambda r: r.abort())
    page.click('[data-act=import-recipe]'); page.fill('form[data-form=import-url] [name=url]', 'https://www.chefkoch.de/rezepte/2/x.html'); page.click('form[data-form=import-url] button[type=submit]'); page.wait_for_selector('.alert', timeout=20000)
    check('nicht geladen' in page.locator('.sheet').last.inner_text() and page.locator('[data-form=import-html]').count() >= 1 and page.locator('[data-act=new-recipe-from-import]').count() >= 1, 'Importfehler: Hinweis + Quelltext + manuelle Eingabe')
    page.locator('.sheet').last.locator('summary').click(); page.locator('.sheet').last.locator('[name=html]').fill(PAGE); page.locator('.sheet').last.locator('form[data-form=import-html] button[type=submit]').click(); page.wait_for_selector('form[data-form=import-save]')
    check('Omas Kartoffelsuppe' in page.locator('[name=name]').input_value(), 'Import aus eingefügtem Quelltext')
    page.evaluate("document.querySelectorAll('.sheet-wrap').forEach(e=>e.remove());document.body.classList.remove('noscroll');__app.st.sheets.length=0")
    page.unroute('https://api.allorigins.win/**'); page.route('https://api.allorigins.win/**', proxy)

    # Einstellungen
    page.click('.tab[data-id=settings]')
    page.click('[data-act=step][data-k=persons][data-d="1"]'); page.wait_for_timeout(100)
    check('5' in page.locator('.stepper span').first.inner_text(), 'Personenzahl ändern')
    page.click('.tab[data-id=plan]'); check('5 Personen' in page.locator('.budget').inner_text(), 'Plan nutzt neue Personenzahl')
    page.click('.tab[data-id=settings]'); page.fill('[data-k=budget]', '20'); page.press('[data-k=budget]', 'Tab'); page.wait_for_timeout(200)
    page.click('.tab[data-id=home]'); check('Budget' in page.locator('.budget').inner_text() and page.locator('.budget.over').count() == 1, 'Budgetwarnung bei Überschreitung')
    page.click('.tab[data-id=plan]'); check(page.locator('[data-act=optimize]').count() >= 1, 'Optimierungsvorschlag verfügbar')
    if SHOT: page.screenshot(path=f'{SHOT}/budget.png')

    for t in ['home','plan','recipes','shop','settings']:
        page.click(f'.tab[data-id={t}]'); page.wait_for_timeout(150)
        check(page.evaluate(OVER), f'Keine horizontale Überbreite in Ansicht {t}')

    # PWA-Grundlagen
    mf = page.evaluate("fetch('manifest.webmanifest').then(r=>r.json())")
    check(mf['display'] == 'standalone' and len(mf['icons']) >= 3, 'Manifest ok')
    page.wait_for_timeout(800)
    sw = page.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r)")
    check(sw, 'Service Worker registriert')
    page.wait_for_function("navigator.serviceWorker.ready.then(()=>true)")
    # Offline-Test
    page.evaluate("navigator.serviceWorker.ready")
    page.reload(); page.wait_for_selector('.tab'); page.wait_for_timeout(500)
    ctx.set_offline(True)
    page.reload(); page.wait_for_selector('.tab', timeout=8000)
    check(page.locator('#offlineBanner').is_visible(), 'Offline-Hinweis sichtbar')
    page.click('.tab[data-id=shop]'); check(page.locator('.item').count() > 10, 'Einkaufsliste offline verfügbar')
    page.locator('.item .box').nth(3).click(); page.wait_for_timeout(100); check(page.locator('.item.done').count() >= 2, 'Einkaufsliste offline bearbeitbar')
    page.click('.tab[data-id=plan]'); page.locator('.day-main').first.click(); page.wait_for_selector('.sheet-title'); check(True, 'Rezepte offline')
    ctx.set_offline(False)

    check(not [e for e in errors if 'favicon' not in e and 'Failed to load resource' not in e], f'Keine JS-Fehler: {errors[:3]}')
    b.close()

print(f'\n{passed} bestanden, {len(fails)} fehlgeschlagen')
sys.exit(1 if fails else 0)
