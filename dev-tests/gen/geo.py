# Erzeugt die Seed-Daten für Bundesländer und Bezirke (eine Quelle für schema.sql und update-4)
import unicodedata
def key(n):
    t = n.replace('ä','a').replace('ö','o').replace('ü','u').replace('ß','ss').replace('Ä','A').replace('Ö','O').replace('Ü','U')
    return t.lower()

WIEN = ['Innere Stadt','Leopoldstadt','Landstraße','Wieden','Margareten','Mariahilf','Neubau','Josefstadt','Alsergrund','Favoriten','Simmering','Meidling','Hietzing','Penzing','Rudolfsheim-Fünfhaus','Ottakring','Hernals','Währing','Döbling','Brigittenau','Floridsdorf','Donaustadt','Liesing']

REG = [  # id, Name, aktiv, Startnummer der Bezirks-IDs
 ('wien','Wien',True,0),('noe','Niederösterreich',True,100),('bgld','Burgenland',False,200),('ktn','Kärnten',False,300),
 ('ooe','Oberösterreich',False,400),('sbg','Salzburg',False,500),('stmk','Steiermark',False,600),('tirol','Tirol',False,700),('vbg','Vorarlberg',False,800)]

D = {
 'noe': ['Amstetten','Baden','Bruck an der Leitha','Gänserndorf','Gmünd','Hollabrunn','Horn','Korneuburg','Krems (Land)','Lilienfeld','Melk','Mistelbach','Mödling','Neunkirchen','Scheibbs','St. Pölten (Land)','Tulln','Waidhofen an der Thaya','Wiener Neustadt (Land)','Zwettl',
         'Krems an der Donau (Stadt)','St. Pölten (Stadt)','Waidhofen an der Ybbs (Stadt)','Wiener Neustadt (Stadt)'],
 'bgld': ['Eisenstadt-Umgebung','Güssing','Jennersdorf','Mattersburg','Neusiedl am See','Oberpullendorf','Oberwart','Eisenstadt (Stadt)','Rust (Stadt)'],
 'ktn': ['Feldkirchen','Hermagor','Klagenfurt-Land','Sankt Veit an der Glan','Spittal an der Drau','Villach-Land','Völkermarkt','Wolfsberg','Klagenfurt am Wörthersee (Stadt)','Villach (Stadt)'],
 'ooe': ['Braunau am Inn','Eferding','Freistadt','Gmunden','Grieskirchen','Kirchdorf an der Krems','Linz-Land','Perg','Ried im Innkreis','Rohrbach','Schärding','Steyr-Land','Urfahr-Umgebung','Vöcklabruck','Wels-Land','Linz (Stadt)','Steyr (Stadt)','Wels (Stadt)'],
 'sbg': ['Hallein','Salzburg-Umgebung','St. Johann im Pongau','Tamsweg','Zell am See','Salzburg (Stadt)'],
 'stmk': ['Bruck-Mürzzuschlag','Deutschlandsberg','Graz-Umgebung','Hartberg-Fürstenfeld','Leibnitz','Leoben','Liezen','Murau','Murtal','Südoststeiermark','Voitsberg','Weiz','Graz (Stadt)'],
 'tirol': ['Imst','Innsbruck-Land','Kitzbühel','Kufstein','Landeck','Lienz','Reutte','Schwaz','Innsbruck (Stadt)'],
 'vbg': ['Bludenz','Bregenz','Dornbirn','Feldkirch'],
}
EXPECT = {'noe':24,'bgld':9,'ktn':10,'ooe':18,'sbg':6,'stmk':13,'tirol':9,'vbg':4}
for k,v in EXPECT.items(): assert len(D[k])==v, (k,len(D[k]))
assert len(WIEN)==23
q = lambda s: "'" + s.replace("'","''") + "'"
out = []
out.append("insert into public.regions (id, name, sort, active) values")
out.append(",\n".join(f"  ({q(i)}, {q(n)}, {k+1}, {'true' if a else 'false'})" for k,(i,n,a,_) in enumerate(REG)) + "\non conflict (id) do nothing;\n")
rows = [f"  ({n+1}, 'wien', {q(nm)}, '{1000+(n+1)*10}', {n+1})" for n,nm in enumerate(WIEN)]
for (rid,_,_,base) in REG[1:]:
    names = sorted(D[rid], key=key)
    rows += [f"  ({base+k+1}, {q(rid)}, {q(nm)}, null, {k+1})" for k,nm in enumerate(names)]
out.append("insert into public.districts (id, region_id, name, code, sort) values")
out.append(",\n".join(rows) + "\non conflict (id) do nothing;")
open('/home/claude/tools/gen/geo_seed.sql','w',encoding='utf-8').write("\n".join(out)+"\n")
print(len(rows),'Bezirke,',len(REG),'Bundesländer')
