"""Migration: Daten der Version 1 (ohne Küchen, 58 Rezepte) bleiben erhalten, Neues kommt dazu."""
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
fails, passed = [], 0
def check(c, m):
    global passed
    if c: passed += 1
    else: fails.append(m); print('  ✗', m)
with sync_playwright() as p:
    b = p.chromium.launch(); c = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}); c.route('https://commons.wikimedia.org/**', lambda r: r.fulfill(json={'query': {'pages': {}}}))
    pg = c.new_page(); pg.goto(URL); pg.wait_for_selector('.tab')
    # Zustand der alten Version herstellen
    pg.evaluate("""async()=>{const S=__app.App.S;
      const newIds=['griechisches-haehnchen'].concat(__app.App.D.RECIPES.filter(r=>r.cuisines&&!['deutsch'].includes(r.cuisines[0])).slice(0,0));
      const all=S.recipes(); const old=all.filter(r=>r.id.indexOf('c-')!==0);
      // letzte 14 Rezepte = Erweiterung entfernen, Küchen von allen Grundrezepten löschen
      for(const r of old.slice(-14)) await S.delRecipe(r.id);
      for(const r of S.recipes()){ const n=Object.assign({},r); delete n.cuisines; await S.putRecipe(n); }
      S.set('seedVersion',1); S.set('favorites',{'hack-lasagne':true}); S.set('ratings',{'hack-lasagne':5});
      await S.putRecipe({id:'c-mein',name:'Mein Rezept',emoji:'🍽️',veg:true,time:20,diff:'leicht',main:'gemuese',carb:'keine',ings:[['paprika',2]],steps:['x'],custom:true});
      const e=S.recipes().find(r=>r.id==='hack-lasagne'); await S.putRecipe(Object.assign({},e,{name:'Meine Lasagne',edited:true}));
      window.__before=S.recipes().length;}""")
    n0 = pg.evaluate("__before"); pg.reload(); pg.wait_for_selector('.tab')
    n1 = pg.evaluate("__app.App.S.recipes().length")
    check(n1 == n0 + 14, f'14 neue Rezepte ergänzt ({n0} → {n1})')
    check(pg.evaluate("__app.App.S.recipes().find(r=>r.id==='c-mein')!==undefined"), 'eigenes Rezept bleibt')
    check(pg.evaluate("__app.App.S.recipes().find(r=>r.id==='hack-lasagne').name") == 'Meine Lasagne', 'eigene Änderung an Grundrezept bleibt')
    check(pg.evaluate("__app.App.S.recipes().filter(r=>r.base&&!r.cuisines).length") == 0, 'Küchen für alle Grundrezepte nachgetragen')
    check(pg.evaluate("__app.App.S.get('favorites')['hack-lasagne']") is True and pg.evaluate("__app.App.S.get('ratings')['hack-lasagne']") == 5, 'Favoriten/Bewertungen bleiben')
    check(pg.evaluate("__app.App.S.get('seedVersion')") == 2, 'Version aktualisiert')
    check(pg.evaluate("__app.App.S.plans().length") >= 1, 'Wochenpläne bleiben')
    b.close()
print(f'\n{passed} bestanden, {len(fails)} fehlgeschlagen'); sys.exit(1 if fails else 0)
