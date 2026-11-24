Lokale Testumgebung (nicht Teil der Website, wird von GitHub Pages nicht gebraucht).

- Lokale Postgres-16-Datenbank (Socket /tmp/pg, Port 54329, DB `vcr`), Neuaufbau mit `reset_db.sh`
- `stubs.sql` bildet die Supabase-Rollen nach (ohne Standardrechte, wie ein neues Projekt)
- `rls_test.sql` prüft Zugriffsregeln und Add-ons ("ALL ADDON TESTS PASSED")
- `h/server.py` ist ein REST-Nachbau mit echten Zugriffsregeln, `h/ui_test1-5.py` sind Playwright-Tests
- `run_all.sh` startet alles; danach `pkill -f "server.py 8765"`

Die Pfade in den Skripten zeigen auf /home/claude/tools; beim Wiederherstellen dorthin kopieren.
