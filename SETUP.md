# Vienna Car Registry – Einrichtung Schritt für Schritt

Die Seite besteht aus zwei Teilen:

- **GitHub Pages** zeigt die Webseite an (die Dateien in diesem Repository).
- **Supabase** ist die Datenbank. Dort liegen Konten, Autos, Fotos und Kommentare.

Beides ist im kostenlosen Tarif nutzbar. Du brauchst keinen eigenen Server und keine Programme auf dem Computer.
Plane etwa 30 Minuten ein.

---

## 1. Supabase-Projekt anlegen

1. Öffne <https://supabase.com> und melde dich an (zum Beispiel mit GitHub).
2. Klicke auf **New project**.
3. Name: `vienna-car-registry`. Wähle ein langes Datenbank-Passwort und speichere es im Passwortmanager.
4. Region: **Frankfurt (eu-central-1)**, damit die Daten in der EU liegen.
5. Warte, bis das Projekt fertig ist (ein bis zwei Minuten).

## 2. Datenbank einrichten

1. Links im Menü: **SQL Editor** → **New query**.
2. Öffne in diesem Repository die Datei `supabase/schema.sql`, kopiere den **ganzen** Inhalt und füge ihn in den Editor ein.
3. Klicke auf **Run**. Es muss „Success“ erscheinen.

Das legt alle Tabellen, die Zugriffsregeln (Row Level Security), die Speicherordner für Fotos und die sieben Start-Modelle an.

> **Offizielle Daten:** Die technischen Daten (Motor, Leistung, Getriebe, Stückzahl) stammen von Herstellerseiten und Pressemitteilungen.
> Die Quelle steht pro Modell in `model_specs.source` und wird Mitgliedern auf der Autoseite angezeigt.
> Für den **Pagani Huayra** habe ich keine offizielle Quelle gefunden. Er hat deshalb keine Daten und keine Lackliste.
> Prüfe die Werte bitte noch einmal, bevor die Seite öffentlich wird. Ändern kannst du sie im **Table Editor** in `model_specs`.
>
> **Offizielle Lacknamen:** In der Tabelle `model_colors` stehen die Herstellernamen der Lacke (zum Beispiel „Rosso Corsa“).
> Die Listen sind nicht vollständig, Sonderlacke und Einzelstücke fehlen. Ergänze sie als Admin unter **Admin → Paints**.
> Die Farbflächen in der Auswahl sind nur Annäherungen, kein Farbmuster des Herstellers.

## 3. Zugangsdaten in die Seite eintragen

1. In Supabase: **Project Settings** (Zahnrad) → **API**.
2. Kopiere die **Project URL** und den **anon public** Key.
3. Öffne in GitHub die Datei `js/config.js` (Stift-Symbol zum Bearbeiten) und ersetze die zwei Platzhalter:

```js
export const SUPABASE_URL = 'https://abcdefgh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...';
```

4. **Commit changes** klicken.

Der anon-Key darf öffentlich sein, die Zugriffsregeln in der Datenbank schützen die Daten.
Den **service_role**-Key trägst du **nie** in die Seite ein.

## 4. Seite mit GitHub Pages veröffentlichen

1. GitHub: Repository → **Settings** → **Pages**.
2. Source: **Deploy from a branch**. Branch: **main**, Ordner: **/ (root)**. **Save**.
3. Nach ein bis zwei Minuten steht oben auf der Seite die Adresse, zum Beispiel `https://alberto76053.github.io/ViennaCarRegistry/`.

Diese Adresse brauchst du im nächsten Schritt genau so.

## 5. Anmeldung mit der Webadresse verbinden

1. Supabase: **Authentication** → **URL Configuration**.
2. **Site URL**: die Adresse aus Schritt 4.
3. **Redirect URLs**: dieselbe Adresse hinzufügen (mit `/` am Ende).
4. Speichern.

Ohne diesen Schritt führen die Bestätigungs-Mails und die Anmeldung mit Google oder Apple ins Leere.

**E-Mail-Bestätigung:** Unter **Authentication → Sign In / Providers → Email** ist „Confirm email“ standardmäßig an.
Neue Nutzer bekommen dann eine Mail und melden sich danach an. Das ist gut gegen Fake-Konten, lass es an.
Der kostenlose Tarif verschickt nur wenige Mails pro Stunde. Für einen größeren Start richte unter **Authentication → SMTP Settings** einen eigenen Mail-Dienst ein.

## 6. Dich selbst zum CEO machen

1. Öffne die Seite und erstelle ein normales Konto (Benutzername und E-Mail, die Mail bestätigen, anmelden).
2. Supabase: **SQL Editor** → **New query**, einfügen und **Run**:

