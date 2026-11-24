# Vienna Car Registry

A community registry of exclusive cars spotted in Vienna. Anyone can browse the photos, members see the full details, and every upload is checked by an admin before it goes public.

The site is plain HTML, CSS and JavaScript (no build step). It runs on GitHub Pages and uses [Supabase](https://supabase.com) for accounts, database and photo storage.

**Setup guide (German): [SETUP.md](SETUP.md)**

## What it does

- Home page, search page and car page in the classic registry layout, with its own look (night blue and Schönbrunn yellow, Josefin Sans and Manrope, pill shapes): floating header, big title with search and numbers, Most Popular, Latest Events, Explore by make and model, category tiles, filters by make, model and colour on the Cars page, photo gallery and Details/Specifics panel on the car page
- Car page with several photos; guests see photos, paint and district, members see the full details with the source of the technical data
- Official manufacturer paint names (for example Rosso Corsa) instead of a bare colour; the colour family is kept for filtering
- Only real photos: there are no generated or demo cars
- Members upload cars (any number of photos, district only, never the exact place, optional production number); there is no separate "add a spot"
- Other members mark a car as spotted (district and date). Everyone who spotted a car, and the uploader, can suggest changes to it
- Verification queue for admins; Pro members are reviewed first; suggested changes also need approval
- Likes, favourites, comments with word filter, warnings and a ban after three, report buttons
- Public profiles with a Dream Garage (3 slots, +1 for every 5 approved uploads), follow, block, private messages, notifications
- Events (admins only), model requests, admin applications (the CEO decides)
- Vienna Archives for Pro members: ex-Viennese cars, visitors from abroad, event cars
- Ranking by approved uploads
- English and German, dark mode (default) and light mode, minimum age 12

## Folder layout

| Path | Purpose |
| --- | --- |
| `index.html` | Entry page |
| `css/styles.css` | All styles |
| `js/config.js` | Your Supabase URL and anon key (fill in once) |
| `js/app.js` | The user interface and routing |
| `js/api.js` | All calls to Supabase |
| `js/art.js` | Colour families, districts and small helpers |
| `supabase/schema.sql` | Tables, access rules, triggers, storage buckets and start data |
| `supabase/update-2-spotted.sql` | Only for databases set up earlier: adds the "spotted" marks |

## Roles

- **Member**: can upload cars, mark cars as spotted, suggest changes to cars they spotted, comment, like, follow, message.
- **Admin**: approves cars, suggested changes and reports, adds events, grants Pro, suspends users.
- **CEO**: everything an admin can, plus decides on admin applications. Set once in the database (see SETUP.md).

## What is not built yet

- Paid Pro subscriptions (Pro is granted by an admin for now)
- Plate blurring
- A native mobile app

## Tested

The database schema and its access rules were run against PostgreSQL 16, and the interface against that database with a stand-in for the Supabase client (upload, review, edit approval, reports, roles, ban, messages, sign-up, light/dark, mobile layout).
The connection to a real Supabase project and the Google and Apple sign-in were not tested. Check these after setup.