```sql
update public.profiles set role = 'ceo' where username = 'DEIN_BENUTZERNAME';
```

3. Lade die Seite neu. Oben erscheint **Admin**.

Nur der CEO entscheidet über Admin-Bewerbungen. Admins prüfen Autos, Änderungsvorschläge, Meldungen und Modell-Anfragen, tragen Events ein und vergeben Pro.

## 7. Zum Ausprobieren: ein erstes Auto

1. Mit deinem Konto: **Auto hochladen**, Modell wählen, den offiziellen Lack wählen (gibt es für das Modell keine Liste, wählst du eine Farbgruppe), Bezirk und Fotos. Es gibt keine Beispielautos: Das Register ist leer, bis echte Fotos hochgeladen und freigegeben sind.
2. Unter **Admin → Autos** das Auto freigeben.
3. Es erscheint jetzt im Register, auch für Gäste.
4. Mit einem zweiten Konto: Auto öffnen, **Als gespottet markieren**. Danach erscheint **Bearbeiten**, und das Konto kann Änderungen vorschlagen. Ein Admin gibt sie unter **Admin → Änderungen** frei.

### Update: Datenbank schon eingerichtet?

Hast du `schema.sql` früher schon ausgeführt, füge zusätzlich den Inhalt von `supabase/update-2-spotted.sql` im SQL Editor ein und führe ihn aus. Er legt die neue Tabelle für „gespottet"-Markierungen an und trägt bei vorhandenen Autos den Uploader als ersten Spotter ein. Ein frisches Projekt braucht nur `schema.sql`.

---

## Optional: Anmeldung mit Google

1. Google Cloud Console → neues Projekt → **APIs & Services → Credentials → Create credentials → OAuth client ID** (Typ **Web application**).
2. **Authorized redirect URI**: in Supabase unter **Authentication → Sign In / Providers → Google** steht die Callback-URL. Kopiere sie dorthin.
3. Client ID und Secret in Supabase bei Google eintragen und aktivieren.
4. In `js/config.js` ändern: `export const OAUTH_PROVIDERS = ['google'];`

## Optional: Anmeldung mit Apple

Apple verlangt das **Apple Developer Program** (derzeit 99 US-Dollar pro Jahr).
Die Schritte stehen in der Supabase-Anleitung unter **Authentication → Sign In / Providers → Apple**.
Danach: `export const OAUTH_PROVIDERS = ['google', 'apple'];`

---

## Was noch von Hand läuft

- **Pro ist noch nicht bezahlbar.** Es gibt keine Zahlungsanbindung. Du vergibst Pro unter **Admin → People → Give Pro**. Ein Bezahlsystem (zum Beispiel Stripe) wäre ein eigener nächster Schritt.
- **Events** tragen nur Admins ein (Admin → Events).
- **Neue Modelle** kommen über Anfragen von Nutzern. Ein Admin nimmt sie auf (Admin → Model requests). Danach trägst du unter **Admin → Paints** die offiziellen Lacknamen ein und ergänzt in `model_specs` die technischen Daten mit Quelle (`source`).
- **Kennzeichen unkenntlich machen** ist noch nicht gebaut. Es steht als „in Überlegung“ auf der Pro-Seite.
- **Schimpfwortliste:** Die Tabelle `bad_words` enthält nur wenige Beispielwörter. Ergänze deutsche und englische Wörter im Table Editor.

## Datenschutz und Recht (bitte vor dem Start klären)

Die Seite speichert E-Mail-Adressen, Fotos und Nachrichten von Menschen, auch von Kindern ab 12 Jahren.
In Österreich und der EU brauchst du dafür ein **Impressum** und eine **Datenschutzerklärung**.
Fotos von Autos können Kennzeichen und Personen zeigen. Die Meldefunktion „Private Daten sichtbar“ ist dafür gedacht, ersetzt aber keine rechtliche Beratung.
Ich bin kein Anwalt: Lass die Texte prüfen.

## Wenn etwas nicht klappt

- **Seite zeigt „noch nicht mit einer Datenbank verbunden“:** `js/config.js` enthält noch die Platzhalter.
- **Registrierung klappt, aber keine Mail kommt:** Spam-Ordner prüfen, Mail-Limit im kostenlosen Tarif beachten (Schritt 5).
- **„You are not allowed to do that“ beim Hochladen:** Schritt 2 wurde nicht vollständig ausgeführt. Führe `schema.sql` nochmal aus.
- **Fotos erscheinen nicht:** Unter **Storage** müssen die Ordner `spot-photos` und `avatars` existieren und als **Public** markiert sein.
- **Änderungen auf GitHub sind nicht sichtbar:** GitHub Pages braucht ein bis zwei Minuten, dann mit `Strg+Shift+R` neu laden.
